// Shared HTTP utilities for ingestion scripts
// Usage: import { fetchJSON, postJSON, fetchWithRetry } from './lib/http.mjs'

import https from 'https'
import http from 'http'

const USER_AGENT = 'Vigil-CTI-Dashboard/1.0'
const DEFAULT_TIMEOUT = 30000 // 30 seconds

/**
 * Make an HTTP GET request and parse JSON response
 * @param {string} url - URL to fetch
 * @param {object} options - Optional headers and timeout
 * @returns {Promise<any>} Parsed JSON response
 */
export function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || DEFAULT_TIMEOUT
    }

    const req = protocol.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout for ${url}`))
    })

    req.end()
  })
}

/**
 * Make an HTTP POST request with JSON body and parse JSON response
 * @param {string} url - URL to post to
 * @param {object} data - Request body data
 * @param {object} options - Optional headers and timeout
 * @returns {Promise<any>} Parsed JSON response
 */
export function postJSON(url, data, options = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data)
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...options.headers
      },
      timeout: options.timeout || DEFAULT_TIMEOUT
    }

    const req = protocol.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout for ${url}`))
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Fetch with automatic retry and exponential backoff
 * @param {Function} fetchFn - Function that returns a promise (e.g., () => fetchJSON(url))
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @returns {Promise<any>} Result from fetchFn
 */
export async function fetchWithRetry(fetchFn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000
  } = options

  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

/**
 * Fetch with authentication header
 * @param {string} url - URL to fetch
 * @param {string} apiKey - API key for authentication
 * @param {string} authType - Auth header type: 'bearer', 'api-key', 'basic' (default: 'bearer')
 * @param {object} options - Additional options
 * @returns {Promise<any>} Parsed JSON response
 */
export function fetchWithAuth(url, apiKey, authType = 'bearer', options = {}) {
  const headers = { ...options.headers }

  switch (authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiKey}`
      break
    case 'api-key':
      headers['X-API-Key'] = apiKey
      break
    case 'basic':
      headers['Authorization'] = `Basic ${Buffer.from(apiKey).toString('base64')}`
      break
    default:
      headers['Authorization'] = `Bearer ${apiKey}`
  }

  return fetchJSON(url, { ...options, headers })
}

/**
 * Fetch text content (non-JSON)
 * @param {string} url - URL to fetch
 * @param {object} options - Optional headers and timeout
 * @returns {Promise<string>} Raw text response
 */
export function fetchText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        ...options.headers
      },
      timeout: options.timeout || DEFAULT_TIMEOUT
    }

    const req = protocol.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }
        resolve(data)
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout for ${url}`))
    })

    req.end()
  })
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  fetchJSON,
  postJSON,
  fetchWithRetry,
  fetchWithAuth,
  fetchText,
  sleep
}
