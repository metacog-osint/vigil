import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardShortcuts({ onToggleSidebar, onOpenSearch, onShowHelp }) {
  const navigate = useNavigate()

  const handleKeyDown = useCallback(
    (e) => {
      // Ignore if user is typing in an input
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) {
        // Allow Escape to blur inputs
        if (e.key === 'Escape') {
          e.target.blur()
        }
        return
      }

      // Global shortcuts (no modifier keys needed)
      switch (e.key) {
        case '?':
          // Show keyboard shortcuts help modal
          e.preventDefault()
          if (onShowHelp) {
            onShowHelp()
          }
          break

        case '/':
          // Focus search / go to IOC search
          e.preventDefault()
          if (onOpenSearch) {
            onOpenSearch()
          } else {
            navigate('/iocs')
            // Focus the search input after navigation
            setTimeout(() => {
              const searchInput = document.querySelector('input[type="text"]')
              if (searchInput) searchInput.focus()
            }, 100)
          }
          break

        case '[':
          // Toggle sidebar collapse
          if (onToggleSidebar) {
            onToggleSidebar()
          }
          break

        case 'Escape':
          // Close any open modals/panels (future)
          break

        case 'g':
          // Start "go to" sequence
          window._waitingForGoKey = true
          setTimeout(() => {
            window._waitingForGoKey = false
          }, 1000)
          break

        case 'd':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/')
            window._waitingForGoKey = false
          }
          break

        case 'a':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/actors')
            window._waitingForGoKey = false
          }
          break

        case 'i':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/incidents')
            window._waitingForGoKey = false
          }
          break

        case 'v':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/vulnerabilities')
            window._waitingForGoKey = false
          }
          break

        case 's':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/settings')
            window._waitingForGoKey = false
          }
          break

        case 't':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/techniques')
            window._waitingForGoKey = false
          }
          break

        case 'w':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/watchlists')
            window._waitingForGoKey = false
          }
          break

        case 'r':
          if (window._waitingForGoKey) {
            e.preventDefault()
            navigate('/trends')
            window._waitingForGoKey = false
          }
          break
      }
    },
    [navigate, onToggleSidebar, onOpenSearch, onShowHelp]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export default useKeyboardShortcuts
