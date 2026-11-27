/* global __VIGIL_BUILD__ */

/**
 * What this build of the site says about itself (scripts/lib/buildInfo.mjs,
 * passed in by vite.config.js): the site's version, the commit it was built
 * from, and a summary of the feed registry beside it.
 *
 * The registry is the list of jobs the ingestion worker knows how to run
 * (workers/src/feeds/registry.js). The worker is deployed on its own, so the
 * registry in this build may be newer than the one running now.
 */
const EMPTY = { version: null, commit: null, registry: null }

export const BUILD_INFO = typeof __VIGIL_BUILD__ !== 'undefined' ? __VIGIL_BUILD__ : EMPTY

/** "Vigil 2.6.0", or null when the build carries no version. */
export function siteVersionLabel(info = BUILD_INFO) {
  return info?.version ? `Vigil ${info.version}` : null
}

/** "feed registry 3f9a01bc (43 jobs)", or null when the registry was not loaded. */
export function registryVersionLabel(info = BUILD_INFO) {
  const reg = info?.registry
  if (!reg?.fingerprint) return null
  return `feed registry ${reg.fingerprint} (${reg.jobCount} jobs)`
}

/** "every hour", "every 6 hours", "daily", "weekly" or "every N minutes". */
export function describeInterval(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'no set interval'
  const WEEK = 7 * 24 * 60
  const DAY = 24 * 60
  if (minutes % WEEK === 0) return minutes === WEEK ? 'weekly' : `every ${minutes / WEEK} weeks`
  if (minutes % DAY === 0) return minutes === DAY ? 'daily' : `every ${minutes / DAY} days`
  if (minutes % 60 === 0) return minutes === 60 ? 'every hour' : `every ${minutes / 60} hours`
  return `every ${minutes} minutes`
}
