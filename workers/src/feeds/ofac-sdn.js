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

const SDN_XML = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML'
const MARKER = 'Digital Currency Address'
const ENTRY_END = '</sdnEntry>'

export async function ingestOFAC(supabase) {
  console.log('Starting OFAC SDN ingestion...')

  try {
    // Ask what the published list is dated before deciding to fetch it.
    const published = await publishedAt()

    const { data: cursors } = await supabase
      .from('feed_cursors')
      .select('cursor', 'feed_id=eq.ofac-sdn')
    const seen = cursors?.[0]?.cursor || {}

    if (published && seen.last_modified === published) {
      console.log(`OFAC unchanged since ${published}, not downloading`)
      return {
        success: true,
        source: 'ofac-sdn',
        unchanged: true,
        last_modified: published,
        addresses: seen.addresses ?? null,
      }
    }

    const response = await fetch(SDN_XML, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0', Accept: 'application/xml' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const rows = await parseEntries(response.body)
    console.log(`Parsed ${rows.length} sanctioned addresses`)

    const { data, error } = await supabase.rpc('upsert_sanctioned_addresses', { p_rows: rows })
    if (error) throw new Error(`upsert_sanctioned_addresses failed: ${error.message}`)

    console.log(
      `OFAC complete: ${data.addresses} addresses (${data.new} new, ${data.delisted} delisted, ` +
        `${data.relisted} relisted), ${data.actors_linked} actor links`
    )
    // Recorded only after the upsert succeeded. A cursor written ahead of the data
    // would tell the next run to skip a list it never actually ingested.
    if (published) {
      await supabase.from('feed_cursors').upsert(
        {
          feed_id: 'ofac-sdn',
          cursor: { last_modified: published, addresses: data.addresses ?? rows.length },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'feed_id' }
      )
    }

    return { success: true, source: 'ofac-sdn', last_modified: published, ...data }
  } catch (error) {
    console.error('OFAC ingestion error:', error.message)
    return { success: false, source: 'ofac-sdn', error: error.message }
  }
}

/**
 * The publication date of the current list, or null if the HEAD gives no answer.
 * Null means "fetch anyway": a missing header is not evidence that nothing changed.
 */
async function publishedAt() {
  try {
    const head = await fetch(SDN_XML, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' },
    })
    return head.ok ? head.headers.get('last-modified') : null
  } catch (error) {
    console.log(`OFAC HEAD failed (${error.message}), fetching in full`)
    return null
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
