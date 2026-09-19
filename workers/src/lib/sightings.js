/**
 * Mark indicators as listed by their source on this run.
 *
 * Setting last_seen_at on every upsert lets the ioc_sightings trigger (migration 082)
 * record "source listed this indicator on this day", which builds pattern-of-life
 * over time. Without it, re-listed indicators never moved any date, so nothing after
 * the first sighting was recorded. The feed's own first_seen/last_seen are kept as-is.
 *
 * Only for feeds that list current or recent indicators; not for historical datasets
 * (e.g. Ransomwhere payments), where re-importing does not mean the indicator is active.
 */
export function stampListed(records, at = new Date().toISOString()) {
  return records.map((r) => ({ ...r, last_seen_at: at }))
}
