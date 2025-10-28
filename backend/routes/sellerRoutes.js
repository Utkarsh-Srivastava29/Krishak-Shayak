const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getSellerProfile,
  updateSellerProfile,
  getAllShops,
  getShopById,
} = require("../controllers/sellerController");

// Public routes
router.get("/shops", getAllShops);
router.get("/shops/:id", getShopById);

// Protected routes (seller only)
router.get("/profile", protect, getSellerProfile);
router.put("/profile", protect, updateSellerProfile);

module.exports = router;
