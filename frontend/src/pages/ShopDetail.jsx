import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductCard from "../components/marketplace/ProductCard";
import { getShopById, getShopProducts } from "../services/marketplaceService";

const ShopDetail = () => {
  const { shopId } = useParams();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const loadShopData = async () => {
      setIsLoading(true);
      try {
        const [shopData, productsData] = await Promise.all([
          getShopById(shopId),
          getShopProducts(shopId),
        ]);
        setShop(shopData);
        setProducts(productsData);
      } catch (error) {
        console.error("Failed to load shop data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadShopData();
  }, [shopId]);

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((p) => p.category === selectedCategory);

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

  if (!shop) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Shop not found
          </h2>
          <Link
            to="/marketplace"
            className="text-green-600 hover:text-green-800"
          >
            Back to Marketplace
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Shop Header */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          {/* Banner */}
          <div className="relative h-48 md:h-64 bg-gradient-to-r from-green-400 to-green-600">
            <img
              src={
                shop.bannerImage ||
                "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&auto=format&fit=crop"
              }
              alt={shop.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          </div>

          {/* Shop Info */}
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mr-3">
                    {shop.name}
                  </h1>
                  {shop.verified && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Verified Seller
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mb-2 flex items-center">
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
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {shop.location}
                </p>
                <p className="text-gray-600 max-w-2xl">{shop.description}</p>
              </div>

              <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {shop.productsCount || products.length}
                    </div>
                    <div className="text-xs text-gray-500">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {shop.totalSales || "50+"}
                    </div>
                    <div className="text-xs text-gray-500">Sales</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-sm text-gray-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
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
                  Member since {shop.memberSince || "2024"}
                </div>
              </div>
            </div>

            {/* Shop Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center md:text-left">
                <div className="text-2xl font-bold text-green-600">
                  {shop.productsCount}
                </div>
                <div className="text-sm text-gray-500">Products</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl font-bold text-green-600">
                  {shop.totalSales || 0}
                </div>
                <div className="text-sm text-gray-500">Total Sales</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl font-bold text-green-600">
                  {shop.followers || 0}
                </div>
                <div className="text-sm text-gray-500">Followers</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-2xl font-bold text-green-600">
                  {shop.memberSince || "2024"}
                </div>
                <div className="text-sm text-gray-500">Member Since</div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-4 py-2 rounded-md ${
                selectedCategory === "All"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              All Products ({products.length})
            </button>
            {shop.categories &&
              shop.categories.map((category) => {
                const count = products.filter(
                  (p) => p.category === category
                ).length;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-md ${
                      selectedCategory === category
                        ? "bg-green-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)} (
                    {count})
                  </button>
                );
              })}
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-gray-400 mx-auto mb-4"
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
              No products in this category
            </h3>
            <p className="text-gray-500">Please check other categories</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id || product._id}
                product={{
                  ...product,
                  unit: product.unitType || product.unit,
                  seller: shop.name,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default ShopDetail;
