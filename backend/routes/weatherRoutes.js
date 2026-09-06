const express = require("express");
const router = express.Router();
const cacheMiddleware = require("../middleware/cacheMiddleware");
const {
  getWeather,
  getHourlyForecast,
} = require("../controllers/weatherController");

// TTL: 15 minutes (900 seconds) — weather changes moderately
const WEATHER_TTL = 900;

// GET /api/weather?location=<city>
router.get("/", cacheMiddleware("weather", WEATHER_TTL), getWeather);

// GET /api/weather/hourly?location=<city>
router.get("/hourly", cacheMiddleware("weather-hourly", WEATHER_TTL), getHourlyForecast);

module.exports = router;
