// @vitest-environment node
/**
 * Vigil's STIX 2.1 feed (api/_lib/stixFeed.js): structure, licences and the sources' voice.
 */
import { describe, it, expect } from 'vitest'
import {
  buildStixBundle,
  loadStixRows,
  parseDays,
  stixTime,
  STIX_CAPS,
  TLP_WHITE,
  uuid5,
} from '../../../api/_lib/stixFeed.js'

const NOW = new Date('2026-11-20T18:00:00Z')
const ACTOR = '11111111-1111-4111-8111-111111111111'
const LICENCES = [
  {
    source_id: 'cisa',
    display_name: 'CISA advisories',
    licence: 'US public domain',
    licence_url: 'https://www.cisa.gov/',
    commercial_use: true,
  },
  {
    source_id: 'cisa-vulnrichment',
    display_name: 'CISA Vulnrichment',
    licence: 'CC0 1.0 Universal',
    licence_url: 'https://github.com/cisagov/vulnrichment/blob/develop/LICENSE',
    commercial_use: true,
  },
  {
    source_id: 'ransomlook',
    display_name: 'RansomLook',
    licence: 'CC BY 4.0 (data and API responses)',
    licence_url: 'https://github.com/RansomLook/RansomLook',
    commercial_use: true,
  },
  {
    source_id: 'misp-galaxy',
    display_name: 'MISP Galaxy',
    licence: 'CC0 or BSD',
    licence_url: 'https://github.com/MISP/misp-galaxy',
    commercial_use: true,
  },
  {
    source_id: 'ransomware.live',
    display_name: 'Ransomware.live',
    licence: 'Non-commercial',
    licence_url: 'https://www.ransomware.live/t&c',
    commercial_use: false,
  },
]
const KEV = {
  cve_id: 'CVE-2026-0001',
  is_kev: true,
  kev_date: '2026-11-18',
  source: 'cisa-kev',
  vendor: 'Acme',
  product: 'Gateway',
  description: 'Acme Gateway contains a flaw.',
  ransomware_use: true,
}
const ADP = {
  cve_id: 'CVE-2026-0002',
  assessed_at: '2026-11-19T04:05:06Z',
  automatable: 'yes',
  technical_impact: 'total',
}
const CLAIM = {
  incident_id: '22222222-2222-4222-8222-222222222222',
  actor_id: ACTOR,
  victim_name: 'Example Org',
  discovered_date: '2026-11-19',
  victim_country: 'US',
  sources: ['ransomlook'],
}
const GROUP = { actor_id: ACTOR, name: 'examplegroup', listed_by: 'source', source: 'misp_galaxy' }
const base = {
  licences: LICENCES,
  kev: [KEV],
  adp: [ADP],
  adpVulns: [
    {
      cve_id: 'CVE-2026-0002',
      is_kev: false,
      source: 'nvd',
      description: 'NVD text',
      vendor: 'Other',
      product: 'Thing',
    },
  ],
  claims: [CLAIM],
  actors: [GROUP],
  counts: { kev: 1, adp: 1, claims: 1 },
  days: 7,
}
const build = (over = {}) => buildStixBundle({ ...base, ...over }, NOW)
const ofType = (b, t) => b.objects.filter((o) => o.type === t)
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ID =
  /^[a-z][a-z0-9-]+--[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** The STIX 2.1 common and per-type required properties used by this feed. */
function structuralErrors(bundle) {
  const errors = []
  const ids = new Set(bundle.objects.map((o) => o.id))
  if (bundle.type !== 'bundle' || !bundle.id.startsWith('bundle--')) errors.push('bundle header')
  if (ids.size !== bundle.objects.length) errors.push('duplicate ids')
  const required = {
    vulnerability: ['name'],
    note: ['content', 'object_refs'],
    identity: ['name', 'identity_class'],
    'threat-actor': ['name'],
    'marking-definition': ['definition_type', 'definition'],
  }
  for (const o of bundle.objects) {
    if (!ID.test(o.id) || !o.id.startsWith(`${o.type}--`)) errors.push(`${o.id}: id`)
    if (o.spec_version !== '2.1') errors.push(`${o.id}: spec_version`)
    if (!TIME.test(o.created)) errors.push(`${o.id}: created`)
    if (o.type !== 'marking-definition') {
      if (!TIME.test(o.modified)) errors.push(`${o.id}: modified`)
      if (o.modified < o.created) errors.push(`${o.id}: modified before created`)
    }
    for (const p of required[o.type] || ['?']) if (o[p] === undefined) errors.push(`${o.id}: ${p}`)
    for (const r of [
      o.created_by_ref,
      ...(o.object_refs || []),
      ...(o.object_marking_refs || []),
    ]) {
      if (r && !ids.has(r)) errors.push(`${o.id}: dangling ${r}`)
    }
    for (const e of o.external_references || []) {
      if (!e.source_name || !(e.url || e.external_id || e.description)) errors.push(`${o.id}: ref`)
    }
  }
  return errors
}

describe('STIX feed structure', () => {
  it('is structurally valid STIX 2.1', async () => {
    expect(structuralErrors(await build())).toEqual([])
  })

  it('keeps ids stable between builds', async () => {
    const a = await build()
    const b = await buildStixBundle({ ...base }, new Date('2026-11-21T01:00:00Z'))
    const stable = (x) =>
      x.objects.filter((o) => !o.abstract?.startsWith('Vigil STIX')).map((o) => o.id)
    expect(stable(b)).toEqual(stable(a))
  })

  it('makes a valid version 5 UUID', async () => {
    expect(await uuid5('x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('formats times and rejects bad ones', () => {
    expect(stixTime('2026-11-18')).toBe('2026-11-18T00:00:00.000Z')
    expect(stixTime('nope')).toBeNull()
  })

  it('accepts only the offered windows', () => {
    expect(parseDays(null)).toBe(7)
    expect(parseDays('90')).toBe(90)
    for (const bad of ['8', '-7', '7d', '']) expect(parseDays(bad)).toBeNull()
  })
})

describe('licences', () => {
  it('marks every data object with TLP and its licence', async () => {
    const b = await build()
    const statements = new Set(
      ofType(b, 'marking-definition')
        .filter((m) => m.definition_type === 'statement')
        .map((m) => m.id)
    )
    const data = b.objects.filter(
      (o) =>
        o.type !== 'marking-definition' &&
        !o.abstract?.startsWith('Vigil STIX') &&
        o.name !== 'Vigil, The Intelligence Company'
    )
    expect(data.length).toBeGreaterThan(0)
    for (const o of data) {
      expect(o.object_marking_refs).toContain(TLP_WHITE.id)
      expect(o.object_marking_refs.some((r) => statements.has(r))).toBe(true)
      expect(o.external_references.some((e) => e.description?.startsWith('Licence:'))).toBe(true)
    }
  })

  it('drops a claim whose only source is not cleared', async () => {
    const b = await build({ claims: [{ ...CLAIM, sources: ['ransomware.live'] }] })
    expect(JSON.stringify(b)).not.toContain('Example Org')
    expect(b.objects.find((o) => o.abstract?.startsWith('Vigil STIX')).content).toContain(
      '1 claim left out'
    )
  })

  it('keeps a claim through its cleared source and never credits the other', async () => {
    const b = await build({ claims: [{ ...CLAIM, sources: ['ransomware.live', 'ransomlook'] }] })
    expect(JSON.stringify(b)).toContain('Example Org')
    expect(JSON.stringify(b)).not.toContain('Ransomware.live')
  })

  it('drops a group whose name source is not cleared', async () => {
    const b = await build({ actors: [{ ...GROUP, source: 'malpedia' }] })
    expect(ofType(b, 'threat-actor')).toEqual([])
    expect(JSON.stringify(b)).not.toContain('Example Org')
  })

  it('credits the relaying source for a group listed only by its claims', async () => {
    const b = await build({ actors: [{ ...GROUP, source: 'malpedia', listed_by: 'claims' }] })
    expect(ofType(b, 'threat-actor')[0].external_references[0].source_name).toBe('RansomLook')
  })

  it('publishes no KEV entry if CISA is not cleared', async () => {
    const b = await build({ licences: LICENCES.filter((l) => l.source_id !== 'cisa') })
    expect(JSON.stringify(b)).not.toContain('CVE-2026-0001')
  })

  it('uses no description or product from a non-CISA row', async () => {
    const b = await build()
    const v = ofType(b, 'vulnerability').find((o) => o.name.startsWith('CVE-2026-0002'))
    expect(v.name).toBe('CVE-2026-0002')
    expect(v.description).toBeUndefined()
  })
})

describe("the sources' voice", () => {
  it('states a claim as a claim, with no relationship object', async () => {
    const b = await build()
    expect(ofType(b, 'relationship')).toEqual([])
    const note = ofType(b, 'note').find((n) => n.abstract.includes('claims Example Org'))
    expect(note.abstract).toContain('unverified')
    expect(note.content).toContain('Neither the organization named nor Vigil has confirmed it')
  })

  it('gives the KEV reference only to CVEs in the catalog', async () => {
    const b = await build()
    const kevRef = (v) => v.external_references.some((e) => e.url?.includes('known-exploited'))
    const vulns = ofType(b, 'vulnerability')
    expect(kevRef(vulns.find((v) => v.name.startsWith('CVE-2026-0001')))).toBe(true)
    expect(kevRef(vulns.find((v) => v.name.startsWith('CVE-2026-0002')))).toBe(false)
  })

  it("writes an ADP rating as CISA's, and says when it is outside KEV", async () => {
    const b = await build()
    const note = ofType(b, 'note').find((n) => n.abstract.startsWith("CISA's ADP"))
    expect(note.authors).toEqual(['CISA'])
    expect(note.content).toContain("Not in CISA's KEV catalog")
  })

  it('reports what it lists against the database count', async () => {
    const b = await build({ counts: { kev: 1, adp: null, claims: 5000 } })
    const c = b.objects.find((o) => o.abstract?.startsWith('Vigil STIX')).content
    expect(c).toContain('Leak-site claims: 1 of 5000')
    expect(c).toContain('1 listed, count unavailable')
  })
})

describe('loadStixRows', () => {
  const reader = (fail) => async (path, opts) => {
    if (fail && path.startsWith(fail)) throw new Error('boom')
    const table = path.split('?')[0]
    const rows =
      table === 'source_licences'
        ? LICENCES
        : table === 'incidents_commercial'
          ? [CLAIM]
          : table === 'threat_actors_commercial'
            ? [{ actor_id: ACTOR, name: 'examplegroup', listed_by: 'source' }]
            : table === 'threat_actors'
              ? [{ id: ACTOR, source: 'misp_galaxy' }]
              : []
    return opts?.count ? { rows, count: rows.length } : rows
  }

  it('joins each group to its catalog source and applies the caps', async () => {
    const paths = []
    const read = reader()
    const rows = await loadStixRows((p, o) => (paths.push(p), read(p, o)), 7, NOW)
    expect(rows.actors[0].source).toBe('misp_galaxy')
    expect(paths.some((p) => p.includes(`limit=${STIX_CAPS.claims}`))).toBe(true)
    expect(paths.join(' ')).not.toContain('raw_data')
    expect(paths.some((p) => p.startsWith('incidents?'))).toBe(false)
  })

  it('fails rather than serve a bundle without its licences', async () => {
    await expect(loadStixRows(reader('source_licences'), 7, NOW)).rejects.toThrow('boom')
  })
})
