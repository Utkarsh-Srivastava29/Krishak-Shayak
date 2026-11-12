require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { verifyQstashSignature } = require("../../jobs/qstashVerify");
const { buildAlertCandidates, pickAlert } = require("../../alerts/alertRules");
const { computeTrend } = require("../../alerts/priceHistory");
const { summarizeForecast } = require("../../services/weatherService");
const { resolveCommodity, recordMatchesCommodity } = require("../../services/commodityNames");
const { summarizePrices } = require("../../services/marketPriceService");
const { ruleChecks } = require("../../eval/judge");

const DAY = 24 * 60 * 60 * 1000;

const qstashToken = (key, claims) => {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const payload = enc(claims);
  const sig = crypto.createHmac("sha256", key).update(`${head}.${payload}`).digest("base64url");
  return `${head}.${payload}.${sig}`;
};

test("QStash signatures: valid, rotated key, tampered body, expired, wrong URL", () => {
  const body = Buffer.from('{"hello":"world"}');
  const now = 1_800_000_000_000;
  const claims = {
    iss: "Upstash",
    sub: "https://api.example.com/api/jobs/proactive-alerts",
    exp: now / 1000 + 300,
    nbf: now / 1000 - 1,
    body: crypto.createHash("sha256").update(body).digest("base64url"),
  };
  const keys = ["current-key", "next-key"];

  assert.equal(verifyQstashSignature(qstashToken("current-key", claims), body, { keys, now }).iss, "Upstash");
  assert.ok(verifyQstashSignature(qstashToken("next-key", claims), body, { keys, now }));
  assert.throws(() => verifyQstashSignature(qstashToken("other", claims), body, { keys, now }), /Invalid QStash signature/);
  assert.throws(() => verifyQstashSignature(qstashToken("current-key", claims), Buffer.from("{}"), { keys, now }), /body hash/);
  assert.throws(() => verifyQstashSignature(qstashToken("current-key", claims), body, { keys, now: now + 600000 }), /expired/);
  assert.throws(
    () => verifyQstashSignature(qstashToken("current-key", claims), body, { keys, now, url: "https://evil.example/api/jobs/x" }),
    /different URL/
  );
  assert.throws(() => verifyQstashSignature(undefined, body, { keys }), /Missing/);
});

test("rain before a planned spray is the top alert", () => {
  const now = new Date("2026-11-12T06:00:00Z");
  const candidates = buildAlertCandidates({
    now,
    profile: { crops: ["mustard"] },
    daily: [
      { date: "2026-11-12", minTemp: 14, maxTemp: 26, rainMm: 0, rainChancePct: 10 },
      { date: "2026-11-13", minTemp: 15, maxTemp: 23, rainMm: 14, rainChancePct: 80 },
    ],
    episodes: [{ text: "Plan to spray insecticide on mustard", isPlanned: true, eventDate: new Date(now.getTime() + DAY) }],
    priceTrends: [{ commodity: "mustard", state: "Uttar Pradesh", changePct: 9.5, fromPrice: 5150, toPrice: 5640, toDate: "2026-11-12" }],
  });
  assert.equal(candidates[0].type, "spray_rain");
  assert.match(candidates[0].message, /Postpone the planned spray/);
  assert.ok(candidates.some((c) => c.type === "price_move"));
});

test("alerts already sent are skipped; nothing relevant means no alert", () => {
  const candidates = [
    { type: "spray_rain", dedupeKey: "spray_rain:2026-11-13", priority: 90 },
    { type: "price_move", dedupeKey: "price_move:mustard:2026-11-12", priority: 65 },
  ];
  assert.equal(pickAlert(candidates, new Set(["spray_rain:2026-11-13"])).type, "price_move");
  assert.equal(buildAlertCandidates({ daily: [], episodes: [] }).length, 0);
});

test("price moves only alert for crops the farmer grows", () => {
  const trend = { commodity: "onion", state: "Maharashtra", changePct: 15, fromPrice: 1500, toPrice: 1725, toDate: "x" };
  assert.equal(buildAlertCandidates({ profile: { crops: ["wheat"] }, priceTrends: [trend] }).length, 0);
  assert.equal(buildAlertCandidates({ profile: { crops: ["onion"] }, priceTrends: [trend] }).length, 1);
});

