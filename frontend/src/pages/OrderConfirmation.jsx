import { useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const OrderConfirmation = () => {
  const location = useLocation();
  const orderDetails = location.state;
  
  // If no order details are present, redirect to home
  if (!orderDetails) {
    return <Navigate to="/" replace />;
  }

  const { orderId, orderTotal, orderDate } = orderDetails;
  const formattedDate = new Date(orderDate).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-green-600"
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
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Order Confirmed!
          </h1>
          <p className="text-gray-600 mb-8">
            Thank you for your purchase. Your order has been confirmed and will
            be shipped soon.
          </p>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col md:flex-row justify-between mb-6">
              <div className="mb-4 md:mb-0">
                <p className="text-sm text-gray-500">Order Number</p>
                <p className="font-semibold">{orderId}</p>
              </div>
              <div className="mb-4 md:mb-0">
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-semibold">{formattedDate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-semibold">{formatCurrency(orderTotal)}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-8">
              <p className="text-sm text-gray-600">
                We'll send you a shipping confirmation email once your order has
                been shipped. You can check your order status in your account
                dashboard.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/marketplace"
                className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium"
              >
                Continue Shopping
              </Link>
              <Link
                to="/orders"
                className="border border-green-600 text-green-600 hover:bg-green-50 py-3 px-6 rounded-lg font-medium"
              >
                View Orders
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default OrderConfirmation;