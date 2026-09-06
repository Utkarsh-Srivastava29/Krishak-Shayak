const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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
    required: function () {
      return this.authProvider === "local";
    },
    trim: true,
    match: [/^\d{10}$/, "Please provide a valid 10-digit phone number"],
  },
  password: {
    type: String,
    required: function () {
      return this.authProvider === "local";
    },
    minlength: 6,
    select: false, // Don't include password in query results by default
  },
  userType: {
    type: String,
    enum: ["buyer", "seller"],
    default: "buyer",
    required: [true, "User type is required"],
  },
  address: {
    type: String,
    required: function () {
      return this.authProvider === "local";
    },
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
  // OAuth & 2FA Fields
  googleId: {
    type: String,
    sparse: true,
    unique: true,
  },
  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },
  profileImage: {
    type: String,
    default: "",
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
  },
  lastLoginIp: {
    type: String,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
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
  // Only hash the password if it's modified (or new) and exists
  if (!this.isModified("password") || !this.password) return next();

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
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate and hash password reset token
userSchema.methods.getResetPasswordToken = function () {
  // Generate random 32-byte hex token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash token using SHA-256 and store in database
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set token expiration to 15 minutes
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
