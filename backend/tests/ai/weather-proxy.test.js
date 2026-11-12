require("./_setup");
const test = require("node:test");
const assert = require("node:assert/strict");
const { proxyOpenWeather, _owmParams: owmParams } = require("../../controllers/weatherController");

const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

test("OpenWeather proxy whitelists parameters and never forwards an appid", () => {
  assert.deepEqual(owmParams("geo", { q: " Etawah ", limit: "9", appid: "attacker" }), { q: "Etawah", limit: 5 });
  assert.deepEqual(owmParams("forecast", { lat: "26.7", lon: "79.0", units: "imperial", appid: "x" }), { lat: 26.7, lon: 79, units: "metric" });
  assert.equal(owmParams("geo", { q: "" }), null);
  assert.equal(owmParams("geo", { q: "x".repeat(101) }), null);
  assert.equal(owmParams("current", { lat: "91", lon: "0" }), null);
  assert.equal(owmParams("current", { lat: "abc", lon: "0" }), null);
});

test("OpenWeather proxy rejects unknown endpoints and bad queries before any network call", async () => {
  const unknown = fakeRes();
  await proxyOpenWeather({ params: { endpoint: "onecall" }, query: {} }, unknown);
  assert.equal(unknown.statusCode, 404);
  const bad = fakeRes();
  await proxyOpenWeather({ params: { endpoint: "current" }, query: { lat: "x" } }, bad);
  assert.equal(bad.statusCode, 400);
});
