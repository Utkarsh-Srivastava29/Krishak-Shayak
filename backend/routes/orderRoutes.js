const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// Create a new order
router.post("/", orderController.createOrder);

// Get all orders for the authenticated user (buyer)
router.get("/my-orders", orderController.getMyOrders);

// Get orders for seller's shop
router.get("/seller/orders", orderController.getSellerOrders);

// Get a specific order by ID
router.get("/:id", orderController.getOrderById);

// Update order status
router.patch("/:id/status", orderController.updateOrderStatus);

// Update individual item status (for sellers)
router.patch(
  "/:orderId/item/:itemIndex/status",
  orderController.updateItemStatus
);

// Cancel an order
router.patch("/:id/cancel", orderController.cancelOrder);

module.exports = router;
