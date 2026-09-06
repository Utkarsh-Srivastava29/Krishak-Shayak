const crypto = require("crypto");
const { getRawRedisClient, isRedisReady } = require("../config/redisClient");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_SECONDS || "600", 10); // 10 min
const OTP_RESEND_COOLDOWN = parseInt(process.env.OTP_RESEND_COOLDOWN || "60", 10); // 60s
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure 6-digit OTP.
 * Uses crypto.randomInt for uniform distribution.
 */
const generateRandomOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hashes an OTP using SHA-256 for secure storage.
 * We use SHA-256 (not bcrypt) because:
 * - OTPs are short-lived (10 min TTL in Redis)
 * - We need timing-safe comparison
 * - Performance matters for real-time verification
 */
const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

// ---------------------------------------------------------------------------
// OTP lifecycle
// ---------------------------------------------------------------------------

/**
 * Generates a new OTP for the given user, stores its hash in Redis,
 * and returns the plain-text OTP (for emailing only).
 *
 * - Invalidates any existing OTP for the user
 * - Stores: { hash, attempts: 0, createdAt }
 * - Sets TTL to OTP_EXPIRY seconds
 *
 * @param {string} userId - MongoDB user ID
 * @returns {{ otp: string, expiresIn: number } | null}
 */
const generateOtp = async (userId) => {
  if (!isRedisReady()) {
    console.error("[OTP] Redis unavailable, cannot generate OTP");
    return null;
  }

  try {
    const redis = getRawRedisClient();
    const key = `otp:${userId}`;

    const otp = generateRandomOtp();
    const hash = hashOtp(otp);

    const data = JSON.stringify({
      hash,
      attempts: 0,
      createdAt: Date.now(),
    });

    // Store with TTL — automatically invalidates previous OTP
    await redis.setex(key, OTP_EXPIRY, data);

    // Log event (never log the OTP value itself)
    console.log(`[OTP] Generated for user ${userId}, expires in ${OTP_EXPIRY}s`);

    return { otp, expiresIn: OTP_EXPIRY };
  } catch (error) {
    console.error("[OTP] Error generating OTP:", error.message);
    return null;
  }
};

/**
 * Verifies an OTP input against the stored hash.
 *
 * @param {string} userId - MongoDB user ID
 * @param {string} otpInput - The OTP entered by the user
 * @returns {{ success: boolean, error?: string }}
 */
const verifyOtp = async (userId, otpInput) => {
  if (!isRedisReady()) {
    return { success: false, error: "Service temporarily unavailable" };
  }

  try {
    const redis = getRawRedisClient();
    const key = `otp:${userId}`;

    const raw = await redis.get(key);
    if (!raw) {
      return { success: false, error: "expired" };
    }

    const data = JSON.parse(raw);

    // Check max attempts
    if (data.attempts >= OTP_MAX_ATTEMPTS) {
      await redis.del(key); // Invalidate exhausted OTP
      return { success: false, error: "too_many_attempts" };
    }

    // Increment attempt counter
    data.attempts += 1;
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(data));
    }

    // Timing-safe comparison of hashes
    const inputHash = hashOtp(otpInput);
    const storedHashBuf = Buffer.from(data.hash, "hex");
    const inputHashBuf = Buffer.from(inputHash, "hex");

    if (
      storedHashBuf.length !== inputHashBuf.length ||
      !crypto.timingSafeEqual(storedHashBuf, inputHashBuf)
    ) {
      if (data.attempts >= OTP_MAX_ATTEMPTS) {
        await redis.del(key);
        console.log(`[OTP] Max attempts reached for user ${userId}, OTP invalidated`);
        return {
          success: false,
          error: "too_many_attempts",
          attemptsRemaining: 0,
        };
      }

      const remaining = OTP_MAX_ATTEMPTS - data.attempts;
      console.log(`[OTP] Verification failed for user ${userId}, ${remaining} attempts remaining`);
      return {
        success: false,
        error: "invalid",
        attemptsRemaining: remaining,
      };
    }

    // Success — delete OTP to prevent reuse
    await redis.del(key);
    console.log(`[OTP] Verified successfully for user ${userId}`);

    return { success: true };
  } catch (error) {
    console.error("[OTP] Error verifying OTP:", error.message);
    return { success: false, error: "Service temporarily unavailable" };
  }
};

/**
 * Checks if the user can request a new OTP (resend cooldown).
 *
 * @param {string} userId - MongoDB user ID
 * @returns {{ canResend: boolean, waitSeconds?: number }}
 */
const canResendOtp = async (userId) => {
  if (!isRedisReady()) {
    return { canResend: true }; // Fail open
  }

  try {
    const redis = getRawRedisClient();
    const key = `otp:${userId}`;

    const raw = await redis.get(key);
    if (!raw) {
      return { canResend: true };
    }

    const data = JSON.parse(raw);
    const elapsed = (Date.now() - data.createdAt) / 1000;

    if (elapsed < OTP_RESEND_COOLDOWN) {
      const waitSeconds = Math.ceil(OTP_RESEND_COOLDOWN - elapsed);
      return { canResend: false, waitSeconds };
    }

    return { canResend: true };
  } catch (error) {
    console.error("[OTP] Error checking resend cooldown:", error.message);
    return { canResend: true };
  }
};

// ---------------------------------------------------------------------------
// Pending 2FA session management
// ---------------------------------------------------------------------------

/**
 * Creates a pending 2FA session in Redis.
 * Returns an opaque session ID that the frontend uses to complete verification.
 *
 * @param {string} userId - MongoDB user ID
 * @param {string} ip - Client IP address
 * @param {string} userAgent - Client user-agent string
 * @returns {string|null} sessionId
 */
const createPendingSession = async (userId, ip, userAgent, rememberMe = true) => {
  if (!isRedisReady()) {
    console.error("[OTP] Redis unavailable, cannot create pending session");
    return null;
  }

  try {
    const redis = getRawRedisClient();
    const sessionId = crypto.randomUUID();
    const key = `pending_2fa:${sessionId}`;

    const data = JSON.stringify({
      userId,
      ip,
      userAgent,
      rememberMe: rememberMe !== false,
      createdAt: Date.now(),
    });

    await redis.setex(key, OTP_EXPIRY, data);
    console.log(`[OTP] Pending session created for user ${userId}`);

    return sessionId;
  } catch (error) {
    console.error("[OTP] Error creating pending session:", error.message);
    return null;
  }
};

/**
 * Retrieves and validates a pending 2FA session.
 *
 * @param {string} sessionId - The session ID from the frontend
 * @returns {{ userId: string, ip: string, userAgent: string } | null}
 */
const getPendingSession = async (sessionId) => {
  if (!isRedisReady() || !sessionId) return null;

  try {
    const redis = getRawRedisClient();
    const key = `pending_2fa:${sessionId}`;

    const raw = await redis.get(key);
    if (!raw) return null;

    return JSON.parse(raw);
  } catch (error) {
    console.error("[OTP] Error retrieving pending session:", error.message);
    return null;
  }
};

/**
 * Deletes a pending 2FA session after successful verification.
 *
 * @param {string} sessionId
 */
const deletePendingSession = async (sessionId) => {
  if (!isRedisReady() || !sessionId) return;

  try {
    const redis = getRawRedisClient();
    await redis.del(`pending_2fa:${sessionId}`);
  } catch (error) {
    console.error("[OTP] Error deleting pending session:", error.message);
  }
};

module.exports = {
  generateOtp,
  verifyOtp,
  canResendOtp,
  createPendingSession,
  getPendingSession,
  deletePendingSession,
};
