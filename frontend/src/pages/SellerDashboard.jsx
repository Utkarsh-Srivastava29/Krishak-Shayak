import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  getSellerProducts,
  deleteProduct,
  getSellerProfile,
  updateSellerProfile,
  getSellerOrders,
  updateItemStatus,
} from "../services/marketplaceService";
import authService from "../services/authService";

const SellerDashboard = () => {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [groupedOrders, setGroupedOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // profile, products, orders
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({}); // Track which orders are expanded

  // Profile form state
  const [profileData, setProfileData] = useState({
    shopName: "",
    shopDescription: "",
    location: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    // Get the current user
    const currentUser = authService.getCurrentUser();

    console.log("SellerDashboard - current user:", currentUser);

    if (!currentUser) {
      console.warn("No user found in SellerDashboard");
    } else if (currentUser.userType !== "seller") {
      console.warn("Non-seller user in SellerDashboard:", currentUser.userType);
    }

    setUser(currentUser);

    // Load seller profile from API
    const loadSellerProfile = async () => {
      try {
        const profileData = await getSellerProfile();
        setProfileData({
          shopName: profileData.shopName || "",
          shopDescription: profileData.shopDescription || "",
          location: profileData.location || "",
          phone: profileData.phone || "",
          email: profileData.email || "",
        });
      } catch (error) {
        console.error("Failed to load seller profile:", error);
        // Fallback to user data from localStorage if API fails
        if (currentUser) {
          setProfileData({
            shopName: currentUser.shopName || "",
            shopDescription: currentUser.shopDescription || "",
            location: currentUser.location || "",
            phone: currentUser.phone || "",
            email: currentUser.email || "",
          });
        }
      }
    };

    if (currentUser) {
      loadSellerProfile();
    }
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const productsData = await getSellerProducts();
        console.log("Loaded products:", productsData); // Debug log
        setProducts(productsData);
      } catch (error) {
        console.error("Failed to load products:", error);
        setMessage({
          type: "error",
          text: "Failed to load your products. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Fetch orders when Orders tab is active
  useEffect(() => {
    const loadOrders = async () => {
      if (activeTab === "orders") {
        setIsLoadingOrders(true);
        try {
          const ordersData = await getSellerOrders();
          console.log("Loaded seller orders:", ordersData);
          setOrders(ordersData.orders);
          setGroupedOrders(ordersData.groupedByCustomer);
        } catch (error) {
          console.error("Failed to load orders:", error);
          setMessage({
            type: "error",
            text: "Failed to load orders. Please try again.",
          });
        } finally {
          setIsLoadingOrders(false);
        }
      }
    };

    loadOrders();
  }, [activeTab]);

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteProduct(productId);
        setProducts(products.filter((product) => product._id !== productId));
        setMessage({
          type: "success",
          text: "Product deleted successfully!",
        });
      } catch (error) {
        console.error("Failed to delete product:", error);
        setMessage({
          type: "error",
          text: "Failed to delete product. Please try again.",
        });
      }

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      const updatedProfile = await updateSellerProfile(profileData);

      // Update the user in localStorage with new data
      const currentUser = authService.getCurrentUser();
      const updatedUser = {
        ...currentUser,
        ...updatedProfile,
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      setMessage({
        type: "success",
        text: "Profile updated successfully!",
      });
      setIsEditingProfile(false); // Exit edit mode after successful update
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to update profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  const handleCancelEdit = () => {
    // Reload profile data from the user state
    if (user) {
      setProfileData({
        shopName: user.shopName || "",
        shopDescription: user.shopDescription || "",
        location: user.location || "",
        phone: user.phone || "",
        email: user.email || "",
      });
    }
    setIsEditingProfile(false);
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleItemStatusChange = async (orderId, itemIndex, newStatus) => {
    try {
      await updateItemStatus(orderId, itemIndex, newStatus);

      // Refresh orders to show updated status
      const ordersData = await getSellerOrders();
      setOrders(ordersData.orders);
      setGroupedOrders(ordersData.groupedByCustomer);

      setMessage({
        type: "success",
        text: "Item status updated successfully!",
      });

      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    } catch (error) {
      console.error("Failed to update item status:", error);
      setMessage({
        type: "error",
        text:
          error.message || "Failed to update item status. Please try again.",
      });

      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    }
  };

  // Toggle order details visibility
  const toggleOrderExpansion = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-orange-100 text-orange-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
          Seller Dashboard
        </h1>

        {message.text && (
          <div
            className={`p-4 mb-6 rounded-md ${
              message.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Dashboard Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("profile")}
              className={`py-3 px-6 border-b-2 font-medium text-sm ${
                activeTab === "profile"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`py-3 px-6 border-b-2 font-medium text-sm ${
                activeTab === "products"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`py-3 px-6 border-b-2 font-medium text-sm ${
                activeTab === "orders"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Orders
            </button>
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Shop Profile
                  </h2>
                  <p className="text-green-100">
                    Manage your shop information and details
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Shop Name */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
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
                        <label className="text-sm font-medium text-gray-500">
                          Shop Name
                        </label>
                      </div>
                      <p className="text-gray-900 text-lg font-semibold">
                        {profileData.shopName || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </p>
                    </div>

                    {/* Location */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
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
                        <label className="text-sm font-medium text-gray-500">
                          Location
                        </label>
                      </div>
                      <p className="text-gray-900 text-lg font-semibold">
                        {profileData.location || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </p>
                    </div>

                    {/* Phone Number */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <label className="text-sm font-medium text-gray-500">
                          Phone Number
                        </label>
                      </div>
                      <p className="text-gray-900 text-lg font-semibold">
                        {profileData.phone || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </p>
                    </div>

                    {/* Email */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <label className="text-sm font-medium text-gray-500">
                          Email
                        </label>
                      </div>
                      <p className="text-gray-900 text-lg font-semibold break-all">
                        {profileData.email || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Shop Description */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center mb-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                      <label className="text-sm font-medium text-gray-500">
                        Shop Description
                      </label>
                    </div>
                    <p className="text-gray-900 leading-relaxed">
                      {profileData.shopDescription || (
                        <span className="text-gray-400 italic">
                          No description provided
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                // Edit Mode
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Shop Name */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
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
                        Shop Name
                        <span className="ml-2 text-xs text-gray-500">
                          (Cannot be changed)
                        </span>
                      </label>
                      <input
                        type="text"
                        name="shopName"
                        value={profileData.shopName}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        placeholder="Enter your shop name"
                        readOnly
                        disabled
                      />
                    </div>

                    {/* Location */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
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
                        Location *
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={profileData.location}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        placeholder="City, State"
                        required
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleProfileChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        placeholder="+91 9876543210"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-green-600 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        Email
                        <span className="ml-2 text-xs text-gray-500">
                          (Cannot be changed)
                        </span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={profileData.email}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                        placeholder="shop@example.com"
                        readOnly
                        disabled
                      />
                    </div>
                  </div>

                  {/* Shop Description */}
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-green-600 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
                      Shop Description *
                    </label>
                    <textarea
                      name="shopDescription"
                      value={profileData.shopDescription}
                      onChange={handleProfileChange}
                      rows="4"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      placeholder="Describe your shop and products..."
                      required
                    ></textarea>
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
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-8 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin h-5 w-5 mr-2"
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
                          Saving...
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">Your Products</h2>
              <Link
                to="/marketplace/seller/add-product"
                className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add New Product
              </Link>
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <h3 className="text-xl font-medium text-gray-700 mb-2">
                  No products yet
                </h3>
                <p className="text-gray-500 mb-6">
                  You haven't added any products to sell on the marketplace.
                </p>
                <Link
                  to="/marketplace/seller/add-product"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Your First Product
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 bg-white shadow-md rounded-lg overflow-hidden">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-12 h-12 flex-shrink-0">
                              <img
                                src={
                                  product.imageUrl ||
                                  `https://via.placeholder.com/100?text=${product.name}`
                                }
                                alt={product.name}
                                className="w-full h-full object-cover rounded-md"
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {product._id.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(product.price)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {product.stock} {product.unitType || "units"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              product.stock > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {product.stock > 0 ? "In Stock" : "Out of Stock"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            to={`/marketplace/seller/edit-product/${product._id}`}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteProduct(product._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Customer Orders
              </h2>
              <span className="text-sm text-gray-500">
                Total Orders: {orders.length}
              </span>
            </div>

            {isLoadingOrders ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mb-4"></div>
                <p className="text-gray-500">Loading orders...</p>
              </div>
            ) : groupedOrders.length === 0 ? (
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
                <p className="text-gray-500">
                  Orders containing your products will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Orders grouped by customer */}
                {groupedOrders.map((customerGroup, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Customer Header */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {customerGroup.customer.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {customerGroup.customer.email}
                          </p>
                          {customerGroup.customer.phone && (
                            <p className="text-sm text-gray-600">
                              📞 {customerGroup.customer.phone}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            Total Orders
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {customerGroup.totalOrders}
                          </div>
                          <div className="text-sm font-medium text-gray-700">
                            {formatCurrency(customerGroup.totalAmount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Customer's Orders */}
                    <div className="divide-y divide-gray-200">
                      {customerGroup.orders.map((order) => (
                        <div key={order._id} className="transition-colors">
                          {/* Order Header - Clickable */}
                          <div
                            className="p-6 hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleOrderExpansion(order._id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900">
                                    Order #{order._id.slice(-8).toUpperCase()}
                                  </span>
                                  <div>
                                    <div className="text-xs text-gray-400 mb-1">
                                      Overall Status
                                    </div>
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                        order.status
                                      )}`}
                                    >
                                      {order.status.charAt(0).toUpperCase() +
                                        order.status.slice(1)}
                                    </span>
                                  </div>
                                  {/* Expand/Collapse Icon */}
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-5 w-5 text-gray-500 transition-transform ${
                                      expandedOrders[order._id]
                                        ? "rotate-180"
                                        : ""
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
                                <p className="text-sm text-gray-500 mt-2">
                                  {new Date(
                                    order.orderDate || order.createdAt
                                  ).toLocaleDateString("en-IN", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {order.items.length}{" "}
                                  {order.items.length === 1 ? "item" : "items"}{" "}
                                  from your shop
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-500">
                                  Order Total
                                </p>
                                <p className="text-lg font-bold text-green-600">
                                  {formatCurrency(order.subtotal)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Order Details */}
                          {expandedOrders[order._id] && (
                            <div className="px-6 pb-6">
                              {/* Order Items */}
                              <div className="space-y-3 mb-4">
                                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                  📦 Your Products in this Order
                                </h4>
                                {order.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start space-x-4 bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                                  >
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
                                      <p className="text-sm text-gray-600 mb-2">
                                        Quantity: {item.quantity} ×{" "}
                                        {formatCurrency(item.price)}
                                      </p>

                                      {/* Product Status with Dropdown */}
                                      <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-xs text-gray-500">
                                          Status:
                                        </span>
                                        <select
                                          value={item.status || order.status}
                                          onChange={(e) => {
                                            const indexToUse =
                                              item.originalIndex !== undefined
                                                ? item.originalIndex
                                                : idx;
                                            console.log("Updating status:", {
                                              orderId: order._id,
                                              itemOriginalIndex:
                                                item.originalIndex,
                                              idx: idx,
                                              indexToUse: indexToUse,
                                              newStatus: e.target.value,
                                            });
                                            handleItemStatusChange(
                                              order._id,
                                              indexToUse,
                                              e.target.value
                                            );
                                          }}
                                          className={`text-xs px-3 py-1 rounded-full font-medium border-2 cursor-pointer transition-colors ${getStatusColor(
                                            item.status || order.status
                                          )} hover:opacity-80`}
                                        >
                                          <option value="pending">
                                            Pending
                                          </option>
                                          <option value="processing">
                                            Processing
                                          </option>
                                          <option value="shipped">
                                            Shipped
                                          </option>
                                          <option value="delivered">
                                            Delivered
                                          </option>
                                          <option value="cancelled">
                                            Cancelled
                                          </option>
                                        </select>
                                      </div>

                                      <p className="text-xs text-gray-400 italic">
                                        Click dropdown to update status
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-gray-900 text-lg">
                                        {formatCurrency(
                                          item.price * item.quantity
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Shipping Address */}
                              {order.shippingAddress && (
                                <div className="bg-blue-50 p-4 rounded-lg">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                    📦 Shipping Address
                                  </h4>
                                  <p className="text-sm text-gray-900 font-medium">
                                    {order.shippingAddress.fullName}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    📞 {order.shippingAddress.phone}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {order.shippingAddress.address}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {order.shippingAddress.city},{" "}
                                    {order.shippingAddress.state} -{" "}
                                    {order.shippingAddress.pincode}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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

export default SellerDashboard;
