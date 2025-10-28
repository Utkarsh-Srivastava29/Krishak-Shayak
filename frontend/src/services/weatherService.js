import axios from "axios";

// Replace with your actual API key from OpenWeatherMap
const API_KEY =
  import.meta.env.VITE_WEATHER_API_KEY || "97a99a6978e3f046029de9c4a8a54795";
const BASE_URL = `${
  import.meta.env.VITE_WEATHER_BASE_URL || "https://api.openweathermap.org"
}/data/2.5`;

// Function to fetch current weather and forecast data
export const getWeatherData = async (location) => {
  console.log(`Fetching weather data for ${location}...`);

  try {
    // Get coordinates from location name
    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        location
      )}&limit=1&appid=${API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      throw new Error("Location not found");
    }

    const { lat, lon, name, country } = geoResponse.data[0];

    // Get current weather
    const currentResponse = await axios.get(
      `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Get 5-day forecast
    const forecastResponse = await axios.get(
      `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Format the response data
    const currentWeather = {
      location: `${name}, ${country}`,
      current: {
        temp: Math.round(currentResponse.data.main.temp),
        condition: currentResponse.data.weather[0].main,
        description: currentResponse.data.weather[0].description,
        icon: getWeatherIcon(currentResponse.data.weather[0].id),
        humidity: currentResponse.data.main.humidity,
        windSpeed: Math.round(currentResponse.data.wind.speed * 3.6), // Convert m/s to km/h
        feelsLike: Math.round(currentResponse.data.main.feels_like),
        pressure: currentResponse.data.main.pressure,
        visibility: currentResponse.data.visibility / 1000,
        uvIndex: 0, // Will be updated if available
        precipitation: currentResponse.data.rain
          ? currentResponse.data.rain["1h"]
          : 0,
      },
      forecast: processForecastData(forecastResponse.data.list),
    };

    return currentWeather;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
};

