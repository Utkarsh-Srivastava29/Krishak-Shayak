const WeatherCard = ({ weatherData }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 flex items-center">
      <div className="text-5xl text-yellow-500 mr-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-700">Current Weather</h3>
        <p className="text-3xl font-bold text-gray-900">{weatherData.temp}°C</p>
        <p className="text-gray-600">{weatherData.condition}, Humidity: {weatherData.humidity}%</p>
        <p className="text-gray-600">Wind: {weatherData.windSpeed} km/h</p>
        <a href="/weather" onClick={(e) => {
          e.preventDefault();
          window.location.href = '/weather';
        }} className="text-green-600 hover:text-green-800 text-sm font-medium mt-2 inline-block">View 7-Day Forecast →</a>
      </div>
    </div>
  );
};

export default WeatherCard;