import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import authService from "../services/authService";
import { getMyOrders } from "../services/marketplaceService";

const FarmerDashboard = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("details"); // details, orders
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [expandedOrders, setExpandedOrders] = useState({}); // Track which orders are expanded

  // Farmer details state
  const [farmerData, setFarmerData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    village: "",
    district: "",
    state: "",
    farmSize: "",
    crops: "",
  });

  // Orders state
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      setFarmerData({
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        address: currentUser.address || "",
        village: currentUser.village || "",
        district: currentUser.district || "",
        state: currentUser.state || "",
        farmSize: currentUser.farmSize || "",
        crops: currentUser.crops || "",
      });
    }

    // Fetch orders when component mounts or when switching to orders tab
    if (activeTab === "orders") {
      fetchOrders();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const fetchedOrders = await getMyOrders();
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setMessage({
        type: "error",
        text: "Failed to load orders. Please try again.",
      });
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Toggle order details visibility
  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setFarmerData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    // TODO: Add API call to update profile
    setMessage({
      type: "success",
      text: "Profile updated successfully!",
    });
    setIsEditingProfile(false);
    setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 3000);
  };

  const handleCancelEdit = () => {
    // Reload data from user state
    if (user) {
      setFarmerData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        village: user.village || "",
        district: user.district || "",
        state: user.state || "",
        farmSize: user.farmSize || "",
        crops: user.crops || "",
      });
    }
    setIsEditingProfile(false);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "shipped":
      case "in transit":
        return "bg-blue-100 text-blue-800";
      case "processing":
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.name || "Farmer"}! 🌾
          </h1>
          <p className="text-green-100">
            Manage your profile and track your orders
          </p>
        </div>

        {/* Success/Error Messages */}
        {message.text && (
          <div
            className={`p-4 mb-6 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <nav className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("details")}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "details"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Farmer Details
              </div>
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "orders"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center">
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
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                My Orders
              </div>
            </button>
          </nav>
        </div>

        {/* Farmer Details Tab */}
        {activeTab === "details" && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Farmer Profile
                  </h2>
                  <p className="text-green-100">
                    Your personal and farm information
                  </p>
                </div>
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center px-4 py-2 bg-white text-green-600 hover:bg-green-50 rounded-lg font-medium shadow-md transition-all duration-200 hover:shadow-lg"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {!isEditingProfile ? (
                // View Mode
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Full Name
                        </label>
                        <p className="text-gray-900 text-lg font-semibold">
                          {farmerData.name || (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Email Address
                        </label>
                        <p className="text-gray-900 text-lg font-semibold break-all">
                          {farmerData.email || (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Phone Number
                        </label>
                        <p className="text-gray-900 text-lg font-semibold">
                          {farmerData.phone || (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Location Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Location Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Address
                        </label>
                        <p className="text-gray-900">
                          {farmerData.address || (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <label className="text-sm font-medium text-gray-500 mb-2 block">
                            Village
                          </label>
                          <p className="text-gray-900 font-semibold">
                            {farmerData.village || (
                              <span className="text-gray-400 italic text-sm">
                                Not set
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <label className="text-sm font-medium text-gray-500 mb-2 block">
                            District
                          </label>
                          <p className="text-gray-900 font-semibold">
                            {farmerData.district || (
                              <span className="text-gray-400 italic text-sm">
                                Not set
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <label className="text-sm font-medium text-gray-500 mb-2 block">
                            State
                          </label>
                          <p className="text-gray-900 font-semibold">
                            {farmerData.state || (
                              <span className="text-gray-400 italic text-sm">
                                Not set
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Farm Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Farm Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Farm Size
                        </label>
                        <p className="text-gray-900 text-lg font-semibold">
                          {farmerData.farmSize || (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}{" "}
                          {farmerData.farmSize && "acres"}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Crops Grown
                        </label>
                        <p className="text-gray-900">
                          {farmerData.crops || (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Edit Mode
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name
                          <span className="ml-2 text-xs text-gray-500">
                            (Cannot be changed)
                          </span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={farmerData.name}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          readOnly
                          disabled
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                          <span className="ml-2 text-xs text-gray-500">
                            (Cannot be changed)
                          </span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={farmerData.email}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          readOnly
                          disabled
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={farmerData.phone}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          placeholder="+91 9876543210"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Location Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address *
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={farmerData.address}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          placeholder="Enter your address"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Village *
                          </label>
                          <input
                            type="text"
                            name="village"
                            value={farmerData.village}
                            onChange={handleProfileChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="Village"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            District *
                          </label>
                          <input
                            type="text"
                            name="district"
                            value={farmerData.district}
                            onChange={handleProfileChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="District"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            State *
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={farmerData.state}
                            onChange={handleProfileChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                            placeholder="State"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Farm Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Farm Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Farm Size (in acres) *
                        </label>
                        <input
                          type="number"
                          name="farmSize"
                          value={farmerData.farmSize}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          placeholder="Enter farm size"
                          step="0.01"
                          min="0"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Crops Grown *
                        </label>
                        <input
                          type="text"
                          name="crops"
                          value={farmerData.crops}
                          onChange={handleProfileChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          placeholder="e.g., Wheat, Rice, Cotton"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-all duration-200 flex items-center"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-8 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center"
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* My Orders Tab */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Orders</h2>
              <span className="text-sm text-gray-500">
                Total Orders: {orders.length}
              </span>
            </div>

            {isLoadingOrders ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mb-4"></div>
                <p className="text-gray-500">Loading orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 mx-auto text-gray-400 mb-4"
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
                <h3 className="text-xl font-medium text-gray-700 mb-2">
                  No orders yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Start shopping to place your first order
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200"
                  >
                    {/* Order Header - Clickable */}
                    <div
                      className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:from-gray-100 hover:to-blue-100 transition-colors"
                      onClick={() => toggleOrderExpansion(order._id)}
                    >
                      <div className="flex flex-wrap justify-between items-center">
                        <div className="flex items-center space-x-6 flex-wrap">
                          <div>
                            <span className="text-xs text-gray-500 uppercase">
                              Order ID
                            </span>
                            <p className="font-semibold text-gray-900">
                              #{order._id.slice(-8).toUpperCase()}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 uppercase">
                              Date
                            </span>
                            <p className="font-semibold text-gray-900">
                              {new Date(
                                order.orderDate || order.createdAt
                              ).toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 uppercase">
                              Payment
                            </span>
                            <p className="font-semibold text-gray-900 capitalize">
                              {order.paymentMethod}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 uppercase">
                              Items
                            </span>
                            <p className="font-semibold text-gray-900">
                              {order.items.length}{" "}
                              {order.items.length === 1
                                ? "Product"
                                : "Products"}
                            </p>
                          </div>
                          {/* Expand/Collapse Icon */}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 text-gray-500 transition-transform ${
                              expandedOrders[order._id] ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                        <div className="mt-2 md:mt-0">
                          <div className="text-xs text-gray-500 mb-1">
                            Overall Status
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {order.status.charAt(0).toUpperCase() +
                              order.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Order Details */}
                    {expandedOrders[order._id] && (
                      <>
                        {/* Order Items */}
                        <div className="px-6 py-4">
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                            📦 Order Items & Individual Status
                          </h3>
                          <div className="space-y-3">
                            {order.items.map((item, index) => (
                              <div
                                key={index}
                                className="flex justify-between items-start py-3 px-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white"
                              >
                                <div className="flex items-start space-x-4 flex-1">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="w-20 h-20 object-cover rounded border border-gray-200"
                                      onError={(e) => {
                                        e.target.src =
                                          "https://via.placeholder.com/64?text=Product";
                                      }}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900 mb-1">
                                      {item.name}
                                    </p>
                                    <p className="text-sm text-gray-600 mb-1">
                                      Quantity: {item.quantity} ×{" "}
                                      {formatCurrency(item.price)}
                                    </p>
                                    {item.seller && (
                                      <p className="text-xs text-gray-500 mb-2">
                                        Sold by:{" "}
                                        <span className="font-medium">
                                          {item.seller}
                                        </span>
                                      </p>
                                    )}
                                    {/* Product-wise status */}
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs text-gray-500">
                                        Status:
                                      </span>
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                          item.status || order.status
                                        )}`}
                                      >
                                        {(item.status || order.status)
                                          .charAt(0)
                                          .toUpperCase() +
                                          (item.status || order.status).slice(
                                            1
                                          )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-bold text-gray-900 text-lg">
                                    {formatCurrency(item.price * item.quantity)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Shipping Address */}
                          {order.shippingAddress && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Shipping Address
                              </p>
                              <p className="text-sm text-gray-600">
                                {order.shippingAddress.fullName} -{" "}
                                {order.shippingAddress.phone}
                              </p>
                              <p className="text-sm text-gray-600">
                                {order.shippingAddress.address},{" "}
                                {order.shippingAddress.city}
                              </p>
                              <p className="text-sm text-gray-600">
                                {order.shippingAddress.state} -{" "}
                                {order.shippingAddress.pincode}
                              </p>
                            </div>
                          )}

                          {/* Order Summary */}
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Subtotal</span>
                              <span className="text-gray-900">
                                {formatCurrency(order.subtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Shipping</span>
                              <span className="text-gray-900">
                                {order.shipping === 0
                                  ? "Free"
                                  : formatCurrency(order.shipping)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-lg font-semibold text-gray-900">
                                Total Amount
                              </span>
                              <span className="text-xl font-bold text-green-600">
                                {formatCurrency(order.total)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default FarmerDashboard;
