const express = require("express");
const router = express.Router();
const { getHealthStatus, getMetricChart } = require("../controllers/healthController");

const DEV_HEALTH_KEY = process.env.DEV_HEALTH_KEY || "ks-dev-admin-2026";

/**
 * Developer Passkey Middleware
 * Checks ?key=... or x-dev-key header. Returns 404 if invalid so endpoint is completely hidden.
 */
const verifyDevKey = (req, res, next) => {
  const providedKey = req.query.key || req.headers["x-dev-key"];
  if (!providedKey || providedKey !== DEV_HEALTH_KEY) {
    return res.status(404).json({ message: "Cannot GET " + req.originalUrl });
  }
  next();
};

// Protect all health routes
router.use(verifyDevKey);

// Developer health check route
// GET /api/health?key=...
router.get("/", getHealthStatus);

// Live CloudWatch metric widget image stream
// GET /api/health/chart?type=uptime|latency|errors&hours=3&key=...
router.get("/chart", getMetricChart);

module.exports = router;
