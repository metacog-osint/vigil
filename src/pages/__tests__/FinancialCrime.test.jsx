/**
 * The financial-crime register page.
 *
 * Fixtures are the shapes the live table returns. Every assertion about what is
 * absent waits for the page to have painted first - asserting a queryBy against
 * a page that has not rendered yet passes for the wrong reason, which is the
 * lesson PR #50 left on the contested-claims tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const getAll = vi.fn()
const getCoverage = vi.fn()
const countsByKind = vi.fn()
const getQueuedForReading = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const actual = await vi.importActual('../../lib/supabase/advisoryRegister')
  return {
    ...actual,
    advisoryRegister: {
      getAll: (...a) => getAll(...a),
      getCoverage: (...a) => getCoverage(...a),
      countsByKind: (...a) => countsByKind(...a),
      getQueuedForReading: (...a) => getQueuedForReading(...a),
    },
  }
})

import FinancialCrime from '../FinancialCrime'

const PIG_BUTCHERING = {
  id: 'r-1',
  source: 'fincen',
  advisory_id: 'FIN-2023-Alert005',
  language: 'en',
  kind: 'alert',
  title:
    'FinCEN Alert on Prevalent Virtual Currency Investment Scam Commonly Known as "Pig Butchering"',
  published: '2023-09-08',
  url: 'https://www.fincen.gov/system/files/shared/FinCEN_Alert_Pig_Butchering_FINAL_508c.pdf',
  document_url:
    'https://www.fincen.gov/system/files/shared/FinCEN_Alert_Pig_Butchering_FINAL_508c.pdf',
  rescinded: false,
  rescinded_note: null,
  indicators_read: false,
}

const RESCINDED = {
  id: 'r-2',
  source: 'fincen',
  advisory_id: 'FIN-2024-Alert001',
  language: 'en',
  kind: 'alert',
  title: 'FinCEN Issues Alert on Israeli Extremist Settler Violence Against Palestinians',
  published: '2024-02-01',
  url: 'https://www.fincen.gov/system/files/2024-02/alert.pdf',
  document_url: 'https://www.fincen.gov/system/files/2024-02/alert.pdf',
  rescinded: true,
  rescinded_note: 'Rescinded as of January 29, 2025',
  indicators_read: false,
}

const LANDING_PAGE_ONLY = {
  id: 'r-3',
  source: 'fincen',
  advisory_id: 'FIN-2013-A003',
  language: 'en',
  kind: 'advisory',
  title: 'Guidance to Financial Institutions Based on the FATF Publication ...',
  published: '2013-04-24',
  url: 'https://www.fincen.gov/resources/advisories/fincen-advisory-fin-2013-a003',
  document_url: null,
  rescinded: false,
  indicators_read: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  getAll.mockResolvedValue({
    data: [PIG_BUTCHERING, RESCINDED, LANDING_PAGE_ONLY],
    count: 183,
    error: null,
  })
  getCoverage.mockResolvedValue({
    data: {
      documents: 183,
      rescinded: 9,
      indicatorsRead: 0,
      spanish: 13,
      undated: 9,
      earliest: '2007-10-01',
      latest: '2026-09-08',
    },
    error: null,
  })
  countsByKind.mockResolvedValue({
    data: [
      { kind: 'advisory', documents: 137 },
      { kind: 'alert', documents: 27 },
    ],
    error: null,
  })
  getQueuedForReading.mockResolvedValue({ data: [], count: 29, error: null })
})

describe('the page says what Vigil does not hold', () => {
  it('warns that the red flags are not here, before the list', async () => {
    render(<FinancialCrime />)
    expect(screen.getByText(/Vigil holds the register, not the red flags/)).toBeInTheDocument()

    // Let the load settle, so the assertion above is known to have been true
    // while the documents were on screen rather than merely before them.
    await screen.findByText(/Pig Butchering/)
  })

  it('shows zero indicators read as a figure rather than hiding it', async () => {
    render(<FinancialCrime />)
    await screen.findByText(/Pig Butchering/)
    expect(screen.getByText('indicators read into Vigil')).toBeInTheDocument()
    expect(screen.getByText('queued for a person to read')).toBeInTheDocument()
    expect(screen.getByText('29')).toBeInTheDocument()
  })

  it('marks a document whose link is a landing page rather than the document', async () => {
    render(<FinancialCrime />)
    await screen.findByText(/Pig Butchering/)
    expect(screen.getByText(/Register links a landing page/)).toBeInTheDocument()
  })
})

describe('a rescinded document is kept and marked', () => {
  it('shows it, with the reason it is still here', async () => {
    render(<FinancialCrime />)
    await screen.findByText(/Pig Butchering/)

    expect(screen.getByText(/FIN-2024-Alert001/)).toBeInTheDocument()
    expect(
      screen.getByText(/Rescinded as of January 29, 2025 — kept, because it was issued/)
    ).toBeInTheDocument()
  })
})

describe('links go to the document', () => {
  it('points the identifier at the PDF where the indicators actually are', async () => {
    render(<FinancialCrime />)
    const link = await screen.findByRole('link', { name: /FIN-2023-Alert005/ })
    expect(link).toHaveAttribute('href', PIG_BUTCHERING.document_url)
  })
})

describe('a failed read is not an empty register', () => {
  it('reports the error instead of rendering nothing', async () => {
    getAll.mockResolvedValue({ data: null, count: null, error: { message: 'permission denied' } })

    render(<FinancialCrime />)
    expect(await screen.findByText('permission denied')).toBeInTheDocument()
  })

  it('renders a failed count as an em dash rather than zero', async () => {
    getCoverage.mockResolvedValue({
      data: {
        documents: null,
        rescinded: null,
        indicatorsRead: null,
        spanish: null,
        undated: null,
        earliest: null,
        latest: null,
      },
      error: null,
    })
    getQueuedForReading.mockResolvedValue({ data: [], count: null, error: null })

    render(<FinancialCrime />)
    await screen.findByText(/Pig Butchering/)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
