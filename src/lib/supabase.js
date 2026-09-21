/**
 * Supabase query functions — re-exports only.
 *
 * This file used to define the query objects a second time, alongside
 * ./supabase/*.js. Most of the app imports from here, so whenever the two
 * copies drifted the working code sat in the module and the page held the
 * other one. On 20 September that single fact produced five user-visible
 * defects:
 *
 *   threatActors    the actor page could not resolve a name from the url
 *   trendAnalysis   a dashboard fix changed the labels and not one number
 *   syncLog         the Operations page reported no sync data beside 15,068 rows
 *   watchlists      the copy here had no ownership check; the module does
 *   iocs            the copy here ignored the country argument the IOC search
 *                   page passes it, so that filter did nothing at all
 *
 * A missing or stale method is not an error anyone sees. It is undefined or
 * quietly wrong, a try/catch swallows what it throws, and the page renders an
 * empty state that reads exactly like "there is nothing here".
 *
 * So nothing is defined here any more. **Do not add a definition to this
 * file.** Put it in ./supabase/<name>.js and re-export it below.
 * src/lib/__tests__/queryLayerSurface.test.js fails if the two ever drift.
 *
 * IMPORTANT: This file imports the Supabase client from ./supabase/client.js
 * DO NOT create a new client here - that causes "Multiple GoTrueClient instances" warnings.
 * All Supabase client creation should happen in ONE place: src/lib/supabase/client.js
 */

import { supabase, subscribeToTable } from './supabase/client'

// Re-export the centralized client and subscription helper
export { supabase, subscribeToTable }

// Modules that live only in ./supabase/, re-exported so both import paths work
export { profiles } from './supabase/profiles'

// One implementation of the dashboard counts, not two: the copy that used to
// live here drifted from ./supabase/dashboard and kept its own `|| 0` bug.
export { dashboard } from './supabase/dashboard'

// Likewise one implementation of the team watchlists, not two. The copy that
// lived here queried shared_watchlists, a table that has never existed.
export { sharedWatchlists } from './supabase/sharedWatchlists'
export { landing } from './supabase/landing'

// One implementation of the actor queries, not two: the copy that used to
// live here was identical but for dropped comments, and only the module copy
// knows how to resolve a name or an alias out of a URL.
export { threatActors } from './supabase/threatActors'

export { incidents } from './supabase/incidents'

export { iocs } from './supabase/iocs'
export { countries } from './supabase/countries'
export { sourceLicences } from './supabase/sourceLicences'
export {
  attributedActivity,
  ATTRIBUTION_STRENGTHS,
  ATTRIBUTION_STRENGTH_LABELS,
  ATTRIBUTION_STRENGTH_COLORS,
  ATTRIBUTION_SOURCE_LABELS,
  strengthRank,
} from './supabase/attributedActivity'

// Helper to detect IOC type

export { vulnerabilities } from './supabase/vulnerabilities'

export { techniques } from './supabase/techniques'

export { watchlists } from './supabase/watchlists'

// One implementation of the saved-search queries, not two. The copy that
// used to live here was missing the five alert methods; nothing calls them
// yet, which is precisely why it would have been found the hard way.
export { savedSearches } from './supabase/savedSearches'

export { userPreferences } from './supabase/userPreferences'

export { tags } from './supabase/tags'

export { alerts } from './supabase/alerts'

export { malwareSamples } from './supabase/malwareSamples'

// One implementation of the sync queries, not two. The copy that used to
// live here had getRecent and getBySource and nothing else, while the
// Operations page called getStatusSummary, getDataFreshness, getErrorRates
// and getSourceHistory against it. All four were undefined, the page caught
// the TypeError, and it reported no sync data beside a table of 15,068 rows.
export { syncLog } from './supabase/syncLog'

export { aiSummaries } from './supabase/aiSummaries'

export { orgProfile } from './supabase/orgProfile'

export { relevance } from './supabase/relevance'

// Correlations - linking actors, vulnerabilities, TTPs, and IOCs
// Correlations live in ./supabase/correlations.js. A stale copy used to be
// defined here, and because most pages import from '../lib/supabase' they got
// that copy: 5 of the 35 functions, with the rest failing as "not a function".
// Re-exported rather than redefined so there is one implementation.
export { correlations } from './supabase/correlations'

// One implementation of the trend windows, not two. The copy that used to
// live here was identical but for dropped comments, and it was the one the
// pages actually imported - so fixing the module copy alone changed nothing
// on screen.
export { trendAnalysis } from './supabase/trendAnalysis'

export { dataSources } from './supabase/dataSources'

export { unifiedEvents } from './supabase/unifiedEvents'

export { notifications } from './supabase/notifications'

export { alertRules } from './supabase/alertRules'

export { threatHunts } from './supabase/threatHunts'

// ============================================
// TEAMS & COLLABORATION
export { teams } from './supabase/teams'

export default supabase
