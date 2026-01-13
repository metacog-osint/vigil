import { useState, useEffect } from 'react'

const SHORTCUT_GROUPS = [
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['g', 'd'], description: 'Go to Dashboard' },
      { keys: ['g', 'a'], description: 'Go to Threat Actors' },
      { keys: ['g', 'i'], description: 'Go to Incidents' },
      { keys: ['g', 'v'], description: 'Go to Vulnerabilities' },
      { keys: ['g', 't'], description: 'Go to Techniques' },
      { keys: ['g', 'w'], description: 'Go to Watchlists' },
      { keys: ['g', 's'], description: 'Go to Settings' },
      { keys: ['g', 'r'], description: 'Go to Trends' },
    ],
  },
  {
    name: 'Search',
    shortcuts: [
      { keys: ['/'], description: 'Open search' },
      { keys: ['Ctrl', 'K'], description: 'Open search (alternative)' },
      { keys: ['Cmd', 'K'], description: 'Open search (Mac)' },
    ],
  },
  {
    name: 'Interface',
    shortcuts: [
      { keys: ['['], description: 'Toggle sidebar' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / Cancel' },
    ],
  },
]

/**
 * KeyboardShortcutsModal - Displays available keyboard shortcuts
 */
export function KeyboardShortcutsModal({ isOpen, onClose }) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.name} className="mb-6 last:mb-0">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                {group.name}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-gray-300 text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <KeyBadge>{key}</KeyBadge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-gray-600 mx-1 text-xs">then</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-800/50 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Press <KeyBadge small>Esc</KeyBadge> to close
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * KeyBadge - Styled keyboard key
 */
function KeyBadge({ children, small = false }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center font-mono font-medium
        bg-gray-800 border border-gray-600 rounded shadow-sm
        ${small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs min-w-[24px]'}
        text-gray-200`}
    >
      {children}
    </kbd>
  )
}

/**
 * useKeyboardShortcutsModal - Hook to manage modal state
 */
export function useKeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e) {
      // Only trigger on ? key when no input is focused
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}

export default KeyboardShortcutsModal
