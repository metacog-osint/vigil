/**
 * Limit Reached Modal
 *
 * Shows when users hit usage limits (watchlist items, searches, saved filters).
 * Displays current usage, limit info, and upgrade options.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { TIER_INFO, getLimit, getUpgradeTier } from '../../lib/features'

const LIMIT_CONFIGS = {
  watchlistItems: {
    icon: '👁️',
    title: 'Watchlist Full',
    singular: 'item',
    plural: 'items',
    description: 'Track more actors and CVEs',
    benefits: [
      'Get alerts when watched items are active',
      'Personalized threat relevance scores',
      'Export watchlist as IOC list',
    ],
  },
  savedFilters: {
    icon: '🔖',
    title: 'Saved Filters Limit',
    singular: 'filter',
    plural: 'filters',
    description: 'Save more custom views',
    benefits: [
      'Quick access to frequent searches',
      'Share filters with team members',
      'Set default dashboard views',
    ],
  },
  searches: {
    icon: '🔍',
    title: 'Daily Search Limit',
    singular: 'search',
    plural: 'searches',
    description: 'Unlimited threat intelligence searches',
    benefits: [
      'Unlimited daily searches',
      'Full historical data access',
      'Advanced query syntax',
    ],
    isDaily: true,
  },
  apiRequests: {
    icon: '🔌',
    title: 'API Rate Limit',
    singular: 'request',
    plural: 'requests',
    description: 'Higher API throughput',
    benefits: [
      'Automate IOC lookups',
      'SIEM/SOAR integration',
      'Bulk data exports',
    ],
    isMonthly: true,
  },
  orgProfiles: {
    icon: '🏢',
    title: 'Org Profile Limit',
    singular: 'profile',
    plural: 'profiles',
    description: 'Monitor multiple organizations',
    benefits: [
      'Separate threat views per org',
      'Client-specific dashboards',
      'Multi-tenant reporting',
    ],
  },
}

function ProgressBar({ current, max, className }) {
  const percentage = Math.min(100, (current / max) * 100)
  const isAtLimit = current >= max

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{current} used</span>
        <span>{max} max</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            isAtLimit ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-cyber-accent'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function TierComparison({ limitType, currentTier }) {
  const tiers = ['free', 'professional', 'team', 'enterprise']
  const currentIndex = tiers.indexOf(currentTier)

  return (
    <div className="grid grid-cols-4 gap-2 text-center text-xs">
      {tiers.map((tier, i) => {
        const limit = getLimit(tier, limitType)
        const isCurrent = tier === currentTier
        const isUpgrade = i > currentIndex

        return (
          <div
            key={tier}
            className={clsx(
              'p-2 rounded',
              isCurrent ? 'bg-cyber-accent/20 border border-cyber-accent/30' :
              isUpgrade ? 'bg-gray-800' : 'bg-gray-800/50'
            )}
          >
            <div className={clsx(
              'font-medium mb-1',
              isCurrent ? 'text-cyber-accent' : isUpgrade ? 'text-white' : 'text-gray-500'
            )}>
              {limit === Infinity || limit === -1 ? '∞' : limit.toLocaleString()}
            </div>
            <div className={clsx(
              'capitalize',
              isCurrent ? 'text-cyber-accent' : 'text-gray-500'
            )}>
              {tier === 'professional' ? 'Pro' : tier}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LimitReachedModal({
  isOpen,
  onClose,
  limitType,
  currentCount,
  onRemoveItem, // Optional: callback to remove an item to make room
}) {
  const { tier } = useSubscription()
  const config = LIMIT_CONFIGS[limitType] || LIMIT_CONFIGS.watchlistItems
  const limit = getLimit(tier, limitType)
  const nextTier = getUpgradeTier(tier)
  const nextLimit = nextTier ? getLimit(nextTier, limitType) : null

  if (!isOpen) return null

  const resetText = config.isDaily ? 'Resets daily at midnight UTC' :
                    config.isMonthly ? 'Resets monthly' : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header with icon */}
        <div className="bg-gradient-to-b from-red-500/10 to-transparent p-6 text-center">
          <div className="text-5xl mb-3">{config.icon}</div>
          <h3 className="text-xl font-semibold text-white">{config.title}</h3>
          <p className="text-gray-400 text-sm mt-1">
            You've reached your {tier} plan limit
          </p>
        </div>

        {/* Usage progress */}
        <div className="px-6 pb-4">
          <ProgressBar current={currentCount} max={limit} />
          {resetText && (
            <p className="text-xs text-gray-500 mt-2 text-center">{resetText}</p>
          )}
        </div>

        {/* Tier comparison */}
        <div className="px-6 pb-4">
          <div className="text-xs text-gray-500 mb-2 text-center">
            {config.plural.charAt(0).toUpperCase() + config.plural.slice(1)} by plan
          </div>
          <TierComparison limitType={limitType} currentTier={tier} />
        </div>

        {/* Benefits of upgrading */}
        {nextTier && (
          <div className="px-6 pb-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm font-medium text-white mb-2">
                With {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}:
              </div>
              <ul className="space-y-2">
                {config.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {benefit}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm text-white font-medium">
                  <svg className="w-4 h-4 text-cyber-accent mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {nextLimit === Infinity || nextLimit === -1
                    ? `Unlimited ${config.plural}`
                    : `${nextLimit.toLocaleString()} ${config.plural}`
                  }
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t border-gray-800 flex gap-3">
          {onRemoveItem && (
            <button
              onClick={onRemoveItem}
              className="flex-1 px-4 py-2 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Remove an item
            </button>
          )}
          <Link
            to="/pricing"
            className="flex-1 px-4 py-2 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90 transition-colors text-center"
          >
            Upgrade{nextTier ? ` to ${nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}` : ''}
          </Link>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * Toast notification for approaching limits
 */
export function LimitWarningToast({
  limitType,
  currentCount,
  onDismiss,
  className,
}) {
  const { tier } = useSubscription()
  const config = LIMIT_CONFIGS[limitType] || LIMIT_CONFIGS.watchlistItems
  const limit = getLimit(tier, limitType)
  const remaining = limit - currentCount
  const percentage = (currentCount / limit) * 100

  // Only show if > 80% used
  if (percentage < 80) return null

  return (
    <div className={clsx(
      'flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg',
      className
    )}>
      <span className="text-xl">{config.icon}</span>
      <div className="flex-1">
        <div className="text-sm text-yellow-400">
          {remaining === 0
            ? `${config.title} - limit reached`
            : `${remaining} ${remaining === 1 ? config.singular : config.plural} remaining`
          }
        </div>
        <Link to="/pricing" className="text-xs text-yellow-500/70 hover:text-yellow-400">
          Upgrade for more →
        </Link>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="p-1 text-yellow-500/50 hover:text-yellow-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Hook to check limits and show modal
 */
export function useLimitCheck(limitType) {
  const { tier, getLimit: getTierLimit } = useSubscription()
  const [showModal, setShowModal] = useState(false)
  const [currentCount, setCurrentCount] = useState(0)

  const limit = getTierLimit(limitType)

  const checkLimit = (count) => {
    setCurrentCount(count)
    if (count >= limit) {
      setShowModal(true)
      return false
    }
    return true
  }

  const isAtLimit = currentCount >= limit
  const isApproachingLimit = currentCount >= limit * 0.8

  return {
    showModal,
    setShowModal,
    checkLimit,
    isAtLimit,
    isApproachingLimit,
    currentCount,
    limit,
    remaining: Math.max(0, limit - currentCount),
  }
}

export default LimitReachedModal
