const fs = require("fs");
const path = require("path");
const { getRawRedisClient, isRedisReady } = require("../config/redisClient");

// ---------------------------------------------------------------------------
// Configuration (all configurable via environment variables)
// ---------------------------------------------------------------------------
const config = {
  // Per-IP rate limit
  ip: {
    capacity: parseInt(process.env.LOGIN_IP_CAPACITY || "20", 10),
    refillRate: parseFloat(process.env.LOGIN_IP_REFILL_RATE || "0.33"),
  },
  // Per-account rate limit
  account: {
    capacity: parseInt(process.env.LOGIN_ACCOUNT_CAPACITY || "7", 10),
    refillRate: parseFloat(process.env.LOGIN_ACCOUNT_REFILL_RATE || "0.017"),
  },
  // Per-IP+account rate limit
  ipAccount: {
    capacity: parseInt(process.env.LOGIN_IP_ACCOUNT_CAPACITY || "5", 10),
    refillRate: parseFloat(
      process.env.LOGIN_IP_ACCOUNT_REFILL_RATE || "0.0083"
    ),
  },
  // Failed login exponential backoff
  failBaseDelay: parseInt(process.env.LOGIN_FAIL_BASE_DELAY || "1", 10),
  failMaxDelay: parseInt(process.env.LOGIN_FAIL_MAX_DELAY || "900", 10),
  // Redis failure behavior: 'open' (allow requests) or 'closed' (reject requests)
  failMode: process.env.RATE_LIMIT_FAIL_MODE || "open",
};

// ---------------------------------------------------------------------------
// Load the Lua script once at startup
// ---------------------------------------------------------------------------
const TOKEN_BUCKET_LUA = fs.readFileSync(
  path.join(__dirname, "..", "scripts", "tokenBucket.lua"),
  "utf8"
);

// Track whether the custom command has been defined on the Redis client
let commandDefined = false;

/**
 * Ensures the custom 'tokenBucket' command is defined on the Redis client.
 * Uses ioredis defineCommand for automatic EVALSHA with EVAL fallback.
 */
const ensureCommand = () => {
  if (commandDefined) return;
  const redis = getRawRedisClient();
  redis.defineCommand("tokenBucket", {
    numberOfKeys: 1,
    lua: TOKEN_BUCKET_LUA,
  });
  commandDefined = true;
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Normalizes an email for consistent Redis key generation.
 * Matches the Mongoose User schema behavior (lowercase + trim).
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== "string") return null;
  return email.trim().toLowerCase();
};

/**
 * Calculates the TTL for a bucket key.
 * TTL = capacity / refillRate (time to fully refill), with a minimum of 60 seconds.
 */
const calculateTtl = (capacity, refillRate) => {
  if (refillRate <= 0) return 3600; // fallback: 1 hour
  return Math.max(60, Math.ceil(capacity / refillRate));
};

/**
 * Attempts to consume a token from the specified bucket.
 * Returns { allowed, remaining, retryAfter }.
 */
const consumeToken = async (key, capacity, refillRate) => {
  const redis = getRawRedisClient();
  ensureCommand();

  const now = Date.now() / 1000; // current time in seconds
  const ttl = calculateTtl(capacity, refillRate);

  // ioredis defineCommand creates the method on the client
  const result = await redis.tokenBucket(key, capacity, refillRate, now, ttl);

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    retryAfter: result[2],
  };
};

// ---------------------------------------------------------------------------
// Login rate limiter middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that enforces three independent token bucket rate limits
 * on the login endpoint:
 *   1. Per IP — prevents one IP from flooding the endpoint
 *   2. Per account/email — prevents brute-force on a single account
 *   3. Per IP+account — prevents one IP from repeatedly targeting one account
 *
 * If any limit is exceeded, returns HTTP 429 with Retry-After header.
 * If Redis is unavailable, fails open (allows request through with a warning).
 */
