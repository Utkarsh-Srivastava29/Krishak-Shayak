import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const MarketPrice = () => {
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [marketData, setMarketData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [states, setStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Show 20 records per page

  // Fetch Indian states on component mount
  useEffect(() => {
    const fetchStates = async () => {
      setLoadingStates(true);
      try {
        const response = await fetch(
          "https://countriesnow.space/api/v0.1/countries/states",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              country: "India",
            }),
          }
        );

        const data = await response.json();

        if (data.error) {
          console.error("Error fetching states:", data.msg);
          // Fallback to sample states
          setStates([
            "Andhra Pradesh",
            "Bihar",
            "Delhi",
            "Gujarat",
            "Haryana",
            "Karnataka",
            "Kerala",
            "Madhya Pradesh",
            "Maharashtra",
            "Punjab",
            "Rajasthan",
            "Tamil Nadu",
            "Uttar Pradesh",
            "West Bengal",
          ]);
        } else if (data.data && data.data.states) {
          // Extract state names from the response
          const stateNames = data.data.states.map((state) => state.name);
          setStates(stateNames.sort()); // Sort alphabetically
        }
      } catch (err) {
        console.error("Failed to fetch states:", err);
        // Fallback to sample states
        setStates([
          "Andhra Pradesh",
          "Bihar",
          "Delhi",
          "Gujarat",
          "Haryana",
          "Karnataka",
          "Kerala",
          "Madhya Pradesh",
          "Maharashtra",
          "Punjab",
          "Rajasthan",
          "Tamil Nadu",
          "Uttar Pradesh",
          "West Bengal",
        ]);
      } finally {
        setLoadingStates(false);
      }
    };

    fetchStates();
  }, []);

  // Fetch cities when state is selected
  useEffect(() => {
    const fetchCities = async () => {
      if (!selectedState) {
        setCities([]);
        return;
      }

      setLoadingCities(true);
      try {
        const response = await fetch(
          "https://countriesnow.space/api/v0.1/countries/state/cities",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              country: "India",
              state: selectedState,
            }),
          }
        );

        const data = await response.json();

        if (data.error) {
          console.error("Error fetching cities:", data.msg);
          setCities([]);
        } else if (data.data) {
          // data.data is an array of city names
          // Filter out cities with special characters (keep only ASCII characters)
          const filteredCities = data.data.filter((city) =>
            /^[a-zA-Z\s\-.']+$/.test(city)
          );
          setCities(filteredCities.sort()); // Sort alphabetically
        }
      } catch (err) {
        console.error("Failed to fetch cities:", err);
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    };

    fetchCities();
  }, [selectedState]);

  const handleFetchPrices = async () => {
    if (!selectedState) {
      setError("Please select a state");
      return;
    }

    setIsLoading(true);
    setError("");
    setMarketData([]);
    setCurrentPage(1); // Reset to first page on new search

    try {
      // Data.gov.in API for commodity prices
      const apiKey = "579b464db66ec23bdd00000193b99a55112f47fa73efacc0606e14af";
      let apiUrl = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${apiKey}&format=json&limit=10000`;

      // Build filters for API URL
      if (selectedState) {
        apiUrl += `&filters[state.keyword]=${encodeURIComponent(
          selectedState
        )}`;
      }
      if (selectedDistrict) {
        apiUrl += `&filters[district]=${encodeURIComponent(selectedDistrict)}`;
      }
      if (selectedMarket) {
        apiUrl += `&filters[market]=${encodeURIComponent(selectedMarket)}`;
      }
      if (selectedCommodity) {
        apiUrl += `&filters[commodity]=${encodeURIComponent(
          selectedCommodity
        )}`;
      }
      if (selectedVariety) {
        apiUrl += `&filters[variety]=${encodeURIComponent(selectedVariety)}`;
      }
      if (selectedGrade) {
        apiUrl += `&filters[grade]=${encodeURIComponent(selectedGrade)}`;
      }

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.records || data.records.length === 0) {
        setError("No data available for the selected criteria.");
        return;
      }

      setMarketData(data.records);
    } catch (err) {
      setError(`Failed to fetch market prices: ${err.message}`);
      console.error("Error fetching market prices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = marketData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(marketData.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-green-800 mb-3">
              Market Price Information
            </h1>
            <p className="text-lg text-gray-600">
              Get real-time commodity prices across different markets in India
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Search Market Prices
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* State Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select State *
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedMarket(""); // Reset market when state changes
                  }}
                  disabled={loadingStates}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingStates ? "Loading states..." : "Choose a state"}
                  </option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>

              {/* District Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  District (Optional)
                </label>
                <input
                  type="text"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  placeholder="Enter district name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Market Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Market/City (Optional)
                </label>
                <select
                  value={selectedMarket}
                  onChange={(e) => setSelectedMarket(e.target.value)}
                  disabled={!selectedState || loadingCities}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedState
                      ? "Select a state first"
                      : loadingCities
                      ? "Loading cities..."
                      : "Choose a city"}
                  </option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Commodity Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commodity (Optional)
                </label>
                <input
                  type="text"
                  value={selectedCommodity}
                  onChange={(e) => setSelectedCommodity(e.target.value)}
                  placeholder="e.g., Wheat, Rice, Potato"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Variety Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variety (Optional)
                </label>
                <input
                  type="text"
                  value={selectedVariety}
                  onChange={(e) => setSelectedVariety(e.target.value)}
                  placeholder="Enter variety"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Grade Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grade (Optional)
                </label>
                <input
                  type="text"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  placeholder="Enter grade"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleFetchPrices}
              disabled={isLoading}
              className="w-full md:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading...
                </span>
              ) : (
                "Get Market Prices"
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          {marketData.length > 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Market Price Results ({marketData.length} records found)
                </h2>
                <p className="text-sm text-gray-600">
                  Showing {indexOfFirstItem + 1}-
                  {Math.min(indexOfLastItem, marketData.length)} of{" "}
                  {marketData.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        State
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        District
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Market
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commodity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variety
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Arrival Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Min Price (₹)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Price (₹)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Modal Price (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentItems.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.state || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.district || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.market || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.commodity || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.variety || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.arrival_date || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          ₹{item.min_price || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          ₹{item.max_price || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-bold">
                          ₹{item.modal_price || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                  <button
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  <div className="flex gap-2">
                    {/* Show first page */}
                    {currentPage > 3 && (
                      <>
                        <button
                          onClick={() => paginate(1)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          1
                        </button>
                        {currentPage > 4 && (
                          <span className="px-3 py-2 text-gray-500">...</span>
                        )}
                      </>
                    )}

                    {/* Show pages around current page */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === currentPage ||
                          page === currentPage - 1 ||
                          page === currentPage + 1 ||
                          (currentPage <= 2 && page <= 3) ||
                          (currentPage >= totalPages - 1 &&
                            page >= totalPages - 2)
                        );
                      })
                      .map((page) => (
                        <button
                          key={page}
                          onClick={() => paginate(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-md ${
                            currentPage === page
                              ? "bg-green-600 text-white"
                              : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                    {/* Show last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && (
                          <span className="px-3 py-2 text-gray-500">...</span>
                        )}
                        <button
                          onClick={() => paginate(totalPages)}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 mb-4"
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Data Available
              </h3>
              <p className="text-gray-600 mb-4">
                Select a state and click "Get Market Prices" to view real-time
                commodity prices from markets across India.
              </p>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tips:</strong>
                </p>
                <ul className="mt-2 text-sm text-blue-700 list-disc list-inside text-left">
                  <li>
                    <strong>State (Required):</strong> Select a state to begin
                    your search
                  </li>
                  <li>
                    <strong>District:</strong> Narrow down to specific district
                    markets
                  </li>
                  <li>
                    <strong>Market:</strong> Filter by market name (e.g.,
                    Mainpuri)
                  </li>
                  <li>
                    <strong>Commodity:</strong> Enter commodity name (e.g.,
                    Wheat, Rice, Potato)
                  </li>
                  <li>
                    <strong>Variety:</strong> Specify variety if known
                  </li>
                  <li>
                    <strong>Grade:</strong> Filter by quality grade
                  </li>
                  <li>
                    Data is sourced from Government of India's official data
                    portaluse 
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MarketPrice;
