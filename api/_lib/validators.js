/**
 * Query Parameter Validators
 * Validates and sanitizes API query parameters to prevent injection attacks
 */

// Allowed sort fields per entity type
const ALLOWED_SORT_FIELDS = {
  actors: ['name', 'last_seen', 'first_seen', 'incident_count', 'trend_status', 'created_at'],
  incidents: ['discovered_date', 'victim_name', 'created_at', 'severity', 'threat_actor'],
  iocs: ['created_at', 'last_seen', 'type', 'threat_level', 'first_seen'],
  vulnerabilities: ['published_date', 'cvss_score', 'cve_id', 'created_at', 'severity'],
}

/**
 * Validate sort field against whitelist
 * @param {string} entity - Entity type (actors, incidents, iocs, vulnerabilities)
 * @param {string} field - Requested sort field
 * @returns {string} - Validated field or default
 */
export function validateSortField(entity, field) {
  const allowed = ALLOWED_SORT_FIELDS[entity] || []
  if (!field || !allowed.includes(field)) {
    return allowed[0] || 'created_at'
  }
  return field
}

/**
 * Validate sort order
 * @param {string} order - Requested sort order
 * @returns {string} - 'asc' or 'desc'
 */
export function validateSortOrder(order) {
  return order === 'asc' ? 'asc' : 'desc'
}

/**
 * Validate and constrain pagination parameters
 * @param {string|number} page - Requested page number
 * @param {string|number} limit - Requested items per page
 * @returns {{page: number, limit: number, offset: number}}
 */
export function validatePagination(page, limit) {
  const validPage = Math.max(1, Math.min(parseInt(page) || 1, 1000))
  const validLimit = Math.max(1, Math.min(parseInt(limit) || 50, 100))
  const offset = (validPage - 1) * validLimit

  return { page: validPage, limit: validLimit, offset }
}

/**
 * Validate UUID format
 * @param {string} id - UUID to validate
 * @returns {boolean}
 */
export function isValidUUID(id) {
  if (!id) return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
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
 * Validate trend status
 * @param {string} status - Trend status to validate
 * @returns {string|null} - Validated status or null
 */
export function validateTrendStatus(status) {
  if (!status) return null
  const upper = status.toUpperCase()
  const allowed = ['ESCALATING', 'STABLE', 'DECLINING']
  return allowed.includes(upper) ? upper : null
}

/**
 * Sanitize search string to prevent injection
 * @param {string} search - Search string
 * @returns {string} - Sanitized search string
 */
export function sanitizeSearch(search) {
  if (!search) return ''
  // Remove special characters that could be used for injection
  // Keep alphanumeric, spaces, hyphens, and common punctuation
  return search
    .slice(0, 200) // Limit length
    .replace(/[%_]/g, '') // Remove SQL wildcards (we add our own)
    .replace(/[^\w\s\-.,@]/g, '') // Keep safe characters only
    .trim()
}

/**
 * Validate IOC type
 * @param {string} type - IOC type
 * @returns {string|null} - Validated type or null
 */
export function validateIOCType(type) {
  if (!type) return null
  const allowed = ['ip', 'domain', 'url', 'hash', 'email', 'file', 'registry']
  return allowed.includes(type.toLowerCase()) ? type.toLowerCase() : null
}

/**
 * Validate date range
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {{start: string|null, end: string|null}}
 */
export function validateDateRange(startDate, endDate) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/

  const start = startDate && dateRegex.test(startDate) ? startDate : null
  const end = endDate && dateRegex.test(endDate) ? endDate : null

  return { start, end }
}

/**
 * Validate IP address format (IPv4 or IPv6)
 * @param {string} ip - IP address to validate
 * @returns {boolean}
 */
export function isValidIP(ip) {
  if (!ip) return false
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean}
 */
export function isValidDomain(domain) {
  if (!domain) return false
  // Domain name regex - allows subdomains, standard TLDs
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
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate IOC value based on type
 * @param {string} value - IOC value
 * @param {string} type - IOC type (ip, domain, hash, email, url)
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateIOCValue(value, type) {
  if (!value) return { valid: false, error: 'Value is required' }

  switch (type?.toLowerCase()) {
    case 'ip':
      if (!isValidIP(value)) return { valid: false, error: 'Invalid IP address format' }
      break
    case 'domain':
      if (!isValidDomain(value)) return { valid: false, error: 'Invalid domain format' }
      break
    case 'hash':
      const hashResult = isValidHash(value)
      if (!hashResult.valid) return { valid: false, error: 'Invalid hash format (must be MD5, SHA1, SHA256, or SHA512)' }
      break
    case 'email':
      if (!isValidEmail(value)) return { valid: false, error: 'Invalid email format' }
      break
    case 'url':
      try {
        new URL(value)
      } catch {
        return { valid: false, error: 'Invalid URL format' }
      }
      break
    default:
      // For unknown types, just check length
      if (value.length > 2048) return { valid: false, error: 'Value too long' }
  }

  return { valid: true, error: null }
}

/**
 * Sanitize string to prevent header injection in emails
 * @param {string} value - Value to sanitize
 * @returns {string}
 */
export function sanitizeEmailHeader(value) {
  if (!value) return ''
  // Remove newlines and carriage returns that could be used for header injection
  return value.replace(/[\r\n]/g, '').slice(0, 200).trim()
}

export default {
  validateSortField,
  validateSortOrder,
  validatePagination,
  isValidUUID,
  isValidCVE,
  validateTrendStatus,
  sanitizeSearch,
  validateIOCType,
  validateDateRange,
  isValidIP,
  isValidDomain,
  isValidHash,
  isValidEmail,
  validateIOCValue,
  sanitizeEmailHeader,
}
