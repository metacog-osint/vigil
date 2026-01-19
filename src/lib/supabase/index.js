/**
 * Supabase Module Barrel Export
 *
 * All modules have been extracted from the monolithic supabase.js file.
 * This barrel export maintains backward compatibility for existing imports.
 *
 * Modules (25 total):
 * - client.js: Supabase client, subscribeToTable
 * - threatActors.js: Threat actor queries
 * - incidents.js: Incident queries
 * - iocs.js: IOC queries with enrichment
 * - vulnerabilities.js: CVE/KEV management
 * - techniques.js: MITRE ATT&CK queries
 * - advisories.js: GitHub Security Advisories (GHSA)
 * - watchlists.js: User watchlist management
 * - teams.js: Team collaboration
 * - trendAnalysis.js: Temporal intelligence
 * - correlations.js: Actor-CVE-TTP linking
 * - savedSearches.js: Saved search management
 * - userPreferences.js: User preferences
 * - tags.js: Entity tagging system
 * - alerts.js: CISA alerts
 * - malwareSamples.js: Malware sample queries
 * - syncLog.js: Data sync logging
 * - dashboard.js: Dashboard statistics
 * - aiSummaries.js: AI-generated summaries
 * - orgProfile.js: Organization profile
 * - relevance.js: Relevance scoring
 * - dataSources.js: Data source management
 * - unifiedEvents.js: Unified event timeline
 * - notifications.js: User notifications
 * - alertRules.js: User alert rules
 * - threatHunts.js: Threat hunt guides
 * - sharedWatchlists.js: Team watchlists
 * - assets.js: Attack surface monitoring
 * - vendors.js: Third-party vendor risk management
 * - escalationPolicies.js: Alert escalation and on-call schedules
 */

// Core
export { supabase, subscribeToTable } from './client'

// Entity queries
export { threatActors } from './threatActors'
export { incidents } from './incidents'
export { iocs, detectIOCType } from './iocs'
export { vulnerabilities } from './vulnerabilities'
export { techniques } from './techniques'
export { advisories, ECOSYSTEMS } from './advisories'

// User features
export { watchlists } from './watchlists'
export { savedSearches } from './savedSearches'
export { userPreferences } from './userPreferences'
export { tags } from './tags'
export { notifications } from './notifications'
export { alertRules } from './alertRules'

// Analytics & Intelligence
export { trendAnalysis } from './trendAnalysis'
export { correlations } from './correlations'
export { relevance } from './relevance'
export { dashboard } from './dashboard'
export { aiSummaries } from './aiSummaries'
export { orgProfile } from './orgProfile'
export { unifiedEvents } from './unifiedEvents'

// Data management
export { alerts } from './alerts'
export { malwareSamples } from './malwareSamples'
export { syncLog } from './syncLog'
export { dataSources } from './dataSources'
export { threatHunts } from './threatHunts'

// Team collaboration
export { teams } from './teams'
export { sharedWatchlists } from './sharedWatchlists'

// Escalation & On-call
export {
  escalationPolicies,
  escalationLevels,
  escalationTargets,
  oncallSchedules,
  alertEscalations,
} from './escalationPolicies'

// Attack surface monitoring
export {
  assets,
  assetMatches,
  assetGroups,
  checkAssetsAgainstIOCs,
  runAssetMonitoring,
  ASSET_TYPES,
  ASSET_CATEGORIES,
  CRITICALITY_LEVELS,
  MATCH_TYPES,
  MATCH_STATUSES,
} from './assets'

// Note: Vendor risk management is in src/lib/vendors.js (not in supabase folder)

// Retry utility for resilient API calls
export { withRetry, fetchWithRetry, createRetryable } from '../retry'
