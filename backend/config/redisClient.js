const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient = null;
let isConnected = false;
let hasLoggedError = false;

/**
 * Initialize and return the Redis client singleton.
 * Safe to call multiple times — returns the existing client if already connected.
 */
const connectRedis = async () => {
  if (redisClient && isConnected) {
    return redisClient;
  }

  // Create ioredis client (fully compatible with older Redis versions like Windows native)
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      if (times > 3) {
        if (!hasLoggedError) {
          console.warn("[REDIS] ⚠️  Could not connect. Server running without cache.");
          hasLoggedError = true;
        }
        // Continue retrying with longer intervals for rate limiter reconnection
        return Math.min(times * 500, 5000);
      }
      return 1000;
    },
    enableOfflineQueue: true,
  });

  redisClient.on("connect", () => {
    console.log(`[REDIS] Connecting to Redis at ${REDIS_URL}...`);
  });

  redisClient.on("ready", () => {
    isConnected = true;
    hasLoggedError = false;
    console.log("[REDIS] ✅ Redis client connected and ready");
  });

  redisClient.on("error", (err) => {
    if (isConnected || !hasLoggedError) {
      console.error(`[REDIS] ❌ Redis connection error: ${err.message}`);
      if (!hasLoggedError) {
        console.warn("[REDIS] ⚠️  Server running without cache/rate-limiting. Start Redis and restart server to enable.");
        hasLoggedError = true;
      }
    }
    isConnected = false;
  });

  redisClient.on("end", () => {
    isConnected = false;
  });

  return redisClient;
};

/**
 * Get the Redis client instance.
 * Returns null if not connected (allows graceful fallback for caching).
 */
const getRedisClient = () => {
  if (redisClient && isConnected) {
    return redisClient;
  }
  return null;
};

/**
 * Get the raw Redis client instance regardless of connection state.
 * Used by the rate limiter for defineCommand() setup.
 * The rate limiter checks isRedisReady() before executing commands.
 */
const getRawRedisClient = () => {
  return redisClient;
};

/**
 * Checks if Redis is currently connected and ready.
 * Used by the rate limiter for fail-open behavior.
 */
const isRedisReady = () => {
  return isConnected && redisClient && redisClient.status === "ready";
};

/**
 * Get a cached value by key. Returns parsed JSON or null.
 */
const getCache = async (key) => {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`[REDIS] Error getting key "${key}":`, err.message);
    return null;
  }
};

/**
 * Set a cached value with TTL (in seconds).
 */
const setCache = async (key, data, ttlSeconds) => {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.error(`[REDIS] Error setting key "${key}":`, err.message);
  }
};

/**
 * Delete a specific cache key.
 */
const delCache = async (key) => {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (err) {
    console.error(`[REDIS] Error deleting key "${key}":`, err.message);
  }
};

/**
 * Delete all keys matching a pattern (e.g., "products:*").
 * Uses SCAN to avoid blocking Redis with KEYS command.
 */
const delCacheByPattern = async (pattern) => {
  const client = getRedisClient();
  if (!client) return;

  try {
    let cursor = "0";
    let deletedCount = 0;

    do {
      const result = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await client.del(keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    if (deletedCount > 0) {
      console.log(
        `[REDIS] 🗑️  Invalidated ${deletedCount} keys matching "${pattern}"`
      );
    }
  } catch (err) {
    console.error(
      `[REDIS] Error deleting keys by pattern "${pattern}":`,
      err.message
    );
  }
};

// Graceful shutdown
const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log("[REDIS] Disconnected gracefully");
  }
};

process.on("SIGINT", async () => {
  await disconnectRedis();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectRedis();
  process.exit(0);
});

module.exports = {
  connectRedis,
  getRedisClient,
  getRawRedisClient,
  isRedisReady,
  getCache,
  setCache,
  delCache,
  delCacheByPattern,
};
