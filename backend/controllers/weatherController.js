const axios = require("axios");

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
