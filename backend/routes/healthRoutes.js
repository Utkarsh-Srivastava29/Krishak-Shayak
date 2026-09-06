const express = require("express");
const router = express.Router();
const { getHealthStatus } = require("../controllers/healthController");

// Public health check route
// GET /api/health
router.get("/", getHealthStatus);

module.exports = router;
