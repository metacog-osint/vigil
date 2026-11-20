/**
 * The Upper Midwest watch page (ideas#51).
 *
 * Checks that every lane paints, that claims carry their warning and their
 * reason, that picking a state filters every lane, and that the page shows
 * no total of people affected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getCounts = vi.fn()
const getFilings = vi.fn()
const getClaimsSameName = vi.fn()
const getClaimsNamingState = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const um = await vi.importActual('../../lib/supabase/upperMidwest')
  const disc = await vi.importActual('../../lib/supabase/disclosures')
  return {
    UPPER_MIDWEST: um.UPPER_MIDWEST,
    DISCLOSURE_SOURCES: disc.DISCLOSURE_SOURCES,
    COUNT_SCOPES: disc.COUNT_SCOPES,
    upperMidwest: {
      getCounts: (...a) => getCounts(...a),
      getFilings: (...a) => getFilings(...a),
      getClaimsSameName: (...a) => getClaimsSameName(...a),
      getClaimsNamingState: (...a) => getClaimsNamingState(...a),
    },
  }
})

import UpperMidwest from '../UpperMidwest'

const COUNTS = ['MN', 'WI', 'IA', 'ND', 'SD'].map((state, i) => ({
  state,
  name: { MN: 'Minnesota', WI: 'Wisconsin', IA: 'Iowa', ND: 'North Dakota', SD: 'South Dakota' }[
    state
  ],
  hhs: 100 + i,
  hhsYear: 10 + i,
  sec: i,
  claimsText: i,
}))

beforeEach(() => {
  vi.clearAllMocks()
  getCounts.mockResolvedValue({ data: COUNTS, since: '2025-11-20', error: null })
  getFilings.mockImplementation(async ({ lane }) => ({
    data:
      lane === 'hhs-ocr'
        ? [
            {
              id: 1,
              source: 'hhs-ocr',
              company_name: 'Lake Region Healthcare',
              business_location: 'MN',
              placed_in: 'MN',
              filed_date: '2026-07-01',
              breach_cause: 'Hacking/IT Incident',
              persons_affected: 1234,
              persons_affected_scope: 'total',
              filing_url: 'https://example.test/hhs',
            },
          ]
        : [
            {
              id: 2,
              source: 'sec-edgar',
              company_name: 'Lee Enterprises',
              business_location: 'Davenport, IA',
              placed_in: 'IA',
              filed_date: '2025-02-28',
            },
          ],
    count: 1,
    error: null,
  }))
  getClaimsSameName.mockResolvedValue({
    data: [
      {
        id: 'a',
        victim_name: 'Lake Region Healthcare',
        discovered_date: '2025-06-12T10:00:00Z',
        threat_actor: { id: 't', name: 'SomeGroup' },
        matched: [{ source: 'hhs-ocr', state: 'MN' }],
      },
    ],
    error: null,
  })
  getClaimsNamingState.mockResolvedValue({
    data: [
      {
        id: 'b',
        victim_name: 'Acme Dairy',
        discovered_date: '2026-03-02T10:00:00Z',
        threat_actor: null,
        states_named: ['WI'],
      },
    ],
    error: null,
  })
})

describe('Upper Midwest watch', () => {
  it('paints every lane apart, with claims marked as claims', async () => {
    render(<UpperMidwest />)

    expect(await screen.findByText('Minnesota')).toBeTruthy()
    expect(await screen.findByText('Lee Enterprises')).toBeTruthy()
    expect(screen.getAllByText('Lake Region Healthcare').length).toBe(2)
    expect(await screen.findByText('Acme Dairy')).toBeTruthy()

    expect(screen.getByText(/criminals' claims, not confirmed attacks/)).toBeTruthy()
    expect(screen.getByText('Same name as HHS filing, MN')).toBeTruthy()
    expect(screen.getByText('Text names Wisconsin')).toBeTruthy()

    // No total of people affected anywhere on the page.
    expect(screen.queryByText(/total.*affected/i)).toBeNull()
  })

  it('filters every lane when a state is picked, and clears on a second pick', async () => {
    render(<UpperMidwest />)
    const card = (await screen.findByText('Iowa')).closest('button')

    fireEvent.click(card)
    await waitFor(() => {
      expect(getFilings).toHaveBeenCalledWith(
        expect.objectContaining({ lane: 'hhs-ocr', state: 'IA' })
      )
      expect(getFilings).toHaveBeenCalledWith(
        expect.objectContaining({ lane: 'sec-edgar', state: 'IA' })
      )
      expect(getClaimsSameName).toHaveBeenCalledWith({ state: 'IA' })
      expect(getClaimsNamingState).toHaveBeenCalledWith({ state: 'IA' })
    })
    expect(screen.getByText(/Showing Iowa/)).toBeTruthy()

    fireEvent.click(card)
    await waitFor(() => expect(screen.getByText(/Showing all five states/)).toBeTruthy())
  })

  it('shows an error rather than an empty claims list', async () => {
    getClaimsNamingState.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    render(<UpperMidwest />)
    expect(await screen.findByText('permission denied')).toBeTruthy()
  })
})
