/**
 * Standardized Error Handling Module
 *
 * Provides consistent error responses and prevents leaking internal details.
 */

/**
 * API Error class for controlled error responses
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, publicMessage = null, code = null) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.publicMessage = publicMessage || getDefaultMessage(statusCode)
    this.code = code
  }
}

/**
 * Get default public message for status code
 */
function getDefaultMessage(statusCode) {
  const messages = {
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    405: 'Method not allowed',
    409: 'Conflict',
    422: 'Unprocessable entity',
    429: 'Too many requests',
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
  }
  return messages[statusCode] || 'An error occurred'
}

/**
 * Common error factories
 */
export const Errors = {
  badRequest: (message, code) =>
    new ApiError(message, 400, message, code),

  unauthorized: (internalMessage = 'Unauthorized access attempt') =>
    new ApiError(internalMessage, 401, 'Unauthorized', 'UNAUTHORIZED'),

  forbidden: (internalMessage = 'Access forbidden') =>
    new ApiError(internalMessage, 403, 'Forbidden', 'FORBIDDEN'),

  notFound: (resource = 'Resource') =>
    new ApiError(`${resource} not found`, 404, `${resource} not found`, 'NOT_FOUND'),

  methodNotAllowed: (method) =>
    new ApiError(`Method ${method} not allowed`, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED'),

  conflict: (message) =>
    new ApiError(message, 409, message, 'CONFLICT'),

  validationError: (message) =>
    new ApiError(message, 422, message, 'VALIDATION_ERROR'),

  rateLimited: (retryAfter = 60) => {
    const error = new ApiError('Rate limit exceeded', 429, 'Too many requests. Please try again later.', 'RATE_LIMITED')
    error.retryAfter = retryAfter
    return error
  },

  internal: (internalMessage = 'Internal error') =>
    new ApiError(internalMessage, 500, 'Internal server error', 'INTERNAL_ERROR'),

  serviceUnavailable: (service = 'Service') =>
    new ApiError(`${service} unavailable`, 503, 'Service temporarily unavailable', 'SERVICE_UNAVAILABLE'),
}

/**
 * Handle error and return appropriate response
 * Never exposes internal error details in production
 *
 * @param {Error} error - The error to handle
 * @param {Request} request - The request object (for logging context)
 * @returns {Response} Standardized error response
 */
export function handleError(error, request = null) {
  // Log the full error internally
  console.error('[API Error]', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: request?.url,
    method: request?.method,
  })

  // Determine response based on error type
  if (error instanceof ApiError) {
    const body = {
      error: error.publicMessage,
      code: error.code,
    }

    const headers = {
      'Content-Type': 'application/json',
    }

    // Add retry-after header for rate limiting
    if (error.retryAfter) {
      headers['Retry-After'] = String(error.retryAfter)
    }

    return new Response(JSON.stringify(body), {
      status: error.statusCode,
      headers,
    })
  }

  // For unknown errors, return generic 500
  // Never expose internal error messages
  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Create a standardized success response
 *
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code (default 200)
 * @param {Object} headers - Additional headers
 * @returns {Response}
 */
export function successResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

/**
 * Create a standardized error response
 *
 * @param {string} message - Public error message
 * @param {number} status - HTTP status code
 * @param {string} code - Error code
 * @returns {Response}
 */
export function errorResponse(message, status = 400, code = null) {
  return new Response(
    JSON.stringify({
      error: message,
      code: code || `ERROR_${status}`,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Wrap a handler with error handling
 * Catches all errors and returns standardized responses
 *
 * @param {Function} handler - Request handler
 * @returns {Function} Wrapped handler
 */
export function withErrorHandling(handler) {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      return handleError(error, request)
    }
  }
}

export default {
  ApiError,
  Errors,
  handleError,
  successResponse,
  errorResponse,
  withErrorHandling,
}
