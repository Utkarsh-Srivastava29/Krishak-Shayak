const axios = require("axios");
const { Type } = require("@google/genai");
const {
  getGeminiClient,
  isGeminiConfigured,
  MODEL,
} = require("../services/geminiClient");
const { getSoilMoisture } = require("../services/soilMoistureService");

const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

// @desc    Get current weather + 5-day forecast for a location
// @route   GET /api/weather?location=<city>
// @access  Public
exports.getWeather = async (req, res) => {
  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({ message: "Location query parameter is required" });
    }

    // Step 1: Geocode the location
    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    const { lat, lon, name, country } = geoResponse.data[0];

    // Step 2: Get current weather
    const currentResponse = await axios.get(
      `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Step 3: Get 5-day forecast
    const forecastResponse = await axios.get(
      `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Format response
    const weatherData = {
      location: `${name}, ${country}`,
      current: {
        temp: Math.round(currentResponse.data.main.temp),
        condition: currentResponse.data.weather[0].main,
        description: currentResponse.data.weather[0].description,
        icon: currentResponse.data.weather[0].id,
        humidity: currentResponse.data.main.humidity,
        windSpeed: Math.round(currentResponse.data.wind.speed * 3.6),
        feelsLike: Math.round(currentResponse.data.main.feels_like),
        pressure: currentResponse.data.main.pressure,
        visibility: currentResponse.data.visibility / 1000,
        precipitation: currentResponse.data.rain
          ? currentResponse.data.rain["1h"]
          : 0,
      },
      forecast: forecastResponse.data.list,
    };

    res.json(weatherData);
  } catch (error) {
    console.error("Weather API error:", error.message);
    res.status(500).json({ message: "Failed to fetch weather data", error: error.message });
  }
};

