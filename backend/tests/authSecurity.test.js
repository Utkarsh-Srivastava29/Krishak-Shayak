const assert = require("assert");
const crypto = require("crypto");
require("dotenv").config();

const { connectRedis, getRawRedisClient } = require("../config/redisClient");
const {
  generateOtp,
  verifyOtp,
  canResendOtp,
  createPendingSession,
  getPendingSession,
  deletePendingSession,
} = require("../services/otpService");
const {
  getGoogleAuthUrl,
  validateState,
} = require("../services/googleAuthService");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING AUTH & 2FA SECURITY TEST SUITE");
  console.log("==================================================");

  // 1. Connect to Redis
  console.log("\n[1] Connecting to Redis...");
  await connectRedis();
  const redis = getRawRedisClient();
  assert(redis, "Redis client must be initialized");
  console.log("✅ Redis connected successfully");

  const testUserId = "test-user-" + Date.now();

  // 2. Test OTP Generation & Secure Storage
  console.log("\n[2] Testing OTP Generation & Storage...");
  const otpResult = await generateOtp(testUserId);
  assert(otpResult, "generateOtp must return an object");
  assert(otpResult.otp && otpResult.otp.length === 6, "OTP must be 6 digits");
  assert(/^\d{6}$/.test(otpResult.otp), "OTP must be numeric");

  // Verify that plaintext OTP is NOT stored in Redis
  const rawStored = await redis.get(`otp:${testUserId}`);
  assert(rawStored, "Redis key otp:userId must exist");
  const storedJson = JSON.parse(rawStored);
  assert(!storedJson.otp, "Plaintext OTP must NEVER be stored in Redis");
  assert(storedJson.hash, "OTP hash must exist in Redis");

  const expectedHash = crypto
    .createHash("sha256")
    .update(otpResult.otp)
    .digest("hex");
  assert.strictEqual(
    storedJson.hash,
    expectedHash,
    "Stored hash must match SHA-256 of OTP"
  );
  console.log("✅ OTP generated and securely hashed with SHA-256 (no plaintext stored)");

  // 3. Test Resend Cooldown
  console.log("\n[3] Testing Resend Cooldown...");
  const cooldownCheck = await canResendOtp(testUserId);
  assert.strictEqual(
    cooldownCheck.canResend,
    false,
    "Resend must be blocked within 60s cooldown"
  );
  assert(
    cooldownCheck.waitSeconds > 0 && cooldownCheck.waitSeconds <= 60,
    "Wait seconds must be between 1 and 60"
  );
  console.log(`✅ Resend cooldown active: ${cooldownCheck.waitSeconds}s remaining`);

  // 4. Test Invalid OTP & Attempt Limiting
  console.log("\n[4] Testing Invalid OTP & Attempt Decrement...");
  const wrongOtp = otpResult.otp === "123456" ? "654321" : "123456";
  const fail1 = await verifyOtp(testUserId, wrongOtp);
  assert.strictEqual(fail1.success, false, "Wrong OTP must fail");
  assert.strictEqual(fail1.error, "invalid", "Error type must be 'invalid'");
  assert.strictEqual(fail1.attemptsRemaining, 4, "Attempts remaining must be 4");

  await verifyOtp(testUserId, wrongOtp); // attempt 2
  await verifyOtp(testUserId, wrongOtp); // attempt 3
  await verifyOtp(testUserId, wrongOtp); // attempt 4
  const fail5 = await verifyOtp(testUserId, wrongOtp); // attempt 5 (exhaustion)
  assert.strictEqual(fail5.error, "too_many_attempts", "Must return too_many_attempts on 5th failure");

  const keyAfterExhaustion = await redis.get(`otp:${testUserId}`);
  assert.strictEqual(
    keyAfterExhaustion,
    null,
    "OTP must be invalidated from Redis after max attempts"
  );
  console.log("✅ Attempt limiting verified: blocked and deleted after 5 attempts");

  // 5. Test Successful OTP Verification & Invalidation (Anti-Replay)
  console.log("\n[5] Testing Successful OTP Verification & Invalidation...");
  const newOtpResult = await generateOtp(testUserId);
  const successVerify = await verifyOtp(testUserId, newOtpResult.otp);
  assert.strictEqual(
    successVerify.success,
    true,
    "Correct OTP must verify successfully"
  );

  // Attempt replay with the same OTP
  const replayVerify = await verifyOtp(testUserId, newOtpResult.otp);
  assert.strictEqual(
    replayVerify.success,
    false,
    "OTP cannot be reused after successful verification"
  );
  assert.strictEqual(
    replayVerify.error,
    "expired",
    "Reused OTP must be treated as expired"
  );
  console.log("✅ Anti-replay verified: OTP deleted immediately upon successful verification");

  // 6. Test Pending 2FA Sessions
  console.log("\n[6] Testing Pending 2FA Session Lifecycle...");
  const sessionId = await createPendingSession(
    testUserId,
    "127.0.0.1",
    "Mozilla/5.0 Test Browser"
  );
  assert(sessionId, "Session ID must be created");

  const retrievedSession = await getPendingSession(sessionId);
  assert(retrievedSession, "Pending session must be retrievable");
  assert.strictEqual(retrievedSession.userId, testUserId, "User ID must match");
  assert.strictEqual(retrievedSession.ip, "127.0.0.1", "IP must match");

  await deletePendingSession(sessionId);
  const deletedSession = await getPendingSession(sessionId);
  assert.strictEqual(
    deletedSession,
    null,
    "Session must be null after deletion"
  );
  console.log("✅ Pending 2FA sessions created, retrieved, and deleted successfully");

  // 7. Test Google OAuth State Validation (Anti-CSRF)
  console.log("\n[7] Testing Google OAuth State Validation (CSRF Protection)...");
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "mock-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "mock-client-secret";

  const authUrlResult = await getGoogleAuthUrl();
  assert(authUrlResult && authUrlResult.state, "Google auth state must be generated");
  assert(authUrlResult.url.includes("accounts.google.com"), "URL must point to Google");

  const validState = await validateState(authUrlResult.state);
  assert.strictEqual(validState, true, "First state validation must succeed");

  const replayState = await validateState(authUrlResult.state);
  assert.strictEqual(
    replayState,
    false,
    "OAuth state cannot be reused (one-time token)"
  );

  const fakeState = await validateState("completely-fake-state");
  assert.strictEqual(fakeState, false, "Fake state must be rejected");
  console.log("✅ OAuth CSRF state protection verified (one-time use, replay prevention)");

  // Clean up test key
  await redis.del(`otp:${testUserId}`);

  console.log("\n==================================================");
  console.log("🎉 ALL 7 TEST SUITES PASSED CLEANLY!");
  console.log("==================================================");

  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

