/**
 * Export Blocked Modal
 *
 * Shows when users try to export data without the required tier.
 * Displays available export options and their tier requirements.
 */

import { useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { TIER_INFO } from '../../lib/features'

const EXPORT_OPTIONS = [
  {
    id: 'clipboard',
    name: 'Copy to Clipboard',
    description: 'Copy selected data as text',
    icon: '📋',
    tier: 'free',
    format: 'text',
  },
  {
    id: 'csv',
    name: 'Export CSV',
    description: 'Download as spreadsheet',
    icon: '📊',
    tier: 'professional',
    format: 'csv',
  },
  {
    id: 'json',
    name: 'Export JSON',
    description: 'Download as JSON file',
    icon: '{ }',
    tier: 'professional',
    format: 'json',
  },
  {
    id: 'stix',
    name: 'Export STIX 2.1',
    description: 'Threat intel exchange format',
    icon: '🔗',
    tier: 'team',
    format: 'stix',
  },
  {
    id: 'misp',
    name: 'Export MISP',
    description: 'MISP event format',
    icon: '🛡️',
    tier: 'team',
    format: 'misp',
  },
]

const TIER_ORDER = ['free', 'professional', 'team', 'enterprise']

function getTierIndex(tier) {
  return TIER_ORDER.indexOf(tier)
}

function ExportOption({ option, currentTier, onExport, selectedCount }) {
  const hasAccess = getTierIndex(currentTier) >= getTierIndex(option.tier)
  const tierInfo = TIER_INFO[option.tier]

  return (
    <button
      onClick={() => hasAccess && onExport(option.format)}
      disabled={!hasAccess}
      className={clsx(
        'w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left',
        hasAccess
          ? 'border-gray-700 hover:border-cyber-accent/50 hover:bg-gray-800/50 cursor-pointer'
          : 'border-gray-800 bg-gray-800/30 cursor-not-allowed opacity-60'
      )}
    >
      <div className="text-2xl w-10 text-center">{option.icon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={clsx('font-medium', hasAccess ? 'text-white' : 'text-gray-400')}>
            {option.name}
          </span>
          {!hasAccess && (
            <span
              className={clsx(
                'px-2 py-0.5 text-xs rounded',
                option.tier === 'professional'
                  ? 'bg-blue-500/20 text-blue-400'
                  : option.tier === 'team'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-gray-500/20 text-gray-400'
              )}
            >
              {option.tier.charAt(0).toUpperCase() + option.tier.slice(1)}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">{option.description}</div>
      </div>

      {hasAccess ? (
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      )}
    </button>
  )
}

export function ExportBlockedModal({
  isOpen,
  onClose,
  onExport,
  selectedCount = 0,
  entityType = 'items',
  availableFormats = ['clipboard', 'csv', 'json', 'stix'],
}) {
  const { tier } = useSubscription()

  if (!isOpen) return null

  const filteredOptions = EXPORT_OPTIONS.filter((opt) => availableFormats.includes(opt.id))
  const lockedOptions = filteredOptions.filter((opt) => getTierIndex(tier) < getTierIndex(opt.tier))
  const nextTier = lockedOptions.length > 0 ? lockedOptions[0].tier : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Export Data</h3>
            <p className="text-sm text-gray-400">
              {selectedCount > 0
                ? `${selectedCount} ${entityType} selected`
                : `Export ${entityType}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Export options */}
        <div className="p-4 space-y-2">
          {filteredOptions.map((option) => (
            <ExportOption
              key={option.id}
              option={option}
              currentTier={tier}
              onExport={onExport}
              selectedCount={selectedCount}
            />
          ))}
        </div>

        {/* Upgrade prompt */}
        {lockedOptions.length > 0 && nextTier && (
          <div className="p-4 border-t border-gray-800 bg-gray-800/30">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-gray-300">
                  Unlock {lockedOptions.length} more export format
                  {lockedOptions.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  Starting at ${TIER_INFO[nextTier]?.price || 39}/month
                </p>
              </div>
              <Link
                to="/pricing"
                className="px-4 py-2 bg-cyber-accent text-black text-sm font-medium rounded-lg hover:bg-cyber-accent/90 transition-colors"
              >
                Upgrade
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Simple export button that shows modal when needed
 */
export function ExportButton({
  onExport,
  selectedCount = 0,
  entityType = 'items',
  availableFormats,
  className,
}) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors',
          className
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
      </button>

      <ExportBlockedModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onExport={(format) => {
          onExport(format)
          setShowModal(false)
        }}
        selectedCount={selectedCount}
        entityType={entityType}
        availableFormats={availableFormats}
      />
    </>
  )
}

export default ExportBlockedModal
