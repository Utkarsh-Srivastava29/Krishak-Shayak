const express = require("express");
const router = express.Router();
const cacheMiddleware = require("../middleware/cacheMiddleware");
const { getAllSchemes } = require("../controllers/schemeController");

// TTL: 7 days (604800 seconds) — schemes rarely change
const SCHEMES_TTL = 7 * 24 * 60 * 60;

// GET /api/schemes
router.get("/", cacheMiddleware("schemes", SCHEMES_TTL), getAllSchemes);

module.exports = router;
