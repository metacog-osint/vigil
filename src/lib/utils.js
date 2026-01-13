// Utility functions for Vigil

/**
 * Classify severity based on CVSS score
 * @param {number} score - CVSS score (0-10)
 * @returns {string} - Severity level
 */
export function classifySeverity(score) {
  if (score === null || score === undefined) return 'unknown'
  if (score >= 9.0) return 'critical'
  if (score >= 7.0) return 'high'
  if (score >= 4.0) return 'medium'
  if (score >= 0.1) return 'low'
  return 'none'
}

/**
 * Detect IOC type from value
 * @param {string} value - IOC value
 * @returns {string} - IOC type
 */
export function detectIOCType(value) {
  if (!value || typeof value !== 'string') return 'unknown'

  const trimmed = value.trim()

  // IPv4 with optional port
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(trimmed)) {
    return 'ip'
  }

  // IPv6
  if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(trimmed)) {
    return 'ip'
  }

  // URL
  if (/^https?:\/\//i.test(trimmed)) {
    return 'url'
  }

  // MD5 hash (32 hex chars)
  if (/^[a-fA-F0-9]{32}$/.test(trimmed)) {
    return 'hash_md5'
  }

  // SHA1 hash (40 hex chars)
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) {
    return 'hash_sha1'
  }

  // SHA256 hash (64 hex chars)
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    return 'hash_sha256'
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'email'
  }

  // CVE ID
  if (/^CVE-\d{4}-\d+$/i.test(trimmed)) {
    return 'cve'
  }

  // Domain (basic check - has dot, no protocol, no spaces)
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(trimmed)) {
    return 'domain'
  }

  return 'unknown'
}

/**
 * Format large numbers with K/M/B suffixes
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength = 50) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Parse date string safely
 * @param {string} dateStr - Date string
 * @returns {Date|null} - Parsed date or null
 */
export function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    // Handle ransomwatch format: "YYYY-MM-DD HH:MM:SS.ffffff"
    const cleaned = dateStr.replace(' ', 'T').split('.')[0]
    const date = new Date(cleaned)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Get relative time string
 * @param {Date|string} date - Date to compare
 * @returns {string} - Relative time string
 */
export function relativeTime(date) {
  if (!date) return 'Unknown'

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'

  const now = new Date()
  const diffMs = now - d
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 4) return `${diffWeek}w ago`
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return d.toLocaleDateString()
}

/**
 * Sanitize string for safe display
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitize(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Generate a color for a string (consistent hash)
 * @param {string} str - Input string
 * @returns {string} - HSL color string
 */
export function stringToColor(str) {
  if (!str) return 'hsl(0, 0%, 50%)'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = hash % 360
  return `hsl(${hue}, 70%, 50%)`
}
