/**
 * Feature Gating System
 * Controls access to features based on subscription tier
 */

// Subscription tiers in order of access level
export const TIERS = ['free', 'professional', 'team', 'enterprise']

// Tier metadata
export const TIER_INFO = {
  free: {
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    description: 'Basic threat intelligence access',
    limits: {
      users: 1,
      orgProfiles: 0,
      apiRequests: 0,
      savedFilters: 3,
      watchlistItems: 10,
    },
  },
  professional: {
    name: 'Professional',
    price: 29,
    priceLabel: '$29/month',
    description: 'For individual security professionals',
    limits: {
      users: 1,
      orgProfiles: 1,
      apiRequests: 0,
      savedFilters: 25,
      watchlistItems: 100,
    },
  },
  team: {
    name: 'Team',
    price: 99,
    priceLabel: '$99/month',
    description: 'For security teams',
    limits: {
      users: 5,
      orgProfiles: 3,
      apiRequests: 10000,
      savedFilters: -1, // unlimited
      watchlistItems: -1, // unlimited
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    priceLabel: 'Contact us',
    description: 'Custom solutions for large organizations',
    limits: {
      users: -1, // unlimited
      orgProfiles: -1, // unlimited
      apiRequests: -1, // unlimited
      savedFilters: -1, // unlimited
      watchlistItems: -1, // unlimited
    },
  },
}

// Features available at each tier (cumulative - higher tiers get all lower tier features)
export const TIER_FEATURES = {
  free: [
    'view_dashboard',
    'view_actors',
    'view_incidents',
    'view_vulnerabilities',
    'view_iocs',
    'view_alerts',
    'basic_search',
    'view_trends',
    'view_techniques',
  ],
  professional: [
    'org_profile',
    'relevance_scoring',
    'email_digests',
    'vendor_alerts',
    'saved_filters',
    'saved_searches',
    'csv_export',
    'watchlist',
    'threat_hunts',
    'custom_alert_rules',
    'correlation_panel',
    'scheduled_reports',
    'investigations',
    'attack_surface',
    'custom_ioc_lists',
  ],
  team: [
    'api_access',
    'api_keys',
    'multiple_profiles',
    'bulk_search',
    'stix_export',
    'team_sharing',
    'advanced_search',
    'priority_support',
  ],
  enterprise: [
    'siem_integration',
    'custom_integrations',
    'sso_saml',
    'audit_logs',
    'white_label',
    'sla_guarantee',
    'dedicated_support',
    'custom_data_retention',
    'on_premise_option',
  ],
}

// Feature descriptions for UI
export const FEATURE_DESCRIPTIONS = {
  view_dashboard: 'Access to main dashboard',
  view_actors: 'Browse threat actors',
  view_incidents: 'View ransomware incidents',
  view_vulnerabilities: 'Access CVE database',
  view_iocs: 'Search IOC database',
  view_alerts: 'View CISA alerts',
  basic_search: 'Basic search functionality',
  view_trends: 'Access trend analysis',
  view_techniques: 'Browse MITRE ATT&CK techniques',
  org_profile: 'Organization profile setup',
  relevance_scoring: 'Personalized relevance scores',
  email_digests: 'Daily/weekly email digests',
  vendor_alerts: 'Vendor-specific CVE alerts',
  saved_filters: 'Save and reuse filters',
  saved_searches: 'Save searches and set default views',
  csv_export: 'Export data to CSV',
  watchlist: 'Track actors and CVEs',
  threat_hunts: 'Actionable threat hunt guides',
  custom_alert_rules: 'Create custom alert rules',
  correlation_panel: 'Actor correlation insights',
  scheduled_reports: 'Automated scheduled reports',
  investigations: 'Investigation notebooks for threat analysis',
  attack_surface: 'Attack surface monitoring for your assets',
  custom_ioc_lists: 'Import and manage private IOC collections',
  api_access: 'REST API access',
  api_keys: 'Generate API keys',
  multiple_profiles: 'Multiple org profiles',
  bulk_search: 'Bulk IOC lookup',
  stix_export: 'Export in STIX 2.1 format',
  team_sharing: 'Share with team members',
  advanced_search: 'Advanced query language',
  priority_support: 'Priority email support',
  siem_integration: 'SIEM connectors (Splunk, Elastic, Sentinel)',
  custom_integrations: 'Custom integration development',
  sso_saml: 'SSO/SAML authentication',
  audit_logs: 'Full audit logging',
  sla_guarantee: 'SLA guarantee',
  dedicated_support: 'Dedicated support contact',
  custom_data_retention: 'Custom data retention policies',
  white_label: 'White-label branding customization',
  on_premise_option: 'On-premise deployment option',
}

/**
 * Check if a user's tier has access to a feature
 * @param {string} userTier - User's subscription tier
 * @param {string} feature - Feature to check
 * @returns {boolean} - Whether user has access
 */
export function canAccess(userTier, feature) {
  const tierIndex = TIERS.indexOf(userTier || 'free')
  if (tierIndex === -1) return false

  // Check current tier and all lower tiers (features are cumulative)
  for (let i = tierIndex; i >= 0; i--) {
    const tier = TIERS[i]
    if (TIER_FEATURES[tier]?.includes(feature)) {
      return true
    }
  }
  return false
}

/**
 * Get all features available to a tier
 * @param {string} tier - Subscription tier
 * @returns {string[]} - Array of feature names
 */
export function getTierFeatures(tier) {
  const tierIndex = TIERS.indexOf(tier || 'free')
  if (tierIndex === -1) return []

  const features = []
  for (let i = 0; i <= tierIndex; i++) {
    features.push(...(TIER_FEATURES[TIERS[i]] || []))
  }
  return [...new Set(features)] // Remove duplicates
}

/**
 * Get the minimum tier required for a feature
 * @param {string} feature - Feature name
 * @returns {string|null} - Tier name or null if feature doesn't exist
 */
export function getRequiredTier(feature) {
  for (const tier of TIERS) {
    if (TIER_FEATURES[tier]?.includes(feature)) {
      return tier
    }
  }
  return null
}

/**
 * Check if user has reached a limit
 * @param {string} userTier - User's subscription tier
 * @param {string} limitType - Type of limit (users, orgProfiles, etc.)
 * @param {number} currentCount - Current usage count
 * @returns {boolean} - Whether limit is reached
 */
export function isLimitReached(userTier, limitType, currentCount) {
  const tierInfo = TIER_INFO[userTier || 'free']
  if (!tierInfo) return true

  const limit = tierInfo.limits[limitType]
  if (limit === -1) return false // Unlimited
  return currentCount >= limit
}

/**
 * Get limit for a tier
 * @param {string} userTier - User's subscription tier
 * @param {string} limitType - Type of limit
 * @returns {number} - Limit value (-1 for unlimited)
 */
export function getLimit(userTier, limitType) {
  const tierInfo = TIER_INFO[userTier || 'free']
  if (!tierInfo) return 0
  return tierInfo.limits[limitType] ?? 0
}

/**
 * Get the next tier upgrade from current tier
 * @param {string} currentTier - Current subscription tier
 * @returns {string|null} - Next tier name or null if at highest
 */
export function getUpgradeTier(currentTier) {
  const tierIndex = TIERS.indexOf(currentTier || 'free')
  if (tierIndex === -1 || tierIndex >= TIERS.length - 1) return null
  return TIERS[tierIndex + 1]
}

/**
 * Compare two tiers
 * @param {string} tier1 - First tier
 * @param {string} tier2 - Second tier
 * @returns {number} - -1 if tier1 < tier2, 0 if equal, 1 if tier1 > tier2
 */
export function compareTiers(tier1, tier2) {
  const index1 = TIERS.indexOf(tier1 || 'free')
  const index2 = TIERS.indexOf(tier2 || 'free')
  return Math.sign(index1 - index2)
}

export default {
  TIERS,
  TIER_INFO,
  TIER_FEATURES,
  FEATURE_DESCRIPTIONS,
  canAccess,
  getTierFeatures,
  getRequiredTier,
  isLimitReached,
  getLimit,
  getUpgradeTier,
  compareTiers,
}
