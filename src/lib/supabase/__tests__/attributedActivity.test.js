/**
 * Attributed activity module tests.
 *
 * The behaviour worth protecting here is not "it fetches rows". It is that the
 * five attribution strengths stay distinct: the first version of the CISA
 * parser read advisory summaries as well as titles and turned "Pro-Russia
 * Hacktivists" into `state`, which is false. The map now colours by strength,
 * so a ranking bug would put that same false claim on screen instead of in a
 * column.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  attributedActivity,
  strengthRank,
  ATTRIBUTION_STRENGTHS,
  ATTRIBUTION_STRENGTH_LABELS,
  ATTRIBUTION_STRENGTH_COLORS,
} from '../attributedActivity'
import { supabase } from '../client'

vi.mock('../client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

/** A chainable query stub that resolves to the given payload when awaited. */
function queryReturning(payload) {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(payload).then(resolve, reject),
  }
  return q
}

const IRAN_PLC = {
  advisory_id: 'AA26-097A',
  title: 'Iranian-Affiliated Cyber Actors Exploit Programmable Logic Controllers',
  published: '2026-04-06',
  attributed_country: 'IR',
  attribution_phrase: 'Iranian-Affiliated Cyber Actors',
  attribution_strength: 'affiliated',
  source: 'cisa',
}

const RUSSIA_STATE = {
  advisory_id: 'AA25-001A',
  title: 'Russian State-Sponsored Actors Target Energy',
  published: '2025-01-02',
  attributed_country: 'RU',
  attribution_phrase: 'Russian State-Sponsored Cyber Actors',
  attribution_strength: 'state',
  source: 'cisa',
}

const RUSSIA_HACKTIVIST = {
  advisory_id: 'AA24-249A',
  title: 'Pro-Russia Hacktivists Target Industrial Control Systems',
  published: '2024-09-05',
  attributed_country: 'RU',
  attribution_phrase: 'Pro-Russia Hacktivists',
  attribution_strength: 'aligned',
  source: 'cisa',
}

const UNATTRIBUTED = {
  advisory_id: 'AA26-100A',
  title: 'Critical Vulnerability in Widely Used Appliance',
  published: '2026-04-10',
  attributed_country: null,
  attribution_phrase: null,
  attribution_strength: null,
}

describe('attribution strengths', () => {
  it('ranks a state claim above an aligned one', () => {
    expect(strengthRank('state')).toBeGreaterThan(strengthRank('aligned'))
  })

  it('ranks every named strength above an unknown or absent one', () => {
    for (const strength of ATTRIBUTION_STRENGTHS) {
      expect(strengthRank(strength)).toBeGreaterThan(strengthRank(null))
      expect(strengthRank(strength)).toBeGreaterThan(strengthRank('not-a-strength'))
    }
  })

  it('gives every strength its own label and its own colour', () => {
    const colors = ATTRIBUTION_STRENGTHS.map((s) => ATTRIBUTION_STRENGTH_COLORS[s])
    const labels = ATTRIBUTION_STRENGTHS.map((s) => ATTRIBUTION_STRENGTH_LABELS[s])

    expect(colors.every(Boolean)).toBe(true)
    expect(labels.every(Boolean)).toBe(true)
    // Two strengths sharing a colour would render as one claim on the map.
    expect(new Set(colors).size).toBe(ATTRIBUTION_STRENGTHS.length)
    expect(new Set(labels).size).toBe(ATTRIBUTION_STRENGTHS.length)
  })

  it('matches the five values the database check constraint allows', () => {
    expect([...ATTRIBUTION_STRENGTHS].sort()).toEqual([
      'affiliated',
      'aligned',
      'criminal',
      'nexus',
      'state',
    ])
  })
})

