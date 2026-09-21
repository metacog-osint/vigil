/**
 * CISA joint advisories - activity a government attributed.
 *
 * WHY THIS EXISTS
 *
 * All 39,534 incidents Vigil holds come from three ransomware leak-site
 * trackers, so it can only record an attack the attacker chose to publish for
 * extortion. The consequence is visible on the map: Vigil holds 60 actors
 * attributed to Iran - APT33, APT35, APT39, APT42, Charming Kitten - and
 * fifty-nine have zero incidents. The only one with any is Moses Staff, with
 * 16, because Moses Staff posts to leak sites. Every Iranian group that
 * behaves like a state actor was invisible, however much credible reporting
 * existed about it.
 *
 * CISA, FBI, NSA and their partners publish joint advisories naming
 * state-affiliated activity against named sectors. AA26-097A, 6 April 2026,
 * updated 22 July: "Iranian-Affiliated Cyber Actors Exploit Programmable Logic
 * Controllers Across US Critical Infrastructure". Public domain, free, and it
 * was nowhere in this database.
 *
 * ATTRIBUTION IS READ FROM THE TITLE ONLY
 *
 * CISA states attribution in the title, precisely and deliberately. Summaries
 * mention other things in passing, and reading them produced exactly the
 * conflation this project exists to avoid. On the first run, with the body
 * text included:
 *
 *   "Pro-Russia Hacktivists Conduct Opportunistic Attacks"  ->  RU, state
 *   "Defending Against China-Nexus Covert Networks"         ->  CN, state
 *
 * Both wrong. A pro-Russia hacktivist collective and a Russian state-sponsored
 * actor are different people, and CISA is careful to say which it means. The
 * title is where that care lives, so the title is what is read.
 *
 * Verified against all ten advisories the live feeds return:
 *
 *   Iranian-Affiliated Cyber Actors ...        IR  affiliated
 *   Russian State-Supported Cyber Actors ...   RU  state
 *   Russian State-Sponsored Targeting          RU  state
 *   China-Nexus Covert Networks                CN  nexus
 *   Pro-Russia Hacktivists ...                 RU  aligned     <- not state
 *   #StopRansomware: Gunra                     --  criminal    <- no country
 *   the remaining four                             no attribution
 *
 * A title matching nothing is stored with no attribution rather than guessed
 * at. The summary is kept so a person can read what the advisory actually
 * says, and attribution_phrase keeps CISA's exact words next to the country
 * code, because the code alone loses the distinction.
 *
 * Full reasoning: supabase/migrations/131_attributed_activity.sql
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const FEEDS = [
  'https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml',
  'https://www.cisa.gov/cybersecurity-advisories/analysis-reports.xml',
]
const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'

type Strength = 'state' | 'affiliated' | 'nexus' | 'aligned' | 'criminal'

/**
 * CISA's own phrasings. Order matters: the explicit state formulations are
 * tested first, then the deliberately weaker ones, so "Pro-Russia" is never
 * read as "Russian state-sponsored".
 */
