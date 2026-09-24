/**
 * The page. Every fixture below is the shape the live views actually return,
 * including the detail that bites: PostgREST serialises `numeric` as a string
 * and `count()` as a number, so `value_numeric` arrives as "694" and
 * `values_recorded` as 3.
 *
 * The behaviours worth protecting are the refusals. The page must show a
 * repetition carrying its originator's tier rather than its own, must say out
 * loud when several figures trace to one body, must not print a single number
 * for a contested claim, and must not let an unverified figure read as an
 * established one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getAll = vi.fn()
const getAllValues = vi.fn()
const getCoverage = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const actual = await vi.importActual('../../lib/supabase/contestedClaims')
  return {
    ...actual,
    contestedClaims: {
      getAll: (...a) => getAll(...a),
      getAllValues: (...a) => getAllValues(...a),
      getCoverage: (...a) => getCoverage(...a),
    },
  }
})

import ContestedClaims from '../ContestedClaims'

const ECHO_CLAIM = {
  id: 'c-1',
  claim_key: 'global_crypto_scam_losses_2025',
  question: 'How much did cryptocurrency scams receive on-chain globally in 2025?',
  unit: 'usd_billions',
  period_start: '2025-01-01',
  period_end: '2025-12-31',
  scope_note: null,
  resolution: 'present_both',
  handling:
    '"$14 billion measured, projected above $17 billion." Never present the projection alone.',
  decided_by: 'T. R. Brummer, scam-disruption compilation v1.0',
  decided_at: '2026-08-21T00:00:00+00:00',
  values_recorded: 3,
  distinct_origins: 1,
  repetitions: 1,
  best_tier: 2,
  projections: 1,
  values_verified: 0,
  spread_ratio: '0.214',
}

const UNRULED_CLAIM = {
  id: 'c-2',
  claim_key: 'kk_park_detained_october_2025',
  question: 'How many people were detained in the October 2025 raid on KK Park, Myanmar?',
  period_start: '2025-10-19',
  period_end: '2025-10-20',
  scope_note: 'The raid narrative originates with Myanmar junta state media, an interested party.',
  resolution: 'unresolved',
  handling: null,
  decided_by: null,
  decided_at: null,
  values_recorded: 1,
  distinct_origins: 1,
  repetitions: 0,
  best_tier: 3,
  projections: 0,
  values_verified: 0,
  spread_ratio: null,
}

const VALUES = [
  {
    id: 'v-1',
    claim_key: 'global_crypto_scam_losses_2025',
    publisher_name: 'Chainalysis',
    publisher_tier: 2,
    origin_publisher_name: 'Chainalysis',
    effective_tier: 2,
    repetition_depth: 0,
    is_repetition: false,
    value_numeric: '14',
    value_text: null,
    measurement: 'measured',
    verification: 'carried_forward',
    verified_on: null,
    citation: 'endnote [15]',
  },
  {
    id: 'v-2',
    claim_key: 'global_crypto_scam_losses_2025',
    publisher_name: 'Chainalysis',
    publisher_tier: 2,
    origin_publisher_name: 'Chainalysis',
    effective_tier: 2,
    repetition_depth: 0,
    is_repetition: false,
    value_numeric: '17',
    value_text: 'above $17 billion',
    measurement: 'projected',
    verification: 'carried_forward',
    verified_on: null,
    citation: 'endnote [15]',
  },
  {
    // The row that carries the whole argument: no tier of its own, and it
    // must still render Tier 2 because Chainalysis produced the figure.
    id: 'v-3',
    claim_key: 'global_crypto_scam_losses_2025',
    publisher_name: 'Unattributed secondary coverage',
    publisher_tier: null,
    origin_publisher_name: 'Chainalysis',
    effective_tier: 2,
    repetition_depth: 1,
    is_repetition: true,
    value_numeric: '17',
    value_text: null,
    measurement: 'reported',
    verification: 'carried_forward',
    verified_on: null,
    citation: 'endnote [53]',
  },
  {
    id: 'v-4',
    claim_key: 'kk_park_detained_october_2025',
    publisher_name: 'Myanmar state media',
    publisher_tier: 3,
    origin_publisher_name: 'Myanmar state media',
    effective_tier: 3,
    repetition_depth: 0,
    is_repetition: false,
    value_numeric: '2198',
    value_text: null,
    measurement: 'claimed',
    verification: 'carried_forward',
    verified_on: null,
    citation: 'endnotes [28][33]',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  getAll.mockResolvedValue({ data: [ECHO_CLAIM, UNRULED_CLAIM], count: 2, error: null })
  getAllValues.mockResolvedValue({ data: VALUES, error: null })
  getCoverage.mockResolvedValue({
    data: {
      claims: 8,
      values: 17,
      repetitions: 5,
      verified: 0,
      echoClaims: 3,
      publishers: 20,
      untiered: 1,
    },
    error: null,
  })
})

describe('a repetition never passes for a source', () => {
  it('shows what a repeated figure repeats', async () => {
    render(<ContestedClaims />)
    expect(await screen.findByText(/repeats Chainalysis/)).toBeInTheDocument()
  })

  it('gives a repetition the tier of the body that produced the figure', async () => {
    render(<ContestedClaims />)
    await screen.findByText(/repeats Chainalysis/)

    // Three rows for the echo claim, and none of them renders "Unclassified"
    // even though the repeating publisher has no tier of its own.
    expect(screen.queryByText('Unclassified')).not.toBeInTheDocument()
    expect(screen.getAllByText('Tier 2').length).toBeGreaterThanOrEqual(3)
  })

  it('says when there are fewer bodies than figures', async () => {
    render(<ContestedClaims />)
    expect(await screen.findByText(/3 values · 1 origin/)).toBeInTheDocument()
    expect(screen.getByText(/some of these repeat each other/)).toBeInTheDocument()
  })
})

describe('the page does not resolve anything itself', () => {
  it('renders the ruling a person made, verbatim', async () => {
    render(<ContestedClaims />)
    expect(await screen.findByText(/Never present the projection alone/)).toBeInTheDocument()
  })

  it('shows both the measured and the projected figure rather than one', async () => {
    render(<ContestedClaims />)
    await screen.findByText(/Never present the projection alone/)

    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('above $17 billion')).toBeInTheDocument()
    expect(screen.getByText('projected')).toBeInTheDocument()
  })

  it('takes no position where nobody has ruled', async () => {
    render(<ContestedClaims />)
    expect(await screen.findByText(/until it is ruled Vigil has no position/)).toBeInTheDocument()
  })
})

describe('nothing here reads as established', () => {
  it('warns that no figure has been checked at source, before any figure', async () => {
    render(<ContestedClaims />)
    expect(screen.getByText(/Nothing on this page has been checked at source/)).toBeInTheDocument()

    // Let the load settle so the assertion above is known to have run before
    // any figure reached the screen, not merely alongside one.
    await screen.findByText(/3 values · 1 origin/)
  })

  it('renders a failed count as an em dash rather than zero', async () => {
    getCoverage.mockResolvedValue({
      data: {
        claims: null,
        values: null,
        repetitions: null,
        verified: null,
        echoClaims: null,
        publishers: null,
        untiered: null,
      },
      error: null,
    })

    render(<ContestedClaims />)
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0))
  })

  it('reports the error instead of an empty page when the read fails', async () => {
    getAll.mockResolvedValue({ data: null, count: null, error: { message: 'permission denied' } })

    render(<ContestedClaims />)
    expect(await screen.findByText('permission denied')).toBeInTheDocument()
  })
})
