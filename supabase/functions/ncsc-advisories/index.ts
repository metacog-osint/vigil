/**
 * NCSC-UK news items - a second government, attributing independently.
 *
 * WHY A SECOND SOURCE AT ALL
 *
 * CISA gave Vigil government attribution. One government is still one
 * government: if only CISA is read, "attributed to Russia" means "the United
 * States said so", and the map cannot distinguish a claim two allied states
 * made independently from one the US made twice. NCSC-UK publishes its own
 * attributions, and in the current feed four of its six news items carry one:
 *
 *   UK and partners expose Russian state-supported actors for new
 *     'zero-click' phishing campaign targeting Western organisations
 *   UK and Allies urge critical sectors to improve defences against
 *     Russian intelligence targeting
 *   UK and allies expose spyware used by Iranian state actors to target
 *     dissidents, activists and journalists
 *   Iranian cyber targeting of dissidents, activists and journalists
 *
 * WHY THIS IS NOT THE CISA PARSER WITH A NEW URL
 *
 * The 21 September coverage note said NCSC published "the same RSS shape as
 * CISA, so cisa-advisories generalises rather than being rewritten". It does
 * not, in three ways that all matter:
 *
 *   1. There is no advisory identifier. CISA links end in /aa26-097a and the
 *      parser keys on it. NCSC links end in a slug. The slug is stable and
 *      unique, so it is the key here, prefixed so the two namespaces cannot
 *      collide.
 *
 *   2. The feed is not an advisory feed. It is everything NCSC publishes:
 *      13 blog posts, 6 news items, 1 guidance page in the sample checked.
 *      "Cyber Adversary Simulation (CyAS): scheme documents now available" is
 *      not an attributed event, and a parser that took every item would fill
 *      the table with scheme announcements. Only /news/ is read.
 *
 *   3. The vocabulary differs. NCSC does not write "Iranian-Affiliated". It
 *      writes "Iranian state actors" and "Russian intelligence targeting".
 *      CISA's phrase table matches none of those.
 *
 * WHAT IS NOT GUESSED
 *
 * "Iranian cyber targeting of dissidents, activists and journalists" names a
 * country and says nothing about the actors' relationship to it. It is not
 * state, not affiliated, not aligned, and there is no honest value to store.
 * The row is written with no attribution and the question is queued in
 * data_quality_findings for a person to answer.
 *
 * That is the same discipline the CISA parser learned the hard way: its first
 * version read summaries as well as titles and turned "Pro-Russia Hacktivists"
 * into a Russian state attribution, which is false. The title is where a
 * government puts its care; everything else is queued.
 *
 * Full reasoning: supabase/migrations/132_attributed_activity_sources.sql
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { attributeNcsc } from '../_shared/attribution.ts'

const FEED = 'https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml'
const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'
const SOURCE = 'ncsc-uk'

const SECTORS: Array<{ re: RegExp; sector: string }> = [
  { re: /water and wastewater|water systems/i, sector: 'water' },
  { re: /\benergy\b|electric|power grid/i, sector: 'energy' },
  { re: /healthcare|public health|\bnhs\b/i, sector: 'healthcare' },
  { re: /financial services|banking/i, sector: 'financial' },
  { re: /telecom|communications sector/i, sector: 'communications' },
  { re: /transport/i, sector: 'transportation' },
  { re: /manufacturing/i, sector: 'manufacturing' },
  { re: /\bdefence\b|\bdefense\b|military/i, sector: 'defense' },
  { re: /critical (national )?infrastructure|critical sectors/i, sector: 'critical-infrastructure' },
  { re: /academi|universit|research/i, sector: 'academic' },
  { re: /journalis|dissident|activist|civil society/i, sector: 'civil-society' },
]

export function sectorsIn(title: string): string[] {
  return SECTORS.filter((s) => s.re.test(title)).map((s) => s.sector)
}

/**
 * Who was targeted, and deliberately conservative.
 *
 * Almost every NCSC title opens "UK and allies expose ...", where the UK is
 * the publisher and not the victim. Reading a country name out of that would
 * record the announcing government as the target of the attack it announced,
 * so only an explicit "targeting X" construction counts.
 */
export function targetCountries(title: string): string[] {
  const out: string[] = []
  const targeting = title.match(/\btargeting\s+([^,.]{0,60})/i)
  if (!targeting) return out

  const scope = targeting[1]
  if (/\b(uk|united kingdom|british)\b/i.test(scope)) out.push('GB')
  if (/\b(us|u\.s\.|united states|american)\b/i.test(scope)) out.push('US')
  if (/\bukrain/i.test(scope)) out.push('UA')
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
    .replace(/&#8216;|&#8217;|‘|’/g, "'")
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

    // Blogs and guidance pages are not attributed events. /news/ is where NCSC
    // publishes the attributions and the joint statements.
    const slug = link.match(/ncsc\.gov\.uk\/news\/([a-z0-9-]+)\/?$/i)
    if (!slug) continue

    const published = new Date(pub)
    if (Number.isNaN(published.getTime())) continue

    const { country, phrase, strength, unresolved } = attributeNcsc(title)

    out.push({
      // Prefixed so an NCSC slug can never collide with a CISA AA-number.
      advisory_id: `NCSC-${slug[1].toUpperCase()}`,
      title,
      summary: (tag(item, 'description') ?? '').slice(0, 2000) || null,
      published: published.toISOString().slice(0, 10),
      url: link,
      attributed_country: country,
      attribution_phrase: phrase,
      attribution_strength: strength,
      target_countries: targetCountries(title),
      target_sectors: sectorsIn(title),
      unresolved_country: unresolved,
    })
  }

  return out
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: SOURCE, error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)

  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${FEED} returned HTTP ${res.status}`)
    const rows = parseFeed(await res.text())

    // Unlike CISA's, this feed legitimately can hold no news items at all: it
    // is a rolling window of everything NCSC publishes and a quiet fortnight
    // of blog posts would empty it. Nothing to record is not a failure, and
    // saying so is not the same as saying the fetch broke.
    if (rows.length === 0) {
      return json({
        success: true,
        source: SOURCE,
        parsed: 0,
        note: 'no /news/ items in the current window',
        ms: Date.now() - started,
      })
    }

    const { data, error } = await supabase.rpc('apply_attributed_activity', {
      p_rows: rows,
      p_source: SOURCE,
    })
    if (error) throw new Error(`apply_attributed_activity failed: ${error.message}`)

    return json({
      success: true,
      source: SOURCE,
      parsed: rows.length,
      ...(data ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: SOURCE,
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
