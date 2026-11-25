/**
 * GET /api/feed?format=stix — what Vigil may redistribute, as a STIX 2.1 bundle.
 *
 * Served by api/feed.js rather than a new file, because api/ already holds 12 functions.
 * buildStixBundle is a pure function of database rows, so it is tested without a network.
 *
 * Rules this file keeps:
 * - Every object carries its source's licence from source_licences, as a statement marking and
 *   an external reference. A source that is unregistered or not cleared there is left out.
 * - Claims and group names come only from the *_commercial views. raw_data and leak-site
 *   addresses are never read.
 * - The source's own voice. A leak-site claim is a note saying who claimed what, never a
 *   relationship, because a STIX `targets` would state the claim as fact. A CISA ADP rating is
 *   a note by CISA. Only a vulnerability in CISA's catalog carries a KEV reference.
 */

export const STIX_DAYS = [7, 30, 90]
export const STIX_DEFAULT_DAYS = 7
export const STIX_CAPS = { kev: 200, adp: 200, claims: 1000 }

const SITE = 'https://vigil.theintelligence.company'
const KEV_URL = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
const SPEC = '2.1'
// Fixed so the identity and marking objects stay byte-identical between builds.
const EPOCH = '2026-11-20T00:00:00.000Z'
// Vigil's own UUIDv5 namespace: the same input always yields the same STIX id.
const NAMESPACE = '6f3b1c52-8a44-5d0e-9b57-2c1e7a90d431'

export const TLP_WHITE = {
  type: 'marking-definition',
  spec_version: SPEC,
  id: 'marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9',
  created: '2017-01-20T00:00:00.000Z',
  definition_type: 'tlp',
  name: 'TLP:WHITE',
  definition: { tlp: 'white' },
}

