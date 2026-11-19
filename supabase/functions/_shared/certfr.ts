/**
 * Reading a CERT-FR alert (188). CERT-FR's alerts ("alertes", references
 * CERTFR-YYYY-ALE-NNN, and CERTA-YYYY-ALE-NNN before 2014) are its "act now"
 * notices: most concern a vulnerability being exploited, some an incident or a
 * campaign with no CVE. They are kept as notices, in CERT-FR's own French, and
 * never read as Vigil's claim of exploitation.
 *
 * Free of Deno imports: the certfr-alerts Edge Function loads it at run time,
 * vitest under Node at test time, and the one-time backfill with
 * node --experimental-strip-types.
 *
 * The JSON is CERT-FR's own (openapi.json at cert.cyber.gouv.fr, which
 * www.cert.ssi.gouv.fr redirects to since 2026).
 */

export const CERTFR_ORIGIN = 'https://cert.cyber.gouv.fr'

export interface CertfrListItem {
  reference: string
  last_revision_date: string
  json_url: string
}

export interface CertfrAlertRow {
  reference: string
  title: string
  url: string
  first_published: string | null
  last_revision: string | null
  closed_at: string | null
  cve_ids: string[]
  vendors: string[]
  risks: string[]
  summary: string | null
  raw: unknown
}

const REF = /^CERT(?:FR|A)-\d{4}-ALE-\d{3,}$/
const CVE = /^CVE-\d{4}-\d{4,}$/

const day = (s: unknown) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null

/** The list endpoint's entries that look like alerts, by reference. */
export function readCertfrList(list: unknown): CertfrListItem[] {
  if (!Array.isArray(list)) return []
  return list.filter(
    (x): x is CertfrListItem =>
      x &&
      typeof x.reference === 'string' &&
      REF.test(x.reference) &&
      typeof x.json_url === 'string'
  )
}

/** CERT-FR's summary as plain text: markup removed, whitespace collapsed. */
function plainSummary(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const t = s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\([[\]*_])/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    // Last, so "&amp;#39;" stays "&#39;" rather than becoming "'".
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return t || null
}

// deno-lint-ignore no-explicit-any
export function readCertfrAlert(alert: any): CertfrAlertRow | null {
  if (!alert || typeof alert.reference !== 'string' || !REF.test(alert.reference)) return null
  const revisions: string[] = (alert.revisions ?? [])
    .map((r: { revision_date?: string }) => day(r?.revision_date))
    .filter(Boolean)
    .sort()
  const names = (xs: unknown, pick: (x: any) => unknown) =>
    // deno-lint-ignore no-explicit-any
    [
      ...new Set(
        (Array.isArray(xs) ? xs : [])
          .map(pick)
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .map((v) => v.trim())
      ),
    ]
  return {
    reference: alert.reference,
    title: typeof alert.title === 'string' ? alert.title.trim() : alert.reference,
    url: `${CERTFR_ORIGIN}/alerte/${alert.reference}/`,
    first_published: revisions[0] ?? null,
    last_revision: revisions[revisions.length - 1] ?? null,
    closed_at: day(alert.closed_at),
    cve_ids: names(alert.cves, (c) => c?.name).filter((c) => CVE.test(c)),
    vendors: names(alert.affected_systems, (s) => s?.product?.vendor?.name).filter(
      (v) => v !== 'N/A'
    ),
    risks: names(alert.risks, (r) => r?.description),
    summary: plainSummary(alert.summary),
    raw: alert,
  }
}