test("weekly price trend from stored snapshots", () => {
  const trend = computeTrend([
    { date: "2026-11-12", averageModalPrice: 1100 },
    { date: "2026-11-11", averageModalPrice: 1080 },
    { date: "2026-11-05", averageModalPrice: 1000 },
  ]);
  assert.equal(trend.changePct, 10);
  assert.equal(trend.fromDate, "2026-11-05");
  assert.equal(computeTrend([{ date: "2026-11-12", averageModalPrice: 1 }]), null);
});

test("3-hourly forecast is summarised per day", () => {
  const slot = (dt, temp, rain, pop) => ({ dt_txt: dt, main: { temp, temp_min: temp, temp_max: temp }, rain: { "3h": rain }, pop, wind: { speed: 2 }, weather: [{ main: rain ? "Rain" : "Clear" }] });
  const days = summarizeForecast([
    slot("2026-11-13 06:00:00", 15, 0, 0.1),
    slot("2026-11-13 09:00:00", 22, 4.2, 0.7),
    slot("2026-11-13 12:00:00", 24, 3.1, 0.9),
    slot("2026-11-14 06:00:00", 13, 0, 0),
  ]);
  assert.equal(days.length, 2);
  assert.deepEqual(
    { min: days[0].minTemp, max: days[0].maxTemp, rain: days[0].rainMm, chance: days[0].rainChancePct },
    { min: 15, max: 24, rain: 7.3, chance: 90 }
  );
});

test("farmer crop names resolve to mandi commodities", () => {
  assert.equal(resolveCommodity("gehun").canonical, "wheat");
  assert.equal(resolveCommodity("सरसों").canonical, "mustard");
  assert.equal(recordMatchesCommodity("Paddy(Dhan)(Common)", "dhan"), true);
  assert.equal(recordMatchesCommodity("Bengal Gram(Gram)(Whole)", "chana"), true);
  assert.equal(recordMatchesCommodity("Wheat", "rice"), false);
  // Whole-word matching and exclusions (live Agmarknet names)
  assert.equal(recordMatchesCommodity("Turnip", "arhar"), false);
  assert.equal(recordMatchesCommodity("Turmeric", "tur"), false);
  assert.equal(recordMatchesCommodity("Red gram/Arhar/Tur(whole)", "tur"), true);
  assert.equal(recordMatchesCommodity("Pegeon Pea(Arhar Fali)", "arhar"), false);
  assert.equal(recordMatchesCommodity("Green Gram(Moong)(Whole)", "chana"), false);
  assert.equal(recordMatchesCommodity("Black Gram(Urd Beans)(Whole)", "urad"), true);
  assert.equal(recordMatchesCommodity("Black Gram Dal(Urd Dal)", "urad"), false);
  assert.equal(recordMatchesCommodity("Bengal Gram Dal(Chana Dal)", "chana dal"), true);
  assert.equal(recordMatchesCommodity("Bengal Gram(Gram)(Whole)", "chana dal"), false);
  assert.equal(recordMatchesCommodity("Sweet Potato", "aloo"), false);
  assert.equal(recordMatchesCommodity("Onion Green", "onion"), false);
  assert.equal(recordMatchesCommodity("Paddy(Basmati)", "dhan"), false);
  assert.equal(recordMatchesCommodity("Paddy(Basmati)", "basmati"), true);
  assert.equal(recordMatchesCommodity("Mustard Oil", "sarson"), false);
});

test("mandi records are summarised for the requested crop only", () => {
  const summary = summarizePrices(
    [
      { commodity: "Wheat", market: "Etawah", district: "Etawah", modal_price: "2490", min_price: "2400", max_price: "2550", arrival_date: "12/11/2026" },
      { commodity: "Wheat", market: "Kannauj", district: "Kannauj", modal_price: "2390", min_price: "2300", max_price: "2450", arrival_date: "12/11/2026" },
      { commodity: "Potato", market: "Agra", district: "Agra", modal_price: "900" },
    ],
    "gehun"
  );
  assert.equal(summary.marketsReporting, 2);
  assert.equal(summary.averageModalPrice, 2440);
  assert.equal(summary.bestMarkets[0].market, "Etawah");
});

test("evaluation rule checks: tool recall and keyword hits", () => {
  const checks = ruleChecks(
    { expectedTools: ["get_mandi_prices", "get_weather_forecast"], mustMention: [["rain"], ["₹", "price"]] },
    { text: "Rain tomorrow; price is ₹2,450.", toolCalls: [{ name: "get_mandi_prices" }], steps: 2 }
  );
  assert.equal(checks.toolRecall, 0.5);
  assert.equal(checks.keywordHit, 1);
});