// Function to fetch hourly forecast
export const getHourlyForecast = async (location) => {
  console.log(`Fetching hourly forecast for ${location}...`);

  try {
    // Get coordinates from location name
    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        location
      )}&limit=1&appid=${API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      throw new Error("Location not found");
    }

    const { lat, lon } = geoResponse.data[0];

    // Get hourly forecast
    const response = await axios.get(
      `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Process 3-hourly data (OpenWeatherMap free tier provides 3-hour intervals)
    // Take only 8 intervals to cover 24 hours (8 × 3 = 24 hours)
    return response.data.list.slice(0, 8).map((item) => {
      const date = new Date(item.dt * 1000);
      return {
        time: date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        temp: Math.round(item.main.temp),
        feelsLike: Math.round(item.main.feels_like),
        condition: item.weather[0].main,
        description: item.weather[0].description,
        icon: getWeatherIcon(item.weather[0].id),
        precipitation: item.rain ? item.rain["3h"] : 0,
        precipProbability: Math.round(item.pop * 100),
        humidity: item.main.humidity,
        windSpeed: Math.round(item.wind.speed * 3.6), // Convert m/s to km/h
        windDeg: item.wind.deg || 0,
        pressure: item.main.pressure,
        visibility: item.visibility ? item.visibility / 1000 : null, // Convert to km
        cloudiness: item.clouds ? item.clouds.all : 0,
        timestamp: item.dt,
        // Compute if it's daytime based on the hour
        isDaytime: date.getHours() >= 6 && date.getHours() < 19,
      };
    });
  } catch (error) {
    console.error("Error fetching hourly forecast:", error);
    throw error;
  }
};

// Function to fetch extended forecast for 5+ days
export const getExtendedForecast = async (location) => {
  console.log(`Fetching extended forecast for ${location}...`);

  try {
    // Get coordinates from location name
    const geoResponse = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        location
      )}&limit=1&appid=${API_KEY}`
    );

    if (!geoResponse.data || geoResponse.data.length === 0) {
      throw new Error("Location not found");
    }

    const { lat, lon } = geoResponse.data[0];

    // For extended forecast, we'll use the One Call API which provides 7-day forecast
    // Note: This requires a paid subscription, so we'll mock days 6+ for the free tier
    const response = await axios.get(
      `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );

    // Process the 5-day forecast from the API
    const fiveDayForecast = processDailyForecastData(response.data.list);

    // For demo purposes, extend to 10 days by duplicating with slight variations
    const extendedDays = [...fiveDayForecast];

    // If you need more than 5 days, simulate the rest
    if (fiveDayForecast.length < 15) {
      // For days 6-15, create simulated data based on the patterns from days 1-5
      for (let i = fiveDayForecast.length; i < 15; i++) {
        const baseDay = fiveDayForecast[i % fiveDayForecast.length];
        const day = new Date();
        day.setDate(day.getDate() + i);

        extendedDays.push({
          day: day.toLocaleDateString("en-US", { weekday: "short" }),
          date: day.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          temp: Math.round(baseDay.temp + (Math.random() * 4 - 2)),
          maxTemp: Math.round(baseDay.maxTemp + (Math.random() * 4 - 2)),
          minTemp: Math.round(baseDay.minTemp + (Math.random() * 4 - 2)),
          condition: baseDay.condition,
          icon: baseDay.icon,
          humidity: Math.min(
            100,
            Math.max(30, baseDay.humidity + Math.round(Math.random() * 20 - 10))
          ),
          windSpeed: Math.max(
            0,
            baseDay.windSpeed + Math.round(Math.random() * 10 - 5)
          ),
          precipitation: Math.max(
            0,
            baseDay.precipitation + (Math.random() * 5 - 2.5)
          ),
          precipProbability: Math.min(
            100,
            Math.max(
              0,
              baseDay.precipProbability + Math.round(Math.random() * 30 - 15)
            )
          ),
        });
      }
    }

    return extendedDays;
  } catch (error) {
    console.error("Error fetching extended forecast:", error);
    throw error;
  }
};

// Process forecast data to get daily forecasts
function processForecastData(forecastList) {
  const dailyData = {};

  forecastList.forEach((item) => {
    const date = new Date(item.dt * 1000).toLocaleDateString();

    if (!dailyData[date]) {
      dailyData[date] = {
        temps: [],
        conditions: [],
        humidity: [],
        windSpeed: [],
        icon: [],
        date: date,
      };
    }

    dailyData[date].temps.push(item.main.temp);
    dailyData[date].conditions.push(item.weather[0].main);
    dailyData[date].humidity.push(item.main.humidity);
    dailyData[date].windSpeed.push(item.wind.speed * 3.6); // Convert m/s to km/h
    dailyData[date].icon.push(item.weather[0].id);
  });

  return Object.values(dailyData).map((day) => {
    // Get the most frequent condition and icon
    const modeCondition = mode(day.conditions);
    const modeIcon = getWeatherIcon(mode(day.icon));

    return {
      date: formatDateToWeekday(new Date(day.date)),
      maxTemp: Math.round(Math.max(...day.temps)),
      minTemp: Math.round(Math.min(...day.temps)),
      condition: modeCondition,
      humidity: Math.round(average(day.humidity)),
      windSpeed: Math.round(average(day.windSpeed)),
      icon: modeIcon,
    };
  });
}

// Process daily forecast data
function processDailyForecastData(forecastList) {
  const dailyData = {};

  forecastList.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const dateStr = date.toLocaleDateString();

    if (!dailyData[dateStr]) {
      dailyData[dateStr] = {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        temps: [],
        maxTemp: -100,
        minTemp: 100,
        conditions: [],
        icons: [],
        humidity: [],
        windSpeed: [],
        precipitation: [],
        pop: [], // Probability of precipitation
      };
    }

    // Update max and min temperatures
    dailyData[dateStr].maxTemp = Math.max(
      dailyData[dateStr].maxTemp,
      item.main.temp_max
    );
    dailyData[dateStr].minTemp = Math.min(
      dailyData[dateStr].minTemp,
      item.main.temp_min
    );

    dailyData[dateStr].temps.push(item.main.temp);
    dailyData[dateStr].conditions.push(item.weather[0].main);
    dailyData[dateStr].icons.push(item.weather[0].id);
    dailyData[dateStr].humidity.push(item.main.humidity);
    dailyData[dateStr].windSpeed.push(item.wind.speed * 3.6);
    dailyData[dateStr].precipitation.push(item.rain ? item.rain["3h"] || 0 : 0);
    dailyData[dateStr].pop.push(item.pop || 0);
  });

  return Object.values(dailyData).map((day) => {
    // Calculate the average temperature
    const avgTemp = average(day.temps);

    // Get the most frequent condition and icon
    const modeCondition = mode(day.conditions);
    const modeIcon = mode(day.icons);

    return {
      day: day.day,
      date: day.date,
      temp: Math.round(avgTemp),
      maxTemp: Math.round(day.maxTemp),
      minTemp: Math.round(day.minTemp),
      condition: modeCondition,
      icon: getWeatherIcon(modeIcon),
      humidity: Math.round(average(day.humidity)),
      windSpeed: Math.round(average(day.windSpeed)),
      precipitation: parseFloat(average(day.precipitation).toFixed(1)),
      precipProbability: Math.round(Math.max(...day.pop) * 100),
    };
  });
}

// Helper function to get mode (most frequent value) in array
function mode(array) {
  if (array.length === 0) return null;

  const modeMap = {};
  let maxCount = 0;
  let modeValue;

  array.forEach((value) => {
    if (!modeMap[value]) modeMap[value] = 0;
    modeMap[value]++;

    if (modeMap[value] > maxCount) {
      maxCount = modeMap[value];
      modeValue = value;
    }
  });

  return modeValue;
}

// Helper function to calculate average
function average(array) {
  if (array.length === 0) return 0;
  const sum = array.reduce((total, val) => total + val, 0);
  return sum / array.length;
}

// Helper function to format date to weekday
function formatDateToWeekday(date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
}

// Map weather condition codes to emoji icons
function getWeatherIcon(conditionCode) {
  // Map condition codes to appropriate emojis
  if (conditionCode >= 200 && conditionCode < 300) return "⛈️"; // Thunderstorm
  if (conditionCode >= 300 && conditionCode < 400) return "🌧️"; // Drizzle
  if (conditionCode >= 500 && conditionCode < 600) return "🌧️"; // Rain
  if (conditionCode >= 600 && conditionCode < 700) return "❄️"; // Snow
  if (conditionCode >= 700 && conditionCode < 800) return "🌫️"; // Atmosphere (fog, mist, etc.)
  if (conditionCode === 800) return "☀️"; // Clear
  if (conditionCode === 801) return "🌤️"; // Few clouds
  if (conditionCode === 802) return "⛅"; // Scattered clouds
  if (conditionCode >= 803) return "☁️"; // Broken/overcast clouds

  return "🌈"; // Default
}

// Agricultural tips based on weather data
export const getAgricultureTips = (weatherData) => {
  const tips = [];

  // Based on temperature
  if (weatherData.current.temp > 30) {
    tips.push("Ensure adequate irrigation for crops due to high temperatures.");
    tips.push("Consider providing shade for sensitive seedlings.");
  } else if (weatherData.current.temp < 15) {
    tips.push("Protect frost-sensitive crops with covers.");
    tips.push("Delay planting of warm-season crops until temperatures rise.");
  }

  // Based on forecast
  const rainyDaysForecast = weatherData.forecast.filter(
    (day) =>
      day.condition.toLowerCase().includes("rain") ||
      day.condition.toLowerCase().includes("shower") ||
      day.condition.toLowerCase().includes("drizzle") ||
      day.condition.toLowerCase().includes("thunderstorm")
  );

  if (rainyDaysForecast.length > 2) {
    tips.push(
      "Expected rainfall in coming days - delay fertilizer application."
    );
    tips.push("Ensure proper drainage in fields to prevent waterlogging.");
  } else if (rainyDaysForecast.length === 0) {
    tips.push("No rain expected soon - ensure adequate irrigation.");
  }

  // Based on humidity
  if (weatherData.current.humidity > 80) {
    tips.push(
      "High humidity levels increase risk of fungal diseases. Monitor crops closely."
    );
    tips.push(
      "Ensure good air circulation around plants to reduce disease pressure."
    );
  } else if (weatherData.current.humidity < 40) {
    tips.push(
      "Low humidity may increase water loss. Consider more frequent irrigation."
    );
  }

  // Based on wind
  if (weatherData.current.windSpeed > 25) {
    tips.push(
      "High winds expected - secure young plants and provide windbreaks if possible."
    );
  }

  // General tips
  tips.push("Monitor soil moisture regularly for optimal crop health.");
  tips.push("Consider mulching to conserve soil moisture and control weeds.");

  return tips;
};

// Function to get location suggestions based on input
export const getSuggestedCities = async (input) => {
  if (!input || input.length < 2) return [];

  try {
    const response = await axios.get(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        input
      )}&limit=5&appid=${API_KEY}`
    );

    return response.data.map((city) => {
      // Format as "City, Country"
      return `${city.name}, ${city.country}`;
    });
  } catch (error) {
    console.error("Error fetching city suggestions:", error);
    return [];
  }
};

