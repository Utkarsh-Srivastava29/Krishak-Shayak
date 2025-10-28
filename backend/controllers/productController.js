const Product = require("../models/Product");
const User = require("../models/User");
const mongoose = require("mongoose");

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (Seller only)
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, unitType, imageUrl } =
      req.body;

    // Verify user is a seller
    const seller = await User.findById(req.user._id);
    if (!seller || seller.userType !== "seller") {
      return res
        .status(403)
        .json({ message: "Only sellers can create products" });
    }

    const product = new Product({
      name,
      description,
      price,
      stock,
      category,
      unitType,
      imageUrl: imageUrl || "",
      seller: req.user._id,
      sellerName: seller.shopName || seller.name,
    });

    await product.save();

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all products (with filters)
// @route   GET /api/products
// @access  Public
exports.getAllProducts = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search, sort } = req.query;

    let query = { isActive: true };

    // Apply filters
    if (category && category !== "All") {
      query.category = category.toLowerCase();
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting
    let sortOption = {};
    switch (sort) {
      case "price-low-high":
        sortOption = { price: 1 };
        break;
      case "price-high-low":
        sortOption = { price: -1 };
        break;
      case "rating":
        sortOption = { rating: -1 };
        break;
      default:
        sortOption = { createdAt: -1 }; // newest first
    }

    const products = await Product.find(query)
      .sort(sortOption)
      .populate("seller", "shopName name");

    res.json(products);
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id).populate(
      "seller",
      "shopName name location phone email rating reviewsCount"
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get seller's products
// @route   GET /api/products/seller/:sellerId
// @access  Public
exports.getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.params.sellerId || req.user.id;

    if (!isValidObjectId(sellerId)) {
      return res.status(400).json({ message: "Invalid seller ID" });
    }

    const products = await Product.find({
      seller: sellerId,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error("Get seller products error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get current seller's products
// @route   GET /api/products/my-products
// @access  Private (Seller only)
exports.getMyProducts = async (req, res) => {
  try {
    // Check if user exists and has an ID
    if (!req.user || !req.user._id) {
      return res.status(400).json({ message: "User not authenticated" });
    }

    console.log("Fetching products for user:", req.user._id);

    const products = await Product.find({ seller: req.user._id }).sort({
      createdAt: -1,
    });

    console.log(`Found ${products.length} products for seller`);
    res.json(products);
  } catch (error) {
    console.error("Get my products error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Seller only - own products)
exports.updateProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the user is the owner
    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this product" });
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      unitType,
      imageUrl,
      isActive,
    } = req.body;

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (category) product.category = category;
    if (unitType) product.unitType = unitType;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (isActive !== undefined) product.isActive = isActive;

    await product.save();

    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Seller only - own products)
exports.deleteProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the user is the owner
    if (product.seller.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this product" });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = exports;
