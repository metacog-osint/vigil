/**
 * Actor-related constants and configurations
 */

// Tooltip content and styling for actor types
export const ACTOR_TYPE_CONFIG = {
  ransomware: {
    tooltip: 'Ransomware operators encrypt victim data and demand payment for decryption keys.',
    color: 'bg-red-900/50 text-red-400 border-red-800',
    sortOrder: 1
  },
  apt: {
    tooltip: 'Advanced Persistent Threat - state-sponsored groups conducting espionage operations.',
    color: 'bg-purple-900/50 text-purple-400 border-purple-800',
    sortOrder: 2
  },
  cybercrime: {
    tooltip: 'Financially motivated criminals (fraud, theft, carding, etc.).',
    color: 'bg-orange-900/50 text-orange-400 border-orange-800',
    sortOrder: 3
  },
  hacktivism: {
    tooltip: 'Politically or ideologically motivated hackers (Anonymous, Killnet, etc.).',
    color: 'bg-green-900/50 text-green-400 border-green-800',
    sortOrder: 4
  },
  initial_access_broker: {
    tooltip: 'Actors who sell initial network access to other criminals.',
    color: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
    sortOrder: 5
  },
  data_extortion: {
    tooltip: 'Groups that steal data without encryption and extort victims with leak threats.',
    color: 'bg-pink-900/50 text-pink-400 border-pink-800',
    sortOrder: 6
  },
  unknown: {
    tooltip: 'Actor type not yet classified.',
    color: 'bg-gray-800/50 text-gray-400 border-gray-700',
    sortOrder: 99
  }
}

// Helper to get type config with fallback
export function getTypeConfig(type) {
  const normalized = (type || 'unknown').toLowerCase()
  return ACTOR_TYPE_CONFIG[normalized] || ACTOR_TYPE_CONFIG.unknown
}

// Filter options for column menus
export const TYPE_FILTER_OPTIONS = [
  { value: 'ransomware', label: 'Ransomware', color: 'bg-red-400' },
  { value: 'apt', label: 'APT', color: 'bg-purple-400' },
  { value: 'cybercrime', label: 'Cybercrime', color: 'bg-orange-400' },
  { value: 'hacktivism', label: 'Hacktivism', color: 'bg-green-400' },
  { value: 'initial_access_broker', label: 'Initial Access Broker', color: 'bg-yellow-400' },
  { value: 'data_extortion', label: 'Data Extortion', color: 'bg-pink-400' },
]

export const TREND_FILTER_OPTIONS = [
  { value: 'ESCALATING', label: 'Escalating', color: 'bg-red-400' },
  { value: 'STABLE', label: 'Stable', color: 'bg-gray-400' },
  { value: 'DECLINING', label: 'Declining', color: 'bg-green-400' },
]

export const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-400' },
  { value: 'inactive', label: 'Inactive', color: 'bg-yellow-400' },
  { value: 'defunct', label: 'Defunct', color: 'bg-gray-400' },
]

// Page size for pagination
export const PAGE_SIZE = 50
