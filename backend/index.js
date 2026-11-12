require("dotenv").config(); // Load environment variables first

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const marketPriceRoutes = require("./routes/marketPriceRoutes");
const schemeRoutes = require("./routes/schemeRoutes");
const chatRoutes = require("./routes/chatRoutes");
const healthRoutes = require("./routes/healthRoutes");
const memoryRoutes = require("./routes/memoryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const jobRoutes = require("./routes/jobRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const cropRoutes = require("./routes/cropRoutes");
const { startWorker, registerBullSchedules } = require("./jobs/queue");
const { connectRedis } = require("./config/redisClient");


// Environment variables are loaded at the top

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for accurate client IP extraction behind reverse proxies
// Set TRUST_PROXY=1 for single proxy (Render, Railway, Heroku), 2 for double proxy, etc.
app.set("trust proxy", parseInt(process.env.TRUST_PROXY || "1", 10));

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONTEND_URL, // Vercel frontend URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (
        process.env.FRONTEND_URL === "*" ||
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes(undefined)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Retry-After"],
    credentials: true,
  })
);
// Increase payload size limit to handle large order data with images
app.use(
  express.json({
    limit: "50mb",
    // Keep the exact bytes for HMAC checks: QStash signs job requests and
    // Razorpay signs webhooks over the raw body.
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith("/api/jobs/") || req.originalUrl === "/api/payments/webhook") {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Connect to Redis (non-blocking — server starts even if Redis is down)
connectRedis().catch((err) => {
  console.error("[REDIS] Failed to connect on startup:", err.message);
  console.warn("[REDIS] Server will run without caching. Start Redis and restart the server to enable caching.");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/market-prices", marketPriceRoutes);
app.use("/api/schemes", schemeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/crops", cropRoutes);

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Krishak Shayak API is running");
});

// JSON errors for async route failures
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled route error:", err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ message: "Server error" });
});

// Background jobs: BullMQ worker (memory consolidation, proactive alerts).
// Triggered by Upstash QStash, or by BullMQ itself when JOB_SCHEDULER=bullmq.
startWorker();
if (process.env.JOB_SCHEDULER === "bullmq") {
  registerBullSchedules().catch((err) => console.error("[JOBS] Schedule setup failed:", err.message));
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
