/**
 * Filter and dropdown option constants
 * Single source of truth for filter definitions
 */

// Time range options
export const TIME_RANGES = [
  { label: '24 hours', value: 1, shortLabel: '24h' },
  { label: '7 days', value: 7, shortLabel: '7d' },
  { label: '30 days', value: 30, shortLabel: '30d' },
  { label: '90 days', value: 90, shortLabel: '90d' },
  { label: '1 year', value: 365, shortLabel: '1y' },
  { label: 'All time', value: null, shortLabel: 'All' },
]

// Trend filter options
export const TREND_FILTERS = [
  { key: '', label: 'All Trends' },
  { key: 'ESCALATING', label: 'Escalating' },
  { key: 'STABLE', label: 'Stable' },
  { key: 'DECLINING', label: 'Declining' },
]

// Actor type filter options
export const ACTOR_TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'ransomware', label: 'Ransomware' },
  { value: 'apt', label: 'APT' },
  { value: 'cybercrime', label: 'Cybercrime' },
  { value: 'hacktivism', label: 'Hacktivism' },
  { value: 'initial_access_broker', label: 'Initial Access Broker' },
  { value: 'data_extortion', label: 'Data Extortion' },
]

// Actor type values
export const ACTOR_TYPES = [
  'ransomware',
  'apt',
  'cybercrime',
  'hacktivism',
  'initial_access_broker',
  'data_extortion',
]

// Severity filter options
export const SEVERITY_FILTERS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// Status filter options (for alerts, investigations)
export const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

// IOC type filter options
export const IOC_TYPE_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'ip', label: 'IP Address' },
  { value: 'domain', label: 'Domain' },
  { value: 'url', label: 'URL' },
  { value: 'md5', label: 'MD5 Hash' },
  { value: 'sha256', label: 'SHA256 Hash' },
  { value: 'sha1', label: 'SHA1 Hash' },
  { value: 'email', label: 'Email' },
]

// IOC types
export const IOC_TYPES = ['ip', 'domain', 'url', 'md5', 'sha256', 'sha1', 'email']

// Region options
export const REGIONS = [
  { value: 'north_america', label: 'North America' },
  { value: 'south_america', label: 'South America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'africa', label: 'Africa' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'middle_east', label: 'Middle East' },
]

// Sort options for tables
export const SORT_OPTIONS = {
  actors: [
    { value: 'last_seen', label: 'Last Seen' },
    { value: 'incidents_7d', label: 'Recent Activity' },
    { value: 'name', label: 'Name' },
    { value: 'trend_status', label: 'Trend Status' },
  ],
  incidents: [
    { value: 'discovered_at', label: 'Discovery Date' },
    { value: 'victim_name', label: 'Victim Name' },
    { value: 'victim_sector', label: 'Sector' },
  ],
  vulnerabilities: [
    { value: 'cvss_score', label: 'CVSS Score' },
    { value: 'kev_date_added', label: 'KEV Date' },
    { value: 'id', label: 'CVE ID' },
  ],
}

// Page size options
export const PAGE_SIZES = [25, 50, 100, 200]

// Default page size
export const DEFAULT_PAGE_SIZE = 50

// Export format options
export const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'stix', label: 'STIX 2.1' },
  { value: 'pdf', label: 'PDF Report' },
]

/**
 * Get time range by value
 * @param {number} value - Days value
 * @returns {object|undefined} Time range object
 */
export function getTimeRangeByValue(value) {
  return TIME_RANGES.find(tr => tr.value === value)
}

/**
 * Get default time range
 * @returns {object} Default time range (30 days)
 */
export function getDefaultTimeRange() {
  return TIME_RANGES.find(tr => tr.value === 30)
}
