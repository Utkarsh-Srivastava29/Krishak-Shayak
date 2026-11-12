const express = require("express");
const router = express.Router();
const cacheMiddleware = require("../middleware/cacheMiddleware");
const {
  getWeather,
  getHourlyForecast,
  getWeatherInsights,
  proxyOpenWeather,
} = require("../controllers/weatherController");
const { createRateLimiter } = require("../middleware/rateLimiter");

// The proxy is cheap per call but public: 60 burst per IP, 1 per second refill
const owmRateLimiter = createRateLimiter({
  keyPrefix: "rl:owm",
  limits: [{ type: "ip", capacity: 60, refillRate: 1 }],
  identifierExtractor: (req) => ({ ip: req.ip }),
});

// TTL: 15 minutes (900 seconds) — weather changes moderately
const WEATHER_TTL = 900;

// Soil moisture and daily advice move slowly, and this route costs a Gemini call,
// so it is cached hard. A fallback response (Gemini unavailable) gets a short TTL
// instead, so one rate-limited minute does not pin canned tips for hours.
const INSIGHTS_TTL = parseInt(process.env.INSIGHTS_CACHE_TTL || "10800", 10);
const INSIGHTS_FALLBACK_TTL = 7200;

// GET /api/weather?location=<city>
router.get("/", cacheMiddleware("weather", WEATHER_TTL), getWeather);

// GET /api/weather/hourly?location=<city>
router.get("/hourly", cacheMiddleware("weather-hourly", WEATHER_TTL), getHourlyForecast);

// GET /api/weather/insights?location=<city>&lang=<en|hi>
router.get(
  "/insights",
  cacheMiddleware("weather-insights", (data) =>
    data.generated ? INSIGHTS_TTL : INSIGHTS_FALLBACK_TTL
  ),
  getWeatherInsights
);

// GET /api/weather/owm/:endpoint  (geo | current | forecast)
// Server-side OpenWeatherMap access for the browser; 10-minute cache
router.get("/owm/:endpoint", owmRateLimiter, cacheMiddleware("owm", 600), proxyOpenWeather);

module.exports = router;
