/**
 * Upgrade Components Barrel Export
 *
 * Components for showing users what they're missing and
 * encouraging upgrades to premium tiers.
 */

// Blurred/teaser content
export {
  BlurredContent,
  BlurredHistoricalData,
  BlurredListTeaser,
  BlurredSearchResults,
  BlurredCorrelationPreview,
  default as BlurredContentDefault,
} from './BlurredContent'

// Export blocked modal
export {
  ExportBlockedModal,
  ExportButton,
  default as ExportBlockedModalDefault,
} from './ExportBlockedModal'

// Limit reached modal
export {
  LimitReachedModal,
  LimitWarningToast,
  useLimitCheck,
  default as LimitReachedModalDefault,
} from './LimitReachedModal'

// Tier badges
export {
  TierBadge,
  LockedBadge,
  FeatureLabel,
  LockedIcon,
  NavItemWithTier,
  ButtonWithTier,
  UpgradeInline,
  NewFeatureBadge,
  default as TierBadgeDefault,
} from './TierBadge'

// API Playground (will be added)
export { default as ApiPlayground } from './ApiPlayground'

// Missed alerts widget (will be added)
export { MissedAlertsWidget, MissedAlertsCard } from './MissedAlertsWidget'
