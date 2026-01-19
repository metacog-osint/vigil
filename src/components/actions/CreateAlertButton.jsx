/**
 * CreateAlertButton Component
 *
 * One-click button to create an alert rule for an entity.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'

export function CreateAlertButton({
  entityType, // 'actor', 'sector', 'cve', 'ioc_type'
  entityId,
  entityName,
  className = '',
  size = 'md',
  showLabel = false,
}) {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)

  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const buttonSizes = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  }

  const handleClick = () => {
    // Build alert rule params
    const params = new URLSearchParams({
      create: 'true',
      type: entityType,
      value: entityId,
      name: entityName || entityId,
    })

    // Navigate to alerts page with pre-filled rule
    navigate(`/alerts?${params.toString()}`)
  }

  const _handleQuickCreate = () => {
    setShowConfirm(true)
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={clsx(
          'text-gray-400 hover:text-yellow-400 transition-colors',
          buttonSizes[size],
          className
        )}
        title={`Create alert for ${entityName || entityType}`}
        aria-label="Create alert rule"
      >
        <svg className={sizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {showLabel && <span className="ml-1.5 text-sm">Alert</span>}
      </button>

      {/* Quick confirm tooltip */}
      {showConfirm && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowConfirm(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-cyber-dark border border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
            <p className="text-sm text-gray-300 mb-2">
              Create alert for <strong className="text-white">{entityName}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClick}
                className="flex-1 px-3 py-1.5 text-sm bg-yellow-500 text-black rounded hover:bg-yellow-400 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CreateAlertButton
