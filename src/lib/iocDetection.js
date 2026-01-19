/**
 * IOC Detection Module
 *
 * Auto-detect IOC type from input string.
 */

// IOC type patterns
export const IOC_PATTERNS = {
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/,
  md5: /^[a-fA-F0-9]{32}$/,
  sha1: /^[a-fA-F0-9]{40}$/,
  sha256: /^[a-fA-F0-9]{64}$/,
  sha512: /^[a-fA-F0-9]{128}$/,
  domain: /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
  url: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  cve: /^CVE-\d{4}-\d{4,}$/i,
  btc: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/,
}

// IOC type metadata
export const IOC_TYPE_META = {
  ipv4: {
    label: 'IPv4 Address',
    icon: 'globe',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  ipv6: {
    label: 'IPv6 Address',
    icon: 'globe',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  md5: {
    label: 'MD5 Hash',
    icon: 'fingerprint',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  sha1: {
    label: 'SHA-1 Hash',
    icon: 'fingerprint',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  sha256: {
    label: 'SHA-256 Hash',
    icon: 'fingerprint',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  sha512: {
    label: 'SHA-512 Hash',
    icon: 'fingerprint',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  domain: {
    label: 'Domain',
    icon: 'link',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  url: {
    label: 'URL',
    icon: 'link',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
  },
  email: {
    label: 'Email',
    icon: 'mail',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
  cve: {
    label: 'CVE ID',
    icon: 'shield',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
  },
  btc: {
    label: 'Bitcoin Address',
    icon: 'currency',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  unknown: {
    label: 'Unknown',
    icon: 'question',
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
  },
}

/**
 * Detect IOC type from input string
 * @param {string} input - Input string to analyze
 * @returns {Object} Detected type and cleaned value
 */
export function detectIOCType(input) {
  if (!input || typeof input !== 'string') {
    return { type: 'unknown', value: input, confidence: 0 }
  }

  // Clean input
  const cleaned = input.trim()
    .replace(/\[.\]/g, '.') // Defang: [.] -> .
    .replace(/hxxp/gi, 'http') // Defang: hxxp -> http
    .replace(/\s+/g, '') // Remove whitespace

  // Check each pattern
  for (const [type, pattern] of Object.entries(IOC_PATTERNS)) {
    if (pattern.test(cleaned)) {
      return {
        type,
        value: cleaned,
        confidence: 100,
        meta: IOC_TYPE_META[type],
      }
    }
  }

  // Check for partial matches or potential IOCs
  if (/^[a-fA-F0-9]+$/.test(cleaned)) {
    // Looks like a hash but wrong length
    const len = cleaned.length
    if (len > 20 && len < 32) {
      return { type: 'unknown', value: cleaned, confidence: 30, hint: 'Partial hash?' }
    }
    if (len > 32 && len < 64) {
      return { type: 'unknown', value: cleaned, confidence: 30, hint: 'Partial hash?' }
    }
  }

  // Check if it looks like a domain without TLD
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(cleaned)) {
    return { type: 'unknown', value: cleaned, confidence: 20, hint: 'Add domain TLD?' }
  }

  return {
    type: 'unknown',
    value: cleaned,
    confidence: 0,
    meta: IOC_TYPE_META.unknown,
  }
}

/**
 * Validate IOC value
 * @param {string} value - IOC value to validate
 * @param {string} type - Expected IOC type
 * @returns {boolean}
 */
export function validateIOC(value, type) {
  const pattern = IOC_PATTERNS[type]
  if (!pattern) return false
  return pattern.test(value)
}

/**
 * Normalize IOC value (defang, lowercase, etc.)
 * @param {string} value - IOC value
 * @param {string} type - IOC type
 * @returns {string} Normalized value
 */
export function normalizeIOC(value, type) {
  let normalized = value.trim()
    .replace(/\[.\]/g, '.')
    .replace(/hxxp/gi, 'http')

  // Lowercase domains and emails
  if (['domain', 'email', 'url'].includes(type)) {
    normalized = normalized.toLowerCase()
  }

  // Uppercase hashes
  if (['md5', 'sha1', 'sha256', 'sha512'].includes(type)) {
    normalized = normalized.toLowerCase()
  }

  // Uppercase CVE
  if (type === 'cve') {
    normalized = normalized.toUpperCase()
  }

  return normalized
}

export default {
  IOC_PATTERNS,
  IOC_TYPE_META,
  detectIOCType,
  validateIOC,
  normalizeIOC,
}
