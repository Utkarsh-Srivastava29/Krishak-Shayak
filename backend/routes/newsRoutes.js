const express = require("express");
const router = express.Router();
const cacheMiddleware = require("../middleware/cacheMiddleware");
const { getNews } = require("../controllers/newsController");

// 1 hour: keeps well inside NewsData.io's free daily credit limit.
// Responses with untranslated fallback items are cached briefly so the
// translation is retried soon.
const NEWS_TTL = 60 * 60;
router.get(
  "/",
  cacheMiddleware("news", (data) => (data.items?.some((i) => i.translated === false) ? 300 : NEWS_TTL)),
  getNews
);

module.exports = router;
