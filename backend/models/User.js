const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please provide a valid email",
    ],
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6,
    select: false, // Don't include password in query results by default
  },
  userType: {
    type: String,
    enum: ["buyer", "seller"],
    required: [true, "User type is required"],
  },
  address: {
    type: String,
    required: [true, "Address is required"],
  },
  aadharNumber: {
    type: String,
    validate: {
      validator: function (v) {
        // Only validate aadhar if user type is seller
        if (this.userType === "seller") {
          return /^\d{12}$/.test(v);
        }
        return true;
      },
      message: "Aadhar number must be 12 digits",
    },
  },
  // Seller-specific fields
  shopName: {
    type: String,
    required: function () {
      return this.userType === "seller";
    },
  },
  shopDescription: {
    type: String,
    default: "",
  },
  location: {
    type: String,
    default: "",
  },
  bannerImage: {
    type: String,
    default: "",
  },
  verified: {
    type: Boolean,
    default: false,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviewsCount: {
    type: Number,
    default: 0,
  },
  totalSales: {
    type: Number,
    default: 0,
  },
  followers: {
    type: Number,
    default: 0,
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

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
