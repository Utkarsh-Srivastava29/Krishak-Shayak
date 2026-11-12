const express = require("express");
const router = express.Router();
const { optionalAuth } = require("../middleware/optionalAuth");
const { getRecommendations } = require("../controllers/cropController");

// GET /api/crops/recommendations?location=<place>&lang=<en|hi>
// Signed-in farmers get results tuned to their saved state, irrigation and soil.
router.get("/recommendations", optionalAuth, getRecommendations);

module.exports = router;
