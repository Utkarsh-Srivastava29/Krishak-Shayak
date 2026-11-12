const axios = require("axios");

const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";

const apiKey = () => process.env.OPENWEATHER_API_KEY;

/**
 * Resolve a place name ("Etawah", "Kanpur, UP") to coordinates.
 * Returns null when OpenWeatherMap does not know the place.
 */
const geocode = async (location) => {
  const { data } = await axios.get(GEO_URL, {
    params: { q: location, limit: 1, appid: apiKey() },
    timeout: 10000,
  });
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon, name, state, country } = data[0];
  return { lat, lon, name, state, country };
};

/**
 * Collapse OpenWeatherMap's 3-hourly forecast into one line per day:
 * min/max temperature, total rain and the highest chance of rain.
 */
const summarizeForecast = (list = []) => {
  const days = new Map();
  for (const slot of list) {
    const date = (slot.dt_txt || "").slice(0, 10) ||
      new Date(slot.dt * 1000).toISOString().slice(0, 10);
    const day = days.get(date) || {
      date,
      minTemp: Infinity,
      maxTemp: -Infinity,
      rainMm: 0,
      maxRainChance: 0,
      conditions: new Set(),
      maxWindKmh: 0,
    };
    day.minTemp = Math.min(day.minTemp, slot.main?.temp_min ?? slot.main?.temp);
    day.maxTemp = Math.max(day.maxTemp, slot.main?.temp_max ?? slot.main?.temp);
    day.rainMm += slot.rain?.["3h"] || 0;
    day.maxRainChance = Math.max(day.maxRainChance, slot.pop || 0);
    day.maxWindKmh = Math.max(day.maxWindKmh, (slot.wind?.speed || 0) * 3.6);
    if (slot.weather?.[0]?.main) day.conditions.add(slot.weather[0].main);
    days.set(date, day);
  }

  return [...days.values()].map((day) => ({
    date: day.date,
    minTemp: Math.round(day.minTemp),
    maxTemp: Math.round(day.maxTemp),
    rainMm: Math.round(day.rainMm * 10) / 10,
    rainChancePct: Math.round(day.maxRainChance * 100),
    maxWindKmh: Math.round(day.maxWindKmh),
    conditions: [...day.conditions],
  }));
};

/**
 * Current conditions plus a 5-day daily summary for a place.
 */
const getForecast = async (location) => {
  const place = await geocode(location);
  if (!place) return null;

  const params = { lat: place.lat, lon: place.lon, units: "metric", appid: apiKey() };
  const [current, forecast] = await Promise.all([
    axios.get(`${BASE_URL}/weather`, { params, timeout: 10000 }),
    axios.get(`${BASE_URL}/forecast`, { params, timeout: 10000 }),
  ]);

  return {
    place,
    current: {
      temp: Math.round(current.data.main.temp),
      condition: current.data.weather?.[0]?.description,
      humidity: current.data.main.humidity,
      windKmh: Math.round((current.data.wind?.speed || 0) * 3.6),
      rainLastHourMm: current.data.rain ? current.data.rain["1h"] : 0,
    },
    daily: summarizeForecast(forecast.data.list),
  };
};

module.exports = { geocode, getForecast, summarizeForecast };