// @desc    Get hourly forecast for a location
// @route   GET /api/weather/hourly?location=<city>
// @access  Public
exports.getHourlyForecast = async (req, res) => {
  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({ message: "Location query parameter is required" });
    }

    // Geocode
    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    const { lat, lon } = geoResponse.data[0];

    // Get forecast (3-hour intervals)
    const response = await axios.get(
      `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Return first 8 intervals (24 hours)
    const hourlyData = response.data.list.slice(0, 8).map((item) => {
      const date = new Date(item.dt * 1000);
      return {
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        temp: Math.round(item.main.temp),
        feelsLike: Math.round(item.main.feels_like),
        condition: item.weather[0].main,
        description: item.weather[0].description,
        icon: item.weather[0].id,
        precipitation: item.rain ? item.rain["3h"] : 0,
        precipProbability: Math.round(item.pop * 100),
        humidity: item.main.humidity,
        windSpeed: Math.round(item.wind.speed * 3.6),
        windDeg: item.wind.deg || 0,
        pressure: item.main.pressure,
        visibility: item.visibility ? item.visibility / 1000 : null,
        cloudiness: item.clouds ? item.clouds.all : 0,
        timestamp: item.dt,
        isDaytime: date.getHours() >= 6 && date.getHours() < 19,
      };
    });

    res.json(hourlyData);
  } catch (error) {
    console.error("Hourly forecast API error:", error.message);
    res.status(500).json({ message: "Failed to fetch hourly forecast", error: error.message });
  }
};

// Fallback used when Gemini is unconfigured or fails, so the panel is never empty.
const basicTips = (current, soil) => {
  const tips = [];
  if (soil.level === "low") {
    tips.push("Soil is dry in the root zone — irrigate before the crop shows stress.");
  } else if (soil.level === "high") {
    tips.push("Soil is wet — hold off irrigating and check that fields drain freely.");
  } else {
    tips.push("Root-zone moisture is in a good range — keep to your normal irrigation schedule.");
  }
  if (current.temp > 35) {
    tips.push("Irrigate early morning or evening to cut evaporation losses in this heat.");
  }
  if (current.humidity > 80) {
    tips.push("High humidity raises fungal disease risk — scout leaves for early spots.");
  }
  tips.push("Mulch bare soil to hold moisture and keep weeds down.");
  return tips;
};

// @desc    Real soil moisture plus weather-specific farming advice
// @route   GET /api/weather/insights?location=<city>&lang=<en|hi>
// @access  Public
exports.getWeatherInsights = async (req, res) => {
  try {
    const { location, lang } = req.query;

    if (!location) {
      return res.status(400).json({ message: "Location query parameter is required" });
    }

    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    const { lat, lon, name, country, state } = geoResponse.data[0];

    const [currentResponse, soil] = await Promise.all([
      axios.get(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
      getSoilMoisture(lat, lon),
    ]);

    const current = {
      temp: Math.round(currentResponse.data.main.temp),
      condition: currentResponse.data.weather[0].description,
      humidity: currentResponse.data.main.humidity,
      windSpeed: Math.round(currentResponse.data.wind.speed * 3.6),
      rain1h: currentResponse.data.rain ? currentResponse.data.rain["1h"] : 0,
    };

    let tips;
    let generated = false;

    if (isGeminiConfigured()) {
      try {
        const language = lang === "hi" ? "Hindi (हिन्दी)" : "English";
        const place = [name, state, country].filter(Boolean).join(", ");
        const month = new Date().toLocaleDateString("en-IN", { month: "long" });

        const result = await getGeminiClient().models.generateContent({
          model: MODEL,
          contents: `Location: ${place}
Month: ${month}
Air temperature: ${current.temp}°C
Conditions: ${current.condition}
Humidity: ${current.humidity}%
Wind: ${current.windSpeed} km/h
Rain in last hour: ${current.rain1h} mm
Root-zone soil moisture (3-9cm): ${soil.value} m³/m³ (${soil.level})
Soil temperature at 6cm: ${soil.soilTemp ?? "unknown"}°C

Give this farmer their advice for today.`,
          config: {
            systemInstruction: `You advise Indian farmers on field work for the day ahead, using real measurements supplied by the app.

Write 3 to 5 tips. Each tip must:
- Act on the specific numbers given, not generic farming wisdom. Refer to the actual conditions.
- Be something the farmer can do today or this week.
- Be one sentence, under 20 words, in plain language for a farmer reading on a phone.
- Be written in ${language}.

Base soil advice on the measured soil moisture, not on humidity — they are different things. Consider what crops are typically in the field in this region this month. Do not invent rainfall, prices, or scheme names. Do not repeat the same advice twice.`,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["tips"],
            },
            // Thinking tokens count against maxOutputTokens on 2.5 models and
            // starve the answer; this task is advice, not reasoning.
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 1024,
          },
        });

        const parsed = JSON.parse(result.text);
        if (Array.isArray(parsed.tips) && parsed.tips.length) {
          tips = parsed.tips.slice(0, 5);
          generated = true;
        }
      } catch (error) {
        console.error("Weather insights: Gemini failed:", error.message);
      }
    }

    if (!tips) tips = basicTips(current, soil);

    res.json({
      location: `${name}, ${country}`,
      soilMoisture: soil,
      tips,
      generated,
    });
  } catch (error) {
    console.error("Weather insights error:", error.message);
    res.status(500).json({
      message: "Failed to build weather insights",
      error: error.message,
    });
  }
};

// ---------------------------------------------------------------------------
// OpenWeatherMap proxy: lets the frontend keep its existing response shapes
// without shipping the API key in the browser bundle. Only three upstream
// endpoints and a fixed set of parameters are allowed.
// ---------------------------------------------------------------------------
const OWM_ENDPOINTS = {
  geo: "https://api.openweathermap.org/geo/1.0/direct",
  current: `${BASE_URL}/weather`,
  forecast: `${BASE_URL}/forecast`,
};

/** Validate and whitelist query params; returns null if invalid. */
const owmParams = (endpoint, query) => {
  if (endpoint === "geo") {
    const q = typeof query.q === "string" ? query.q.trim() : "";
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 1, 1), 5);
    return q && q.length <= 100 ? { q, limit } : null;
  }
  const lat = Number(query.lat);
  const lon = Number(query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, units: "metric" };
};

// @route   GET /api/weather/owm/:endpoint   (geo | current | forecast)
// @access  Public, rate-limited and cached
exports.proxyOpenWeather = async (req, res) => {
  const url = OWM_ENDPOINTS[req.params.endpoint];
  if (!url) return res.status(404).json({ message: "Unknown weather endpoint" });
  const params = owmParams(req.params.endpoint, req.query);
  if (!params) return res.status(400).json({ message: "Invalid weather query" });
  if (!process.env.OPENWEATHER_API_KEY) {
    return res.status(503).json({ message: "Weather is not configured on the server" });
  }
  try {
    const { data } = await axios.get(url, {
      params: { ...params, appid: process.env.OPENWEATHER_API_KEY },
      timeout: 10000,
    });
    res.json(data);
  } catch (error) {
    const status = error.response?.status;
    console.error(`OpenWeather proxy (${req.params.endpoint}) error:`, error.message);
    // Pass through "not found"; hide upstream auth/quota details
    res.status(status === 404 ? 404 : 502).json({ message: "Weather service unavailable" });
  }
};

exports._owmParams = owmParams; // for tests
