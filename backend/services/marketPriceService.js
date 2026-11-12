const axios = require("axios");
const { getCache, setCache } = require("../config/redisClient");
const { recordMatchesCommodity, canonicalCrop } = require("./commodityNames");

const DATA_GOV_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const CACHE_TTL_SECONDS = 30 * 60;

const apiKey = () =>
  process.env.DATA_GOV_API_KEY ||
  "579b464db66ec23bdd00000193b99a55112f47fa73efacc0606e14af";

const titleCase = (text = "") =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Raw mandi records for a state (and optionally district), cached. */
const fetchMandiRecords = async ({ state, district }) => {
  const cacheKey = `agent:mandi:${state}:${district || "*"}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const params = {
    "api-key": apiKey(),
    format: "json",
    limit: 10000,
    "filters[state.keyword]": titleCase(state),
  };
  if (district) params["filters[district]"] = titleCase(district);

  const { data } = await axios.get(
    `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`,
    { params, timeout: 15000 }
  );
  const records = data.records || [];
  await setCache(cacheKey, records, CACHE_TTL_SECONDS);
  return records;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Summarise mandi records for one crop: price range across markets and the
 * cheapest/dearest markets. Prices are ₹ per quintal, as published.
 */
const summarizePrices = (records, commodity) => {
  const matching = records.filter((r) => recordMatchesCommodity(r.commodity, commodity));
  if (matching.length === 0) return null;

  const rows = matching
    .map((r) => ({
      market: r.market,
      district: r.district,
      variety: r.variety,
      arrivalDate: r.arrival_date,
      minPrice: toNumber(r.min_price),
      maxPrice: toNumber(r.max_price),
      modalPrice: toNumber(r.modal_price),
    }))
    .filter((r) => r.modalPrice !== null);

  if (rows.length === 0) return null;

  const modal = rows.map((r) => r.modalPrice);
  const sorted = [...rows].sort((a, b) => b.modalPrice - a.modalPrice);

  return {
    commodity: canonicalCrop(commodity),
    unit: "INR per quintal",
    marketsReporting: rows.length,
    arrivalDate: rows[0].arrivalDate,
    averageModalPrice: Math.round(modal.reduce((a, b) => a + b, 0) / modal.length),
    lowestModalPrice: Math.min(...modal),
    highestModalPrice: Math.max(...modal),
    bestMarkets: sorted.slice(0, 3),
    cheapestMarkets: sorted.slice(-2).reverse(),
  };
};

/**
 * Today's mandi prices for a crop in a state/district. Falls back from the
 * district to the whole state when the district reports nothing.
 */
const getCropPrices = async ({ commodity, state, district }) => {
  let records = district ? await fetchMandiRecords({ state, district }) : [];
  let summary = district ? summarizePrices(records, commodity) : null;
  let scope = district ? "district" : "state";

  if (!summary) {
    records = await fetchMandiRecords({ state });
    summary = summarizePrices(records, commodity);
    scope = "state";
  }

  return summary ? { ...summary, scope, state: titleCase(state), district: district ? titleCase(district) : null } : null;
};

module.exports = { fetchMandiRecords, summarizePrices, getCropPrices, titleCase };