const loginRateLimiter = async (req, res, next) => {
  try {
    // Fail-open or fail-closed check
    if (!isRedisReady()) {
      if (config.failMode === "closed") {
        console.error(
          "Rate limiter: Redis unavailable, failing closed (rejecting request)"
        );
        return res.status(503).json({
          success: false,
          message: "Service temporarily unavailable. Please try again later.",
        });
      }
      // Fail open: allow request through with warning
      console.warn(
        "Rate limiter: Redis unavailable, failing open (allowing request)"
      );
      return next();
    }

    const clientIp = req.ip;
    const email = normalizeEmail(req.body && req.body.email);

    // Store normalized email for use by the auth controller (failed login tracking)
    res.locals._rateLimitEmail = email;
    res.locals._rateLimitIp = clientIp;

    // Build the list of rate limit checks to perform
    const checks = [];

    // 1. Per-IP check (always applies)
    checks.push({
      key: `rl:login:ip:${clientIp}`,
      capacity: config.ip.capacity,
      refillRate: config.ip.refillRate,
      label: "per-IP",
    });

    // 2. Per-account check (only if email is provided and valid)
    if (email) {
      checks.push({
        key: `rl:login:acct:${email}`,
        capacity: config.account.capacity,
        refillRate: config.account.refillRate,
        label: "per-account",
      });

      // 3. Per-IP+account check
      checks.push({
        key: `rl:login:ip_acct:${clientIp}:${email}`,
        capacity: config.ipAccount.capacity,
        refillRate: config.ipAccount.refillRate,
        label: "per-IP+account",
      });
    }

    // 4. Check failed login backoff (only if email is provided)
    if (email) {
      const redis = getRawRedisClient();
      const failKey = `rl:login:fail:${clientIp}:${email}`;
      const failCount = await redis.get(failKey);
      if (failCount) {
        const count = parseInt(failCount, 10);
        const backoffDelay = Math.min(
          config.failBaseDelay * Math.pow(2, count - 1),
          config.failMaxDelay
        );
        const ttl = await redis.ttl(failKey);
        if (ttl > 0) {
          return res
            .status(429)
            .set("Retry-After", String(ttl))
            .json({
              success: false,
              message: "Too many failed login attempts. Please try again later.",
            });
        }
      }
    }

    // Run all token bucket checks concurrently
    const results = await Promise.all(
      checks.map((check) =>
        consumeToken(check.key, check.capacity, check.refillRate)
      )
    );

    // Find the most restrictive result
    let blocked = false;
    let maxRetryAfter = 0;

    for (let i = 0; i < results.length; i++) {
      if (!results[i].allowed) {
        blocked = true;
        if (results[i].retryAfter > maxRetryAfter) {
          maxRetryAfter = results[i].retryAfter;
        }
      }
    }

    if (blocked) {
      const retryAfter = Math.max(1, maxRetryAfter);
      return res
        .status(429)
        .set("Retry-After", String(retryAfter))
        .json({
          success: false,
          message: "Too many requests. Please try again later.",
        });
    }

    // All limits passed — proceed to authentication
    next();
  } catch (error) {
    // On any unexpected error, fail open
    console.error("Rate limiter error:", error.message);
    if (config.failMode === "closed") {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable. Please try again later.",
      });
    }
    next();
  }
};

// ---------------------------------------------------------------------------
// Failed login tracking
// ---------------------------------------------------------------------------

/**
 * Records a failed login attempt for the given IP + email combination.
 * Implements exponential backoff by setting a Redis key with an increasing TTL.
 *
 * Key structure: rl:login:fail:{ip}:{email}
 * - Uses IP+email combination to prevent account-level lockout by attackers
 * - An attacker on IP-A cannot lock out a legitimate user on IP-B
 *
 * @param {string} ip - Client IP address
 * @param {string} normalizedEmail - Normalized email (already lowercased/trimmed)
 */
