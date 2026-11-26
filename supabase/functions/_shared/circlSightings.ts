/**
 * Which CIRCL sightings Vigil may keep (migration 194). An allow-list: a source
 * nobody has judged is counted and left out, so a new aggregator cannot bring
 * VulnCheck's or anyone else's restricted data in unnoticed.
 *
 * No Deno imports, so the tests can load it.
 */

export type SourceClass = 'honeypot' | 'government' | 'vendor_press' | 'social_code'

export interface RawSighting {
  uuid?: string
  type?: string
  vulnerability?: string
  source?: string | null
  creation_timestamp?: string
  vulnerability_lookup_origin?: string | null
}

export interface SightingRow {
  cve_id: string
  source_class: SourceClass
  source_name: string
  source_link: string
  sighted_at: string
}

export type Classified = { row: SightingRow } | { excluded: string }

const CATALOGUE_PATH = '/known-exploited-vulnerabilities-catalog/'

// CIRCL's catalogue ids, from /api/stats/scorecard/catalogues (21 Nov 2026).
const KEPT_CATALOGUES: Record<string, { source_class: SourceClass; source_name: string }> = {
  'c8fb6bf1-f81f-4cb8-95b1-eadbb3b54ee8': {
    source_class: 'honeypot',
    source_name: 'Shadowserver honeypots',
  },
  'cce329bf-df49-4c6e-a027-80be2e6483bd': { source_class: 'government', source_name: 'ENISA' },
}

const LEFT_OUT_CATALOGUES: Record<string, string> = {
  'caeb2787-0d58-4236-9039-7c86c3e566f3': 'previdian',
  '1a89b78e-f703-45f3-bb86-59eb712668bd': 'circl_combined',
  '405284c2-e461-4670-8979-7fd2c9755a60': 'cisa_catalogue',
  'fc16d4f5-594d-5807-9bf1-71af4407c589': 'siberkapan',
}

const VENDOR_PRESS_HOSTS = new Set([
  'aikido.dev',
  'arcticwolf.com',
  'bleepingcomputer.com',
  'blog.talosintelligence.com',
  'cloud.google.com',
  'huntress.com',
  'hunt.io',
  'microsoft.com',
  'rapid7.com',
  'research.checkpoint.com',
  'securelist.com',
  'securityweek.com',
  'thehackernews.com',
  'therecord.media',
  'unit42.paloaltonetworks.com',
])

const SOCIAL_CODE_HOSTS: Record<string, string> = {
  't.me': 'Telegram',
  'telegram.me': 'Telegram',
  'github.com': 'GitHub',
  'gist.github.com': 'GitHub',
}

function parseUrl(source: string): URL | null {
  if (!/^https?:\/\//i.test(source)) return null
  try {
    return new URL(source)
  } catch {
    return null
  }
}

export function classifySighting(s: RawSighting): Classified {
  if (s.type !== 'exploited') return { excluded: 'not_exploited_type' }

  const cve = (s.vulnerability ?? '').trim().toUpperCase()
  if (!/^CVE-\d{4}-\d{4,}$/.test(cve)) return { excluded: 'not_a_cve' }

  const sighted_at = s.creation_timestamp ?? ''
  if (!sighted_at || Number.isNaN(Date.parse(sighted_at))) return { excluded: 'no_date' }

  const source = (s.source ?? '').trim()
  if (!source) return { excluded: 'no_source' }
  if (/vulncheck/i.test(source)) return { excluded: 'vulncheck' }

  const keep = (source_class: SourceClass, source_name: string, source_link = ''): Classified => ({
    row: { cve_id: cve, source_class, source_name, source_link, sighted_at },
  })

  const url = parseUrl(source)

  // A catalogue entry is judged by the catalogue it belongs to, never by its host.
  if (url?.hostname === 'vulnerability.circl.lu' && url.pathname.includes(CATALOGUE_PATH)) {
    const origin = s.vulnerability_lookup_origin ?? ''
    const kept = KEPT_CATALOGUES[origin]
    if (kept) return keep(kept.source_class, kept.source_name)
    return { excluded: LEFT_OUT_CATALOGUES[origin] ?? 'unlisted_catalogue' }
  }

  if (!url) {
    if (/^The Shadowserver \(honeypot\/exploited-vulnerabilities\)/.test(source)) {
      return keep('honeypot', 'Shadowserver honeypots')
    }
    if (/^OffSeq Mirage\b/.test(source)) return keep('honeypot', 'OffSeq Mirage')
    if (/^Telegram\//.test(source)) return keep('social_code', 'Telegram')
    return { excluded: 'unlisted_source' }
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (SOCIAL_CODE_HOSTS[host]) return keep('social_code', SOCIAL_CODE_HOSTS[host])
  if (VENDOR_PRESS_HOSTS.has(host) && url.protocol === 'https:') {
    url.hash = ''
    url.search = ''
    return keep('vendor_press', host, url.toString())
  }
  return { excluded: 'unlisted_source' }
}

/** The next date window: 30 days, ending no later than today. Dates are YYYY-MM-DD, UTC. */
export function windowEnd(day: string, today: string): string {
  const end = new Date(`${day}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 29)
  const iso = end.toISOString().slice(0, 10)
  return iso < today ? iso : today
}
