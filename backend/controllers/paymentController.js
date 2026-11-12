const Order = require("../models/Order");
const {
  getRazorpay,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  priceCart,
  toPaise,
  markOrderPaid,
  markOrderFailed,
} = require("../services/paymentService");

const ONLINE_METHODS = ["card", "upi"];

const sendError = (res, error, fallback) => {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(`[PAYMENT] ${fallback}:`, error);
  res.status(status).json({ message: status >= 500 && status !== 503 ? fallback : error.message });
};

// @desc    Create a local Order + a Razorpay order for online payment
// @route   POST /api/payments/create-order
// @access  Private
exports.createPaymentOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!ONLINE_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid online payment method" });
    }
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.address) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    const razorpay = getRazorpay();
    const priced = await priceCart(items);

    const order = await Order.create({
      buyer: req.user.id,
      items: priced.items,
      shippingAddress,
      paymentMethod,
      subtotal: priced.subtotal,
      shipping: priced.shipping,
      total: priced.total,
      status: "pending",
      paymentStatus: "pending",
      payment: { provider: "razorpay" },
    });

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount: toPaise(priced.total),
        currency: "INR",
        receipt: order._id.toString(),
        notes: { orderId: order._id.toString(), buyerId: String(req.user.id) },
      });
    } catch (rzpError) {
      await Order.deleteOne({ _id: order._id });
      throw rzpError;
    }

    order.payment.razorpayOrderId = rzpOrder.id;
    await order.save();

    res.status(201).json({
      orderId: order._id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // public key id only, never the secret
      subtotal: priced.subtotal,
      shipping: priced.shipping,
      total: priced.total,
    });
  } catch (error) {
    sendError(res, error, "Failed to initiate payment");
  }
};

// @desc    Verify the signature returned by Razorpay Checkout
// @route   POST /api/payments/verify
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await Order.findOne({ "payment.razorpayOrderId": razorpay_order_id });
    if (!order || order.buyer.toString() !== String(req.user.id)) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.paymentStatus === "paid") {
      return res.json({ success: true, orderId: order._id, paymentStatus: "paid", total: order.total });
    }

    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      await markOrderFailed(razorpay_order_id, "Signature verification failed");
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Defence in depth: confirm with Razorpay that this payment belongs to
    // this order, for the expected amount.
    const payment = await getRazorpay().payments.fetch(razorpay_payment_id);
    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== toPaise(order.total) ||
      !["authorized", "captured"].includes(payment.status)
    ) {
      await markOrderFailed(razorpay_order_id, `Unexpected payment state: ${payment.status}`);
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const { order: paidOrder } = await markOrderPaid({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    res.json({
      success: true,
      orderId: paidOrder._id,
      paymentStatus: paidOrder.paymentStatus,
      total: paidOrder.total,
    });
  } catch (error) {
    sendError(res, error, "Failed to verify payment");
  }
};

// @desc    Razorpay webhook (server to server). Source of truth if the
//          browser closes before /verify is called.
// @route   POST /api/payments/webhook   (raw body kept by express.json verify)
// @access  Public, HMAC-authenticated
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = req.body;
    const payment = event.payload?.payment?.entity;

    if (payment?.order_id) {
      if (event.event === "payment.captured" || event.event === "order.paid") {
        const order = await Order.findOne({ "payment.razorpayOrderId": payment.order_id });
        if (order && payment.amount === toPaise(order.total)) {
          await markOrderPaid({ razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id });
        } else if (order) {
          console.error(`[PAYMENT] Webhook amount mismatch for order ${order._id}`);
        }
      } else if (event.event === "payment.failed") {
        await markOrderFailed(payment.order_id, payment.error_description);
      }
    }

    // Always 200 on a valid signature so Razorpay doesn't retry forever
    res.json({ received: true });
  } catch (error) {
    console.error("[PAYMENT] Webhook error:", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};
