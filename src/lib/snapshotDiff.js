/**
 * Diff of two frozen snapshots (table `snapshots`, body version 1).
 *
 * A section is null when it was not computed, and 0 only when it was counted.
 * A change against a null side is null: absence is never read as zero.
 */

const BODY_VERSION = 1

const isCounted = (v) => typeof v === 'number' && Number.isFinite(v)

function count(before, after) {
  const b = isCounted(before) ? before : null
  const a = isCounted(after) ? after : null
  return { before: b, after: a, change: b === null || a === null ? null : a - b }
}

/**
 * Per-key counts from two maps. Inside a counted map a missing key was counted
 * and is zero; a missing map is null. Only keys whose count differs, or cannot
 * be compared, are returned, largest change first.
 */
function countMap(before, after) {
  if (!before && !after) return null
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  const read = (map, key) => (map ? (map[key] ?? 0) : null)
  return [...keys]
    .map((key) => ({ key, ...count(read(before, key), read(after, key)) }))
    .filter((row) => row.change !== 0)
    .sort((x, y) => Math.abs(y.change ?? 0) - Math.abs(x.change ?? 0) || x.key.localeCompare(y.key))
}

function setDiff(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) return { added: null, removed: null }
  const b = new Set(before)
  const a = new Set(after)
  return {
    added: [...a].filter((x) => !b.has(x)).sort(),
    removed: [...b].filter((x) => !a.has(x)).sort(),
  }
}

const header = (s) => ({
  name: s.name,
  scope_value: s.scope_value,
  window_start: s.window_start,
  window_end: s.window_end,
  taken_at: s.taken_at,
})

export function diffSnapshots(before, after) {
  if (!before || !after) throw new Error('Two snapshots are needed.')
  if (before.scope_type !== after.scope_type) {
    throw new Error(
      `A ${before.scope_type} snapshot cannot be compared with a ${after.scope_type} snapshot.`
    )
  }
  for (const s of [before, after]) {
    if ((s.body_version ?? BODY_VERSION) !== BODY_VERSION) {
      throw new Error(`Snapshot "${s.name}" has a format this page cannot read.`)
    }
  }
  const b = before.body || {}
  const a = after.body || {}
  return {
    scope_type: before.scope_type,
    same_scope: before.scope_value === after.scope_value,
    before: header(before),
    after: header(after),
    claims_total: count(b.claims?.total, a.claims?.total),
    open_findings: count(b.open_findings, a.open_findings),
    by_actor: countMap(b.claims?.by_actor, a.claims?.by_actor),
    by_sector: countMap(b.claims?.by_sector, a.claims?.by_sector),
    actors: setDiff(b.actors, a.actors),
    kev: setDiff(b.kev, a.kev),
    evidence_tiers: null,
  }
}

/** Every actor id the diff mentions. */
export function diffActorIds(diff) {
  return [
    ...new Set([
      ...(diff.by_actor || []).map((r) => r.key),
      ...(diff.actors.added || []),
      ...(diff.actors.removed || []),
    ]),
  ]
}

/** The diff with actor names in place of ids: what the narration is given. */
export function nameActors(diff, names) {
  const name = (id) => names[id] || 'unnamed actor'
  const list = (ids) => (ids ? ids.map(name) : null)
  return {
    ...diff,
    // A snapshot's scope value is an id for an actor or a watchlist
    before: scoped(diff.scope_type, diff.before),
    after: scoped(diff.scope_type, diff.after),
    by_actor: diff.by_actor && diff.by_actor.map(({ key, ...r }) => ({ actor: name(key), ...r })),
    actors: { added: list(diff.actors.added), removed: list(diff.actors.removed) },
  }
}

function scoped(scopeType, { scope_value, ...rest }) {
  return scopeType === 'sector' ? { ...rest, scope_value } : rest
}
