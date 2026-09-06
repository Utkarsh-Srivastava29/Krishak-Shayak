const express = require("express");
const router = express.Router();
const cacheMiddleware = require("../middleware/cacheMiddleware");
const { getMarketPrices } = require("../controllers/marketPriceController");

// TTL: 1 hour (3600 seconds) — government data updates daily at most
const MARKET_PRICE_TTL = 3600;

// GET /api/market-prices?state=<state>&district=<district>&...
router.get("/", cacheMiddleware("market-prices", MARKET_PRICE_TTL), getMarketPrices);

module.exports = router;
