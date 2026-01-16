/**
 * Incident Constants and Configuration
 */
import { SECTORS, getSectorLabel } from '../../lib/constants'

// Page size for pagination
export const PAGE_SIZE = 50

// Sector-specific colors for charts
export const SECTOR_COLORS = {
  technology: '#06b6d4',
  finance: '#10b981',
  healthcare: '#ef4444',
  manufacturing: '#f59e0b',
  retail: '#8b5cf6',
  education: '#ec4899',
  energy: '#f97316',
  government: '#6366f1',
  other: '#6b7280',
}

// Status options for filter
export const STATUS_OPTIONS = [
  { value: 'claimed', label: 'Claimed', color: 'bg-orange-400' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-red-400' },
  { value: 'leaked', label: 'Leaked', color: 'bg-red-600' },
  { value: 'paid', label: 'Paid', color: 'bg-yellow-400' },
]

// Sector filter options
export const SECTOR_FILTER_OPTIONS = SECTORS.map(s => ({
  value: s,
  label: getSectorLabel(s),
  color: 'bg-cyan-400'
}))

// Get status color class
export function getStatusColor(status) {
  switch (status) {
    case 'claimed': return 'bg-orange-900/50 text-orange-400 border border-orange-800'
    case 'confirmed': return 'bg-red-900/50 text-red-400 border border-red-800'
    case 'leaked': return 'bg-red-900/70 text-red-300 border border-red-700'
    case 'paid': return 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
    default: return 'bg-gray-800/50 text-gray-400 border border-gray-700'
  }
}