// Calculate soil moisture index based on weather data
export const calculateSoilMoistureIndex = (weatherData) => {
  // Base value from humidity
  let moistureIndex = weatherData.current.humidity / 100;

  // Adjust based on recent rainfall
  const rainyDays = weatherData.forecast
    .slice(0, 3)
    .filter(
      (day) =>
        day.condition.toLowerCase().includes("rain") ||
        day.condition.toLowerCase().includes("shower") ||
        day.condition.toLowerCase().includes("drizzle") ||
        day.condition.toLowerCase().includes("thunder")
    ).length;

  moistureIndex += rainyDays * 0.1;

  // Reduce for high temperatures
  if (weatherData.current.temp > 35) {
    moistureIndex -= 0.15;
  } else if (weatherData.current.temp > 30) {
    moistureIndex -= 0.1;
  }

  // Ensure within bounds
  return Math.max(0, Math.min(moistureIndex, 1));
};

// Implementation for getting more detailed hourly forecast
// This is an alternative implementation that you could use
export const getDetailedHourlyForecast = async (location) => {
  try {
    // Make sure to request hourly data with 1-hour intervals
    // This may vary depending on which weather API you're using
    const response = await fetch(
      `YOUR_API_ENDPOINT?location=${encodeURIComponent(
        location
      )}&hourly=true&interval=1`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch hourly forecast");
    }

    const data = await response.json();

    // Process the API response into hourly intervals
    // If your API already returns hourly data, you might not need this processing
    const processedData = processHourlyData(data);

    return processedData;
  } catch (error) {
    console.error("Error fetching detailed hourly forecast:", error);
    throw error;
  }
};

// Helper function to process API data into consistent hourly format
const processHourlyData = (apiData) => {
  // This will depend on your API's response format
  // The goal is to ensure you have entries for each hour, not every 3 hours

  // Example of what this might look like:
  const hourlyData = [];

  // Assuming apiData has some sort of hourly array
  for (let i = 0; i < 24; i++) {
    const hour = {
      time: formatHourTime(
        apiData.hourly[i].time || new Date().setHours(new Date().getHours() + i)
      ),
      timestamp:
        apiData.hourly[i].timestamp ||
        Math.floor(new Date().setHours(new Date().getHours() + i) / 1000),
      icon: getWeatherIcon(apiData.hourly[i].condition || "clear"),
      temp: apiData.hourly[i].temp || "N/A",
      condition: apiData.hourly[i].condition || "No data",
      precipProbability: apiData.hourly[i].precipProbability || 0,
      windSpeed: apiData.hourly[i].windSpeed || "N/A",
      humidity: apiData.hourly[i].humidity || "N/A",
      feelsLike: apiData.hourly[i].feelsLike || "N/A",
    };

    hourlyData.push(hour);
  }

  return hourlyData;
};

// Helper to format hour display
const formatHourTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
