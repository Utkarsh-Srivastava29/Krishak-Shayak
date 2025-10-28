import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import ShopDetail from "./pages/ShopDetail";
import CropGuide from "./pages/CropGuide";
import MarketPrice from "./pages/MarketPrice";
import Weather from "./pages/Weather";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SellerDashboard from "./pages/SellerDashboard";
import FarmerDashboard from "./pages/FarmerDashboard";
import ShoppingCart from "./pages/ShoppingCart";
import OrderConfirmation from "./pages/OrderConfirmation";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";
import GovtSchemes from "./pages/GovtSchemes";
import ProtectedRoute from "./components/ProtectedRoute";
import "./index.css";

function App() {
  // For debugging purposes, log if we have a token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      console.log("Token found in localStorage");
    } else {
      console.log("No token found in localStorage");
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Protected routes based on user type */}
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <Marketplace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketplace/product/:id"
          element={
            <ProtectedRoute>
              <ProductDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketplace/shop/:shopId"
          element={
            <ProtectedRoute>
              <ShopDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <ShoppingCart />
            </ProtectedRoute>
          }
        />

        <Route
          path="/order-confirmation"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/seller-dashboard"
          element={
            <ProtectedRoute requiredUserType="seller">
              <SellerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketplace/seller/dashboard"
          element={
            <ProtectedRoute requiredUserType="seller">
              <SellerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketplace/seller/add-product"
          element={
            <ProtectedRoute requiredUserType="seller">
              <AddProduct />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketplace/seller/edit-product/:productId"
          element={
            <ProtectedRoute requiredUserType="seller">
              <EditProduct />
            </ProtectedRoute>
          }
        />

        <Route
          path="/farmer-dashboard"
          element={
            <ProtectedRoute requiredUserType="buyer">
              <FarmerDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/cart" element={<ShoppingCart />} />

        {/* Public routes */}
        <Route path="/crop-recommendation" element={<CropGuide />} />
        <Route path="/market-price" element={<MarketPrice />} />
        <Route path="/weather" element={<Weather />} />
        <Route path="/govt-schemes" element={<GovtSchemes />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Fallback route */}
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
