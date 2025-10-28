import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  getCartItems,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  placeOrder,
} from "../services/marketplaceService";

// Razorpay configuration - These will be loaded from environment variables
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "YOUR_KEY_ID";

const ShoppingCart = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Cart, 2: Address, 3: Payment, 4: Confirmation
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("cash");

  useEffect(() => {
    const loadCart = async () => {
      setIsLoading(true);
      try {
        const items = await getCartItems();
        setCartItems(items);
      } catch (error) {
        console.error("Failed to load cart items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();

    const onCartUpdated = () => loadCart();
    window.addEventListener("cartUpdated", onCartUpdated);

    return () => {
      window.removeEventListener("cartUpdated", onCartUpdated);
    };
  }, []);

  const handleUpdateQuantity = async (productId, quantity) => {
    if (quantity < 1) return;

    try {
      await updateCartItemQuantity(productId, quantity);
      setCartItems(
        cartItems.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        )
      );
    } catch (error) {
      console.error("Failed to update quantity:", error);
    }
  };

  const handleRemoveItem = async (productId) => {
    try {
      await removeFromCart(productId);
      setCartItems(cartItems.filter((item) => item.productId !== productId));
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const calculateShipping = () => {
    // Simple shipping calculation logic
    const subtotal = calculateSubtotal();
    return subtotal > 500 ? 0 : 40; // Free shipping for orders over ₹500
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddress((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleContinueToAddress = (e) => {
    e.preventDefault();
    setCheckoutStep(2);
    window.scrollTo(0, 0);
  };

  const handleContinueToPayment = (e) => {
    e.preventDefault();
    setCheckoutStep(3);
    window.scrollTo(0, 0);
  };

  const handleContinueToConfirmation = (e) => {
    e.preventDefault();
    setCheckoutStep(4);
    window.scrollTo(0, 0);
  };

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Handle Razorpay payment
  const handleRazorpayPayment = async (orderData) => {
    const res = await loadRazorpayScript();

    if (!res) {
      alert("Razorpay SDK failed to load. Please check your connection.");
      return false;
    }

    // Create Razorpay order on backend (you'll need to implement this endpoint)
    // For now, using frontend-only implementation
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: calculateTotal() * 100, // Amount in paise
      currency: "INR",
      name: "Krishak Shayak",
      description: "Agricultural Products Purchase",
      image: "/logo.png", // Your logo URL
      handler: async function (response) {
        // Payment successful
        console.log("Payment successful:", response);

        // Add payment details to order
        orderData.paymentDetails = {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        };
        orderData.paymentStatus = "paid";

        try {
          // Send the order to the API
          const apiResponse = await placeOrder(orderData);
          await clearCart();

          // Navigate to order confirmation page
          navigate("/order-confirmation", {
            state: {
              orderId: apiResponse.orderId || apiResponse.order?._id,
              orderTotal: calculateTotal(),
              orderDate: new Date().toISOString(),
              paymentId: response.razorpay_payment_id,
            },
          });
        } catch (error) {
          console.error("Failed to save order:", error);
          alert(
            "Payment successful but order creation failed. Please contact support."
          );
        }
      },
      prefill: {
        name: address.fullName,
        email: "", // Add email field to address form if needed
        contact: address.phone,
      },
      notes: {
        address: `${address.address}, ${address.city}, ${address.state} - ${address.pincode}`,
      },
      theme: {
        color: "#16a34a", // Green color matching your theme
      },
      modal: {
        ondismiss: function () {
          setIsProcessing(false);
          alert("Payment cancelled");
        },
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      // Log cart items for debugging
      console.log("Cart items before optimization:", cartItems);

      // Optimize cart items to only include necessary data
      const optimizedItems = cartItems.map((item) => {
        const productId = item.productId || item.id || item._id;

        if (!productId) {
          console.error("Item missing productId:", item);
        }

        return {
          productId: productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || item.imageUrl || "",
          seller: item.seller || "Unknown Seller",
        };
      });

      console.log("Optimized items:", optimizedItems);

      // Create the order object
      const orderData = {
        items: optimizedItems,
        shippingAddress: address,
        paymentMethod,
        subtotal: calculateSubtotal(),
        shipping: calculateShipping(),
        total: calculateTotal(),
      };

      // If payment method is UPI or Card, use Razorpay
      if (paymentMethod === "upi" || paymentMethod === "card") {
        await handleRazorpayPayment(orderData);
        return;
      }

      // For Cash on Delivery, proceed normally
      orderData.paymentStatus = "pending";

      // Send the order to the API
      const response = await placeOrder(orderData);
      await clearCart();

      // Navigate to order confirmation page
      navigate("/order-confirmation", {
        state: {
          orderId: response.orderId || response.order?._id,
          orderTotal: calculateTotal(),
          orderDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to place order:", error);
      alert("There was a problem placing your order. Please try again.");
    } finally {
      setIsProcessing(false);
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

  // Cart is empty
  if (cartItems.length === 0 && checkoutStep === 1) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Navbar />

        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-8">
            Your Cart
          </h1>

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
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Your cart is empty
            </h2>
            <p className="text-gray-500 mb-6">
              Looks like you haven't added any products to your cart yet.
            </p>
            <Link
              to="/marketplace"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Continue Shopping
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Checkout Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {/* Step 1: Cart */}
            <div
              className={`flex items-center relative ${
                checkoutStep >= 1 ? "text-green-600" : "text-gray-400"
              }`}
            >
              <div
                className={`rounded-full transition duration-500 ease-in-out h-12 w-12 py-3 border-2 ${
                  checkoutStep >= 1
                    ? "border-green-600 bg-green-50"
                    : "border-gray-300"
                } flex items-center justify-center`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div className="absolute top-0 -ml-10 text-center mt-14 w-32 text-xs font-medium">
                Cart
              </div>
            </div>

            <div
              className={`flex-auto border-t-2 transition duration-500 ease-in-out ${
                checkoutStep >= 2 ? "border-green-600" : "border-gray-300"
              }`}
            ></div>

            {/* Step 2: Address */}
            <div
              className={`flex items-center relative ${
                checkoutStep >= 2 ? "text-green-600" : "text-gray-400"
              }`}
            >
              <div
                className={`rounded-full transition duration-500 ease-in-out h-12 w-12 py-3 border-2 ${
                  checkoutStep >= 2
                    ? "border-green-600 bg-green-50"
                    : "border-gray-300"
                } flex items-center justify-center`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="absolute top-0 -ml-10 text-center mt-14 w-32 text-xs font-medium">
                Address
              </div>
            </div>

            <div
              className={`flex-auto border-t-2 transition duration-500 ease-in-out ${
                checkoutStep >= 3 ? "border-green-600" : "border-gray-300"
              }`}
            ></div>

            {/* Step 3: Payment */}
            <div
              className={`flex items-center relative ${
                checkoutStep >= 3 ? "text-green-600" : "text-gray-400"
              }`}
            >
              <div
                className={`rounded-full transition duration-500 ease-in-out h-12 w-12 py-3 border-2 ${
                  checkoutStep >= 3
                    ? "border-green-600 bg-green-50"
                    : "border-gray-300"
                } flex items-center justify-center`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <div className="absolute top-0 -ml-10 text-center mt-14 w-32 text-xs font-medium">
                Payment
              </div>
            </div>

            <div
              className={`flex-auto border-t-2 transition duration-500 ease-in-out ${
                checkoutStep >= 4 ? "border-green-600" : "border-gray-300"
              }`}
            ></div>

            {/* Step 4: Confirmation */}
            <div
              className={`flex items-center relative ${
                checkoutStep >= 4 ? "text-green-600" : "text-gray-400"
              }`}
            >
              <div
                className={`rounded-full transition duration-500 ease-in-out h-12 w-12 py-3 border-2 ${
                  checkoutStep >= 4
                    ? "border-green-600 bg-green-50"
                    : "border-gray-300"
                } flex items-center justify-center`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="absolute top-0 -ml-10 text-center mt-14 w-32 text-xs font-medium">
                Confirm
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          {/* Step 1: Shopping Cart */}
          {checkoutStep === 1 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                Your Cart ({cartItems.length} items)
              </h1>

              <div className="flex flex-col lg:flex-row gap-8">
                {/* Cart Items */}
                <div className="lg:w-2/3">
                  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                    {cartItems.map((item) => (
                      <div
                        key={item.productId}
                        className="flex flex-col md:flex-row py-6 border-b border-gray-200"
                      >
                        <div className="md:w-24 h-24 flex-shrink-0 mb-4 md:mb-0">
                          <img
                            src={
                              item.image ||
                              `https://via.placeholder.com/150?text=${item.name}`
                            }
                            alt={item.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                        <div className="md:ml-4 flex-grow">
                          <h2 className="text-lg font-medium text-gray-800">
                            {item.name}
                          </h2>
                          <p className="text-sm text-gray-500 mb-2">
                            Seller:{" "}
                            {item.seller || "Agricultural Products Inc."}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center">
                              <button
                                onClick={() =>
                                  handleUpdateQuantity(
                                    item.productId,
                                    item.quantity - 1
                                  )
                                }
                                className="px-2 py-1 border border-gray-300 rounded-l-md bg-gray-100 hover:bg-gray-200"
                              >
                                -
                              </button>
                              <span className="px-4 py-1 border-t border-b border-gray-300 bg-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  handleUpdateQuantity(
                                    item.productId,
                                    item.quantity + 1
                                  )
                                }
                                className="px-2 py-1 border border-gray-300 rounded-r-md bg-gray-100 hover:bg-gray-200"
                              >
                                +
                              </button>
                            </div>
                            <div className="flex items-center">
                              <p className="font-medium text-gray-800 mr-4">
                                {formatCurrency(item.price * item.quantity)}
                              </p>
                              <button
                                onClick={() => handleRemoveItem(item.productId)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between">
                    <Link
                      to="/marketplace"
                      className="flex items-center text-green-600 hover:text-green-800"
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
                          d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                      </svg>
                      Continue Shopping
                    </Link>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="lg:w-1/3">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-medium text-gray-800 mb-4">
                      Order Summary
                    </h2>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">
                        {formatCurrency(calculateSubtotal())}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {calculateShipping() === 0
                          ? "Free"
                          : formatCurrency(calculateShipping())}
                      </span>
                    </div>
                    <hr className="my-4" />
                    <div className="flex justify-between mb-6">
                      <span className="text-lg font-medium">Total</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                    <button
                      onClick={handleContinueToAddress}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Address Information */}
          {checkoutStep === 2 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                Shipping Address
              </h1>

              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-2/3">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <form onSubmit={handleContinueToPayment}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label
                            className="block text-gray-700 font-medium mb-2"
                            htmlFor="fullName"
                          >
                            Full Name
                          </label>
                          <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            required
                            value={address.fullName}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="Enter your full name"
                          />
                        </div>

                        <div>
                          <label
                            className="block text-gray-700 font-medium mb-2"
                            htmlFor="phone"
                          >
                            Phone Number
                          </label>
                          <input
                            id="phone"
                            name="phone"
                            type="tel"
                            required
                            value={address.phone}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="Enter your phone number"
                          />
                        </div>
                      </div>

                      <div className="mt-6">
                        <label
                          className="block text-gray-700 font-medium mb-2"
                          htmlFor="address"
                        >
                          Address
                        </label>
                        <textarea
                          id="address"
                          name="address"
                          required
                          value={address.address}
                          onChange={handleAddressChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          rows="3"
                          placeholder="Enter your full address"
                        ></textarea>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <div>
                          <label
                            className="block text-gray-700 font-medium mb-2"
                            htmlFor="city"
                          >
                            City
                          </label>
                          <input
                            id="city"
                            name="city"
                            type="text"
                            required
                            value={address.city}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="City"
                          />
                        </div>

                        <div>
                          <label
                            className="block text-gray-700 font-medium mb-2"
                            htmlFor="state"
                          >
                            State
                          </label>
                          <input
                            id="state"
                            name="state"
                            type="text"
                            required
                            value={address.state}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="State"
                          />
                        </div>

                        <div>
                          <label
                            className="block text-gray-700 font-medium mb-2"
                            htmlFor="pincode"
                          >
                            PIN Code
                          </label>
                          <input
                            id="pincode"
                            name="pincode"
                            type="text"
                            required
                            value={address.pincode}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="PIN Code"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between mt-8">
                        <button
                          type="button"
                          onClick={() => setCheckoutStep(1)}
                          className="flex items-center text-gray-600 hover:text-gray-800"
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
                              d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                          </svg>
                          Back to Cart
                        </button>
                        <button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium"
                        >
                          Continue to Payment
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 ml-2 inline-block"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="lg:w-1/3">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-medium text-gray-800 mb-4">
                      Order Summary
                    </h2>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">
                        {cartItems.length} items
                      </span>
                      <span className="font-medium">
                        {formatCurrency(calculateSubtotal())}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {calculateShipping() === 0
                          ? "Free"
                          : formatCurrency(calculateShipping())}
                      </span>
                    </div>
                    <hr className="my-4" />
                    <div className="flex justify-between mb-4">
                      <span className="text-lg font-medium">Total</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Payment Method */}
          {checkoutStep === 3 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                Payment Method
              </h1>

              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-2/3">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <form onSubmit={handleContinueToConfirmation}>
                      <div className="space-y-4">
                        <div className="flex items-center p-4 border rounded-lg bg-gray-50">
                          <input
                            id="cash"
                            type="radio"
                            name="paymentMethod"
                            value="cash"
                            checked={paymentMethod === "cash"}
                            onChange={() => setPaymentMethod("cash")}
                            className="h-5 w-5 text-green-600"
                          />
                          <label
                            htmlFor="cash"
                            className="ml-3 block text-gray-800"
                          >
                            Cash on Delivery
                          </label>
                        </div>

                        <div className="flex items-center p-4 border rounded-lg">
                          <input
                            id="upi"
                            type="radio"
                            name="paymentMethod"
                            value="upi"
                            checked={paymentMethod === "upi"}
                            onChange={() => setPaymentMethod("upi")}
                            className="h-5 w-5 text-green-600"
                          />
                          <label
                            htmlFor="upi"
                            className="ml-3 block text-gray-800"
                          >
                            UPI
                          </label>
                        </div>

                        <div className="flex items-center p-4 border rounded-lg">
                          <input
                            id="card"
                            type="radio"
                            name="paymentMethod"
                            value="card"
                            checked={paymentMethod === "card"}
                            onChange={() => setPaymentMethod("card")}
                            className="h-5 w-5 text-green-600"
                          />
                          <label
                            htmlFor="card"
                            className="ml-3 block text-gray-800"
                          >
                            Credit / Debit Card
                          </label>
                        </div>
                      </div>

                      {paymentMethod === "upi" && (
                        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                          <h3 className="font-medium text-gray-800 mb-3">
                            Enter UPI ID
                          </h3>
                          <input
                            type="text"
                            placeholder="example@upi"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      )}

                      {paymentMethod === "card" && (
                        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                          <h3 className="font-medium text-gray-800 mb-3">
                            Card Details
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label
                                className="block text-gray-700 mb-2"
                                htmlFor="cardNumber"
                              >
                                Card Number
                              </label>
                              <input
                                id="cardNumber"
                                type="text"
                                placeholder="1234 5678 9012 3456"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label
                                  className="block text-gray-700 mb-2"
                                  htmlFor="expiry"
                                >
                                  Expiration (MM/YY)
                                </label>
                                <input
                                  id="expiry"
                                  type="text"
                                  placeholder="MM/YY"
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                              </div>
                              <div>
                                <label
                                  className="block text-gray-700 mb-2"
                                  htmlFor="cvv"
                                >
                                  CVV
                                </label>
                                <input
                                  id="cvv"
                                  type="text"
                                  placeholder="123"
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between mt-8">
                        <button
                          type="button"
                          onClick={() => setCheckoutStep(2)}
                          className="flex items-center text-gray-600 hover:text-gray-800"
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
                              d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                          </svg>
                          Back to Address
                        </button>
                        <button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium"
                        >
                          Continue
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 ml-2 inline-block"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="lg:w-1/3">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-medium text-gray-800 mb-4">
                      Order Summary
                    </h2>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">
                        {cartItems.length} items
                      </span>
                      <span className="font-medium">
                        {formatCurrency(calculateSubtotal())}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {calculateShipping() === 0
                          ? "Free"
                          : formatCurrency(calculateShipping())}
                      </span>
                    </div>
                    <hr className="my-4" />
                    <div className="flex justify-between mb-4">
                      <span className="text-lg font-medium">Total</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>

                    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                      <h3 className="font-medium text-gray-800 mb-2">
                        Shipping Address:
                      </h3>
                      <p className="text-gray-700">
                        {address.fullName}
                        <br />
                        {address.address}
                        <br />
                        {address.city}, {address.state} {address.pincode}
                        <br />
                        Phone: {address.phone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Order Confirmation */}
          {checkoutStep === 4 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                Review Your Order
              </h1>

              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-2/3">
                  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-medium text-gray-800 mb-4">
                      Order Items
                    </h2>

                    {cartItems.map((item) => (
                      <div
                        key={item.productId}
                        className="flex py-4 border-b border-gray-200 last:border-0"
                      >
                        <div className="w-16 h-16 flex-shrink-0">
                          <img
                            src={
                              item.image ||
                              `https://via.placeholder.com/150?text=${item.name}`
                            }
                            alt={item.name}
                            className="w-full h-full object-cover rounded-md"
                          />
                        </div>
                        <div className="ml-4 flex-grow">
                          <h3 className="text-sm font-medium text-gray-800">
                            {item.name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-800">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-1/2 mb-6 md:mb-0">
                        <h3 className="font-medium text-gray-800 mb-2">
                          Shipping Address:
                        </h3>
                        <p className="text-gray-700">
                          {address.fullName}
                          <br />
                          {address.address}
                          <br />
                          {address.city}, {address.state} {address.pincode}
                          <br />
                          Phone: {address.phone}
                        </p>
                      </div>

                      <div className="md:w-1/2">
                        <h3 className="font-medium text-gray-800 mb-2">
                          Payment Method:
                        </h3>
                        <p className="text-gray-700">
                          {paymentMethod === "cash" && "Cash on Delivery"}
                          {paymentMethod === "upi" && "UPI Payment"}
                          {paymentMethod === "card" && "Credit/Debit Card"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:w-1/3">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-medium text-gray-800 mb-4">
                      Order Summary
                    </h2>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">
                        {cartItems.length} items
                      </span>
                      <span className="font-medium">
                        {formatCurrency(calculateSubtotal())}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {calculateShipping() === 0
                          ? "Free"
                          : formatCurrency(calculateShipping())}
                      </span>
                    </div>
                    <hr className="my-4" />
                    <div className="flex justify-between mb-6">
                      <span className="text-lg font-medium">Total</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      disabled={isProcessing}
                      className={`w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center ${
                        isProcessing ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <span className="mr-2 animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></span>
                          Processing...
                        </>
                      ) : (
                        "Place Order"
                      )}
                    </button>

                    <p className="text-center text-gray-500 text-sm mt-4">
                      By placing your order, you agree to our Terms of Service
                      and Privacy Policy
                    </p>

                    <div className="flex justify-center mt-6">
                      <button
                        type="button"
                        onClick={() => setCheckoutStep(3)}
                        className="flex items-center text-gray-600 hover:text-gray-800"
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
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                          />
                        </svg>
                        Back to Payment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ShoppingCart;
