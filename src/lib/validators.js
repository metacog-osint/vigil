/**
 * Input Validators for Frontend
 *
 * Provides validation functions for user inputs before sending to API.
 * This is defense-in-depth - API also validates inputs.
 */

/**
 * Validate IP address format (IPv4 or IPv6)
 * @param {string} ip - IP address to validate
 * @returns {boolean}
 */
export function isValidIP(ip) {
  if (!ip) return false
  // IPv4 regex
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  // IPv6 regex (simplified)
  const ipv6Regex =
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean}
 */
export function isValidDomain(domain) {
  if (!domain) return false
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
  return domainRegex.test(domain) && domain.length <= 253
}

/**
 * Validate hash format (MD5, SHA1, SHA256, SHA512)
 * @param {string} hash - Hash to validate
 * @returns {{valid: boolean, type: string|null}}
 */
export function isValidHash(hash) {
  if (!hash) return { valid: false, type: null }
  const lower = hash.toLowerCase()

  if (/^[a-f0-9]{32}$/.test(lower)) return { valid: true, type: 'md5' }
  if (/^[a-f0-9]{40}$/.test(lower)) return { valid: true, type: 'sha1' }
  if (/^[a-f0-9]{64}$/.test(lower)) return { valid: true, type: 'sha256' }
  if (/^[a-f0-9]{128}$/.test(lower)) return { valid: true, type: 'sha512' }

  return { valid: false, type: null }
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export function isValidURL(url) {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate CVE ID format
 * @param {string} cve - CVE ID to validate
 * @returns {boolean}
 */
export function isValidCVE(cve) {
  if (!cve) return false
  const cveRegex = /^CVE-\d{4}-\d{4,}$/i
  return cveRegex.test(cve)
}

/**
 * Auto-detect IOC type from value
 * @param {string} value - IOC value
 * @returns {string|null} - Detected type or null
 */
export function detectIOCType(value) {
  if (!value) return null

  const trimmed = value.trim()

  // Check for CVE pattern
  if (isValidCVE(trimmed)) return 'cve'

  // Check for IP address
  if (isValidIP(trimmed)) return 'ip'

  // Check for hash
  const hashResult = isValidHash(trimmed)
  if (hashResult.valid) return 'hash'

  // Check for URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (isValidURL(trimmed)) return 'url'
  }

  // Check for email
  if (trimmed.includes('@') && isValidEmail(trimmed)) return 'email'

  // Check for domain
  if (isValidDomain(trimmed)) return 'domain'

  return null
}

/**
 * Validate IOC value based on type
 * @param {string} value - IOC value
 * @param {string} type - IOC type
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateIOCValue(value, type) {
  if (!value) return { valid: false, error: 'Value is required' }

  const trimmed = value.trim()

  switch (type?.toLowerCase()) {
    case 'ip':
      if (!isValidIP(trimmed)) return { valid: false, error: 'Invalid IP address format' }
      break
    case 'domain':
      if (!isValidDomain(trimmed)) return { valid: false, error: 'Invalid domain format' }
      break
    case 'hash':
      const hashResult = isValidHash(trimmed)
      if (!hashResult.valid)
        return { valid: false, error: 'Invalid hash format (MD5, SHA1, SHA256, or SHA512)' }
      break
    case 'email':
      if (!isValidEmail(trimmed)) return { valid: false, error: 'Invalid email format' }
      break
    case 'url':
      if (!isValidURL(trimmed)) return { valid: false, error: 'Invalid URL format' }
      break
    case 'cve':
      if (!isValidCVE(trimmed))
        return { valid: false, error: 'Invalid CVE format (e.g., CVE-2024-1234)' }
      break
    default:
      // For unknown types, just check length
      if (trimmed.length > 2048) return { valid: false, error: 'Value too long' }
  }

  return { valid: true, error: null }
}

/**
 * Sanitize search query
 * @param {string} query - Search query
 * @param {number} maxLength - Maximum length (default 200)
 * @returns {string}
 */
export function sanitizeSearchQuery(query, maxLength = 200) {
  if (!query) return ''
  return query
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove angle brackets (XSS)
    .trim()
}

/**
 * Validate webhook URL (blocks private IPs for SSRF protection)
 * @param {string} url - Webhook URL
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateWebhookURL(url) {
  if (!url) return { valid: false, error: 'URL is required' }

  try {
    const parsed = new URL(url)

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS' }
    }

    // Block localhost and private IPs
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    if (blockedHosts.includes(parsed.hostname.toLowerCase())) {
      return { valid: false, error: 'Internal URLs not allowed' }
    }

    // Check for private IP ranges
    const privateIPRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
    ]

    for (const pattern of privateIPRanges) {
      if (pattern.test(parsed.hostname)) {
        return { valid: false, error: 'Private IP addresses not allowed' }
      }
    }

    // URL length limit
    if (url.length > 2048) {
      return { valid: false, error: 'URL too long (max 2048 characters)' }
    }

    return { valid: true, error: null }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export default {
  isValidIP,
  isValidDomain,
  isValidHash,
  isValidEmail,
  isValidURL,
  isValidCVE,
  detectIOCType,
  validateIOCValue,
  sanitizeSearchQuery,
  validateWebhookURL,
}
