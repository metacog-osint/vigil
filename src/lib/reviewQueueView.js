/**
 * How the review page orders and groups findings. Pure functions, no I/O.
 *
 * None of this decides anything. It puts the evidence a reviewer needs first
 * in front of them: how far apart a claim and a filing are, which filings
 * belong to one company, which kinds of question are waiting.
 */

const DAY = 86_400_000

function toDay(value) {
  if (!value) return null
  const t = Date.parse(String(value).slice(0, 10))
  return Number.isNaN(t) ? null : t
}

/**
 * Days between the claim and the regulator's record, or null if a date is
 * missing. SEC candidates carry `filed` and `claim_discovered`; breach-notice
 * candidates (166) carry `nearest_days_apart` already.
 */
export function daysApart(finding) {
  const d = finding?.details || {}
  if (typeof d.nearest_days_apart === 'number') return d.nearest_days_apart
  const a = toDay(d.filed)
  const b = toDay(d.claim_discovered)
  if (a === null || b === null) return null
  return Math.round(Math.abs(a - b) / DAY)
}

/** The company an SEC candidate's subject names ("X filed 8-K Item 1.05 on D"). */
export function secCompany(finding) {
  const m = /^(.*) filed 8-K Item 1\.05 on /.exec(finding?.subject || '')
  return m ? m[1] : null
}

/** [{ kind, count }] for the kinds present, most numerous first. */
export function kindCounts(findings) {
  const counts = new Map()
  for (const f of findings || []) counts.set(f.check_name, (counts.get(f.check_name) || 0) + 1)
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}

/**
 * Findings of one kind, in the order that helps read them.
 *
 * SEC candidates: by company, then filing date, so an 8-K sits next to its
 * 8-K/A. Breach-notice candidates: nearest dates first. Anything else keeps
 * the order it came in.
 */
export function orderForKind(findings, kind) {
  const list = (findings || []).filter((f) => !kind || f.check_name === kind)
  if (kind === 'sec_disclosure_candidate') {
    return [...list].sort(
      (a, b) =>
        (secCompany(a) || '').localeCompare(secCompany(b) || '') ||
        String(a.details?.filed || '').localeCompare(String(b.details?.filed || ''))
    )
  }
  if (kind === 'breach_notice_candidate') {
    return [...list].sort((a, b) => (daysApart(a) ?? Infinity) - (daysApart(b) ?? Infinity))
  }
  return list
}

/** How many other SEC candidates in the list name the same company. */
export function sameCompanyCount(finding, findings) {
  const company = secCompany(finding)
  if (!company) return 0
  return (findings || []).filter((f) => f.id !== finding.id && secCompany(f) === company).length
}