const normalise = (id) =>
  String(id || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function uuid5(name) {
  const ns = Uint8Array.from(NAMESPACE.replace(/-/g, '').match(/../g), (h) => parseInt(h, 16))
  const text = new TextEncoder().encode(name)
  const input = new Uint8Array(ns.length + text.length)
  input.set(ns)
  input.set(text, ns.length)
  const b = new Uint8Array(await crypto.subtle.digest('SHA-1', input)).slice(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = hex(b)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const stixId = async (type, key) => `${type}--${await uuid5(`${type}:${key}`)}`

/** A date or timestamp as STIX's millisecond UTC form; null if it does not parse. */
export function stixTime(value) {
  if (!value) return null
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const day = (iso) => iso.slice(0, 10)

/** The days parameter: absent means the default, anything not offered is null. */
export function parseDays(raw) {
  if (raw === null || raw === undefined) return STIX_DEFAULT_DAYS
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return STIX_DAYS.includes(n) ? n : null
}

/**
 * @param {object} rows
 * @param {Array} rows.licences  source_licences rows
 * @param {Array} rows.kev       vulnerabilities rows in CISA's catalog, from the window
 * @param {Array} rows.adp       cisa_ssvc rows rated exploitation active, from the window
 * @param {Array} rows.adpVulns  vulnerabilities rows for the ADP CVEs
 * @param {Array} rows.claims    incidents_commercial rows from the window
 * @param {Array} rows.actors    { actor_id, name, listed_by, source }
 * @param {object} rows.counts   database counts { kev, adp, claims }; null when unavailable
 * @param {number} rows.days     the window
 * @param {Date} now
 */
export async function buildStixBundle(
  { licences = [], kev = [], adp = [], adpVulns = [], claims = [], actors = [], counts = {}, days },
  now
) {
  const generated = now.toISOString()
  const cleared = new Map(
    licences.filter((l) => l.commercial_use === true).map((l) => [normalise(l.source_id), l])
  )

  const vigil = {
    type: 'identity',
    spec_version: SPEC,
    id: await stixId('identity', 'vigil'),
    created: EPOCH,
    modified: EPOCH,
    name: 'Vigil, The Intelligence Company',
    identity_class: 'organization',
    contact_information: SITE,
    object_marking_refs: [TLP_WHITE.id],
  }

  const markings = new Map()
  const licenceFor = async (sourceId) => {
    const key = normalise(sourceId)
    const row = cleared.get(key)
    if (!row) return null
    if (!markings.has(key)) {
      const where = row.licence_url ? ` ${row.licence_url}` : ''
      markings.set(key, {
        row,
        object: {
          type: 'marking-definition',
          spec_version: SPEC,
          id: await stixId('marking-definition', `licence:${key}:${row.licence}`),
          created: EPOCH,
          created_by_ref: vigil.id,
          definition_type: 'statement',
          name: `Licence: ${row.display_name}`,
          definition: { statement: `${row.display_name}: ${row.licence}.${where}` },
        },
      })
    }
    return markings.get(key)
  }

  const licenceRef = ({ row }) => ({
    source_name: row.display_name,
    description: `Licence: ${row.licence}`,
    ...(row.licence_url ? { url: row.licence_url } : {}),
  })

  const common = (marks) => ({
    spec_version: SPEC,
    created_by_ref: vigil.id,
    object_marking_refs: [TLP_WHITE.id, ...new Set(marks.map((m) => m.object.id))],
  })

  // ---- Vulnerabilities: KEV additions, and any CVE CISA's ADP rated active ----
  const cisa = await licenceFor('cisa')
  const vulnrichment = await licenceFor('cisa-vulnrichment')
  const vulnRows = new Map()
  if (cisa) for (const v of kev) if (v.cve_id) vulnRows.set(v.cve_id, v)
  const adpRows = vulnrichment ? adp.filter((r) => r.cve_id && stixTime(r.assessed_at)) : []
  const heldForAdp = new Map(adpVulns.map((v) => [v.cve_id, v]))
  for (const r of adpRows) {
    if (!vulnRows.has(r.cve_id))
      vulnRows.set(r.cve_id, heldForAdp.get(r.cve_id) || { cve_id: r.cve_id })
  }

  const vulnerabilities = new Map()
  for (const [cve, v] of vulnRows) {
    const inKev = Boolean(cisa) && v.is_kev === true && Boolean(stixTime(v.kev_date))
    const assessed = adpRows.filter((r) => r.cve_id === cve).map((r) => stixTime(r.assessed_at))
    const times = [...(inKev ? [stixTime(v.kev_date)] : []), ...assessed].sort()
    if (!times.length) continue
    const marks = [...(inKev ? [cisa] : []), ...(assessed.length ? [vulnrichment] : [])]
    // CISA's text is used only on rows CISA's job wrote. Another job's text has no licence entry.
    const fromCisa = inKev && v.source === 'cisa-kev'
    const product = fromCisa ? [v.vendor, v.product].filter(Boolean).join(' ') : ''
    const ransomware = v.ransomware_use === true || v.ransomware_campaign_use === true
    const refs = [{ source_name: 'cve', external_id: cve }]
    if (inKev) {
      refs.push({
        source_name: 'CISA Known Exploited Vulnerabilities catalog',
        url: KEV_URL,
        description:
          `Added to CISA's KEV catalog on ${day(stixTime(v.kev_date))}.` +
          (ransomware ? ' CISA records known use in ransomware campaigns.' : ''),
      })
      refs.push(licenceRef(cisa))
    }
    if (assessed.length) refs.push(licenceRef(vulnrichment))
    const description = fromCisa && v.description ? v.description : null
    vulnerabilities.set(cve, {
      type: 'vulnerability',
      ...common(marks),
      id: await stixId('vulnerability', cve),
      created: times[0],
      modified: times[times.length - 1],
      name: product ? `${cve} (${product})` : cve,
      ...(description ? { description } : {}),
      external_references: refs,
    })
  }

  // ---- CISA's ADP ratings, as CISA's notes ----
  const adpNotes = []
  for (const r of adpRows) {
    const vuln = vulnerabilities.get(r.cve_id)
    if (!vuln) continue
    const at = stixTime(r.assessed_at)
    const inKev = vuln.external_references.some((e) => e.url === KEV_URL)
    const detail = [
      'Exploitation: active.',
      r.automatable ? `Automatable: ${r.automatable}.` : null,
      r.technical_impact ? `Technical impact: ${r.technical_impact}.` : null,
      `Assessed ${day(at)}.`,
      inKev ? "Also in CISA's KEV catalog." : "Not in CISA's KEV catalog.",
    ]
      .filter(Boolean)
      .join(' ')
    adpNotes.push({
      type: 'note',
      ...common([vulnrichment]),
      id: await stixId('note', `adp:${r.cve_id}:${at}`),
      created: at,
      modified: at,
      abstract: `CISA's ADP SSVC assessment of ${r.cve_id}: exploitation active`,
      content: detail,
      authors: ['CISA'],
      object_refs: [vuln.id],
      external_references: [
        {
          source_name: 'CISA Vulnrichment',
          url: 'https://github.com/cisagov/vulnrichment',
          description: "CISA's ADP SSVC assessment, not the KEV catalog.",
        },
        licenceRef(vulnrichment),
      ],
    })
  }

  // ---- Leak-site claims: the group, the organization named, and a note of the claim ----
  const actorRows = new Map(actors.map((a) => [a.actor_id, a]))
  const groups = new Map()
  const victims = new Map()
  const claimNotes = []
  let leftOut = 0
  for (const c of claims) {
    const at = stixTime(c.discovered_date)
    const actor = actorRows.get(c.actor_id)
    let claimLicence = null
    for (const s of c.sources || []) {
      claimLicence = await licenceFor(s)
      if (claimLicence) break
    }
    if (!at || !actor?.name || !c.victim_name || !claimLicence) {
      leftOut += 1
      continue
    }
    // A group's name: its own catalog source if cleared, or, for a group listed only through its
    // claims, the source relaying them. Otherwise the group and its claim stay out.
    const nameLicence =
      (await licenceFor(actor.source)) || (actor.listed_by === 'claims' ? claimLicence : null)
    if (!nameLicence) {
      leftOut += 1
      continue
    }
    if (!groups.has(c.actor_id)) {
      groups.set(c.actor_id, {
        type: 'threat-actor',
        ...common([nameLicence]),
        id: await stixId('threat-actor', c.actor_id),
        created: at,
        modified: at,
        name: actor.name,
        external_references: [licenceRef(nameLicence)],
      })
    }
    const group = groups.get(c.actor_id)
    if (at < group.created) group.created = at
    if (at > group.modified) group.modified = at

    if (!victims.has(c.victim_name)) {
      victims.set(c.victim_name, {
        type: 'identity',
        ...common([claimLicence]),
        id: await stixId('identity', `claimed:${c.victim_name}`),
        created: at,
        modified: at,
        name: c.victim_name,
        identity_class: 'organization',
        external_references: [licenceRef(claimLicence)],
      })
    }
    const victim = victims.get(c.victim_name)
    if (at < victim.created) victim.created = at
    if (at > victim.modified) victim.modified = at

    const country = c.victim_country ? ` Country as claimed or recorded: ${c.victim_country}.` : ''
    claimNotes.push({
      type: 'note',
      ...common([claimLicence, nameLicence]),
      id: await stixId('note', `claim:${c.incident_id}`),
      created: at,
      modified: at,
      abstract: `${actor.name} claims ${c.victim_name} (unverified leak-site claim)`,
      content:
        `A criminal group's own claim, relayed by ${claimLicence.row.display_name} and first seen ` +
        `${day(at)}. Neither the organization named nor Vigil has confirmed it.${country}`,
      authors: [claimLicence.row.display_name],
      object_refs: [group.id, victim.id],
      external_references: [licenceRef(claimLicence)],
    })
  }

  // ---- What this bundle holds, against what the database counted ----
  const line = (noun, listed, total) =>
    total === null || total === undefined
      ? `${noun}: ${listed} listed, count unavailable`
      : `${noun}: ${listed} of ${total}`
  const kevListed = [...vulnerabilities.values()].filter((v) =>
    v.external_references.some((e) => e.url === KEV_URL)
  ).length
  const coverage = {
    type: 'note',
    spec_version: SPEC,
    created_by_ref: vigil.id,
    object_marking_refs: [TLP_WHITE.id],
    id: await stixId('note', `coverage:${days}:${generated}`),
    created: generated,
    modified: generated,
    abstract: `Vigil STIX feed: the last ${days} days`,
    content:
      [
        line('CISA KEV additions in the window', Math.min(kev.length, kevListed), counts.kev),
        line('CISA ADP ratings of exploitation active', adpNotes.length, counts.adp),
        line('Leak-site claims', claimNotes.length, counts.claims),
      ].join('. ') +
      `. ${leftOut} claim${leftOut === 1 ? '' : 's'} left out for lacking a named group, a named ` +
      "organization or a cleared source. An older KEV entry appears only if CISA's ADP rated it in the window.",
    object_refs: [vigil.id],
  }

  return {
    type: 'bundle',
    id: `bundle--${await uuid5(`bundle:${days}:${generated}`)}`,
    objects: [
      TLP_WHITE,
      vigil,
      ...[...markings.values()].map((m) => m.object),
      coverage,
      ...vulnerabilities.values(),
      ...adpNotes,
      ...groups.values(),
      ...victims.values(),
      ...claimNotes,
    ],
  }
}

const chunks = (list, size) => {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Reads the rows for one bundle. Any failed read throws: a partial licence or KEV read must not
 * come out looking like "not cleared" or "not in KEV".
 * @param {Function} read (path, { count }) => rows, or { rows, count } with count
 */
export async function loadStixRows(read, days, now) {
  const start = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)
  const [licences, kevPage, adpPage, claimsPage] = await Promise.all([
    read('source_licences?select=source_id,display_name,licence,licence_url,commercial_use'),
    read(
      `vulnerabilities?select=cve_id,kev_date,is_kev,source,vendor,product,description,ransomware_use,ransomware_campaign_use&is_kev=is.true&kev_date=gte.${start}&order=kev_date.desc,cve_id.asc&limit=${STIX_CAPS.kev}`,
      { count: true }
    ),
    read(
      `cisa_ssvc?select=cve_id,assessed_at,automatable,technical_impact&exploitation=eq.active&assessed_at=gte.${start}T00:00:00Z&order=assessed_at.desc,cve_id.asc&limit=${STIX_CAPS.adp}`,
      { count: true }
    ),
    read(
      `incidents_commercial?select=incident_id,actor_id,victim_name,discovered_date,victim_country,sources&discovered_date=gte.${start}&order=discovered_date.desc,incident_id.asc&limit=${STIX_CAPS.claims}`,
      { count: true }
    ),
  ])

  const adpIds = [...new Set(adpPage.rows.map((r) => r.cve_id).filter(Boolean))]
  const actorIds = [...new Set(claimsPage.rows.map((c) => c.actor_id).filter(Boolean))]
  const [adpVulns, listed, catalog] = await Promise.all([
    Promise.all(
      chunks(adpIds, 100).map((ids) =>
        read(
          `vulnerabilities?select=cve_id,kev_date,is_kev,source,vendor,product,description,ransomware_use,ransomware_campaign_use&cve_id=in.(${ids.join(',')})`
        )
      )
    ),
    Promise.all(
      chunks(actorIds, 100).map((ids) =>
        read(
          `threat_actors_commercial?select=actor_id,name,listed_by&actor_id=in.(${ids.join(',')})`
        )
      )
    ),
    Promise.all(
      chunks(actorIds, 100).map((ids) =>
        read(`threat_actors?select=id,source&id=in.(${ids.join(',')})`)
      )
    ),
  ])
  const sourceById = new Map(catalog.flat().map((r) => [r.id, r.source]))
  return {
    licences,
    kev: kevPage.rows,
    adp: adpPage.rows,
    adpVulns: adpVulns.flat(),
    claims: claimsPage.rows,
    actors: listed.flat().map((a) => ({ ...a, source: sourceById.get(a.actor_id) || null })),
    counts: { kev: kevPage.count, adp: adpPage.count, claims: claimsPage.count },
    days,
  }
}
