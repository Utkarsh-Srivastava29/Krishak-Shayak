const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createProduct,
  getAllProducts,
  getProductById,
  getSellerProducts,
  getMyProducts,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

// Public routes
router.get("/", getAllProducts);
router.get("/seller/:sellerId", getSellerProducts);

// Protected routes (seller only)
router.post("/", protect, createProduct);
router.get("/my-products", protect, getMyProducts);
router.put("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

// This must come last to avoid conflicts with other routes
router.get("/:id", getProductById);

module.exports = router;
