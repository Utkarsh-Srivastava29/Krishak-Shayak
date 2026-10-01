const express = require("express");
const router = express.Router();
const { createRateLimiter } = require("../middleware/rateLimiter");
const { chat } = require("../controllers/chatController");

// 10 messages burst, refilling at 1 every 10 seconds
const chatRateLimiter = createRateLimiter({
  keyPrefix: "rl:chat",
  limits: [{ type: "ip", capacity: 10, refillRate: 0.1 }],
  identifierExtractor: (req) => ({ ip: req.ip }),
});

// POST /api/chat
router.post("/", chatRateLimiter, chat);

module.exports = router;
