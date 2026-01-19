/**
 * Retry Utility with Exponential Backoff
 *
 * Provides automatic retry logic for API calls that may fail due to
 * network issues or transient errors.
 *
 * Usage:
 * const result = await withRetry(() => supabase.from('table').select('*'))
 * const result = await withRetry(fetchData, { maxRetries: 5 })
 */

// Default retry configuration
const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'Failed to fetch', 'Network request failed'],
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @param {object} config - Retry configuration
 * @returns {boolean} - Whether the error is retryable
 */
function isRetryableError(error, config) {
  // Check error message
  if (error.message) {
    const message = error.message.toLowerCase()
    for (const retryable of config.retryableErrors) {
      if (message.includes(retryable.toLowerCase())) {
        return true
      }
    }
  }

  // Check error code
  if (error.code && config.retryableErrors.includes(error.code)) {
    return true
  }

  // Check HTTP status
  if (error.status && config.retryableStatuses.includes(error.status)) {
    return true
  }

  // Supabase error format
  if (error.error?.status && config.retryableStatuses.includes(error.error.status)) {
    return true
  }

  return false
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {object} config - Retry configuration
 * @returns {number} - Delay in milliseconds
 */
function calculateDelay(attempt, config) {
  // Exponential backoff
  let delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)

  // Apply jitter to prevent thundering herd
  const jitter = delay * config.jitterFactor * (Math.random() * 2 - 1)
  delay += jitter

  // Cap at max delay
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with automatic retry on failure
 * @param {Function} fn - Async function to execute
 * @param {object} options - Retry options
 * @returns {Promise} - Result of the function
 */
export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options }
  let lastError = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn()

      // Check for Supabase error in result
      if (result?.error) {
        if (isRetryableError(result.error, config) && attempt < config.maxRetries) {
          const delay = calculateDelay(attempt, config)
          console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, result.error.message)
          await sleep(delay)
          lastError = result.error
          continue
        }
        // Non-retryable error or max retries reached
        return result
      }

      // Success
      return result
    } catch (error) {
      lastError = error

      if (isRetryableError(error, config) && attempt < config.maxRetries) {
        const delay = calculateDelay(attempt, config)
        console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message)
        await sleep(delay)
        continue
      }

      // Non-retryable error or max retries reached
      throw error
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Max retries exceeded')
}

/**
 * Create a retryable version of a function
 * @param {Function} fn - Function to wrap
 * @param {object} options - Retry options
 * @returns {Function} - Wrapped function with retry logic
 */
export function createRetryable(fn, options = {}) {
  return (...args) => withRetry(() => fn(...args), options)
}

/**
 * Retry decorator for class methods
 * Usage: @retry({ maxRetries: 3 })
 */
export function retry(options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value
    descriptor.value = function (...args) {
      return withRetry(() => originalMethod.apply(this, args), options)
    }
    return descriptor
  }
}

/**
 * Create a Supabase query wrapper with retry
 * @param {object} supabase - Supabase client
 * @param {object} options - Retry options
 * @returns {object} - Wrapped Supabase client
 */
export function createRetryableSupabase(supabase, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options }

  return {
    from: (table) => {
      const query = supabase.from(table)
      return createRetryableQuery(query, config)
    },
    rpc: (fn, params) => withRetry(() => supabase.rpc(fn, params), config),
  }
}

/**
 * Wrap a Supabase query builder with retry logic
 */
function createRetryableQuery(query, config) {
  const methods = ['select', 'insert', 'update', 'delete', 'upsert']
  const filters = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'contains', 'or', 'and', 'not', 'is', 'filter', 'match']
  const modifiers = ['order', 'limit', 'range', 'single', 'maybeSingle', 'csv']

  const wrapped = {}

  // Wrap query methods to return retryable promises
  methods.forEach((method) => {
    wrapped[method] = (...args) => {
      const result = query[method](...args)
      return createRetryableQuery(result, config)
    }
  })

  // Wrap filter methods
  filters.forEach((method) => {
    if (query[method]) {
      wrapped[method] = (...args) => {
        const result = query[method](...args)
        return createRetryableQuery(result, config)
      }
    }
  })

  // Wrap modifier methods
  modifiers.forEach((method) => {
    if (query[method]) {
      wrapped[method] = (...args) => {
        const result = query[method](...args)
        return createRetryableQuery(result, config)
      }
    }
  })

  // The final then() is where the actual request happens
  wrapped.then = (resolve, reject) => {
    return withRetry(() => query, config).then(resolve, reject)
  }

  return wrapped
}

/**
 * Fetch with retry
 * @param {string} url - URL to fetch
 * @param {object} init - Fetch init options
 * @param {object} retryOptions - Retry configuration
 */
export async function fetchWithRetry(url, init = {}, retryOptions = {}) {
  return withRetry(async () => {
    const response = await fetch(url, init)

    // Treat certain HTTP statuses as errors for retry purposes
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      error.status = response.status
      error.response = response
      throw error
    }

    return response
  }, retryOptions)
}

export default {
  withRetry,
  createRetryable,
  retry,
  createRetryableSupabase,
  fetchWithRetry,
}
