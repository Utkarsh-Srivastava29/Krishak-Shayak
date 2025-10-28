import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  getWeatherData,
  getAgricultureTips,
  getHourlyForecast,
  getSuggestedCities,
  getExtendedForecast,
  calculateSoilMoistureIndex,
} from "../services/weatherService";

const Weather = () => {
  const [location, setLocation] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [hourlyData, setHourlyData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tips, setTips] = useState([]);
  const [soilMoisture, setSoilMoisture] = useState(0.5);
  const [showHourlyForecast, setShowHourlyForecast] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [forecastDays, setForecastDays] = useState(5);
  const [extendedForecast, setExtendedForecast] = useState([]);

  useEffect(() => {
    const fetchWeather = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Default to Delhi if no location is set
        const data = await getWeatherData("Delhi, IN");
        setWeatherData(data);

        // Fetch hourly forecast data
        const hourlyForecastData = await getHourlyForecast("Delhi, IN");
        setHourlyData(hourlyForecastData);

        // Fetch extended forecast data
        const extendedForecastData = await getExtendedForecast("Delhi, IN");
        setExtendedForecast(extendedForecastData);

        // Generate agricultural tips based on weather data
        const agricultureTips = getAgricultureTips(data);
        setTips(agricultureTips);

        // Calculate and set soil moisture index
        const soilMoistureIndex = calculateSoilMoistureIndex(data);
        setSoilMoisture(soilMoistureIndex);
      } catch (err) {
        console.error("Failed to fetch weather data:", err);
        setError("Unable to load weather data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeather();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!location.trim()) {
      setError("Please enter a location");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try with original input
      const data = await getWeatherData(location);
      setWeatherData(data);

      // Fetch hourly forecast data for the new location
      const hourlyForecastData = await getHourlyForecast(location);
      setHourlyData(hourlyForecastData);

      // Fetch extended forecast data for the new location
      const extendedForecastData = await getExtendedForecast(location);
      setExtendedForecast(extendedForecastData);

      // Generate agricultural tips based on new weather data
      const agricultureTips = getAgricultureTips(data);
      setTips(agricultureTips);

      // Calculate and set soil moisture index
      const soilMoistureIndex = calculateSoilMoistureIndex(data);
      setSoilMoisture(soilMoistureIndex);
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
      // More helpful error message
      setError(
        `Weather data not found for "${location}". Try adding a country code (e.g., "Delhi, IN" for Delhi, India).`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Add these functions to predict soil moisture
  const calculateSoilMoistureIndex = (weatherData) => {
    // Simple prediction model based on recent rainfall and temperature
    const { current, forecast } = weatherData;

    // Base value from humidity
    let moistureIndex = current.humidity / 100;

    // Adjust based on recent rainfall patterns
    const rainyDays = forecast
      .slice(0, 3)
      .filter(
        (day) =>
          day.condition.toLowerCase().includes("rain") ||
          day.condition.toLowerCase().includes("shower") ||
          day.condition.toLowerCase().includes("drizzle")
      ).length;

    moistureIndex += rainyDays * 0.1;

    // Reduce for high temperatures
    if (current.temp > 35) {
      moistureIndex -= 0.15;
    } else if (current.temp > 30) {
      moistureIndex -= 0.1;
    }

    // Ensure within bounds
    return Math.max(0, Math.min(moistureIndex, 1));
  };

  // Function to toggle hourly forecast visibility
  const toggleHourlyForecast = () => {
    setShowHourlyForecast(!showHourlyForecast);
  };

  // Function to handle forecast days slider change
  const handleForecastDaysChange = (e) => {
    setForecastDays(parseInt(e.target.value));
  };

  // Update your handleLocationChange function
  const handleLocationChange = async (e) => {
    const inputValue = e.target.value;
    setLocation(inputValue);

    if (inputValue.length >= 2) {
      try {
        // Get city suggestions from API
        const citySuggestions = await getSuggestedCities(inputValue);
        setSuggestions(citySuggestions);
        setShowSuggestions(citySuggestions.length > 0);
      } catch (err) {
        console.error("Failed to fetch city suggestions:", err);
        setShowSuggestions(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Weather Forecast
        </h1>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <form onSubmit={handleSearch} className="flex">
            <input
              type="text"
              placeholder="Enter location (e.g., Delhi, IN)"
              className="flex-grow px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={location}
              onChange={handleLocationChange}
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-r-lg hover:bg-green-700 transition"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading
                </span>
              ) : (
                "Search"
              )}
            </button>
          </form>
          {error && <p className="text-red-600 mt-2 text-sm">{error}</p>}

          {/* Location Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="bg-white rounded-lg shadow-md mt-2 max-h-60 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="p-2 cursor-pointer hover:bg-green-50"
                    onClick={() => {
                      setLocation(suggestion);
                      setShowSuggestions(false);
                      const mockEvent = { preventDefault: () => {} };
                      handleSearch(mockEvent);
                    }}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Popular Cities Quick Selection */}
        <div className="max-w-md mx-auto mb-8">
          <p className="text-center text-sm text-gray-600 mb-2">
            Popular Cities:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Delhi, IN",
              "Mumbai, IN",
              "Kolkata, IN",
              "Chennai, IN",
              "Bangalore, IN",
            ].map((city) => (
              <button
                key={city}
                onClick={() => {
                  setLocation(city);
                  const mockEvent = { preventDefault: () => {} };
                  handleSearch(mockEvent);
                }}
                className="text-sm bg-white border border-gray-300 rounded-full px-3 py-1 hover:bg-green-50 hover:border-green-400 transition"
              >
                {city.split(",")[0]}
              </button>
            ))}
          </div>
        </div>

        {isLoading && !weatherData ? (
          <div className="flex justify-center my-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
          weatherData && (
            <div>
              {/* Current Weather */}
              <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {weatherData.location}
                    </h2>
                    <p className="text-gray-600">Current Weather</p>
                  </div>
                  <div className="text-5xl mt-4 md:mt-0">
                    {weatherData.current.icon}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between">
                  <div>
                    <p className="text-4xl font-bold text-gray-800">
                      {weatherData.current.temp}°C
                    </p>
                    <p className="text-gray-600">
                      {weatherData.current.description}
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <p className="text-gray-600">
                      Feels like: {weatherData.current.feelsLike}°C
                    </p>
                    <p className="text-gray-600">
                      Humidity: {weatherData.current.humidity}%
                    </p>
                    <p className="text-gray-600">
                      Wind: {weatherData.current.windSpeed} km/h
                    </p>
                    {weatherData.current.precipitation !== undefined && (
                      <p className="text-gray-600">
                        Precipitation:{" "}
                        {parseFloat(weatherData.current.precipitation).toFixed(
                          2
                        )}{" "}
                        mm
                      </p>
                    )}
                  </div>
                </div>

                {/* Toggle Hourly Forecast Button */}
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={toggleHourlyForecast}
                    className="flex items-center text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>
                      {showHourlyForecast
                        ? "Hide Hourly Forecast"
                        : "Show Hourly Forecast"}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-5 w-5 ml-1 transform ${
                        showHourlyForecast ? "rotate-180" : ""
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Hourly Forecast - Fixed to show data every hour */}
              {showHourlyForecast && hourlyData && (
                <div className="max-w-5xl mx-auto mb-8 fade-in">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Hourly Weather Forecast
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      (3-hour intervals)
                    </span>
                  </h2>

                  {/* Desktop version - Shows every hour */}
                  <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden">
                    {/* Scrollable hours container with improved styling */}
                    <div
                      className="overflow-x-auto py-6 px-4"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#CBD5E0 #EDF2F7",
                      }}
                    >
                      <div className="flex space-x-2 min-w-max">
                        {hourlyData.map((hour, index) => (
                          <div
                            key={index}
                            className={`flex-none w-24 p-3 mx-1 rounded-lg transition-all ${
                              index === 0
                                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                                : "bg-gray-50 hover:bg-blue-50"
                            }`}
                          >
                            <div className="text-center">
                              {/* Time display */}
                              <p
                                className={`font-medium ${
                                  index === 0 ? "text-white" : "text-gray-700"
                                }`}
                              >
                                {hour.time}
                              </p>
                              <p
                                className={`text-xs ${
                                  index === 0
                                    ? "text-blue-100"
                                    : "text-gray-500"
                                }`}
                              >
                                {new Date(
                                  hour.timestamp * 1000
                                ).toLocaleDateString(undefined, {
                                  weekday: "short",
                                })}
                              </p>

                              {/* Weather icon and temperature */}
                              <div className="text-2xl my-2">{hour.icon}</div>
                              <p
                                className={`text-xl font-bold ${
                                  index === 0 ? "text-white" : "text-gray-800"
                                }`}
                              >
                                {hour.temp}°C
                              </p>
                              <p
                                className={`text-xs ${
                                  index === 0
                                    ? "text-blue-100"
                                    : "text-gray-600"
                                }`}
                              >
                                {hour.condition}
                              </p>

                              {/* Divider */}
                              <div
                                className={`${
                                  index === 0
                                    ? "border-t border-blue-400"
                                    : "border-t border-gray-200"
                                } my-1`}
                              ></div>

                              {/* Compact weather details */}
                              <div className="grid grid-cols-2 gap-x-1 gap-y-1 text-xs mt-1">
                                <div
                                  className={`flex items-center ${
                                    index === 0
                                      ? "text-blue-100"
                                      : "text-gray-500"
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                    />
                                  </svg>
                                  {hour.precipProbability}%
                                </div>
                                <div
                                  className={`flex items-center ${
                                    index === 0
                                      ? "text-blue-100"
                                      : "text-gray-500"
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                  </svg>
                                  {hour.windSpeed}
                                </div>
                                <div
                                  className={`flex items-center ${
                                    index === 0
                                      ? "text-blue-100"
                                      : "text-gray-500"
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 10h18M3 14h18"
                                    />
                                  </svg>
                                  {hour.humidity}%
                                </div>
                                <div
                                  className={`flex items-center ${
                                    index === 0
                                      ? "text-blue-100"
                                      : "text-gray-500"
                                  }`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                    />
                                  </svg>
                                  {hour.feelsLike}°
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mobile version - Show all hours */}
                  <div className="md:hidden">
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                      <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                        <h3 className="font-medium">Hourly Forecast</h3>
                      </div>

                      <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                        {hourlyData.map((hour, index) => (
                          <div
                            key={index}
                            className="p-3 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center">
                                <div className="w-16">
                                  <div className="font-medium text-gray-800">
                                    {hour.time}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(
                                      hour.timestamp * 1000
                                    ).toLocaleDateString(undefined, {
                                      weekday: "short",
                                    })}
                                  </div>
                                </div>
                                <div className="text-2xl mx-3">{hour.icon}</div>
                              </div>

                              <div className="text-right">
                                <div className="font-bold text-lg">
                                  {hour.temp}°C
                                </div>
                                <div className="text-xs text-gray-600">
                                  {hour.condition}
                                </div>
                              </div>
                            </div>

                            {/* Weather details in a more compact format */}
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                              <div className="flex items-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3 mr-1 text-blue-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                  />
                                </svg>
                                Rain: {hour.precipProbability}%
                              </div>
                              <div className="flex items-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3 mr-1 text-gray-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                  />
                                </svg>
                                Wind: {hour.windSpeed}
                              </div>
                              <div className="flex items-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3 mr-1 text-blue-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 10h18M3 14h18"
                                  />
                                </svg>
                                Hum: {hour.humidity}%
                              </div>
                              <div className="flex items-center">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3 mr-1 text-orange-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                  />
                                </svg>
                                Feels: {hour.feelsLike}°
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Close button */}
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={toggleHourlyForecast}
                      className="flex items-center justify-center px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                    >
                      Hide hourly forecast
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Extended Forecast with Slider */}
              <div className="mt-8 max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Extended Forecast
                  </h2>
                  <div className="flex items-center space-x-3 mt-2 md:mt-0">
                    <span className="text-sm text-gray-600">
                      Days: {forecastDays}
                    </span>
                    <input
                      type="range"
                      min="5"
                      max="15"
                      value={forecastDays}
                      onChange={handleForecastDaysChange}
                      className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-2 overflow-x-auto">
                  <div className="min-w-max flex space-x-3 pb-2">
                    {extendedForecast
                      .slice(0, forecastDays)
                      .map((day, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-lg p-3 min-w-[100px] text-center"
                        >
                          <p className="font-medium text-sm">{day.day}</p>
                          <p className="text-xs text-gray-500">{day.date}</p>
                          <p className="text-3xl my-2">{day.icon}</p>
                          <p className="font-bold">{day.temp}°C</p>
                          <p className="text-sm text-gray-600">
                            {day.condition}
                          </p>
                          {/* Precipitation data */}
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-blue-500 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                />
                              </svg>
                              <span className="text-xs text-blue-600">
                                {parseFloat(day.precipitation).toFixed(2)} mm
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {day.precipProbability}% chance
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Scroll horizontally to view more days →
                </p>
              </div>

              {/* Estimated Soil Moisture */}
              <div className="mt-8 max-w-xl mx-auto">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Estimated Soil Moisture
                </h2>
                <div className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700">Soil Moisture Level:</span>
                    <span className="font-bold">
                      {soilMoisture < 0.3
                        ? "Low"
                        : soilMoisture > 0.7
                        ? "High"
                        : "Moderate"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full ${
                        soilMoisture < 0.3
                          ? "bg-orange-500"
                          : soilMoisture > 0.7
                          ? "bg-blue-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${soilMoisture * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Dry</span>
                    <span>Moderate</span>
                    <span>Wet</span>
                  </div>
                  <p className="text-sm mt-3 text-gray-600">
                    {soilMoisture < 0.3
                      ? "Soil moisture is low. Consider irrigation to prevent crop stress."
                      : soilMoisture > 0.7
                      ? "Soil moisture is high. Monitor for potential waterlogging issues."
                      : "Soil moisture is at an optimal level for most crops."}
                  </p>
                </div>
              </div>

              {/* Agricultural Weather Tips */}
              <div className="mt-12 max-w-4xl mx-auto mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Agricultural Weather Tips
                </h2>
                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                  <ul className="space-y-2">
                    {tips.map((tip, index) => (
                      <li key={index} className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Weather;
