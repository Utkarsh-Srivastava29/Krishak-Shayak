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

  return new Promise((resolve) => {
    if (redisClient.status === "ready") {
      isConnected = true;
      return resolve(redisClient);
    }

    const timeout = setTimeout(() => {
      resolve(redisClient);
    }, 2000);

    redisClient.once("ready", () => {
      clearTimeout(timeout);
      resolve(redisClient);
    });

    redisClient.once("error", () => {
      clearTimeout(timeout);
      resolve(redisClient);
    });
  });
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

// ---------------------------------------------------------------------------
// In-process fallback cache
// ---------------------------------------------------------------------------
// Without this, every cached route degrades to zero caching whenever Redis is
// unavailable — which silently burns paid upstream API calls. It is per-process
// and not shared across instances, so Redis is still the real cache in
// production; this only stops a Redis outage from becoming an upstream bill.
const memoryCache = new Map();
const MEMORY_CACHE_MAX_KEYS = 500;

const memoryGet = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
};

const memorySet = (key, data, ttlSeconds) => {
  if (memoryCache.size >= MEMORY_CACHE_MAX_KEYS && !memoryCache.has(key)) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
  memoryCache.set(key, {
    value: data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

/**
 * Get a cached value by key. Returns parsed JSON or null.
 * Falls back to the in-process cache when Redis is unavailable.
 */
const getCache = async (key) => {
  const client = getRedisClient();
  if (!client) return memoryGet(key);

  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`[REDIS] Error getting key "${key}":`, err.message);
    return memoryGet(key);
  }
};

/**
 * Set a cached value with TTL (in seconds).
 * Falls back to the in-process cache when Redis is unavailable.
 */
const setCache = async (key, data, ttlSeconds) => {
  const client = getRedisClient();
  if (!client) return memorySet(key, data, ttlSeconds);

  try {
    await client.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.error(`[REDIS] Error setting key "${key}":`, err.message);
    memorySet(key, data, ttlSeconds);
  }
};

/**
 * Delete a specific cache key.
 */
const delCache = async (key) => {
  memoryCache.delete(key);

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
  const prefix = pattern.replace(/\*$/, "");
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }

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
  disconnectRedis,
  getRedisClient,
  getRawRedisClient,
  isRedisReady,
  getCache,
  setCache,
  delCache,
  delCacheByPattern,
};
