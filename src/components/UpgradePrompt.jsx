import { Link } from 'react-router-dom'
import { TIER_INFO, getRequiredTier, FEATURE_DESCRIPTIONS, canAccess as canAccessFn, isLimitReached as isLimitReachedFn, getLimit as getLimitFn, getUpgradeTier } from '../lib/features'
import { useSubscription } from '../contexts/SubscriptionContext'

/**
 * Upgrade prompt shown when user tries to access a feature they don't have
 */
export function UpgradePrompt({ feature, currentTier: _currentTier = 'free', variant = 'default' }) {
  const requiredTier = getRequiredTier(feature)
  const tierInfo = TIER_INFO[requiredTier]
  const featureDescription = FEATURE_DESCRIPTIONS[feature] || feature

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-gray-400">
          {featureDescription} requires{' '}
          <Link to="/pricing" className="text-cyan-400 hover:underline">
            {tierInfo?.name || requiredTier}
          </Link>
        </span>
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <Link
        to="/pricing"
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded hover:bg-yellow-500/30 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        {tierInfo?.name || 'Upgrade'}
      </Link>
    )
  }

  if (variant === 'minimal') {
    return (
      <Link
        to="/pricing"
        className="text-cyan-400 hover:text-cyan-300 text-sm"
      >
        Upgrade to {tierInfo?.name || requiredTier} →
      </Link>
    )
  }

  // Default card variant
  return (
    <div className="bg-gradient-to-br from-cyan-900/20 to-gray-900 border border-cyan-800/30 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-cyan-500/20 rounded-lg">
          <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-white mb-1">
            Upgrade to {tierInfo?.name || requiredTier}
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            {featureDescription} is available on the {tierInfo?.name || requiredTier} plan and above.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/pricing"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            >
              View Plans
            </Link>
            {tierInfo?.price && (
              <span className="text-gray-500 text-sm">
                Starting at ${tierInfo.price}/month
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Feature gate wrapper - shows content if user has access, upgrade prompt if not
 */
export function FeatureGate({ children, feature, fallback = null }) {
  const { tier } = useSubscription()

  if (canAccessFn(tier, feature)) {
    return children
  }

  if (fallback) {
    return fallback
  }

  return <UpgradePrompt feature={feature} currentTier={tier} />
}

/**
 * Limit gate - shows content if under limit, warning/upgrade prompt if at/over limit
 */
export function LimitGate({ children, limitType, currentCount }) {
  const { tier } = useSubscription()

  const limit = getLimitFn(tier, limitType)
  const reached = isLimitReachedFn(tier, limitType, currentCount)
  const nextTier = getUpgradeTier(tier)

  if (!reached) {
    return children
  }

  return (
    <div className="space-y-4">
      {children}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-yellow-400 font-medium">Limit Reached</span>
        </div>
        <p className="text-gray-400 text-sm mb-3">
          You've reached your limit of {limit} {limitType.replace(/([A-Z])/g, ' $1').toLowerCase()}.
          {nextTier && ` Upgrade to ${TIER_INFO[nextTier]?.name} for more.`}
        </p>
        {nextTier && (
          <Link
            to="/pricing"
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            View upgrade options →
          </Link>
        )}
      </div>
    </div>
  )
}

/**
 * Pro badge to indicate premium features
 */
export function ProBadge({ tier = 'professional' }) {
  const colors = {
    professional: 'bg-cyan-500/20 text-cyan-400',
    team: 'bg-purple-500/20 text-purple-400',
    enterprise: 'bg-amber-500/20 text-amber-400',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${colors[tier] || colors.professional}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
      {tier === 'enterprise' ? 'Enterprise' : tier === 'team' ? 'Team' : 'Pro'}
    </span>
  )
}

export default UpgradePrompt
