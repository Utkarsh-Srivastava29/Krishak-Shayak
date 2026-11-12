const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Product = require("../models/Product");
const Order = require("../models/Order");

const FREE_SHIPPING_THRESHOLD = 500; // ₹
const FLAT_SHIPPING_FEE = 40; // ₹

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

let razorpayInstance = null;

/**
 * Lazily create the Razorpay client so the server still boots (and cash on
 * delivery still works) when payment keys are not configured.
 */
const getRazorpay = () => {
  if (razorpayInstance) return razorpayInstance;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw httpError("Online payments are not configured on the server", 503);
  }
  razorpayInstance = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return razorpayInstance;
};

/** Constant-time comparison of two hex HMAC strings. */
const safeEqualHex = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Verify the signature Razorpay Checkout returns to the browser.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
const verifyCheckoutSignature = (
  razorpayOrderId,
  razorpayPaymentId,
  signature,
  secret = process.env.RAZORPAY_KEY_SECRET
) => {
  if (!secret || !razorpayOrderId || !razorpayPaymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
};

/**
 * Verify a webhook body. Must be called with the RAW request body (Buffer):
 * re-serialising parsed JSON can change bytes and break the HMAC.
 */
const verifyWebhookSignature = (rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) => {
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
};

const computeShipping = (subtotal) => (subtotal > FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE);

/** Round to 2 decimals to avoid float drift (e.g. 0.1 + 0.2). */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Price a cart from authoritative product data in MongoDB. The client's
 * price / total fields are ignored entirely.
 *
 * @param {Array<{productId: string, quantity: number}>} items
 * @param {object} [deps] injectable for tests: { findProducts }
 * @returns {Promise<{items, subtotal, shipping, total}>}
 * @throws  Error with statusCode 400 for unknown / inactive / out-of-stock items
 */
const priceCart = async (items, deps = {}) => {
  const findProducts = deps.findProducts || ((ids) => Product.find({ _id: { $in: ids } }).lean());

  if (!Array.isArray(items) || items.length === 0) {
    throw httpError("Order must contain at least one item", 400);
  }

  // Merge duplicate lines and validate shape
  const quantities = new Map();
  for (const item of items) {
    const productId = String(item.productId || item.id || item._id || "");
    const quantity = Number(item.quantity);
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw httpError(`"${item.name || productId}" is not available for online payment`, 400);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw httpError(`Invalid quantity for "${item.name || productId}"`, 400);
    }
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  const products = await findProducts([...quantities.keys()]);
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const pricedItems = [];
  for (const [productId, quantity] of quantities) {
    const product = byId.get(productId);
    if (!product || product.isActive === false) {
      throw httpError(`Product ${productId} is no longer available`, 400);
    }
    if (typeof product.stock === "number" && product.stock < quantity) {
      throw httpError(
        `Only ${product.stock} ${product.unitType || "units"} of "${product.name}" left in stock`,
        400
      );
    }
    pricedItems.push({
      productId,
      name: product.name,
      price: product.price,
      quantity,
      image: product.imageUrl || "",
      seller: product.sellerName || "Unknown Seller",
      status: "pending",
    });
  }

  const subtotal = round2(pricedItems.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const shipping = computeShipping(subtotal);
  return { items: pricedItems, subtotal, shipping, total: round2(subtotal + shipping) };
};

/** Rupees -> integer paise, as Razorpay requires. */
const toPaise = (rupees) => Math.round(rupees * 100);

/**
 * Idempotently mark an order paid. Called by both the checkout verify
 * endpoint and the webhook; whichever arrives first wins and the other is a
 * no-op. Stock is decremented only on the transition to "paid".
 */
const markOrderPaid = async ({ razorpayOrderId, razorpayPaymentId, signature }) => {
  const order = await Order.findOneAndUpdate(
    { "payment.razorpayOrderId": razorpayOrderId, paymentStatus: { $ne: "paid" } },
    {
      $set: {
        paymentStatus: "paid",
        status: "processing",
        "payment.razorpayPaymentId": razorpayPaymentId,
        ...(signature && { "payment.razorpaySignature": signature }),
        "payment.paidAt": new Date(),
      },
    },
    { new: true }
  );

  if (!order) {
    // Already paid (or unknown order): return the current state
    return {
      order: await Order.findOne({ "payment.razorpayOrderId": razorpayOrderId }),
      transitioned: false,
    };
  }

  await Promise.all(
    order.items.map((item) =>
      Product.updateOne(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      )
    )
  );
  return { order, transitioned: true };
};

const markOrderFailed = (razorpayOrderId, reason) =>
  Order.findOneAndUpdate(
    { "payment.razorpayOrderId": razorpayOrderId, paymentStatus: "pending" },
    { $set: { paymentStatus: "failed", "payment.failureReason": reason || "" } },
    { new: true }
  );

module.exports = {
  getRazorpay,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  priceCart,
  computeShipping,
  toPaise,
  markOrderPaid,
  markOrderFailed,
};
