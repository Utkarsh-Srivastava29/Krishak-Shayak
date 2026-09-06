-- Token Bucket Rate Limiter (Atomic Lua Script)
-- Executes entirely within Redis to prevent race conditions.
--
-- KEYS[1] = the Redis key for this bucket (e.g., "rl:login:ip:1.2.3.4")
-- ARGV[1] = bucket capacity (max tokens)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp in seconds (floating point)
-- ARGV[4] = TTL in seconds for the key
--
-- Returns: { allowed (0 or 1), remaining tokens, retryAfter (seconds) }

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

-- Read current bucket state
local bucketData = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucketData[1])
local lastRefill = tonumber(bucketData[2])

-- Initialize bucket if it doesn't exist
if tokens == nil then
  tokens = capacity
  lastRefill = now
end

-- Calculate tokens to add based on elapsed time
local elapsed = math.max(0, now - lastRefill)
local tokensToAdd = elapsed * refillRate
tokens = math.min(capacity, tokens + tokensToAdd)
lastRefill = now

-- Try to consume a token
if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, ttl)
  return {1, math.floor(tokens), 0}
else
  -- Not enough tokens; calculate when the next token will be available
  local retryAfter = math.ceil((1 - tokens) / refillRate)
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, ttl)
  return {0, 0, retryAfter}
end

