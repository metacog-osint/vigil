/**
 * Sector constants used across the application
 * Single source of truth for sector definitions
 */

// Core sector values (lowercase, database-compatible)
export const SECTOR_VALUES = [
  'healthcare',
  'finance',
  'technology',
  'manufacturing',
  'retail',
  'education',
  'energy',
  'government',
  'transportation',
  'telecommunications',
  'defense',
  'legal',
  'media',
  'real_estate',
  'hospitality',
  'agriculture',
  'pharmaceuticals',
  'construction',
  'nonprofit',
  'professional_services',
]

// Sector display labels
export const SECTOR_LABELS = {
  healthcare: 'Healthcare',
  finance: 'Finance & Banking',
  technology: 'Technology',
  manufacturing: 'Manufacturing',
  retail: 'Retail',
  education: 'Education',
  energy: 'Energy & Utilities',
  government: 'Government',
  transportation: 'Transportation',
  telecommunications: 'Telecommunications',
  defense: 'Defense',
  legal: 'Legal',
  media: 'Media & Entertainment',
  real_estate: 'Real Estate',
  hospitality: 'Hospitality',
  agriculture: 'Agriculture',
  pharmaceuticals: 'Pharmaceuticals',
  construction: 'Construction',
  nonprofit: 'Nonprofit',
  professional_services: 'Professional Services',
}

// Sector icons (for UI components that need them)
export const SECTOR_ICONS = {
  healthcare: '🏥',
  finance: '🏦',
  technology: '💻',
  manufacturing: '🏭',
  retail: '🛒',
  education: '🎓',
  energy: '⚡',
  government: '🏛️',
  transportation: '🚛',
  telecommunications: '📡',
  defense: '🛡️',
  legal: '⚖️',
  media: '🎬',
  real_estate: '🏢',
  hospitality: '🏨',
  agriculture: '🌾',
  pharmaceuticals: '💊',
  construction: '🏗️',
  nonprofit: '🤝',
  professional_services: '💼',
}

// Full sector objects with value, label, and icon
export const SECTORS_WITH_DETAILS = SECTOR_VALUES.map((value) => ({
  value,
  label: SECTOR_LABELS[value] || value,
  icon: SECTOR_ICONS[value] || '📁',
}))

// Simple array for dropdowns/filters (commonly used format)
export const SECTORS = SECTOR_VALUES

// Title case sectors for certain UI components
export const SECTORS_TITLE_CASE = SECTOR_VALUES.map(
  (s) => SECTOR_LABELS[s] || s.charAt(0).toUpperCase() + s.slice(1)
)

// Sector filter options for select dropdowns
export const SECTOR_FILTER_OPTIONS = [
  { value: '', label: 'All Sectors' },
  ...SECTOR_VALUES.map((value) => ({
    value,
    label: SECTOR_LABELS[value] || value,
  })),
]

/**
 * Get display label for a sector value
 * @param {string} sector - Sector value (lowercase)
 * @returns {string} Display label
 */
export function getSectorLabel(sector) {
  return SECTOR_LABELS[sector] || sector
}

/**
 * Get icon for a sector
 * @param {string} sector - Sector value (lowercase)
 * @returns {string} Emoji icon
 */
export function getSectorIcon(sector) {
  return SECTOR_ICONS[sector] || '📁'
}
