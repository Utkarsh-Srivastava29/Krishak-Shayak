import { useState } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import WeatherCard from "../components/WeatherCard";
import Footer from "../components/Footer";

const Home = () => {
  const [weatherData, setWeatherData] = useState({
    temp: 28,
    condition: "Sunny",
    humidity: 65,
    windSpeed: 12,
  });

  const newsItems = [
    {
      id: 1,
      title: "New subsidy scheme launched for organic farming",
      date: "June 5, 2025",
    },
    {
      id: 2,
      title: "Weather alert: Delayed monsoon expected this year",
      date: "June 2, 2025",
    },
    {
      id: 3,
      title: "Government introduces new crop insurance policy",
      date: "May 28, 2025",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Navbar />
      <Hero />

      {/* Weather and Quick Actions Section */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weather Card */}
          <WeatherCard weatherData={weatherData} />

          {/* Quick Action Cards */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Check Market Prices
            </h3>
            <p className="text-gray-600 mb-4">
              Get real-time commodity prices from government sources across
              India to make informed decisions.
            </p>
            <button
              onClick={() => (window.location.href = "/market-price")}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              View Market Prices
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Government Schemes
            </h3>
            <p className="text-gray-600 mb-4">
              Explore various central and state government schemes designed to
              support and empower farmers across India.
            </p>
            <button
              onClick={() => (window.location.href = "/govt-schemes")}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              View Schemes
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-green-50 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">
            How Krishak Shayak Helps You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 text-center transition transform hover:scale-105">
              <div className="text-green-600 mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Community Marketplace
              </h3>
              <p className="text-gray-600">
                Connect with farmers, buyers, and sellers in a trusted community
                marketplace
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center transition transform hover:scale-105">
              <div className="text-green-600 mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Real-Time Weather Updates
              </h3>
              <p className="text-gray-600">
                Stay informed with accurate weather forecasts and alerts for
                better farm planning
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center transition transform hover:scale-105">
              <div className="text-green-600 mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Market Price Insights
              </h3>
              <p className="text-gray-600">
                Access live commodity prices from government data to make
                informed selling decisions
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 text-center transition transform hover:scale-105">
              <div className="text-green-600 mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Buy & Sell Products
              </h3>
              <p className="text-gray-600">
                Connect directly with buyers and sellers in our farmer-friendly
                marketplace
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agricultural News Section - abbreviated for brevity */}
      <section className="container mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Latest Agricultural News
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <div className="h-48 bg-gray-200">
                <img
                  src={`https://source.unsplash.com/random/300x200/?agriculture,${item.id}`}
                  alt="News"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-500 mb-2">{item.date}</p>
                <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                <a
                  href="#"
                  className="text-green-600 hover:text-green-800 font-medium"
                >
                  Read More →
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Call To Action */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Farming?
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of farmers who have increased their productivity with
            Krishak Shayak's AI-powered recommendations.
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="bg-white text-green-700 hover:bg-gray-100 font-bold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105">
              Get Started
            </button>
            <button className="bg-transparent hover:bg-green-500 text-white font-bold py-3 px-8 border-2 border-white rounded-lg shadow-lg transition transform hover:scale-105">
              Learn More
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
