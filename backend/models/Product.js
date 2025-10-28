const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Product name is required"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Product description is required"],
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0,
  },
  stock: {
    type: Number,
    required: [true, "Stock is required"],
    min: 0,
    default: 0,
  },
  category: {
    type: String,
    required: [true, "Category is required"],
    enum: [
      "vegetables",
      "fruits",
      "grains",
      "dairy",
      "tools",
      "seeds",
      "fertilizers",
      "equipment",
    ],
  },
  unitType: {
    type: String,
    required: [true, "Unit type is required"],
    enum: [
      "kg",
      "g",
      "liter",
      "ml",
      "piece",
      "pcs",
      "packet",
      "gram",
      "quintal",
      "ton",
      "L",
    ],
  },
  imageUrl: {
    type: String,
    default: "",
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sellerName: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
