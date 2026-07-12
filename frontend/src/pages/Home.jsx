import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import WeatherCard from "../components/WeatherCard";
import Footer from "../components/Footer";

const Home = () => {
  const { t } = useTranslation();
  const [weatherData, setWeatherData] = useState({
    temp: 28,
    condition: "Sunny",
    humidity: 65,
    windSpeed: 12,
  });

  const sliderRef = useRef(null);

  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);

  useEffect(() => {
    const fetchNews = async () => {
      const apiKey = import.meta.env.VITE_NEWSDATA_API_KEY;
      if (!apiKey || apiKey === "your_newsdata_api_key_here") {
        setNewsError("News API key not configured.");
        setNewsLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `https://newsdata.io/api/1/news?apikey=${apiKey}&q=agriculture+farming+crop&country=in&language=en&category=business,science&size=6`
        );
        const data = await res.json();
        if (data.status === "success" && data.results?.length > 0) {
          setNewsItems(
            data.results.map((article) => ({
              id: article.article_id,
              title: article.title,
              date: article.pubDate
                ? new Date(article.pubDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Recent",
              image: article.image_url || null,
              url: article.link || "#",
              source: article.source_name || "",
            }))
          );
        } else {
          setNewsError("No agriculture news found at the moment.");
        }
      } catch (err) {
        console.error("News fetch error:", err);
        setNewsError("Failed to load news. Please try again later.");
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, []);

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
            <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('home.checkMarketPrices')}</h3>
            <p className="text-gray-600 mb-4">{t('home.marketPricesDesc')}</p>
            <button
              onClick={() => (window.location.href = "/market-price")}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('home.viewMarketPrices')}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('home.govtSchemes')}</h3>
            <p className="text-gray-600 mb-4">{t('home.govtSchemesDesc')}</p>
            <button
              onClick={() => (window.location.href = "/govt-schemes")}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('home.viewSchemes')}
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-green-50 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">{t('home.howWeHelp')}</h2>
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
              <h3 className="text-lg font-semibold mb-2">{t('home.feature1Title')}</h3>
              <p className="text-gray-600">{t('home.feature1Desc')}</p>
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
              <h3 className="text-lg font-semibold mb-2">{t('home.feature2Title')}</h3>
              <p className="text-gray-600">{t('home.feature2Desc')}</p>
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
              <h3 className="text-lg font-semibold mb-2">{t('home.feature3Title')}</h3>
              <p className="text-gray-600">{t('home.feature3Desc')}</p>
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
              <h3 className="text-lg font-semibold mb-2">{t('home.feature4Title')}</h3>
              <p className="text-gray-600">{t('home.feature4Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Agricultural News Section */}
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{t('home.latestNews')}</h2>
            {/* Slider Nav Buttons */}
            {!newsLoading && !newsError && newsItems.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => sliderRef.current.scrollBy({ left: -340, behavior: 'smooth' })}
                  className="p-2 rounded-full bg-white border border-gray-200 shadow hover:bg-green-50 hover:border-green-400 transition"
                  aria-label="Previous"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => sliderRef.current.scrollBy({ left: 340, behavior: 'smooth' })}
                  className="p-2 rounded-full bg-white border border-gray-200 shadow hover:bg-green-50 hover:border-green-400 transition"
                  aria-label="Next"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading Skeletons */}
        {newsLoading && (
          <div className="flex gap-5 px-4 container mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-80 bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-5">
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!newsLoading && newsError && (
          <div className="text-center py-10 text-gray-500 container mx-auto px-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6" />
            </svg>
            <p>{newsError}</p>
          </div>
        )}

        {/* News Slider */}
        {!newsLoading && !newsError && (
          <div
            ref={sliderRef}
            className="flex gap-5 overflow-x-auto scroll-smooth pb-3 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {newsItems.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-80 bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="h-48 bg-gray-100">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=200&fit=crop";
                      }}
                    />
                  ) : (
                    <img
                      src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=200&fit=crop"
                      alt="Agriculture"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">{item.date}</p>
                    {item.source && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {item.source}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold mb-3 line-clamp-2 leading-snug">{item.title}</h3>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-800 font-medium text-sm"
                  >
                    {t('home.readMore')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Call To Action */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">{t('home.ctaTitle')}</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">{t('home.ctaSubtitle')}</p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <a href="/register" className="bg-white text-green-700 hover:bg-gray-100 font-bold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105">
              {t('home.joinFree')}
            </a>
            <a href="/marketplace" className="bg-transparent hover:bg-green-500 text-white font-bold py-3 px-8 border-2 border-white rounded-lg shadow-lg transition transform hover:scale-105">
              {t('home.exploreMarketplace')}
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
