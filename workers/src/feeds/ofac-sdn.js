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
 */

const SDN_XML = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML'
const MARKER = 'Digital Currency Address'
const ENTRY_END = '</sdnEntry>'

export async function ingestOFAC(supabase) {
  console.log('Starting OFAC SDN ingestion...')

  try {
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
    return { success: true, source: 'ofac-sdn', ...data }
  } catch (error) {
    console.error('OFAC ingestion error:', error.message)
    return { success: false, source: 'ofac-sdn', error: error.message }
  }
}

// Reads the document one chunk at a time, holding only the current entry.
async function parseEntries(body) {
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
