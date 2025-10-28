const ProductFilter = ({ categories, activeCategory, setActiveCategory, sortBy, setSortBy }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Categories</h3>
        <ul className="space-y-2">
          {categories.map(category => (
            <li key={category}>
              <button
                onClick={() => setActiveCategory(category)}
                className={`w-full text-left px-2 py-1 rounded-md transition ${
                  activeCategory === category
                    ? 'bg-green-100 text-green-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {category}
              </button>
            </li>
          ))}
        </ul>
      </div>
      
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Sort By</h3>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="newest">Newest First</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          <option value="rating">Highest Rated</option>
        </select>
      </div>
      
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Price Range</h3>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            placeholder="Min"
            className="w-1/2 p-2 border border-gray-300 rounded-md"
          />
          <span className="text-gray-500">to</span>
          <input
            type="number"
            placeholder="Max"
            className="w-1/2 p-2 border border-gray-300 rounded-md"
          />
        </div>
        <button className="mt-3 w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 rounded-md text-sm">
          Apply Filter
        </button>
      </div>
      
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Availability</h3>
        <div className="flex items-center">
          <input type="checkbox" id="in-stock" className="mr-2" />
          <label htmlFor="in-stock" className="text-gray-600">In Stock Only</label>
        </div>
      </div>
    </div>
  );
};

export default ProductFilter;