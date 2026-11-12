const express = require("express");
const router = express.Router();
const { createRateLimiter } = require("../middleware/rateLimiter");
const { optionalAuth } = require("../middleware/optionalAuth");
const { protect } = require("../middleware/authMiddleware");
const { chat, confirmAction } = require("../controllers/chatController");

// 10 messages burst, refilling at 1 every 10 seconds
const chatRateLimiter = createRateLimiter({
  keyPrefix: "rl:chat",
  limits: [{ type: "ip", capacity: 10, refillRate: 0.1 }],
  identifierExtractor: (req) => ({ ip: req.ip }),
});

// POST /api/chat — works for guests; signed-in farmers get memory
router.post("/", chatRateLimiter, optionalAuth, chat);

// POST /api/chat/actions/confirm — run an action the farmer confirmed
router.post("/actions/confirm", protect, confirmAction);

module.exports = router;
