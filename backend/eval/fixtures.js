/**
 * Deterministic stand-ins for live APIs, so evaluation runs are repeatable
 * and need only a Gemini key. The same values are given to the judge as the
 * reference facts.
 */
const { canonicalCrop } = require("../services/commodityNames");

const isoDay = (offset, now = new Date()) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  return d.toISOString().slice(0, 10);
};

const day = (offset, minTemp, maxTemp, rainMm, rainChancePct, conditions) => ({
  date: isoDay(offset),
  minTemp,
  maxTemp,
  rainMm,
  rainChancePct,
  maxWindKmh: 12,
  conditions,
});

const WEATHER = {
  etawah: {
    place: { name: "Etawah", state: "Uttar Pradesh", country: "IN", lat: 26.78, lon: 79.02 },
    current: { temp: 24, condition: "haze", humidity: 62, windKmh: 8, rainLastHourMm: 0 },
    daily: [day(0, 14, 26, 0, 10, ["Clear"]), day(1, 15, 23, 14, 80, ["Rain"]), day(2, 13, 24, 3, 45, ["Clouds"]), day(3, 12, 25, 0, 5, ["Clear"]), day(4, 12, 26, 0, 0, ["Clear"])],
  },
  nashik: {
    place: { name: "Nashik", state: "Maharashtra", country: "IN", lat: 20.0, lon: 73.79 },
    current: { temp: 33, condition: "clear sky", humidity: 28, windKmh: 14, rainLastHourMm: 0 },
    daily: [day(0, 18, 34, 0, 0, ["Clear"]), day(1, 19, 36, 0, 0, ["Clear"]), day(2, 19, 36, 0, 5, ["Clear"]), day(3, 18, 35, 0, 0, ["Clear"]), day(4, 18, 34, 0, 0, ["Clear"])],
  },
  ludhiana: {
    place: { name: "Ludhiana", state: "Punjab", country: "IN", lat: 30.9, lon: 75.85 },
    current: { temp: 17, condition: "mist", humidity: 78, windKmh: 6, rainLastHourMm: 0 },
    daily: [day(0, 8, 21, 0, 10, ["Clear"]), day(1, 7, 19, 2, 40, ["Clouds"]), day(2, 6, 16, 22, 85, ["Rain"]), day(3, 5, 17, 4, 50, ["Rain"]), day(4, 5, 19, 0, 10, ["Clear"])],
  },
  raipur: {
    place: { name: "Raipur", state: "Chhattisgarh", country: "IN", lat: 21.25, lon: 81.63 },
    current: { temp: 27, condition: "scattered clouds", humidity: 55, windKmh: 9, rainLastHourMm: 0 },
    daily: [day(0, 17, 29, 0, 15, ["Clouds"]), day(1, 18, 28, 6, 65, ["Rain"]), day(2, 17, 29, 1, 30, ["Clouds"]), day(3, 16, 30, 0, 5, ["Clear"]), day(4, 16, 30, 0, 0, ["Clear"])],
  },
};

const price = (commodity, state, avg, best, cheapest, weeklyChangePct, district = null) => ({
  commodity,
  unit: "INR per quintal",
  marketsReporting: best.length + cheapest.length + 3,
  arrivalDate: isoDay(0),
  averageModalPrice: avg,
  lowestModalPrice: cheapest[cheapest.length - 1].modalPrice,
  highestModalPrice: best[0].modalPrice,
  bestMarkets: best,
  cheapestMarkets: cheapest,
  scope: district ? "district" : "state",
  state,
  district,
  weeklyChange:
    weeklyChangePct === null
      ? undefined
      : {
          fromDate: isoDay(-7),
          fromPrice: Math.round(avg / (1 + weeklyChangePct / 100)),
          toDate: isoDay(0),
          toPrice: avg,
          changePct: weeklyChangePct,
        },
});

const m = (market, district, modalPrice) => ({ market, district, modalPrice, minPrice: modalPrice - 80, maxPrice: modalPrice + 60 });

