/**
 * Vendor threat research - the reports, and the questions they raise.
 *
 * WHY THIS DOES NOT PARSE ATTRIBUTION
 *
 * Measured on 21 September across 279 titles from these eight feeds: **zero**
 * carried attribution a parser could read. Six named a nationality, and every
 * one of those named a victim or a language rather than a culprit:
 *
 *   "NightEagle targets Russian companies"         Russia is the target
 *   "Cyber fallout from the Iran war"              geopolitics
 *   "targeted spyware campaign in Pakistan"        Pakistan is the target
 *   "a Chinese-speaking actor turned Brazilian
 *    government sites into an SEO weapon"          a language; Brazil is target
 *
 * A nationality regex over vendor titles would have been wrong six times out
 * of six. So this function extracts nothing about countries. It stores what
 * was published and flags the handful of reports whose wording suggests an
 * attribution exists, for a person to read.
 *
 * THE CASE THAT PROMPTED IT
 *
 * A Dataminr alert read "Suspected Chinese-speaking threat actor steals over
 * 18,000 government records ... via Greynoise". The underlying GreyNoise post
 * says:
 *
 *   "This MCA is a suspected Chinese speaker possibly working in UTC+8 based
 *    on the operational timeline and copious amounts of Chinese language
 *    comments contained within their custom tools and scripts."
 *
 * Neither the post's title nor its RSS summary contains any of that. It is
 * three paragraphs into the body, and it is a claim about a person's language
 * and working hours - not about China. Recording it as CN would be a worse
 * error than the "Pro-Russia Hacktivists -> state" reading this project
 * already caught, because that one at least had Russia in it.
 *
 * WHAT THE TITLES ARE GOOD FOR
 *
 * The actor's name. "Mustang Panda targets India's government and energy
 * sectors" is reliable, and Vigil already knows Mustang Panda is CN. Event
 * from the vendor, country from the actor record. That matching happens in
 * SQL, against named groups only - see migration 139 for the two false
 * positives that taught it.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'

/** Every feed verified on 21 September 2026; item counts are that day's. */
const FEEDS: Array<{ source: string; url: string }> = [
  { source: 'greynoise', url: 'https://www.greynoise.io/blog/rss.xml' },
  { source: 'acronis', url: 'https://www.acronis.com/en-us/tru/feed.xml' },
  { source: 'eset', url: 'https://www.welivesecurity.com/en/rss/feed/' },
  { source: 'unit42', url: 'https://unit42.paloaltonetworks.com/feed/' },
  { source: 'talos', url: 'https://blog.talosintelligence.com/rss/' },
  { source: 'microsoft-security', url: 'https://www.microsoft.com/en-us/security/blog/feed/' },
  { source: 'securelist', url: 'https://securelist.com/feed/' },
  { source: 'checkpoint', url: 'https://research.checkpoint.com/feed/' },
]

/**
 * Wording that suggests the report attributes the activity to someone.
 *
 * This decides only whether to ASK. It never decides a country, a strength or
 * an actor, and there is no path from a match here to a written attribution.
 * So a loose pattern costs a question in the queue; a tight one costs a missed
 * attribution entirely. It is deliberately loose.
 *
 * "-speaking" and "speaker" are in the list precisely because they are NOT
 * attribution - they are the case most likely to be mistaken for it, and the
 * one most worth putting in front of a person.
 */
const ATTRIBUTION_HINTS: RegExp[] = [
  /\b(state[- ]sponsored|state[- ]backed|state[- ]supported|state[- ]affiliated)\b/i,
  /\b(nation[- ]state|government[- ]backed)\b/i,
  /\b\w+-speaking\b/i,
  /\b(chinese|russian|iranian|north korean|dprk)[- ]speak(er|ing)\b/i,
  /\b(apt\d{1,3}|apt[- ]\d{1,3})\b/i,
  /\battributed? to\b/i,
  /\b(linked|tied|traced) to\b/i,
  /\bwe assess (with|that)\b/i,
  /\b(china|russia|iran|north korea|dprk)[- ]nexus\b/i,
  /\bpro[- ](russia|russian|iran|iranian|china|chinese)\b/i,
]

export interface VendorRow {
  url: string
  title: string
  summary: string | null
  published: string | null
  /** The matched wording, or null. Only ever used to raise a question. */
  attribution_phrase: string | null
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return null
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;|&#8217;|&#8216;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The first hint that matches title or summary, quoted exactly, or null. */
export function attributionHint(title: string, summary: string | null): string | null {
  const haystack = `${title} ${summary ?? ''}`
  for (const re of ATTRIBUTION_HINTS) {
    const m = haystack.match(re)
    if (m) return m[0]
  }
  return null
}

export function parseFeed(xml: string): VendorRow[] {
  // Atom feeds use <entry>; RSS uses <item>. Both appear across these eight.
  const blocks = [
    ...(xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []),
  ]

  const out: VendorRow[] = []
  const seen = new Set<string>()

  for (const block of blocks) {
    const title = tag(block, 'title')
    let link = tag(block, 'link')

    // Atom puts the URL in an attribute rather than the element body.
    if (!link || !/^https?:/i.test(link)) {
      const href = block.match(/<link[^>]+href=["']([^"']+)["']/i)
      link = href ? href[1] : null
    }
    if (!title || !link) continue

    const url = link.trim()
    if (seen.has(url)) continue
    seen.add(url)

    const raw = tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated')
    let published: string | null = null
    if (raw) {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) published = d.toISOString().slice(0, 10)
    }

    // A trimmed RSS summary, never the article body: these are the vendors'
    // copyright and Vigil stores metadata, not their writing.
    const summary = (tag(block, 'description') ?? tag(block, 'summary') ?? '').slice(0, 600) || null

    out.push({
      url,
      title,
      summary,
      published,
      attribution_phrase: attributionHint(title, summary),
    })
  }

  return out
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'vendor-research', error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)
  const perSource: Record<string, unknown> = {}
  const failures: string[] = []

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const rows = parseFeed(await res.text())
      if (rows.length === 0) {
        // Not an error: a vendor can have a quiet month. Recorded so a feed
        // that has silently changed shape is visible rather than absent.
        perSource[feed.source] = { parsed: 0, note: 'no items parsed' }
        continue
      }

      const { data, error } = await supabase.rpc('apply_vendor_research', {
        p_rows: rows,
        p_source: feed.source,
      })
      if (error) throw new Error(error.message)

      perSource[feed.source] = { parsed: rows.length, ...(data ?? {}) }
    } catch (e) {
      // One vendor being down must not cost the other seven.
      const message = e instanceof Error ? e.message : String(e)
      perSource[feed.source] = { error: message }
      failures.push(`${feed.source}: ${message}`)
    }
  }

  return json({
    // Every feed failing is a real failure; one or two is a Tuesday.
    success: failures.length < FEEDS.length,
    source: 'vendor-research',
    feeds: perSource,
    failures,
    ms: Date.now() - started,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
