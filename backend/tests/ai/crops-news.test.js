require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  scoreCrops,
  getCropRecommendations,
  summarizeConditions,
  normalizeSoil,
  irrigationLevel,
  CROPS,
} = require("../../services/cropRecommendationService");
const { toolSpecs } = require("../../agent/tools");
const { translateToHindi, translateFields } = require("../../services/translationService");
const { getAgriNews } = require("../../services/newsService");
const { fixtureDeps } = require("../../eval/fixtures");

const byCrop = (list) => Object.fromEntries(list.map((r) => [r.crop, r]));

// --- Crop calendar data -----------------------------------------------------

test("crop calendar entries are complete and every crop has a Hindi name", () => {
  const keys = new Set();
  for (const c of CROPS) {
    assert.ok(!keys.has(c.key), `duplicate ${c.key}`);
    keys.add(c.key);
    assert.match(c.hi, /[ऀ-ॿ]/, `${c.key} Hindi name`);
    assert.ok(c.sowingMonths.length && c.sowingMonths.every((m) => m >= 1 && m <= 12));
    assert.ok(c.tempC[0] < c.tempC[1]);
    assert.ok(["low", "medium", "high"].includes(c.water));
  }
});

// --- Scoring ------------------------------------------------------------------

test("season is a hard filter: November never recommends kharif-only crops", () => {
  const crops = byCrop(scoreCrops({ month: 11, avgTemp: 19, rainMm: 0, soilMoisture: "moderate" }));
  assert.ok(crops.wheat && crops.mustard && crops.gram);
  for (const kharif of ["paddy", "bajra", "soyabean", "cotton", "arhar"]) assert.equal(crops[kharif], undefined, kharif);
});

test("crops sowable next month rank as 'sow_next_month', below sow-now equivalents", () => {
  // Mustard sows Sep-Nov; in August it is next-month
  const aug = byCrop(scoreCrops({ month: 8, avgTemp: 22, soilMoisture: "moderate" }));
  assert.equal(aug.mustard.sowNow, false);
  assert.ok(aug.mustard.reasons.some((r) => r.code === "sow_next_month"));
});

test("December wraps to January for next-month sowing", () => {
  const dec = byCrop(scoreCrops({ month: 12, avgTemp: 18, soilMoisture: "moderate" }));
  assert.ok(dec.groundnut, "groundnut sows in January");
  assert.equal(dec.groundnut.sowNow, false);
});

test("temperature outside the crop's range lowers the score with a reason", () => {
  const warm = byCrop(scoreCrops({ month: 11, avgTemp: 32, soilMoisture: "moderate" }));
  const mild = byCrop(scoreCrops({ month: 11, avgTemp: 18, soilMoisture: "moderate" }));
  assert.ok(warm.wheat.score < mild.wheat.score);
  assert.ok(warm.wheat.reasons.some((r) => r.code === "temp_hot"));
  assert.ok(mild.wheat.reasons.some((r) => r.code === "temp_ok"));
});

test("dry rain-fed field prefers low-water crops; irrigation lifts wheat", () => {
  const dry = { month: 11, avgTemp: 19, rainMm: 5, soilMoisture: "low", state: "Uttar Pradesh" };
  const rainfed = byCrop(scoreCrops({ ...dry, profile: { irrigation: "rainfed" } }));
  const tubewell = byCrop(scoreCrops({ ...dry, profile: { irrigation: "tubewell" } }));
  assert.ok(rainfed.mustard.score > rainfed.wheat.score);
  assert.ok(rainfed.wheat.reasons.some((r) => r.code === "water_needs_irrigation"));
  assert.ok(tubewell.wheat.score > rainfed.wheat.score);
  assert.ok(tubewell.wheat.reasons.some((r) => r.code === "water_ok"));
});

test("unknown irrigation is neutral but flags crops that need more water than the soil holds", () => {
  const r = byCrop(scoreCrops({ month: 11, avgTemp: 18, rainMm: 0, soilMoisture: "low", state: "Punjab" }));
  assert.equal(scoreCrops({ month: 11, avgTemp: 18, rainMm: 0, soilMoisture: "low", state: "Punjab" })[0].crop, "wheat");
  assert.ok(r.wheat.reasons.some((x) => x.code === "water_needs_irrigation"));
  assert.ok(r.barley.reasons.some((x) => x.code === "water_ok"));
});

test("region and soil personalise the ranking", () => {
  const base = { month: 11, avgTemp: 20, soilMoisture: "moderate" };
  const up = byCrop(scoreCrops({ ...base, state: "Uttar Pradesh" }));
  const kerala = byCrop(scoreCrops({ ...base, state: "Kerala" }));
  assert.ok(up.wheat.score > kerala.wheat.score);
  assert.ok(up.wheat.reasons.some((r) => r.code === "region_major"));

  const black = byCrop(scoreCrops({ ...base, profile: { soil_type: "kali mitti" } }));
  assert.ok(black.gram.reasons.some((r) => r.code === "soil_match"));
  assert.ok(black.potato.reasons.some((r) => r.code === "soil_mismatch"));
});

test("crops the farmer already grows are flagged", () => {
  const r = byCrop(scoreCrops({ month: 11, avgTemp: 20, profile: { crops: ["mustard"] } }));
  assert.ok(r.mustard.reasons.some((x) => x.code === "you_grow"));
});

test("soil and irrigation parsing understands Hindi words", () => {
  assert.equal(normalizeSoil("दोमट मिट्टी"), "loam");
  assert.equal(normalizeSoil("balui domat"), "sandy loam");
  assert.equal(normalizeSoil("काली मिट्टी"), "black");
  assert.equal(normalizeSoil("unknown"), null);
  assert.equal(irrigationLevel("नहर"), 2);
  assert.equal(irrigationLevel("rain-fed, no borewell"), 0);
  assert.equal(irrigationLevel(""), null);
});

