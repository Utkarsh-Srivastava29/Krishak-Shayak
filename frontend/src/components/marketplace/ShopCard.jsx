import { Link } from "react-router-dom";

const ShopCard = ({ shop }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Shop Banner/Image */}
      <div className="relative h-40 bg-gradient-to-r from-green-400 to-green-600">
        <img
          src={
            shop.bannerImage ||
            "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop"
          }
          alt={shop.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      </div>

      {/* Shop Info */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {shop.name}
            </h3>
            <p className="text-sm text-gray-600 mb-2">{shop.location}</p>
          </div>
          {shop.verified && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Verified
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {shop.description}
        </p>

        {/* Shop Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4 py-3 border-t border-b border-gray-100">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-800">
              {shop.productsCount}
            </div>
            <div className="text-xs text-gray-500">Products</div>
          </div>
          <div className="text-center border-l border-gray-100">
            <div className="text-lg font-bold text-green-600">
              {shop.memberSince || "2024"}
            </div>
            <div className="text-xs text-gray-500">Since</div>
          </div>
        </div>

        {/* Shop Categories */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {shop.categories &&
              shop.categories.slice(0, 3).map((category, index) => (
                <span
                  key={index}
                  className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded"
                >
                  {category}
                </span>
              ))}
            {shop.categories && shop.categories.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                +{shop.categories.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Visit Shop Button */}
        <Link
          to={`/marketplace/shop/${shop.id}`}
          className="block w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 px-4 rounded-md font-medium transition-colors duration-200"
        >
          Visit My Shop
        </Link>
      </div>
    </div>
  );
};

export default ShopCard;