const recordFailedLogin = async (ip, normalizedEmail) => {
  if (!normalizedEmail || !isRedisReady()) return;

  try {
    const redis = getRawRedisClient();
    const key = `rl:login:fail:${ip}:${normalizedEmail}`;

    // Increment the failure counter
    const count = await redis.incr(key);

    // Calculate exponential backoff TTL
    // 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s, 900s (capped)
    const backoffDelay = Math.min(
      config.failBaseDelay * Math.pow(2, count - 1),
      config.failMaxDelay
    );

    // Set the TTL — the key expires after the backoff delay,
    // naturally resetting the counter after the cooldown period
    await redis.expire(key, Math.ceil(backoffDelay));
  } catch (error) {
    // Non-critical: log and continue — don't break login flow
    console.error("Failed to record failed login:", error.message);
  }
};

/**
 * Clears the failed login counter for a given IP + email after a successful login.
 *
 * @param {string} ip - Client IP address
 * @param {string} normalizedEmail - Normalized email
 */
const clearFailedLogins = async (ip, normalizedEmail) => {
  if (!normalizedEmail || !isRedisReady()) return;

  try {
    const redis = getRawRedisClient();
    const key = `rl:login:fail:${ip}:${normalizedEmail}`;
    await redis.del(key);
  } catch (error) {
    // Non-critical: log and continue
    console.error("Failed to clear failed login counter:", error.message);
  }
};

// ---------------------------------------------------------------------------
// Generic rate limiter factory (for future reuse with OTP, signup, etc.)
// ---------------------------------------------------------------------------

/**
 * Creates a reusable rate limiter middleware for any endpoint.
 *
 * @param {Object} options
 * @param {string} options.keyPrefix - Redis key prefix (e.g., 'rl:otp')
 * @param {Array} options.limits - Array of { type, capacity, refillRate }
 * @param {Function} options.identifierExtractor - (req) => { ip, identifier }
 * @param {string} [options.failMode] - 'open' or 'closed' (defaults to config)
 * @returns {Function} Express middleware
 */
const createRateLimiter = ({
  keyPrefix,
  limits,
  identifierExtractor,
  failMode,
}) => {
  const mode = failMode || config.failMode;

  return async (req, res, next) => {
    try {
      if (!isRedisReady()) {
        if (mode === "closed") {
          return res.status(503).json({
            success: false,
            message: "Service temporarily unavailable. Please try again later.",
          });
        }
        console.warn(
          `Rate limiter (${keyPrefix}): Redis unavailable, failing open`
        );
        return next();
      }

      const identifiers = identifierExtractor(req);
      const checks = [];

      for (const limit of limits) {
        let key;
        if (limit.type === "ip") {
          key = `${keyPrefix}:ip:${identifiers.ip || req.ip}`;
        } else if (limit.type === "identifier") {
          if (!identifiers.identifier) continue;
          key = `${keyPrefix}:id:${identifiers.identifier}`;
        } else if (limit.type === "ip_identifier") {
          if (!identifiers.identifier) continue;
          key = `${keyPrefix}:ip_id:${identifiers.ip || req.ip}:${identifiers.identifier}`;
        } else {
          continue;
        }

        checks.push({
          key,
          capacity: limit.capacity,
          refillRate: limit.refillRate,
        });
      }

      const results = await Promise.all(
        checks.map((c) => consumeToken(c.key, c.capacity, c.refillRate))
      );

      let blocked = false;
      let maxRetryAfter = 0;

      for (const result of results) {
        if (!result.allowed) {
          blocked = true;
          if (result.retryAfter > maxRetryAfter) {
            maxRetryAfter = result.retryAfter;
          }
        }
      }

      if (blocked) {
        return res
          .status(429)
          .set("Retry-After", String(Math.max(1, maxRetryAfter)))
          .json({
            success: false,
            message: "Too many requests. Please try again later.",
          });
      }

      next();
    } catch (error) {
      console.error(`Rate limiter (${keyPrefix}) error:`, error.message);
      if (mode === "closed") {
        return res.status(503).json({
          success: false,
          message: "Service temporarily unavailable. Please try again later.",
        });
      }
      next();
    }
  };
};

module.exports = {
  loginRateLimiter,
  recordFailedLogin,
  clearFailedLogins,
  createRateLimiter,
};

