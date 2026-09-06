const express = require("express");
const router = express.Router();
const { getHealthStatus, getMetricChart } = require("../controllers/healthController");

// Public health check route
// GET /api/health
router.get("/", getHealthStatus);

// Live CloudWatch metric widget image stream
// GET /api/health/chart?type=uptime|latency|errors&hours=3
router.get("/chart", getMetricChart);

module.exports = router;