const PRICES = {
  "uttar pradesh:mustard": price("mustard", "Uttar Pradesh", 5640, [m("Etawah", "Etawah", 5800), m("Kanpur(Grain)", "Kanpur", 5760), m("Agra", "Agra", 5700)], [m("Mainpuri", "Mainpuri", 5450), m("Auraiya", "Auraiya", 5400)], 3.1),
  "uttar pradesh:wheat": price("wheat", "Uttar Pradesh", 2450, [m("Jaswantnagar", "Etawah", 2520), m("Bharthana", "Etawah", 2500), m("Etawah", "Etawah", 2490)], [m("Kannauj", "Kannauj", 2390), m("Hardoi", "Hardoi", 2380)], 1.2),
  "maharashtra:onion": price("onion", "Maharashtra", 1820, [m("Lasalgaon", "Nashik", 2050), m("Pimpalgaon", "Nashik", 1980), m("Pune", "Pune", 1900)], [m("Solapur", "Solapur", 1550), m("Ahmednagar", "Ahmednagar", 1500)], 9.4),
  "maharashtra:tomato": price("tomato", "Maharashtra", 1240, [m("Pune", "Pune", 1500), m("Nashik", "Nashik", 1400), m("Mumbai", "Mumbai", 1380)], [m("Satara", "Satara", 1000), m("Sangli", "Sangli", 950)], -12.5),
  "punjab:paddy": price("paddy", "Punjab", 2320, [m("Khanna", "Ludhiana", 2369), m("Jagraon", "Ludhiana", 2350), m("Rajpura", "Patiala", 2340)], [m("Abohar", "Fazilka", 2250), m("Malout", "Muktsar", 2240)], 0.4),
  "punjab:wheat": price("wheat", "Punjab", 2425, [m("Khanna", "Ludhiana", 2440), m("Ludhiana", "Ludhiana", 2430), m("Moga", "Moga", 2425)], [m("Bathinda", "Bathinda", 2400), m("Mansa", "Mansa", 2395)], null),
  "chhattisgarh:paddy": price("paddy", "Chhattisgarh", 2180, [m("Raipur", "Raipur", 2300), m("Durg", "Durg", 2250), m("Bilaspur", "Bilaspur", 2220)], [m("Kanker", "Kanker", 2100), m("Bastar", "Bastar", 2080)], 0.9),
};

const PRODUCTS = [
  { productId: "eval-p1", name: "Pusa Bold Mustard Seed (1 kg packet)", price: 450, unit: "packet", inStock: 40, seller: "Etawah Agro Store", tags: ["mustard", "seed", "sarson"] },
  { productId: "eval-p2", name: "Knapsack Sprayer 16 L", price: 2499, unit: "piece", inStock: 12, seller: "Kisan Tools", tags: ["sprayer", "knapsack", "spray"] },
  { productId: "eval-p3", name: "Urea 45 kg bag", price: 267, unit: "packet", inStock: 100, seller: "Kisan Seva Kendra", tags: ["urea", "fertilizer", "fertiliser"] },
  { productId: "eval-p4", name: "Battery Sprayer 18 L", price: 3899, unit: "piece", inStock: 5, seller: "Kisan Tools", tags: ["sprayer", "battery"] },
];

const SOIL = {
  etawah: { value: 0.19, unit: "m³/m³", depth: "3-9cm", deeperValue: 0.23, soilTemp: 18, level: "low", fill: 0.38 },
  nashik: { value: 0.16, unit: "m³/m³", depth: "3-9cm", deeperValue: 0.2, soilTemp: 27, level: "low", fill: 0.32 },
  ludhiana: { value: 0.33, unit: "m³/m³", depth: "3-9cm", deeperValue: 0.35, soilTemp: 14, level: "moderate", fill: 0.66 },
  raipur: { value: 0.27, unit: "m³/m³", depth: "3-9cm", deeperValue: 0.29, soilTemp: 22, level: "moderate", fill: 0.54 },
};

const placeKey = (location = "") =>
  Object.keys(WEATHER).find((key) => location.toLowerCase().includes(key)) || null;

const fixtureDeps = {
  weather: {
    getForecast: async (location) => (placeKey(location) ? WEATHER[placeKey(location)] : null),
    geocode: async (location) => (placeKey(location) ? WEATHER[placeKey(location)].place : null),
  },
  soil: { getSoilMoisture: async (lat) => SOIL[Object.keys(WEATHER).find((k) => WEATHER[k].place.lat === lat)] },
  prices: {
    getCropPrices: async ({ commodity, state }) => {
      const key = `${(state || "").toLowerCase().trim()}:${canonicalCrop(commodity)}`;
      const entry = PRICES[key];
      if (!entry) return null;
      const { weeklyChange, ...rest } = entry;
      return rest;
    },
  },
  priceTrend: async (commodity, state) => PRICES[`${state.toLowerCase()}:${commodity}`]?.weeklyChange || null,
  products: async ({ query = "", maxPrice }) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const products = PRODUCTS.filter(
      (p) =>
        (!maxPrice || p.price <= maxPrice) &&
        words.some((w) => p.tags.some((t) => t.includes(w) || w.includes(t)) || p.name.toLowerCase().includes(w))
    ).map(({ tags, ...p }) => p);
    return { products };
  },
};

/** Reference facts for the judge, for one persona's location and crops. */
const referenceFacts = (persona) => {
  const district = persona.memories.find((x) => x.key === "district")?.value;
  const state = persona.memories.find((x) => x.key === "state")?.value;
  const crops = persona.memories.filter((x) => x.key === "crop").map((x) => x.value);
  return {
    weather: district ? WEATHER[district] : null,
    prices: crops.map((c) => PRICES[`${state}:${c}`]).filter(Boolean),
    soil: district ? SOIL[district] : null,
    products: PRODUCTS.map(({ tags, ...p }) => p),
  };
};

module.exports = { fixtureDeps, referenceFacts, WEATHER, PRICES, PRODUCTS, isoDay };
