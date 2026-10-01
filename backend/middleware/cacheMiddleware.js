const { getCache, setCache } = require("../config/redisClient");

/**
 * Express middleware factory for cache-aside pattern.
 *
 * @param {string} prefix          - Cache key prefix (e.g., "products", "weather")
 * @param {number|Function} ttl    - TTL in seconds, or (data) => seconds so a
 *                                   response can choose its own lifetime.
 *                                   Returning 0 skips caching that response.
 * @returns {Function}             - Express middleware
 *
 * Usage:
 *   router.get("/", cacheMiddleware("products", 300), controller);
 *   router.get("/x", cacheMiddleware("x", (d) => (d.ok ? 3600 : 60)), controller);
 *
 * The middleware generates a cache key from `prefix:originalUrl`.
 * On HIT  → returns cached JSON, skips the controller.
 * On MISS → wraps res.json() to store the response before sending.
 */
const cacheMiddleware = (prefix, ttl) => {
  return async (req, res, next) => {
    // Build a unique cache key from the prefix and full URL (includes query params)
    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        console.log(`[REDIS CACHE HIT] ✅ Key: "${cacheKey}"`);
        return res.json(cachedData);
      }

      console.log(`[REDIS CACHE MISS] ❌ Key: "${cacheKey}"`);

      // Store original res.json so we can intercept it
      const originalJson = res.json.bind(res);

      res.json = async (data) => {
        // Only cache successful responses (status 2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const effectiveTtl = typeof ttl === "function" ? ttl(data) : ttl;

          if (effectiveTtl > 0) {
            await setCache(cacheKey, data, effectiveTtl);
            console.log(
              `[CACHE SET] 💾 Key: "${cacheKey}" | TTL: ${effectiveTtl}s`
            );
          } else {
            console.log(`[CACHE SKIP] Key: "${cacheKey}" | not cacheable`);
          }
        }

        // Send the original response
        return originalJson(data);
      };

      next();
    } catch (err) {
      console.error(`[REDIS CACHE ERROR] Key: "${cacheKey}" |`, err.message);
      // On Redis error, proceed without caching (graceful degradation)
      next();
    }
  };
};

module.exports = cacheMiddleware;
