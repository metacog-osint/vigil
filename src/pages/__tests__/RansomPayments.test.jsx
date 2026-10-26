/**
 * The ransom-payments page.
 *
 * The fixtures are the shapes the live table returns, summarised by the real
 * query-layer code rather than a hand-written summary, so a page test cannot
 * pass on a summary the module would never produce.
 *
 * Every assertion about an absence waits for the page to paint first. A
 * queryBy against a page that has not rendered yet passes for the wrong
 * reason, which is the lesson PR #50 left on the contested-claims tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const getPayments = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const actual = await vi.importActual('../../lib/supabase/ransomPayments')
  return {
    ...actual,
    ransomPayments: { getPayments: (...a) => getPayments(...a) },
  }
})

import RansomPayments from '../RansomPayments'
import { summarise, UNLABELED_FAMILY } from '../../lib/supabase/ransomPayments'

const META = { snapshot_version: '1.1.0', snapshot_published: '2024-10-27' }

function row(family, usd, payments, addresses, first, last) {
  return {
    family_name: family,
    total_usd: usd,
    payment_count: payments,
    unique_addresses: addresses,
    first_payment: first,
    last_payment: last,
    metadata: { ...META, attributed: family !== UNLABELED_FAMILY },
  }
}

const ROWS = [
  row(UNLABELED_FAMILY, 682_000_000, 9000, 6000, '2012-03-09', '2024-08-19'),
  row('Conti', 180_000_000, 900, 700, '2020-05-01', '2022-06-01'),
  row('Ryuk', 150_000_000, 400, 300, '2018-08-01', '2021-02-01'),
  row('Locky', 4_000_000, 2000, 1500, '2016-02-01', '2017-12-01'),
]

function payload(rows, count) {
  const toFamily = (r) => ({
    name: r.family_name,
    usd: r.total_usd,
    payments: r.payment_count,
    addresses: r.unique_addresses,
    firstPayment: r.first_payment,
    lastPayment: r.last_payment,
  })
  return {
    data: {
      summary: summarise(rows, count),
      families: rows.filter((r) => r.family_name !== UNLABELED_FAMILY).map(toFamily),
      unlabeled: toFamily(rows[0]),
    },
    error: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getPayments.mockResolvedValue(payload(ROWS, ROWS.length))
})

describe('the age of the data comes first', () => {
  it('states the version, publication date and last payment', async () => {
    render(<RansomPayments />)
    expect(await screen.findByText(/This is a snapshot, not a feed/)).toBeInTheDocument()
    const snapshot = screen.getByText(/This is a snapshot, not a feed/).closest('p')
    expect(snapshot).toHaveTextContent('Version 1.1.0')
    expect(snapshot).toHaveTextContent('Oct 27, 2024')
    // A calendar day, not a timestamp: never shifted to the 18th west of UTC.
    expect(snapshot).toHaveTextContent('Aug 19, 2024')
  })

  it('puts the snapshot before the figures', async () => {
    render(<RansomPayments />)
    const snapshot = await screen.findByText(/This is a snapshot, not a feed/)
    const figure = screen.getByText('named families')
    expect(snapshot.compareDocumentPosition(figure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('there is no single total', () => {
  it('shows attributed and unlabeled separately, with the share', async () => {
    render(<RansomPayments />)
    expect(await screen.findByText('$334M')).toBeInTheDocument()
    expect(screen.getByText('$682M')).toBeInTheDocument()
    expect(screen.getAllByText(/67%/).length).toBeGreaterThan(0)
  })

  it('never renders the two added together', async () => {
    render(<RansomPayments />)
    await screen.findByText('$334M')
    expect(screen.queryByText(/\$1(\.0)?B/)).toBeNull()
    expect(document.body.textContent).not.toMatch(/1,016,000,000/)
  })

  it('keeps Unlabeled out of the family table', async () => {
    render(<RansomPayments />)
    await screen.findByText('Conti')
    const table = screen.getByRole('table')
    expect(table).not.toHaveTextContent(UNLABELED_FAMILY)
    expect(screen.getByRole('heading', { name: UNLABELED_FAMILY })).toBeInTheDocument()
  })
})

describe('the family table', () => {
  it('lists the named families, most money first', async () => {
    render(<RansomPayments />)
    await screen.findByText('Conti')
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent)
    expect(names).toEqual(['Conti', 'Ryuk', 'Locky'])
  })

  it('filters by name', async () => {
    render(<RansomPayments />)
    await screen.findByText('Conti')
    fireEvent.change(screen.getByLabelText('Find a family'), { target: { value: 'ry' } })
    expect(screen.getByText('Ryuk')).toBeInTheDocument()
    expect(screen.queryByText('Conti')).toBeNull()
    expect(screen.getByText(/Showing 1 of 3 named families/)).toBeInTheDocument()
  })
})

describe('when the data is not all there', () => {
  it('withholds the sums rather than showing them short', async () => {
    getPayments.mockResolvedValue(payload(ROWS.slice(0, 3), 4))
    render(<RansomPayments />)
    expect(
      await screen.findByText(/figures that add rows together are withheld/)
    ).toBeInTheDocument()
    expect(screen.queryByText('$334M')).toBeNull()
  })

  it('says the load failed instead of showing an empty page', async () => {
    getPayments.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    render(<RansomPayments />)
    expect(await screen.findByText(/The payments did not load: timeout/)).toBeInTheDocument()
  })
})

describe('attribution', () => {
  it('cites the deposit and its licence, as CC BY requires', async () => {
    render(<RansomPayments />)
    const doi = await screen.findByRole('link', { name: /doi:10\.5281\/zenodo\.6512122/ })
    expect(doi).toHaveAttribute('href', 'https://doi.org/10.5281/zenodo.6512122')
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toBeInTheDocument()
    expect(screen.getByText(/aggregated per family by Vigil/)).toBeInTheDocument()
  })
})
