import { useState, useEffect } from 'react'
import { SHORTCUTS, SHORTCUT_CATEGORIES, formatKeys, MOD_KEY } from '../lib/shortcuts'

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

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 id="shortcuts-title" className="text-lg font-semibold text-white">
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Press <KeyBadge small>?</KeyBadge> anytime to show this
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-10rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(SHORTCUTS).map(([categoryKey, shortcuts]) => {
              const category = SHORTCUT_CATEGORIES[categoryKey]
              return (
                <div key={categoryKey}>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    {category?.label || categoryKey}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-gray-300 text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {formatKeys(shortcut.keys).map((key, keyIndex) => (
                            <span key={keyIndex} className="flex items-center">
                              <KeyBadge>{key}</KeyBadge>
                              {keyIndex < shortcut.keys.length - 1 && shortcut.keys[0] !== MOD_KEY && (
                                <span className="text-gray-600 mx-1 text-xs">then</span>
                              )}
                              {keyIndex < shortcut.keys.length - 1 && shortcut.keys[0] === MOD_KEY && (
                                <span className="text-gray-600 mx-0.5">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-800/50 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Navigation: press <KeyBadge small>g</KeyBadge> then a letter
            </span>
            <span>
              {MOD_KEY === '⌘' ? 'macOS' : 'Windows/Linux'}
            </span>
          </div>
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
