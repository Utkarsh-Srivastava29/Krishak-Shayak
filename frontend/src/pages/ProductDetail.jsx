import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { fetchProductById, addToCart } from "../services/marketplaceService";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [similarProducts, setSimilarProducts] = useState([]);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      setIsLoading(true);
      try {
        const productData = await fetchProductById(id);
        setProduct(productData);
        // In a real app, you would fetch similar products based on category
        // Here we're just setting an empty array
        setSimilarProducts([]);
      } catch (error) {
        console.error("Failed to load product details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleAddToCart = async () => {
    setAddingToCart(true);
    try {
      await addToCart(product.id, quantity);
      alert(`Added ${quantity} ${product.name} to cart!`);
      // Optionally navigate to cart
      // navigate('/cart');
    } catch (error) {
      console.error("Failed to add to cart:", error);
      alert("Failed to add item to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
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

  if (!product) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Product Not Found</h2>
            <p>
              The product you're looking for is no longer available or may have
              been removed.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row -mx-4">
          <div className="md:w-1/2 px-4 mb-6 md:mb-0">
            <img
              src={
                product.imageUrl ||
                `https://via.placeholder.com/600x400?text=${product.name}`
              }
              alt={product.name}
              className="w-full h-auto rounded-lg shadow-md"
            />
          </div>
          <div className="md:w-1/2 px-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
              {product.name}
            </h1>
            <div className="flex items-center mb-4">
              <div className="flex text-yellow-400">
                {/* Stars based on rating */}
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.floor(product.rating)
                        ? "text-yellow-400"
                        : "text-gray-300"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-gray-600 ml-2">
                {product.rating} ({product.reviews} reviews)
              </span>
            </div>
            <p className="text-xl font-bold text-green-600 mb-4">
              {formatCurrency(product.price)} / {product.unitType}
            </p>
            <div className="mb-6">
              <p className="text-gray-600">Seller: {product.seller}</p>
              <p className="text-gray-600">
                Availability:
                <span
                  className={
                    product.stock > 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {product.stock > 0 ? " In Stock" : " Out of Stock"}
                </span>
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2">
                Quantity
              </label>
              <div className="flex items-center">
                <button
                  onClick={() => quantity > 1 && setQuantity(quantity - 1)}
                  className="px-3 py-1 border border-gray-300 rounded-l-md bg-gray-100 hover:bg-gray-200"
                >
                  -
                </button>
                <span className="px-6 py-1 border-t border-b border-gray-300 bg-white">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    quantity < product.stock && setQuantity(quantity + 1)
                  }
                  className="px-3 py-1 border border-gray-300 rounded-r-md bg-gray-100 hover:bg-gray-200"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || addingToCart}
                className={`px-6 py-2 rounded-lg flex-1 flex items-center justify-center ${
                  product.stock > 0 && !addingToCart
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-300 cursor-not-allowed text-gray-500"
                }`}
              >
                {addingToCart ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                    Adding...
                  </>
                ) : product.stock > 0 ? (
                  "Add to Cart"
                ) : (
                  "Out of Stock"
                )}
              </button>
              <button className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t pt-8">
          <div className="flex border-b">
            <button
              className={`px-6 py-3 font-medium ${
                activeTab === "description"
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveTab("description")}
            >
              Description
            </button>
            <button
              className={`px-6 py-3 font-medium ${
                activeTab === "reviews"
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-600"
              }`}
              onClick={() => setActiveTab("reviews")}
            >
              Reviews ({product.reviews})
            </button>
          </div>

          <div className="py-6">
            {activeTab === "description" ? (
              <div className="prose max-w-none">
                <p>{product.description}</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600">
                  Product reviews will be shown here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProductDetail;
