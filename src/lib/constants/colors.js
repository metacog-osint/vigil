/**
 * Color constants used across the application
 * Single source of truth for color definitions
 */

// Actor type colors (hex values for charts/graphs)
export const ACTOR_TYPE_COLORS = {
  ransomware: '#ef4444',  // red-500
  apt: '#8b5cf6',         // violet-500
  cybercrime: '#f97316',  // orange-500
  hacktivism: '#22c55e',  // green-500
  initial_access_broker: '#eab308',  // yellow-500
  data_extortion: '#ec4899',  // pink-500
  default: '#6b7280',     // gray-500
}

// Actor type Tailwind classes
export const ACTOR_TYPE_CLASSES = {
  ransomware: 'bg-red-500/20 text-red-400 border-red-500/30',
  apt: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  cybercrime: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  hacktivism: 'bg-green-500/20 text-green-400 border-green-500/30',
  initial_access_broker: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  data_extortion: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

// Trend status colors
export const TREND_COLORS = {
  ESCALATING: '#ef4444',  // red
  STABLE: '#6b7280',      // gray
  DECLINING: '#22c55e',   // green
}

// Trend status Tailwind classes
export const TREND_CLASSES = {
  ESCALATING: 'text-red-400 bg-red-500/20',
  STABLE: 'text-gray-400 bg-gray-500/20',
  DECLINING: 'text-green-400 bg-green-500/20',
}

// Severity colors (for CVEs, alerts)
export const SEVERITY_COLORS = {
  critical: '#dc2626',  // red-600
  high: '#f97316',      // orange-500
  medium: '#eab308',    // yellow-500
  low: '#3b82f6',       // blue-500
  info: '#6b7280',      // gray-500
}

// Severity Tailwind classes
export const SEVERITY_CLASSES = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
  info: 'bg-gray-500 text-white',
}

// Priority colors (for tickets, tasks)
export const PRIORITY_COLORS = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

// Priority Tailwind classes
export const PRIORITY_CLASSES = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
}

// TLP (Traffic Light Protocol) colors
export const TLP_COLORS = {
  red: '#dc2626',
  amber: '#f59e0b',
  green: '#22c55e',
  white: '#f3f4f6',
}

// TLP Tailwind classes
export const TLP_CLASSES = {
  red: 'bg-red-600 text-white',
  amber: 'bg-amber-500 text-black',
  green: 'bg-green-600 text-white',
  white: 'bg-gray-100 text-black border border-gray-300',
}

// Risk score colors (based on score value)
export const RISK_SCORE_COLORS = {
  critical: '#dc2626',  // 80+
  high: '#f97316',      // 60-79
  medium: '#eab308',    // 40-59
  low: '#3b82f6',       // <40
}

// Activity intensity colors (for heatmaps/calendars)
export const INTENSITY_COLORS = [
  'bg-gray-800',         // 0 - no activity
  'bg-red-900/50',       // 1 - low
  'bg-red-700/60',       // 2 - medium
  'bg-red-500/70',       // 3 - high
  'bg-red-400',          // 4 - very high
]

// Chart color palette
export const CHART_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

/**
 * Get color for actor type
 * @param {string} type - Actor type
 * @returns {string} Hex color
 */
export function getActorTypeColor(type) {
  return ACTOR_TYPE_COLORS[type] || ACTOR_TYPE_COLORS.default
}

/**
 * Get Tailwind class for actor type
 * @param {string} type - Actor type
 * @returns {string} Tailwind classes
 */
export function getActorTypeClass(type) {
  return ACTOR_TYPE_CLASSES[type] || ACTOR_TYPE_CLASSES.default
}

/**
 * Get color for severity level
 * @param {string} severity - Severity level
 * @returns {string} Hex color
 */
export function getSeverityColor(severity) {
  return SEVERITY_COLORS[severity?.toLowerCase()] || SEVERITY_COLORS.info
}

/**
 * Get risk score color based on numeric score
 * @param {number} score - Risk score (0-100)
 * @returns {string} Hex color
 */
export function getRiskScoreColor(score) {
  if (score >= 80) return RISK_SCORE_COLORS.critical
  if (score >= 60) return RISK_SCORE_COLORS.high
  if (score >= 40) return RISK_SCORE_COLORS.medium
  return RISK_SCORE_COLORS.low
}
