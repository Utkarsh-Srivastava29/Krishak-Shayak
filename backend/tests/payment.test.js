// Secure payment flow tests. No DB, Redis or Razorpay account needed.
// Run: npm run test:payment
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const express = require("express");
const {
  verifyCheckoutSignature,
  verifyWebhookSignature,
  priceCart,
  computeShipping,
  toPaise,
} = require("../services/paymentService");

const SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";
const hmac = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("hex");

const PRODUCT_A = "64b7f0c2a1b2c3d4e5f60718";
const PRODUCT_B = "64b7f0c2a1b2c3d4e5f60719";
const catalog = [
  { _id: PRODUCT_A, name: "Wheat Seeds", price: 120, stock: 50, unitType: "kg", sellerName: "Ram Agro", isActive: true },
  { _id: PRODUCT_B, name: "Urea", price: 299.5, stock: 2, unitType: "packet", sellerName: "Kisan Store", isActive: true },
  { _id: "64b7f0c2a1b2c3d4e5f6071a", name: "Old Pump", price: 5000, stock: 5, isActive: false },
];
const findProducts = async (ids) => catalog.filter((p) => ids.includes(String(p._id)));

const rejects400 = (promise, pattern) =>
  assert.rejects(promise, (e) => e.statusCode === 400 && (!pattern || pattern.test(e.message)));

// --- Checkout signature -----------------------------------------------------

test("accepts a valid checkout signature", () => {
  assert.strictEqual(verifyCheckoutSignature("order_1", "pay_1", hmac("order_1|pay_1", SECRET), SECRET), true);
});

test("rejects a signature for a different payment or order id", () => {
  const sig = hmac("order_1|pay_1", SECRET);
  assert.strictEqual(verifyCheckoutSignature("order_1", "pay_2", sig, SECRET), false);
  assert.strictEqual(verifyCheckoutSignature("order_2", "pay_1", sig, SECRET), false);
});

test("rejects a signature made with the wrong secret", () => {
  assert.strictEqual(verifyCheckoutSignature("order_1", "pay_1", hmac("order_1|pay_1", "attacker"), SECRET), false);
});

test("rejects missing or malformed signatures without throwing", () => {
  assert.strictEqual(verifyCheckoutSignature("order_1", "pay_1", undefined, SECRET), false);
  assert.strictEqual(verifyCheckoutSignature("order_1", "pay_1", "short", SECRET), false);
  assert.strictEqual(verifyCheckoutSignature("order_1", "pay_1", "x", undefined), false);
});

// --- Webhook signature ------------------------------------------------------

test("accepts a valid webhook signature over the raw bytes", () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  assert.strictEqual(verifyWebhookSignature(body, hmac(body, WEBHOOK_SECRET), WEBHOOK_SECRET), true);
});

test("rejects a webhook whose body was altered", () => {
  const sig = hmac(Buffer.from('{"amount":100}'), WEBHOOK_SECRET);
  assert.strictEqual(verifyWebhookSignature(Buffer.from('{"amount":1}'), sig, WEBHOOK_SECRET), false);
});

test("webhook endpoint checks the raw body through the real express.json setup", async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const { handleWebhook } = require("../controllers/paymentController");
  const app = express();
  // Same raw-body capture as index.js
  app.use(express.json({ verify: (req, res, buf) => { if (req.originalUrl === "/api/payments/webhook") req.rawBody = buf; } }));
  app.post("/api/payments/webhook", handleWebhook);
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api/payments/webhook`;
  // Spacing that JSON.stringify would not reproduce: proves the raw bytes are used
  const body = '{ "event" : "payment.authorized", "payload": {} }';
  const post = (sig) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": sig }, body });
  try {
    assert.strictEqual((await post(hmac(body, WEBHOOK_SECRET))).status, 200);
    assert.strictEqual((await post(hmac(body, "wrong"))).status, 400);
    assert.strictEqual((await post("")).status, 400);
  } finally {
    server.close();
  }
});

// --- Server-side pricing ----------------------------------------------------

test("prices from the database and ignores client-supplied prices", async () => {
  const r = await priceCart([{ productId: PRODUCT_A, quantity: 2, price: 1, total: 1 }], { findProducts });
  assert.strictEqual(r.items[0].price, 120);
  assert.deepStrictEqual([r.subtotal, r.shipping, r.total], [240, 40, 280]);
});

test("free shipping above ₹500 and float-safe totals in paise", async () => {
  const r = await priceCart(
    [{ productId: PRODUCT_A, quantity: 3 }, { productId: PRODUCT_B, quantity: 1 }],
    { findProducts }
  );
  assert.deepStrictEqual([r.subtotal, r.shipping], [659.5, 0]);
  assert.strictEqual(toPaise(r.total), 65950);
});

test("merges duplicate lines before checking stock", async () => {
  await rejects400(
    priceCart([{ productId: PRODUCT_B, quantity: 2 }, { productId: PRODUCT_B, quantity: 1 }], { findProducts }),
    /Only 2/
  );
});

test("rejects unknown, inactive, non-database and bad-quantity items", async () => {
  await rejects400(priceCart([{ productId: "64b7f0c2a1b2c3d4e5f6ffff", quantity: 1 }], { findProducts }), /no longer available/);
  await rejects400(priceCart([{ productId: "64b7f0c2a1b2c3d4e5f6071a", quantity: 1 }], { findProducts }), /no longer available/);
  await rejects400(priceCart([{ productId: "mock-1", name: "Tomato", quantity: 1 }], { findProducts }), /not available for online payment/);
  for (const quantity of [0, -5, 1.5, "abc", 5000]) {
    await rejects400(priceCart([{ productId: PRODUCT_A, quantity }], { findProducts }), /Invalid quantity/);
  }
  await rejects400(priceCart([], { findProducts }), /at least one item/);
});

test("shipping rule matches the cart UI", () => {
  assert.strictEqual(computeShipping(500), 40);
  assert.strictEqual(computeShipping(500.01), 0);
});
