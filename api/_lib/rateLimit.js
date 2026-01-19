/**
 * Distributed Rate Limiting with Upstash Redis
 *
 * Uses sliding window algorithm for accurate rate limiting across
 * all serverless instances. Falls back to in-memory if Redis unavailable.
 */

// In-memory fallback for when Redis is unavailable
const fallbackMap = new Map()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute window

/**
 * Check if Upstash Redis is configured
 */
function isRedisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Make a Redis REST API request to Upstash
 */
async function redisRequest(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  })

  if (!response.ok) {
    throw new Error(`Redis request failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Sliding window rate limiter using Redis
 * Uses a sorted set to track request timestamps within the window
 */
async function checkRateLimitRedis(keyId, limitPerMinute = 60) {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const key = `ratelimit:${keyId}`

  try {
    // Pipeline: Remove old entries, add current request, count requests, set TTL
    const pipeline = [
      // Remove entries older than window
      ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
      // Add current request with timestamp as score
      ['ZADD', key, String(now), `${now}:${Math.random().toString(36).slice(2)}`],
      // Count entries in window
      ['ZCARD', key],
      // Set TTL to clean up stale keys
      ['EXPIRE', key, '120']
    ]

    // Execute pipeline
    const results = await Promise.all(pipeline.map(cmd => redisRequest(cmd)))

    const count = results[2].result

    if (count > limitPerMinute) {
      // Over limit - calculate reset time
      const resetIn = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        limit: limitPerMinute,
        source: 'redis'
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, limitPerMinute - count),
      resetIn: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      limit: limitPerMinute,
      source: 'redis'
    }
  } catch (err) {
    console.error('Redis rate limit error, falling back to in-memory:', err.message)
    return checkRateLimitFallback(keyId, limitPerMinute)
  }
}

/**
 * In-memory fallback rate limiter (same as original implementation)
 * Used when Redis is unavailable
 */
function checkRateLimitFallback(keyId, limitPerMinute = 60) {
  const now = Date.now()
  const windowKey = `rate:${keyId}`

  let tracking = fallbackMap.get(windowKey)

  if (!tracking || now - tracking.windowStart >= RATE_LIMIT_WINDOW_MS) {
    tracking = {
      windowStart: now,
      count: 0
    }
  }

  if (tracking.count >= limitPerMinute) {
    const resetIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - tracking.windowStart)) / 1000)
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      limit: limitPerMinute,
      source: 'memory'
    }
  }

  tracking.count++
  fallbackMap.set(windowKey, tracking)

  // Clean up old entries periodically
  if (fallbackMap.size > 1000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS
    for (const [key, val] of fallbackMap.entries()) {
      if (val.windowStart < cutoff) {
        fallbackMap.delete(key)
      }
    }
  }

  return {
    allowed: true,
    remaining: limitPerMinute - tracking.count,
    resetIn: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - tracking.windowStart)) / 1000),
    limit: limitPerMinute,
    source: 'memory'
  }
}

/**
 * Check and enforce rate limits for an API key
 * Uses Redis when available, falls back to in-memory
 *
 * @param {string} keyId - The API key ID
 * @param {number} limitPerMinute - Rate limit per minute
 * @returns {Promise<object>} - { allowed: boolean, remaining: number, resetIn: number, limit: number }
 */
export async function checkRateLimit(keyId, limitPerMinute = 60) {
  if (isRedisConfigured()) {
    return checkRateLimitRedis(keyId, limitPerMinute)
  }
  return checkRateLimitFallback(keyId, limitPerMinute)
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(rateInfo) {
  return {
    'X-RateLimit-Limit': String(rateInfo.limit),
    'X-RateLimit-Remaining': String(rateInfo.remaining),
    'X-RateLimit-Reset': String(rateInfo.resetIn)
  }
}

/**
 * Daily rate limit check using Redis
 * Separate from per-minute limits
 */
export async function checkDailyRateLimit(keyId, limitPerDay = 10000) {
  if (!isRedisConfigured()) {
    // Skip daily limit check if Redis not configured
    return { allowed: true, remaining: limitPerDay, limit: limitPerDay }
  }

  const today = new Date().toISOString().split('T')[0]
  const key = `daily:${keyId}:${today}`

  try {
    // Increment counter
    const incrResult = await redisRequest(['INCR', key])
    const count = incrResult.result

    // Set TTL on first request (25 hours to handle timezone edge cases)
    if (count === 1) {
      await redisRequest(['EXPIRE', key, '90000'])
    }

    if (count > limitPerDay) {
      return {
        allowed: false,
        remaining: 0,
        limit: limitPerDay,
        resetIn: 'midnight UTC'
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, limitPerDay - count),
      limit: limitPerDay
    }
  } catch (err) {
    console.error('Daily rate limit error:', err.message)
    // Allow request if Redis fails
    return { allowed: true, remaining: limitPerDay, limit: limitPerDay }
  }
}
