const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

// Server-to-server, authenticated by HMAC over the raw body (see index.js)
router.post("/webhook", paymentController.handleWebhook);

router.post("/create-order", protect, paymentController.createPaymentOrder);
router.post("/verify", protect, paymentController.verifyPayment);

module.exports = router;