const ATTRIBUTION: Array<{ re: RegExp; country: string | null; strength: Strength }> = [
  { re: /\b(russian|russia)[- ]state[- ](sponsored|supported|affiliated)\b/i, country: 'RU', strength: 'state' },
  { re: /\b(chinese|china)[- ]state[- ](sponsored|supported|affiliated)\b/i, country: 'CN', strength: 'state' },
  { re: /\b(iranian|iran)[- ]state[- ](sponsored|supported|affiliated)\b/i, country: 'IR', strength: 'state' },
  { re: /\b(north korean|dprk)[- ]state[- ](sponsored|supported|affiliated)\b/i, country: 'KP', strength: 'state' },

  // Explicitly not the state. Tested before the affiliation patterns.
  { re: /\bpro[- ]russia[n]?\b/i, country: 'RU', strength: 'aligned' },
  { re: /\bpro[- ]iran(ian)?\b/i, country: 'IR', strength: 'aligned' },
  { re: /\bpro[- ](china|chinese)\b/i, country: 'CN', strength: 'aligned' },

  { re: /\biranian[- ]affiliated\b/i, country: 'IR', strength: 'affiliated' },
  { re: /\brussian[- ]affiliated\b/i, country: 'RU', strength: 'affiliated' },
  { re: /\bchinese[- ]affiliated\b/i, country: 'CN', strength: 'affiliated' },
  { re: /\b(north korean|dprk)[- ]affiliated\b/i, country: 'KP', strength: 'affiliated' },

  { re: /\bchina[- ]nexus\b/i, country: 'CN', strength: 'nexus' },
  { re: /\brussia[- ]nexus\b/i, country: 'RU', strength: 'nexus' },
  { re: /\biran[- ]nexus\b/i, country: 'IR', strength: 'nexus' },

  { re: /\biranian cyber actors\b/i, country: 'IR', strength: 'affiliated' },
  { re: /\brussian cyber actors\b/i, country: 'RU', strength: 'affiliated' },
  { re: /\bchinese cyber actors\b/i, country: 'CN', strength: 'affiliated' },
  { re: /\b(north korean|dprk) cyber actors\b/i, country: 'KP', strength: 'affiliated' },

  // Criminal, and CISA names no state. Country stays null on purpose.
  { re: /#StopRansomware/i, country: null, strength: 'criminal' },
]

const SECTORS: Array<{ re: RegExp; sector: string }> = [
  { re: /water and wastewater|water systems/i, sector: 'water' },
  { re: /\benergy\b|electric|power grid/i, sector: 'energy' },
  { re: /government (services and )?facilit/i, sector: 'government' },
  { re: /healthcare|public health/i, sector: 'healthcare' },
  { re: /financial services|banking/i, sector: 'financial' },
  { re: /communications sector/i, sector: 'communications' },
  { re: /transportation systems/i, sector: 'transportation' },
  { re: /critical manufacturing/i, sector: 'manufacturing' },
  { re: /defense industrial base/i, sector: 'defense' },
]

export function attribute(title: string) {
  for (const a of ATTRIBUTION) {
    const m = title.match(a.re)
    if (m) return { country: a.country, phrase: m[0], strength: a.strength }
  }
  return { country: null, phrase: null, strength: null }
}

export function sectorsIn(title: string): string[] {
  return SECTORS.filter((s) => s.re.test(title)).map((s) => s.sector)
}

export function targetCountries(title: string): string[] {
  const out: string[] = []
  if (/\b(u\.?s\.?|united states)\b/i.test(title)) out.push('US')
  if (/\bukrain/i.test(title)) out.push('UA')
  if (/\bunited kingdom\b/i.test(title)) out.push('GB')
  return out
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return null
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseFeed(xml: string) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  const out = []

  for (const item of items) {
    const title = tag(item, 'title')
    const link = tag(item, 'link')
    const pub = tag(item, 'pubDate')
    if (!title || !link || !pub) continue

    // The advisory id is the last path segment: .../aa26-097a
    const idMatch = link.match(/\/(a{1,2}\d{2}-\d{3}[a-z]?)\b/i)
    if (!idMatch) continue

    const published = new Date(pub)
    if (Number.isNaN(published.getTime())) continue

    const { country, phrase, strength } = attribute(title)

    out.push({
      advisory_id: idMatch[1].toUpperCase(),
      title,
      summary: (tag(item, 'description') ?? '').slice(0, 2000) || null,
      published: published.toISOString().slice(0, 10),
      url: link,
      attributed_country: country,
      attribution_phrase: phrase,
      attribution_strength: strength,
      target_countries: targetCountries(title),
      target_sectors: sectorsIn(title),
    })
  }

  return out
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'cisa', error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)

  try {
    const rows = []
    for (const feed of FEEDS) {
      const res = await fetch(feed, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`${feed} returned HTTP ${res.status}`)
      rows.push(...parseFeed(await res.text()))
    }

    if (rows.length === 0) {
      // These feeds never legitimately return nothing. An empty result means
      // the endpoint or the format has changed.
      throw new Error('no advisories parsed, which these feeds never legitimately return')
    }

    const { data, error } = await supabase.rpc('apply_attributed_activity', { p_rows: rows })
    if (error) throw new Error(`apply_attributed_activity failed: ${error.message}`)

    return json({
      success: true,
      source: 'cisa',
      parsed: rows.length,
      ...(data ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: 'cisa',
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
