const User = require("../models/User");
const Product = require("../models/Product");
const mongoose = require("mongoose");

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// @desc    Get seller profile
// @route   GET /api/seller/profile
// @access  Private (Seller only)
exports.getSellerProfile = async (req, res) => {
  try {
    const seller = await User.findById(req.user._id).select("-password");

    if (!seller || seller.userType !== "seller") {
      return res.status(404).json({ message: "Seller not found" });
    }

    res.json(seller);
  } catch (error) {
    console.error("Get seller profile error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update seller profile
// @route   PUT /api/seller/profile
// @access  Private (Seller only)
exports.updateSellerProfile = async (req, res) => {
  try {
    const { shopName, shopDescription, location, phone, email, bannerImage } =
      req.body;

    const seller = await User.findById(req.user._id);

    if (!seller || seller.userType !== "seller") {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Update fields
    if (shopName) seller.shopName = shopName;
    if (shopDescription !== undefined) seller.shopDescription = shopDescription;
    if (location !== undefined) seller.location = location;
    if (phone) seller.phone = phone;
    if (email) seller.email = email;
    if (bannerImage !== undefined) seller.bannerImage = bannerImage;
    seller.updatedAt = Date.now();

    await seller.save();

    const updatedSeller = await User.findById(req.user._id).select("-password");
    res.json({
      message: "Profile updated successfully",
      seller: updatedSeller,
    });
  } catch (error) {
    console.error("Update seller profile error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all sellers/shops
// @route   GET /api/seller/shops
// @access  Public
exports.getAllShops = async (req, res) => {
  try {
    const sellers = await User.find({ userType: "seller" }).select(
      "-password -aadharNumber"
    );

    // Get product count for each seller
    const shopsWithProductCount = await Promise.all(
      sellers.map(async (seller) => {
        const productsCount = await Product.countDocuments({
          seller: seller._id,
          isActive: true,
        });

        // Get categories of products for this seller
        const products = await Product.find({
          seller: seller._id,
          isActive: true,
        }).select("category");
        const categories = [...new Set(products.map((p) => p.category))];

        return {
          id: seller._id,
          name: seller.shopName || seller.name,
          description:
            seller.shopDescription || "Quality agricultural products",
          location: seller.location || seller.address,
          bannerImage: seller.bannerImage || "",
          verified: seller.verified || false,
          rating: seller.rating || 4.5,
          reviewsCount: seller.reviewsCount || 0,
          productsCount: productsCount,
          totalSales: seller.totalSales || 0,
          followers: seller.followers || 0,
          memberSince: seller.createdAt.getFullYear(),
          categories: categories,
          contactInfo: {
            phone: seller.phone,
            email: seller.email,
          },
        };
      })
    );

    res.json(shopsWithProductCount);
  } catch (error) {
    console.error("Get all shops error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get shop by ID
// @route   GET /api/seller/shops/:id
// @access  Public
exports.getShopById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }

    const seller = await User.findById(req.params.id).select(
      "-password -aadharNumber"
    );

    if (!seller || seller.userType !== "seller") {
      return res.status(404).json({ message: "Shop not found" });
    }

    const productsCount = await Product.countDocuments({
      seller: seller._id,
      isActive: true,
    });
    const products = await Product.find({
      seller: seller._id,
      isActive: true,
    }).select("category");
    const categories = [...new Set(products.map((p) => p.category))];

    const shop = {
      id: seller._id,
      name: seller.shopName || seller.name,
      description: seller.shopDescription || "Quality agricultural products",
      location: seller.location || seller.address,
      bannerImage: seller.bannerImage || "",
      verified: seller.verified || false,
      rating: seller.rating || 4.5,
      reviewsCount: seller.reviewsCount || 0,
      productsCount: productsCount,
      totalSales: seller.totalSales || 0,
      followers: seller.followers || 0,
      memberSince: seller.createdAt.getFullYear(),
      categories: categories,
      contactInfo: {
        phone: seller.phone,
        email: seller.email,
      },
    };

    res.json(shop);
  } catch (error) {
    console.error("Get shop by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = exports;
