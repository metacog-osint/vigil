/**
 * OFAC sanctioned digital-currency addresses — fetched from Supabase, not Cloudflare.
 *
 * WHY THIS LIVES HERE AND NOT IN THE WORKER
 *
 * The logic below is a port of workers/src/feeds/ofac-sdn.js, and it moved for one
 * reason: the Cloudflare Worker could not reach Treasury. Every run returned HTTP
 * 525 — Cloudflare's own "SSL handshake failed" — across nine attempts. Not
 * Treasury's fault: the same endpoint answered 200 from a desktop, and answers 200
 * from here.
 *
 * Measured from this runtime before anything was built:
 *
 *   HEAD  200 in 586 ms
 *   GET   200, 29,093,584 bytes in 672 ms
 *
 * `ofac-sdn` is the only reason ingestion_is_healthy() returns false, and it is
 * marked critical because a sanctions claim must not be made from stale data.
 *
 * WHAT IS UNCHANGED FROM THE WORKER VERSION
 *
 * The parse, the cursor discipline and the honesty rules are the same:
 *
 *   - SDN.XML is streamed and only <sdnEntry> blocks mentioning a digital currency
 *     address are kept (99 of ~19,000), so the 29 MB document is never held whole.
 *   - Delisting is recorded, not deleted. upsert_sanctioned_addresses (088) dates
 *     any address that has left the list and leaves its history intact.
 *   - The cursor is written only after the upsert succeeds. A cursor written ahead
 *     of the data would tell the next run to skip a list it never ingested.
 *   - A run that checks and finds nothing new is a successful run, not a skipped
 *     one. Having checked is the thing being asserted.
 *
 * WHAT IS FIXED
 *
 * The worker read its cursor with `.select('cursor', 'feed_id=eq.ofac-sdn')`. The
 * second argument to .select() is an options object, not a filter, so that string
 * was ignored and the query read every row and took the first. It happened to work
 * because feed_cursors held exactly one row. It would have compared OFAC's
 * Last-Modified against another feed's the moment a second feed used a cursor.
 *
 * WHO CALLS THIS
 *
 * The Cloudflare Worker's scheduler, as the ofac-sdn job — one subrequest instead
 * of four, and it records the sync_log row itself, so every feed is still logged
 * by one code path.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SDN_XML =
  'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML'
const MARKER = 'Digital Currency Address'
const ENTRY_END = '</sdnEntry>'
const UA = 'Vigil-ThreatIntel/1.0'

interface Row {
  address: string
  currency: string
  entity_name: string
  entity_uid: string | null
  programs: string[]
  aliases: string[]
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: 'ofac-sdn', error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)

  try {
    // Ask what the published list is dated before deciding to fetch it.
    const published = await publishedAt()

    const { data: cursors } = await supabase
      .from('feed_cursors')
      .select('cursor')
      .eq('feed_id', 'ofac-sdn')
      .limit(1)

    const seen = (cursors?.[0]?.cursor ?? {}) as { last_modified?: string; addresses?: number }

    if (published && seen.last_modified === published) {
      return json({
        success: true,
        source: 'ofac-sdn',
        unchanged: true,
        last_modified: published,
        addresses: seen.addresses ?? null,
        ms: Date.now() - started,
      })
    }

    const response = await fetch(SDN_XML, {
      headers: { 'User-Agent': UA, Accept: 'application/xml' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    if (!response.body) {
      throw new Error('SDN.XML returned no body')
    }

    const rows = await parseEntries(response.body)

    const { data, error } = await supabase.rpc('upsert_sanctioned_addresses', { p_rows: rows })
    if (error) throw new Error(`upsert_sanctioned_addresses failed: ${error.message}`)

    if (published) {
      await supabase.from('feed_cursors').upsert(
        {
          feed_id: 'ofac-sdn',
          cursor: { last_modified: published, addresses: data?.addresses ?? rows.length },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'feed_id' }
      )
    }

    return json({
      success: true,
      source: 'ofac-sdn',
      last_modified: published,
      parsed: rows.length,
      ...data,
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: 'ofac-sdn',
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

/**
 * The publication date of the current list, or null if the HEAD gives no answer.
 * Null means "fetch anyway": a missing header is not evidence that nothing changed.
 */
async function publishedAt(): Promise<string | null> {
  try {
    const head = await fetch(SDN_XML, { method: 'HEAD', headers: { 'User-Agent': UA } })
    return head.ok ? head.headers.get('last-modified') : null
  } catch {
    return null
  }
}

/** Reads the document one chunk at a time, holding only the current entry. */
export async function parseEntries(body: ReadableStream<Uint8Array>): Promise<Row[]> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  const rows: Row[] = []
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += value

    let end: number
    while ((end = buffer.indexOf(ENTRY_END)) !== -1) {
      const entry = buffer.slice(0, end)
      buffer = buffer.slice(end + ENTRY_END.length)
      if (entry.includes(MARKER)) rows.push(...toRows(entry))
    }

    if (done) break
  }

  return rows
}

const ID_RE =
  /<idType>Digital Currency Address - ([A-Z0-9]+)<\/idType>\s*<idNumber>([^<]+)<\/idNumber>/g
const LAST_RE = /<lastName>([^<]*)<\/lastName>/
const FIRST_RE = /<firstName>([^<]*)<\/firstName>/
const UID_RE = /<uid>(\d+)<\/uid>/
const PROGRAM_RE = /<program>([^<]+)<\/program>/g
const AKA_LIST_RE = /<akaList>([\s\S]*?)<\/akaList>/
const AKA_NAME_RE = /<lastName>([^<]*)<\/lastName>/g

function toRows(entry: string): Row[] {
  const ids = [...entry.matchAll(ID_RE)]
  if (ids.length === 0) return []

  const last = entry.match(LAST_RE)
  const first = entry.match(FIRST_RE)
  const entityName = [last?.[1], first?.[1]].filter(Boolean).join(', ')
  if (!entityName) return []

  const uid = entry.match(UID_RE)?.[1] ?? null
  const programs = [...entry.matchAll(PROGRAM_RE)].map((m) => m[1])
  const akaBlock = entry.match(AKA_LIST_RE)?.[1] ?? ''
  const aliases = [...akaBlock.matchAll(AKA_NAME_RE)].map((m) => m[1]).filter(Boolean)

  return ids.map(([, currency, address]) => ({
    address: address.trim(),
    currency,
    entity_name: entityName,
    entity_uid: uid,
    programs,
    aliases,
  }))
}
