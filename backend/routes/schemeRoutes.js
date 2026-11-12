const express = require("express");
const router = express.Router();
const cacheMiddleware = require("../middleware/cacheMiddleware");
const { getAllSchemes } = require("../controllers/schemeController");

// TTL: 7 days (604800 seconds) — schemes rarely change
const SCHEMES_TTL = 7 * 24 * 60 * 60;

// GET /api/schemes?lang=<en|hi>
// Hindi responses with any untranslated scheme are cached for 5 minutes only,
// so translation is retried.
router.get(
  "/",
  cacheMiddleware("schemes", (data) =>
    Array.isArray(data) && data.some((s) => s.translated === false) ? 300 : SCHEMES_TTL
  ),
  getAllSchemes
);

module.exports = router;