describe('attributedActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('reads the advisory table newest first', async () => {
      const q = queryReturning({ data: [IRAN_PLC], error: null })
      supabase.from.mockReturnValue(q)

      await attributedActivity.getAll()

      expect(supabase.from).toHaveBeenCalledWith('attributed_activity')
      expect(q.order).toHaveBeenCalledWith('published', { ascending: false })
      expect(q.eq).not.toHaveBeenCalled()
    })

    it('upper-cases a country filter', async () => {
      const q = queryReturning({ data: [], error: null })
      supabase.from.mockReturnValue(q)

      await attributedActivity.getAll({ country: 'ir' })

      expect(q.eq).toHaveBeenCalledWith('attributed_country', 'IR')
    })
  })

  describe('getCountryIndex', () => {
    it('keeps the strongest claim per country without discarding the weaker ones', async () => {
      supabase.from.mockReturnValue(
        queryReturning({
          data: [RUSSIA_STATE, RUSSIA_HACKTIVIST, IRAN_PLC],
          error: null,
        })
      )

      const { data } = await attributedActivity.getCountryIndex()

      // Russia has both a state claim and a hacktivist one. The strongest
      // drives the colour; both phrases survive for the tooltip, because
      // dropping either would overstate or understate what CISA published.
      expect(data.RU.strongest).toBe('state')
      expect(data.RU.count).toBe(2)
      expect(data.RU.phrases).toContain('Russian State-Sponsored Cyber Actors')
      expect(data.RU.phrases).toContain('Pro-Russia Hacktivists')

      expect(data.IR.strongest).toBe('affiliated')
      expect(data.IR.count).toBe(1)
    })

    it('never promotes an aligned claim to state', async () => {
      supabase.from.mockReturnValue(queryReturning({ data: [RUSSIA_HACKTIVIST], error: null }))

      const { data } = await attributedActivity.getCountryIndex()

      expect(data.RU.strongest).toBe('aligned')
    })

    it('ignores advisories that blame nobody', async () => {
      supabase.from.mockReturnValue(queryReturning({ data: [UNATTRIBUTED, IRAN_PLC], error: null }))

      const { data } = await attributedActivity.getCountryIndex()

      expect(Object.keys(data)).toEqual(['IR'])
    })

    it('normalises the country code so one country is one entry', async () => {
      supabase.from.mockReturnValue(
        queryReturning({
          data: [IRAN_PLC, { ...IRAN_PLC, advisory_id: 'AA26-098A', attributed_country: 'ir' }],
          error: null,
        })
      )

      const { data } = await attributedActivity.getCountryIndex()

      expect(Object.keys(data)).toEqual(['IR'])
      expect(data.IR.count).toBe(2)
    })

    it('records which governments attributed, not just how many advisories', async () => {
      const NCSC_IRAN = {
        advisory_id: 'NCSC-UK-ALLIES-EXPOSE-SPYWARE',
        title: 'UK and allies expose spyware used by Iranian state actors',
        published: '2026-09-15',
        attributed_country: 'IR',
        attribution_phrase: 'Iranian state actors',
        attribution_strength: 'state',
        source: 'ncsc-uk',
      }
      supabase.from.mockReturnValue(
        queryReturning({ data: [IRAN_PLC, NCSC_IRAN, RUSSIA_STATE], error: null })
      )

      const { data } = await attributedActivity.getCountryIndex()

      // Two allied governments naming Iran separately is a materially
      // different position from the US naming it twice, and the count alone
      // cannot tell them apart.
      expect(data.IR.sources.sort()).toEqual(['cisa', 'ncsc-uk'])
      expect(data.RU.sources).toEqual(['cisa'])

      // NCSC says state where CISA said affiliated. The stronger claim wins
      // the colour and both phrases survive.
      expect(data.IR.strongest).toBe('state')
      expect(data.IR.phrases).toHaveLength(2)
    })

    it('passes a read failure through rather than reporting an empty world', async () => {
      const error = { message: 'connection terminated' }
      supabase.from.mockReturnValue(queryReturning({ data: null, error }))

      const result = await attributedActivity.getCountryIndex()

      // Absence and zero are different answers: a failed read must not draw
      // a map with no attributed countries on it.
      expect(result.error).toBe(error)
      expect(result.data).toBeNull()
    })
  })

  describe('getCoverage', () => {
    it('counts how many advisories name a country', async () => {
      supabase.from.mockReturnValue(
        queryReturning({ data: [IRAN_PLC, RUSSIA_STATE, UNATTRIBUTED], error: null })
      )

      const { data } = await attributedActivity.getCoverage()

      expect(data.total).toBe(3)
      expect(data.attributed).toBe(2)
      expect(data.latest).toBe('2026-04-10')
    })

    it('returns the error rather than a zeroed summary', async () => {
      const error = { message: 'nope' }
      supabase.from.mockReturnValue(queryReturning({ data: null, error }))

      const result = await attributedActivity.getCoverage()

      expect(result.error).toBe(error)
      expect(result.data).toBeNull()
    })
  })

  describe('getByCountry', () => {
    it('reads the aggregate view, most advisories first', async () => {
      const q = queryReturning({ data: [], error: null })
      supabase.from.mockReturnValue(q)

      await attributedActivity.getByCountry()

      expect(supabase.from).toHaveBeenCalledWith('attributed_activity_by_country')
      expect(q.order).toHaveBeenCalledWith('advisories', { ascending: false })
    })
  })
})
