/**
 * Crop recommendations grounded in live data:
 *   - season:      crop calendar (data/cropCalendar.json) vs current month  [hard filter]
 *   - temperature: OpenWeatherMap 5-day forecast vs the crop's comfortable range
 *   - water:       Open-Meteo soil moisture + forecast rain + farmer's irrigation
 *   - region/soil: crop's main growing states, farmer's soil type (from memory)
 *   - market:      today's data.gov.in (Agmarknet) mandi price, shown, not scored
 *
 * Reasons are returned as codes + params so the UI can render them in Hindi
 * or English; scoring is a pure function so it is easy to test.
 */
const { crops: CROPS } = require("../data/cropCalendar.json");

const WEIGHTS = { season: 35, temperature: 25, water: 20, region: 15, soil: 5 };
const LEVEL = { low: 0, medium: 1, high: 2 };
const SOIL_LEVEL = { low: 0, moderate: 1, high: 2 };

// Farmers often describe soil in Hindi
const SOIL_ALIASES = [
  ["black", ["black", "kali", "kaali", "काली", "regur", "cotton soil"]],
  ["clay loam", ["clay loam", "chikni domat", "चिकनी दोमट"]],
  ["sandy loam", ["sandy loam", "balui domat", "बलुई दोमट"]],
  ["loam", ["loam", "domat", "dumat", "दोमट"]],
  ["clay", ["clay", "chikni", "चिकनी"]],
  ["sandy", ["sandy", "balui", "reti", "रेतीली", "बलुई"]],
  ["red", ["red", "lal", "लाल"]],
  ["alluvial", ["alluvial", "jalodh", "जलोढ़", "kachhar"]],
];

const normalizeSoil = (text = "") => {
  const t = text.toString().toLowerCase();
  for (const [soil, aliases] of SOIL_ALIASES) {
    if (aliases.some((a) => t.includes(a))) return soil;
  }
  return null;
};

/** 2 = reliably irrigated, 0 = explicitly rain-fed, null = unknown */
const irrigationLevel = (text = "") => {
  const t = text.toString().toLowerCase();
  if (!t) return null;
  if (/rain[- ]?fed|barani|no irrigation|none|without|बारानी|वर्षा/.test(t)) return 0;
  if (/tube|bore|canal|well|drip|sprinkler|pump|irrigat|nahar|नहर|ट्यूबवेल|कुआं/.test(t)) return 2;
  return null;
};

const sameState = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Average daily mean temperature and total rain over the forecast. */
const summarizeConditions = (daily = []) => {
  if (!daily.length) return { avgTemp: null, rainMm: 0, days: 0 };
  const means = daily.map((d) => (d.minTemp + d.maxTemp) / 2);
  return {
    avgTemp: Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 10) / 10,
    rainMm: Math.round(daily.reduce((s, d) => s + (d.rainMm || 0), 0) * 10) / 10,
    days: daily.length,
  };
};

/**
 * Pure scoring. Returns crops that can be sown this month or next, best first.
 *
 * @param {object} c
 * @param {number} c.month          1-12
 * @param {number|null} c.avgTemp   °C, forecast average
 * @param {number} c.rainMm         forecast rain total
 * @param {string|null} c.soilMoisture  "low" | "moderate" | "high"
 * @param {object} [c.profile]      { state, irrigation, soil_type, crops }
 * @param {string} [c.state]        overrides profile.state (from geocoding)
 */
