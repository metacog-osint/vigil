/**
 * Keyboard Shortcuts Configuration
 *
 * Centralized configuration for all keyboard shortcuts in the app.
 */

// Check if Mac
const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')

// Modifier key display
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

// Shortcut categories
export const SHORTCUT_CATEGORIES = {
  navigation: {
    label: 'Navigation',
    description: 'Move around the app quickly',
  },
  actions: {
    label: 'Actions',
    description: 'Perform common actions',
  },
  lists: {
    label: 'Lists',
    description: 'Navigate within lists',
  },
  general: {
    label: 'General',
    description: 'General shortcuts',
  },
}

// All shortcuts
export const SHORTCUTS = {
  // Navigation shortcuts
  navigation: [
    { keys: ['g', 'd'], action: 'goToDashboard', description: 'Go to Dashboard' },
    { keys: ['g', 'a'], action: 'goToActors', description: 'Go to Actors' },
    { keys: ['g', 'i'], action: 'goToIncidents', description: 'Go to Incidents' },
    { keys: ['g', 'v'], action: 'goToVulnerabilities', description: 'Go to Vulnerabilities' },
    { keys: ['g', 'e'], action: 'goToEvents', description: 'Go to Events' },
    { keys: ['g', 's'], action: 'goToSettings', description: 'Go to Settings' },
    { keys: ['g', 't'], action: 'goToTechniques', description: 'Go to Techniques' },
    { keys: ['g', 'w'], action: 'goToWatchlists', description: 'Go to Watchlists' },
    { keys: ['g', 'r'], action: 'goToTrends', description: 'Go to Trends' },
  ],

  // Action shortcuts
  actions: [
    { keys: [MOD_KEY, 'k'], action: 'openSearch', description: 'Open search' },
    { keys: ['/'], action: 'focusSearch', description: 'Focus search / Go to IOCs' },
    { keys: ['f'], action: 'toggleFocusMode', description: 'Toggle Focus Mode' },
    { keys: ['n'], action: 'filterNew', description: 'Show new items only' },
  ],

  // List navigation
  lists: [
    { keys: ['j'], action: 'nextItem', description: 'Next item' },
    { keys: ['k'], action: 'prevItem', description: 'Previous item' },
    { keys: ['Enter'], action: 'openItem', description: 'Open selected item' },
    { keys: ['w'], action: 'toggleWatch', description: 'Toggle watchlist' },
    { keys: ['e'], action: 'exportItem', description: 'Export item' },
  ],

  // General
  general: [
    { keys: ['?'], action: 'showHelp', description: 'Show keyboard shortcuts' },
    { keys: ['Escape'], action: 'closeModal', description: 'Close modal / Deselect' },
    { keys: ['['], action: 'toggleSidebar', description: 'Toggle sidebar' },
  ],
}

// Get all shortcuts as a flat list
export function getAllShortcuts() {
  return Object.entries(SHORTCUTS).flatMap(([category, shortcuts]) =>
    shortcuts.map(s => ({ ...s, category }))
  )
}

// Format keys for display
export function formatKeys(keys) {
  return keys.map(key => {
    if (key === MOD_KEY) return key
    if (key === 'Enter') return '↵'
    if (key === 'Escape') return 'Esc'
    return key.toUpperCase()
  })
}

export default SHORTCUTS
