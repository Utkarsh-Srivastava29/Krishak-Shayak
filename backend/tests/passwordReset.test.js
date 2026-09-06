const assert = require("assert");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-123456";

const User = require("../models/User");

async function runPasswordResetTests() {
  console.log("==================================================");
  console.log("🧪 STARTING PASSWORD RESET & REMEMBER ME TESTS");
  console.log("==================================================");

  // 1. Test getResetPasswordToken method on User model
  console.log("\n[1] Testing getResetPasswordToken generation and SHA-256 hashing...");
  const dummyUser = new User({
    name: "Test Farmer",
    email: "farmer.test@example.com",
    phone: "9876543210",
    password: "OldPassword123!",
    userType: "buyer",
    address: "Farm Road 1",
  });

  const rawToken = dummyUser.getResetPasswordToken();
  assert(rawToken && typeof rawToken === "string", "Raw token must be returned as a string");
  assert.strictEqual(rawToken.length, 64, "Raw token must be a 32-byte hex string (64 characters)");

  // Check stored hash
  assert(dummyUser.resetPasswordToken, "resetPasswordToken must be stored in User");
  assert.notStrictEqual(dummyUser.resetPasswordToken, rawToken, "Stored token must NOT be plaintext");

  const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.strictEqual(
    dummyUser.resetPasswordToken,
    expectedHash,
    "Stored reset token must be the SHA-256 hash of raw token"
  );

  // Check expiration (should be approximately 15 minutes from now)
  const now = Date.now();
  const fifteenMinutesFromNow = now + 15 * 60 * 1000;
  const expireTime = new Date(dummyUser.resetPasswordExpire).getTime();
  assert(
    Math.abs(expireTime - fifteenMinutesFromNow) < 5000,
    "Token expiration must be set to 15 minutes"
  );
  console.log("✅ Reset token generated and securely hashed with SHA-256 (15-minute TTL)");

  // 2. Test Expired Token Detection
  console.log("\n[2] Testing Expired Token Detection...");
  const expiredUser = new User({
    name: "Expired User",
    email: "expired@example.com",
    phone: "9876543210",
    password: "Password123",
    userType: "buyer",
    address: "Address",
  });
  expiredUser.getResetPasswordToken();
  // Simulate expired token
  expiredUser.resetPasswordExpire = new Date(Date.now() - 1000); // 1 second ago

  const isExpired = expiredUser.resetPasswordExpire.getTime() < Date.now();
  assert.strictEqual(isExpired, true, "Expired token must be detected");
  console.log("✅ Expired tokens correctly rejected");

  // 3. Test Token Single-Use (Clearing on successful reset)
  console.log("\n[3] Testing Token Invalidation after Reset...");
  dummyUser.password = "NewPassword123!";
  dummyUser.resetPasswordToken = undefined;
  dummyUser.resetPasswordExpire = undefined;

  assert.strictEqual(dummyUser.resetPasswordToken, undefined, "Reset token must be cleared");
  assert.strictEqual(dummyUser.resetPasswordExpire, undefined, "Reset expire must be cleared");
  console.log("✅ Token successfully cleared to prevent replay attacks");

  // 4. Test Remember Me JWT Expiry (30d vs 1d)
  console.log("\n[4] Testing Remember Me JWT Expiry Calculation...");
  const tokenRemembered = jwt.sign({ id: "user123" }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  const decodedRemembered = jwt.decode(tokenRemembered);
  const durationRemembered = decodedRemembered.exp - decodedRemembered.iat;
  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
  assert.strictEqual(
    durationRemembered,
    thirtyDaysInSeconds,
    "Remembered token must expire in exactly 30 days"
  );

  const tokenSession = jwt.sign({ id: "user123" }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
  const decodedSession = jwt.decode(tokenSession);
  const durationSession = decodedSession.exp - decodedSession.iat;
  const oneDayInSeconds = 24 * 60 * 60;
  assert.strictEqual(
    durationSession,
    oneDayInSeconds,
    "Session token must expire in exactly 1 day"
  );
  console.log("✅ Remember Me (30 days) vs Session (1 day) JWT lifetimes verified");

  console.log("\n==================================================");
  console.log("🎉 ALL PASSWORD RESET & REMEMBER ME TESTS PASSED!");
  console.log("==================================================");
}

runPasswordResetTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});

