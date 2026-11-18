/**
 * Reading CISA's SSVC decision points out of a Vulnrichment CVE record (176).
 *
 * Free of Deno imports: the cisa-vulnrichment Edge Function loads it at run
 * time, vitest under Node at test time, and the one-time backfill script with
 * node --experimental-strip-types.
 *
 * The record is CVE JSON 5. CISA's container is the ADP entry whose
 * providerMetadata.shortName is "CISA-ADP" (title "CISA ADP Vulnrichment").
 * Its metrics hold { other: { type: "ssvc", content } }, where content.options
 * is a list of one-key objects:
 *
 *   [{ "Exploitation": "active" }, { "Automatable": "yes" }, { "Technical Impact": "total" }]
 *
 * and, when the CVE is in KEV, { other: { type: "kev", content: { dateAdded } } }.
 * Values are read exactly; anything outside the known values is dropped, not
 * guessed (the table's checks would refuse it anyway).
 */

export type Exploitation = 'none' | 'poc' | 'active'

export interface SsvcRow {
  cve_id: string
  exploitation: Exploitation
  automatable: 'yes' | 'no' | null
  technical_impact: 'partial' | 'total' | null
  ssvc_version: string | null
  assessed_at: string | null
  adp_updated_at: string | null
  kev_date_added: string | null
}

const EXPLOITATION = new Set(['none', 'poc', 'active'])
const AUTOMATABLE = new Set(['yes', 'no'])
const IMPACT = new Set(['partial', 'total'])
const CVE_ID = /^CVE-\d{4}-\d{4,}$/
const CVE_PATH = /(?:^|\/)(CVE-\d{4}-\d{4,})\.json$/

/** The CVE id a repository path names, or null for anything that is not a record. */
export function cveFromPath(path: string): string | null {
  const m = CVE_PATH.exec(path ?? '')
  return m ? m[1] : null
}

function option(options: unknown, name: string): string | null {
  if (!Array.isArray(options)) return null
  for (const o of options) {
    if (o && typeof o === 'object' && name in o) {
      const v = (o as Record<string, unknown>)[name]
      return typeof v === 'string' ? v.toLowerCase() : null
    }
  }
  return null
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/**
 * CISA's SSVC row for one record, or null when the record has no CISA-ADP
 * container with a readable Exploitation value.
 */
// deno-lint-ignore no-explicit-any
export function readSsvc(record: any): SsvcRow | null {
  const cveId = record?.cveMetadata?.cveId
  if (typeof cveId !== 'string' || !CVE_ID.test(cveId)) return null

  const adp = Array.isArray(record?.containers?.adp) ? record.containers.adp : []
  // deno-lint-ignore no-explicit-any
  const cisa = adp.find((a: any) => a?.providerMetadata?.shortName === 'CISA-ADP')
  if (!cisa) return null

  const metrics = Array.isArray(cisa.metrics) ? cisa.metrics : []
  // deno-lint-ignore no-explicit-any
  const ssvc = metrics.find((m: any) => m?.other?.type === 'ssvc')?.other?.content
  // deno-lint-ignore no-explicit-any
  const kev = metrics.find((m: any) => m?.other?.type === 'kev')?.other?.content

  const exploitation = option(ssvc?.options, 'Exploitation')
  if (!exploitation || !EXPLOITATION.has(exploitation)) return null
  const automatable = option(ssvc?.options, 'Automatable')
  const impact = option(ssvc?.options, 'Technical Impact')
  const kevDate =
    typeof kev?.dateAdded === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(kev.dateAdded)
      ? kev.dateAdded
      : null

  return {
    cve_id: cveId,
    exploitation: exploitation as Exploitation,
    automatable: automatable && AUTOMATABLE.has(automatable) ? (automatable as 'yes' | 'no') : null,
    technical_impact: impact && IMPACT.has(impact) ? (impact as 'partial' | 'total') : null,
    ssvc_version: typeof ssvc?.version === 'string' ? ssvc.version : null,
    assessed_at: isoOrNull(ssvc?.timestamp),
    adp_updated_at: isoOrNull(cisa.providerMetadata?.dateUpdated),
    kev_date_added: kevDate,
  }
}

/** Worth a new row: CISA judged a proof of concept public, or exploitation active. */
export function worthStoring(row: SsvcRow): boolean {
  return row.exploitation === 'active' || row.exploitation === 'poc'
}