test("summarizeConditions averages daily means and totals rain", () => {
  assert.deepEqual(summarizeConditions([{ minTemp: 10, maxTemp: 20, rainMm: 2 }, { minTemp: 14, maxTemp: 26, rainMm: 3.5 }]), { avgTemp: 17.5, rainMm: 5.5, days: 2 });
  assert.equal(summarizeConditions([]).avgTemp, null);
});

// --- Live-data pipeline with evaluation fixtures -----------------------------

test("getCropRecommendations combines forecast, soil moisture and mandi prices", async () => {
  const r = await getCropRecommendations({ location: "Etawah", month: 11, limit: 5, deps: fixtureDeps });
  assert.equal(r.location.state, "Uttar Pradesh");
  assert.equal(r.conditions.soilMoisture, "low");
  assert.equal(r.recommendations.length, 5);
  const crops = byCrop(r.recommendations);
  assert.equal(crops.wheat.mandi.averageModalPrice, 2450); // from the data.gov.in fixture
  assert.equal(crops.potato.mandi, null); // no fixture price -> null, not a guess
  assert.ok(r.sources.includes("OpenWeatherMap"));
  assert.equal(await getCropRecommendations({ location: "Atlantis", deps: fixtureDeps }), null);
});

test("recommend_crops agent tool uses the farmer's saved district and returns reason codes", async () => {
  const spec = toolSpecs.recommend_crops;
  assert.ok(spec && !spec.confirm, "read-only tool");
  const result = await spec.handler({}, { profile: { district: "Etawah", irrigation: "tubewell" }, deps: fixtureDeps });
  assert.ok(result.recommendations.length >= 1 && result.recommendations.length <= 4);
  assert.ok(result.recommendations.every((x) => x.reasons.every((code) => typeof code === "string")));
  assert.equal(result.personalisedWith.irrigation, "tubewell");
  assert.match((await spec.handler({}, { profile: {} })).error, /Location unknown/);
});

// --- Hindi translation --------------------------------------------------------

test("translation keeps order, skips empty and already-Hindi text", async () => {
  const seen = [];
  const translate = async (texts) => { seen.push(...texts); return texts.map((t) => `हि:${t}`); };
  const r = await translateToHindi(["Crop insurance", "", "पहले से हिंदी", "Soil card"], { translate });
  assert.deepEqual(r.texts, ["हि:Crop insurance", "", "पहले से हिंदी", "हि:Soil card"]);
  assert.equal(r.translated, true);
  assert.deepEqual(seen, ["Crop insurance", "Soil card"]);
});

test("translation failure returns English and marks items untranslated", async () => {
  const original = console.error;
  console.error = () => {};
  const items = await translateFields(
    [{ name: "PM-KISAN", benefits: "₹6,000 per year" }],
    ["name", "benefits"],
    { translate: async () => { throw new Error("quota"); } }
  );
  console.error = original;
  assert.deepEqual(items[0], { name: "PM-KISAN", benefits: "₹6,000 per year", translated: false });
  const bad = await translateToHindi(["a b", "c d"], { translate: async () => ["only one"] });
  assert.equal(bad.translated, false);
});

// --- News -------------------------------------------------------------------

const article = (id, title, language = "en") => ({ article_id: id, title, description: `About ${title}`, link: `https://n.example/${id}`, source_id: "src", pubDate: "2026-11-12 06:30:00", language });
const fakeHttp = (byLang) => ({
  get: async (url, { params }) => {
    assert.ok(params.apikey, "API key sent from the server");
    return { data: { status: "success", results: byLang[params.language] || [] } };
  },
});

test("news needs a server-side key", async () => {
  const saved = process.env.NEWSDATA_API_KEY;
  delete process.env.NEWSDATA_API_KEY;
  await assert.rejects(getAgriNews({ lang: "en", http: fakeHttp({}) }), (e) => e.statusCode === 503);
  process.env.NEWSDATA_API_KEY = saved;
});

test("English news is normalised and de-duplicated", async () => {
  process.env.NEWSDATA_API_KEY = "test";
  const r = await getAgriNews({ lang: "en", http: fakeHttp({ en: [article("1", "Wheat MSP raised"), article("2", "Wheat MSP raised!"), article("3", "Monsoon update")] }) });
  assert.deepEqual(r.items.map((i) => i.title), ["Wheat MSP raised", "Monsoon update"]);
  assert.equal(r.items[0].date, "2026-11-12T06:30:00.000Z");
});

test("Hindi news uses native Hindi articles when there are enough", async () => {
  process.env.NEWSDATA_API_KEY = "test";
  const hi = [article("h1", "गेहूं की बुवाई", "hi"), article("h2", "मंडी भाव", "hi"), article("h3", "किसान योजना", "hi")];
  const r = await getAgriNews({ lang: "hi", http: fakeHttp({ hi }), translate: async () => assert.fail("should not translate") });
  assert.equal(r.items.length, 3);
  assert.ok(r.items.every((i) => i.language === "hi" && !i.translatedFrom));
});

test("Hindi news tops up with translated English headlines", async () => {
  process.env.NEWSDATA_API_KEY = "test";
  const r = await getAgriNews({
    lang: "hi",
    http: fakeHttp({ hi: [article("h1", "गेहूं की बुवाई", "hi")], en: [article("e1", "Rain alert"), article("e2", "Onion prices rise")] }),
    translate: async (texts) => texts.map((t) => `अनुवाद: ${t}`),
  });
  assert.equal(r.items.length, 3);
  const translated = r.items.filter((i) => i.translatedFrom === "en");
  assert.equal(translated.length, 2);
  assert.match(translated[0].title, /^अनुवाद: /);
});
