/**
 * Tier Badge Components
 *
 * Small, non-intrusive indicators showing which tier unlocks a feature.
 * Used throughout the UI to indicate premium features.
 */

import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { getRequiredTier, canAccess } from '../../lib/features'

const TIER_STYLES = {
  free: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    icon: null,
  },
  professional: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    icon: '⚡',
    short: 'Pro',
  },
  team: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    icon: '👥',
    short: 'Team',
  },
  enterprise: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    icon: '🏢',
    short: 'Ent',
  },
}

const TIER_ORDER = ['free', 'professional', 'team', 'enterprise']

function getTierIndex(tier) {
  return TIER_ORDER.indexOf(tier)
}

/**
 * Small inline badge showing required tier
 */
export function TierBadge({
  tier,
  feature,
  showIcon = false,
  showLock = true,
  size = 'sm',
  className,
}) {
  const effectiveTier = tier || (feature ? getRequiredTier(feature) : 'professional')
  const style = TIER_STYLES[effectiveTier] || TIER_STYLES.professional

  const sizeClasses = {
    xs: 'text-[10px] px-1 py-0.5',
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded font-medium',
        style.bg,
        style.text,
        sizeClasses[size],
        className
      )}
    >
      {showLock && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      )}
      {showIcon && style.icon && <span>{style.icon}</span>}
      {style.short || effectiveTier.charAt(0).toUpperCase() + effectiveTier.slice(1)}
    </span>
  )
}

/**
 * Badge that only shows if user doesn't have access
 */
export function LockedBadge({ feature, requiredTier, size = 'sm', className }) {
  const { tier } = useSubscription()
  const effectiveTier = requiredTier || (feature ? getRequiredTier(feature) : 'professional')
  const hasAccess = getTierIndex(tier) >= getTierIndex(effectiveTier)

  if (hasAccess) return null

  return <TierBadge tier={effectiveTier} size={size} className={className} />
}

/**
 * Feature label with optional tier badge
 */
export function FeatureLabel({ children, feature, requiredTier, className }) {
  const { tier } = useSubscription()
  const effectiveTier = requiredTier || (feature ? getRequiredTier(feature) : null)
  const hasAccess = effectiveTier ? getTierIndex(tier) >= getTierIndex(effectiveTier) : true

  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <span className={hasAccess ? 'text-white' : 'text-gray-400'}>{children}</span>
      {!hasAccess && effectiveTier && <TierBadge tier={effectiveTier} size="xs" showLock={false} />}
    </span>
  )
}

/**
 * Locked icon indicator (smaller than full badge)
 */
export function LockedIcon({ feature, requiredTier, size = 16, className }) {
  const { tier } = useSubscription()
  const effectiveTier = requiredTier || (feature ? getRequiredTier(feature) : 'professional')
  const hasAccess = getTierIndex(tier) >= getTierIndex(effectiveTier)
  const style = TIER_STYLES[effectiveTier] || TIER_STYLES.professional

  if (hasAccess) return null

  return (
    <svg
      className={clsx(style.text, className)}
      width={size}
      height={size}
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
  )
}

/**
 * Navigation item with tier indicator
 */
export function NavItemWithTier({
  to,
  icon,
  label,
  feature,
  requiredTier,
  isActive,
  collapsed,
  onClick,
}) {
  const { tier } = useSubscription()
  const effectiveTier = requiredTier || (feature ? getRequiredTier(feature) : null)
  const hasAccess = effectiveTier ? getTierIndex(tier) >= getTierIndex(effectiveTier) : true
  const style = effectiveTier ? TIER_STYLES[effectiveTier] : null

  const content = (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
        isActive
          ? 'bg-cyber-accent/20 text-cyber-accent'
          : hasAccess
            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
            : 'text-gray-500 hover:bg-gray-800/50'
      )}
    >
      <span className={clsx('w-5 h-5', !hasAccess && 'opacity-50')}>{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {!hasAccess && effectiveTier && (
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', style?.bg, style?.text)}>
              {style?.short || effectiveTier}
            </span>
          )}
        </>
      )}
    </div>
  )

  if (hasAccess) {
    return (
      <Link to={to} onClick={onClick}>
        {content}
      </Link>
    )
  }

  // For locked features, link to pricing
  return (
    <Link to="/pricing" onClick={onClick} title={`Requires ${effectiveTier} plan`}>
      {content}
    </Link>
  )
}

/**
 * Button with tier indicator
 */
export function ButtonWithTier({
  children,
  feature,
  requiredTier,
  onClick,
  disabled,
  className,
  variant = 'default',
}) {
  const { tier, canAccess: checkAccess } = useSubscription()
  const effectiveTier = requiredTier || (feature ? getRequiredTier(feature) : null)
  const hasAccess = effectiveTier
    ? feature
      ? checkAccess(feature)
      : getTierIndex(tier) >= getTierIndex(effectiveTier)
    : true
  const style = effectiveTier ? TIER_STYLES[effectiveTier] : null

  const variantClasses = {
    default: 'bg-gray-800 text-gray-300 hover:bg-gray-700',
    primary: 'bg-cyber-accent text-black hover:bg-cyber-accent/90',
  }

  if (hasAccess) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          variantClasses[variant],
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        {children}
      </button>
    )
  }

  return (
    <Link
      to="/pricing"
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
        'bg-gray-800/50 text-gray-500 hover:bg-gray-800',
        className
      )}
      title={`Requires ${effectiveTier} plan`}
    >
      {children}
      <TierBadge tier={effectiveTier} size="xs" showLock={false} />
    </Link>
  )
}

/**
 * Upgrade prompt inline with feature
 */
export function UpgradeInline({ feature, requiredTier, message, className }) {
  const { tier } = useSubscription()
  const effectiveTier = requiredTier || (feature ? getRequiredTier(feature) : 'professional')
  const hasAccess = getTierIndex(tier) >= getTierIndex(effectiveTier)
  const style = TIER_STYLES[effectiveTier] || TIER_STYLES.professional

  if (hasAccess) return null

  return (
    <Link
      to="/pricing"
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        style.bg,
        style.border,
        'hover:opacity-80',
        className
      )}
    >
      <LockedIcon requiredTier={effectiveTier} size={14} />
      <span className={clsx('text-sm', style.text)}>
        {message || `Upgrade to ${effectiveTier.charAt(0).toUpperCase() + effectiveTier.slice(1)}`}
      </span>
      <svg
        className={clsx('w-4 h-4 ml-auto', style.text)}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

/**
 * "New" + Tier combo badge for premium features
 */
export function NewFeatureBadge({ tier, className }) {
  const style = TIER_STYLES[tier] || TIER_STYLES.professional

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
        style.bg,
        style.text,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      New in {style.short || tier}
    </span>
  )
}

export default TierBadge