const scoreCrops = ({ month, avgTemp, rainMm = 0, soilMoisture = null, profile = {}, state }, crops = CROPS) => {
  const farmState = state || profile.state || null;
  const soilType = normalizeSoil(profile.soil_type);
  const irrigated = irrigationLevel(profile.irrigation);
  const nextMonth = (month % 12) + 1;
  const grows = new Set((profile.crops || []).map((c) => c.toString().toLowerCase()));

  // Water available to the crop: irrigation beats everything; otherwise soil
  // moisture, raised one step by meaningful forecast rain.
  let available;
  if (irrigated === 2) available = 2;
  else {
    available = soilMoisture in SOIL_LEVEL ? SOIL_LEVEL[soilMoisture] : 1;
    if (rainMm >= 25) available = Math.min(2, available + 1);
    if (irrigated === 0) available = Math.min(available, 1); // rain-fed: never "reliably wet"
  }

  const results = [];
  for (const crop of crops) {
    const reasons = [];
    let score = 0;

    // Season (hard filter)
    if (crop.sowingMonths.includes(month)) {
      score += WEIGHTS.season;
      reasons.push({ code: "sow_now", params: { season: crop.season } });
    } else if (crop.sowingMonths.includes(nextMonth)) {
      score += WEIGHTS.season * 0.6;
      reasons.push({ code: "sow_next_month", params: { season: crop.season } });
    } else {
      continue;
    }

    // Temperature
    const [lo, hi] = crop.tempC;
    if (avgTemp === null || avgTemp === undefined) {
      score += WEIGHTS.temperature / 2;
    } else if (avgTemp >= lo && avgTemp <= hi) {
      score += WEIGHTS.temperature;
      reasons.push({ code: "temp_ok", params: { avgTemp, min: lo, max: hi } });
    } else {
      const gap = avgTemp < lo ? lo - avgTemp : avgTemp - hi;
      score += Math.max(0, WEIGHTS.temperature - 4 * gap);
      reasons.push({ code: avgTemp < lo ? "temp_cool" : "temp_hot", params: { avgTemp, min: lo, max: hi } });
    }

    // Water
    const deficit = LEVEL[crop.water] - available;
    if (deficit <= 0) {
      score += WEIGHTS.water;
      reasons.push({ code: "water_ok", params: { need: crop.water } });
    } else if (deficit === 1) {
      score += WEIGHTS.water / 2;
      reasons.push({ code: "water_needs_irrigation", params: { need: crop.water } });
    } else {
      reasons.push({ code: "water_short", params: { need: crop.water } });
    }

    // Region
    if (farmState) {
      const major = crop.states.some((s) => sameState(s, farmState));
      score += major ? WEIGHTS.region : WEIGHTS.region / 3;
      if (major) reasons.push({ code: "region_major", params: { state: farmState } });
    } else {
      score += WEIGHTS.region / 2;
    }

    // Soil
    if (soilType) {
      const match = crop.soils.includes(soilType);
      if (match) {
        score += WEIGHTS.soil;
        reasons.push({ code: "soil_match", params: { soil: soilType } });
      } else {
        reasons.push({ code: "soil_mismatch", params: { soil: soilType } });
      }
    } else {
      score += WEIGHTS.soil / 2;
    }

    if (grows.has(crop.key)) reasons.push({ code: "you_grow", params: {} });

    results.push({
      crop: crop.key,
      nameEn: crop.en,
      nameHi: crop.hi,
      season: crop.season,
      durationDays: crop.durationDays,
      water: crop.water,
      sowNow: crop.sowingMonths.includes(month),
      score: Math.round(score),
      reasons,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.durationDays[0] - b.durationDays[0]);
};

/**
 * Gather live data and score crops.
 * @param {object} o
 * @param {string} o.location
 * @param {object} [o.profile]   farmer profile from memory
 * @param {number} [o.month]     defaults to the current month in IST
 * @param {number} [o.limit]
 * @param {object} [o.deps]      { weather, soil, prices } — same shape the agent
 *                               tools use, so evaluation fixtures work here too
 * @returns {Promise<object|null>} null when the place is unknown
 */
const getCropRecommendations = async ({ location, profile = {}, month, limit = 5, deps = {} }) => {
  const weather = deps.weather || require("./weatherService");
  const soil = deps.soil || require("./soilMoistureService");
  const prices = deps.prices || require("./marketPriceService");

  const forecast = await weather.getForecast(location);
  if (!forecast) return null;
  const { place } = forecast;

  const currentMonth =
    month || Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", month: "numeric" }));

  let soilMoisture = null;
  try {
    soilMoisture = await soil.getSoilMoisture(place.lat, place.lon);
  } catch (err) {
    console.warn("[CROPS] Soil moisture unavailable:", err.message);
  }

  const conditions = summarizeConditions(forecast.daily);
  const state = place.state || profile.state || null;
  const ranked = scoreCrops({
    month: currentMonth,
    avgTemp: conditions.avgTemp,
    rainMm: conditions.rainMm,
    soilMoisture: soilMoisture?.level || null,
    profile,
    state,
  }).slice(0, limit);

  // Today's mandi price for each recommended crop (context, not a score)
  const withPrices = await Promise.all(
    ranked.map(async (r) => {
      if (!state) return { ...r, mandi: null };
      try {
        const p = await prices.getCropPrices({ commodity: r.crop, state, district: profile.district });
        return {
          ...r,
          mandi: p
            ? { averageModalPrice: p.averageModalPrice, highestModalPrice: p.highestModalPrice, arrivalDate: p.arrivalDate, marketsReporting: p.marketsReporting, unit: p.unit }
            : null,
        };
      } catch {
        return { ...r, mandi: null };
      }
    })
  );

  return {
    location: { name: place.name, state, country: place.country },
    month: currentMonth,
    conditions: {
      avgTemp: conditions.avgTemp,
      rainNext5DaysMm: conditions.rainMm,
      soilMoisture: soilMoisture?.level || null,
      currentTemp: forecast.current?.temp ?? null,
    },
    personalisedWith: Object.fromEntries(
      Object.entries({ state: profile.state, irrigation: profile.irrigation, soil: profile.soil_type }).filter(([, v]) => v)
    ),
    recommendations: withPrices,
    sources: ["OpenWeatherMap", "Open-Meteo", "data.gov.in (Agmarknet)", "ICAR crop calendar"],
  };
};

module.exports = { scoreCrops, getCropRecommendations, summarizeConditions, normalizeSoil, irrigationLevel, CROPS, WEIGHTS };
