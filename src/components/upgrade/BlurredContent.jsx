/**
 * Blurred Content Component
 *
 * Shows premium content as blurred/teaser with upgrade CTA.
 * Used for historical data, correlations, and other gated content.
 */

import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { getRequiredTier, TIER_INFO } from '../../lib/features'

const BLUR_LEVELS = {
  light: 'blur-[2px]',
  medium: 'blur-[4px]',
  heavy: 'blur-[8px]',
}

/**
 * Wrapper that blurs content for users without access
 */
export function BlurredContent({
  feature,
  requiredTier,
  children,
  blurLevel = 'medium',
  overlayMessage,
  showPrice = true,
  className,
}) {
  const { tier, canAccess } = useSubscription()

  const effectiveTier = requiredTier || getRequiredTier(feature)
  const hasAccess = feature ? canAccess(feature) : tier !== 'free'

  if (hasAccess) {
    return children
  }

  const tierInfo = TIER_INFO[effectiveTier]
  const price = tierInfo?.price || 39

  return (
    <div className={clsx('relative', className)}>
      {/* Blurred content */}
      <div className={clsx(BLUR_LEVELS[blurLevel], 'select-none pointer-events-none')}>
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-cyber-accent/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <p className="text-white font-medium mb-2">
            {overlayMessage || `Unlock with ${effectiveTier.charAt(0).toUpperCase() + effectiveTier.slice(1)}`}
          </p>

          {showPrice && (
            <p className="text-gray-400 text-sm mb-4">
              Starting at ${price}/month
            </p>
          )}

          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90 transition-colors"
          >
            View Plans
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Blurred historical data with date restriction message
 */
export function BlurredHistoricalData({
  children,
  daysAvailable = 30,
  totalDays,
  className,
}) {
  const { tier } = useSubscription()

  if (tier !== 'free') {
    return children
  }

  const hiddenDays = totalDays ? totalDays - daysAvailable : null

  return (
    <div className={clsx('relative', className)}>
      <div className="blur-[4px] select-none pointer-events-none">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-md">
          <div className="text-4xl mb-4">📅</div>

          <h4 className="text-white font-medium mb-2">
            Viewing Last {daysAvailable} Days Only
          </h4>

          <p className="text-gray-400 text-sm mb-4">
            {hiddenDays
              ? `${hiddenDays}+ days of historical data available with Professional`
              : 'Full historical data available with Professional'
            }
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              to="/pricing"
              className="px-4 py-2 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90 transition-colors"
            >
              Unlock Full History
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Teaser list showing partial results with blur on rest
 */
export function BlurredListTeaser({
  items,
  visibleCount = 3,
  renderItem,
  feature,
  requiredTier = 'professional',
  emptyMessage = 'No items',
  className,
}) {
  const { canAccess } = useSubscription()
  const hasAccess = feature ? canAccess(feature) : false

  if (!items || items.length === 0) {
    return <div className="text-gray-500 text-sm py-4 text-center">{emptyMessage}</div>
  }

  if (hasAccess) {
    return (
      <div className={className}>
        {items.map((item, i) => renderItem(item, i))}
      </div>
    )
  }

  const visibleItems = items.slice(0, visibleCount)
  const hiddenCount = items.length - visibleCount

  return (
    <div className={className}>
      {/* Visible items */}
      {visibleItems.map((item, i) => renderItem(item, i))}

      {/* Blurred/hidden items indicator */}
      {hiddenCount > 0 && (
        <div className="relative mt-2">
          <div className="blur-[6px] opacity-50 pointer-events-none">
            {items.slice(visibleCount, visibleCount + 2).map((item, i) => renderItem(item, i + visibleCount))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              to="/pricing"
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-cyber-accent/50 hover:text-white transition-colors"
            >
              +{hiddenCount} more with {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Search results with historical data blurred
 */
export function BlurredSearchResults({
  results,
  recentResults,
  historicalResults,
  renderResult,
  daysShown = 30,
  className,
}) {
  const { tier } = useSubscription()
  const hasFullAccess = tier !== 'free'

  if (hasFullAccess) {
    return (
      <div className={className}>
        {results.map((result, i) => renderResult(result, i))}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Recent results (visible) */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">
          Showing results from last {daysShown} days ({recentResults?.length || 0} results)
        </div>
        {recentResults?.map((result, i) => renderResult(result, i))}
      </div>

      {/* Historical results (blurred) */}
      {historicalResults && historicalResults.length > 0 && (
        <div className="relative border-t border-gray-800 pt-4">
          <div className="blur-[6px] opacity-40 pointer-events-none select-none">
            {historicalResults.slice(0, 3).map((result, i) => renderResult(result, i))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
            <div className="text-center p-4">
              <p className="text-gray-300 text-sm mb-3">
                {historicalResults.length} older results hidden
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-accent text-black text-sm font-medium rounded-lg hover:bg-cyber-accent/90"
              >
                Unlock Full History
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Correlation preview with blurred details
 */
export function BlurredCorrelationPreview({
  actorName,
  correlations,
  className,
}) {
  const { tier, canAccess } = useSubscription()
  const hasAccess = canAccess('correlation_panel')

  const stats = [
    { label: 'Related CVEs', value: correlations?.vulnerabilities?.length || 0, locked: false },
    { label: 'Associated IOCs', value: correlations?.iocs?.length || 0, locked: !hasAccess },
    { label: 'Attack Chains', value: correlations?.attackChains?.length || 0, locked: !hasAccess },
    { label: 'Similar Actors', value: correlations?.similarActors?.length || 0, locked: tier !== 'team' && tier !== 'enterprise' },
  ]

  return (
    <div className={clsx('cyber-card', className)}>
      <h4 className="text-white font-medium mb-4">
        Correlations for "{actorName}"
      </h4>

      <div className="space-y-3">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">{stat.label}</span>
            {stat.locked ? (
              <Link
                to="/pricing"
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-cyber-accent transition-colors"
              >
                <span className="blur-[4px]">{stat.value || '??'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </Link>
            ) : (
              <span className="text-white font-medium">{stat.value}</span>
            )}
          </div>
        ))}
      </div>

      {!hasAccess && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <Link
            to="/pricing"
            className="block text-center text-sm text-cyber-accent hover:underline"
          >
            Unlock full correlation data →
          </Link>
        </div>
      )}
    </div>
  )
}

export default BlurredContent
