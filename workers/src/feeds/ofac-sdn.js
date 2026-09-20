/**
 * OFAC sanctioned digital-currency addresses
 *
 * Treasury's SDN list designates crypto addresses alongside the entity that controls
 * them. SDN.XML holds each one as a structured <id> element, so it is parsed rather
 * than scraped out of free text - SDN.CSV truncates its remarks at 1,000 characters
 * and loses over half the addresses, and the advanced export is 127 MB.
 *
 * The response is consumed as a stream and only <sdnEntry> blocks that mention a
 * digital currency address are kept (99 of ~19,000), so the worker never holds the
 * whole 29 MB document.
 *
 * Delisting is recorded, not deleted: upsert_sanctioned_addresses (migration 088)
 * dates any address that has left the list and leaves its history intact.
 *
 * Most runs do not download anything. OFAC publishes no delta endpoint and ignores
 * If-Modified-Since - asked for one, got 200 and all 29 MB back - but it does set
 * Last-Modified, and a HEAD returns that without the body. The list changes a few
 * times a month, so comparing the header against feed_cursors (migration 124)
 * turns most runs into a few hundred bytes.
 *
 * A run that checks and finds nothing new is a successful run, not a skipped one.
 * The distinction matters: the scheduler records `skipped` as "this feed did not
 * run", which through feed_health means "not fresh", and ofac-sdn is a feed Vigil
 * makes sanctions claims from. Having checked is the thing being asserted.
 */

const MARKER = 'Digital Currency Address'
const ENTRY_END = '</sdnEntry>'

/**
 * Runs the fetch where it can actually happen.
 *
 * Every attempt from this Worker returned HTTP 525 - Cloudflare's own "SSL
 * handshake failed" - across nine runs. Treasury was never the problem: the same
 * endpoint answers 200 from a desktop, and answers 200 from a Supabase Edge
 * Function in 672 ms for all 29 MB. So the work moved there and this job invokes
 * it: one subrequest instead of four, and none of the Edge Function's database
 * writes are charged to this invocation's budget.
 *
 * The scheduler still records the sync_log row from what comes back, so every
 * feed is logged by one code path. The parser below stays here because it is
 * what the tests exercise; the deployed copy is supabase/functions/ofac-sdn.
 */
export async function ingestOFAC(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'ofac-sdn',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the ofac-sdn function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/ofac-sdn`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ofac-sdn function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    // The function reports its own outcome, including whether it downloaded
    // anything. Passed through unchanged so the log says what actually happened.
    return await response.json()
  } catch (error) {
    console.error('OFAC ingestion error:', error.message)
    return { success: false, source: 'ofac-sdn', error: error.message }
  }
}

// Reads the document one chunk at a time, holding only the current entry.
export async function parseEntries(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  const rows = []
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += value

    let end
    while ((end = buffer.indexOf(ENTRY_END)) !== -1) {
      const entry = buffer.slice(0, end)
      buffer = buffer.slice(end + ENTRY_END.length)
      if (entry.includes(MARKER)) rows.push(...toRows(entry))
    }

    // Only the tail of an unfinished entry needs to be carried forward.
    if (done) break
  }

  return rows
}

const ID_RE = /<idType>Digital Currency Address - ([A-Z0-9]+)<\/idType>\s*<idNumber>([^<]+)<\/idNumber>/g
const LAST_RE = /<lastName>([^<]*)<\/lastName>/
const FIRST_RE = /<firstName>([^<]*)<\/firstName>/
const UID_RE = /<uid>(\d+)<\/uid>/
const PROGRAM_RE = /<program>([^<]+)<\/program>/g
const AKA_LIST_RE = /<akaList>([\s\S]*?)<\/akaList>/
const AKA_NAME_RE = /<lastName>([^<]*)<\/lastName>/g

function toRows(entry) {
  const ids = [...entry.matchAll(ID_RE)]
  if (ids.length === 0) return []

  const last = entry.match(LAST_RE)
  const first = entry.match(FIRST_RE)
  const entityName = [last?.[1], first?.[1]].filter(Boolean).join(', ')
  if (!entityName) return []

  const uid = entry.match(UID_RE)?.[1] || null
  const programs = [...entry.matchAll(PROGRAM_RE)].map((m) => m[1])
  const akaBlock = entry.match(AKA_LIST_RE)?.[1] || ''
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
