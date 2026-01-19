/**
 * FocusModeToggle Component
 *
 * Header button to toggle Focus Mode.
 * Shows current filter status when enabled.
 */
import { useFocusMode } from '../../hooks/useFocusMode'
import { useNavigate } from 'react-router-dom'

export function FocusModeToggle({ className = '' }) {
  const navigate = useNavigate()
  const {
    enabled,
    filterDescription,
    toggle,
    hasProfile,
    isLoading,
  } = useFocusMode()

  // If no profile, show setup prompt
  const handleClick = () => {
    if (!hasProfile) {
      navigate('/settings')
      return
    }
    toggle()
  }

  if (isLoading) {
    return (
      <div className="w-24 h-8 bg-gray-800 rounded-lg animate-pulse" />
    )
  }

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
        ${enabled
          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30'
          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800 border border-transparent'
        }
        ${className}
      `}
      title={
        !hasProfile
          ? 'Set up organization profile to enable Focus Mode'
          : enabled
          ? `Focus Mode: ${filterDescription}`
          : 'Enable Focus Mode to filter by your organization'
      }
      aria-pressed={enabled}
    >
      {/* Eye icon */}
      <svg
        className={`w-4 h-4 ${enabled ? 'text-cyan-400' : 'text-gray-500'}`}
        fill={enabled ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {enabled ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        )}
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>

      {/* Label */}
      <span className="hidden sm:inline">
        {!hasProfile ? 'Focus' : enabled ? 'Focused' : 'Focus'}
      </span>

      {/* Status indicator */}
      {enabled && (
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      )}
    </button>
  )
}

/**
 * Focus Mode Banner - Shows when focus mode is active
 */
export function FocusModeBanner({ onDisable }) {
  const { enabled, filterDescription } = useFocusMode()

  if (!enabled) return null

  return (
    <div className="bg-cyan-500/10 border-b border-cyan-500/30 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-cyan-400">Focus Mode:</span>
          <span className="text-gray-300">{filterDescription}</span>
        </div>
        {onDisable && (
          <button
            onClick={onDisable}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Turn off
          </button>
        )}
      </div>
    </div>
  )
}

export default FocusModeToggle
