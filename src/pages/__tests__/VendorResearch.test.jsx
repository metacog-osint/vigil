/**
 * The vendor-research page.
 *
 * Fixtures follow the live rows of 26 October 2026: a Talos report whose
 * title matched an actor record literally named "China-nexus", with an open
 * attribution question, and a Securelist report linked to APT41.
 *
 * Every assertion about an absence waits for the page to paint first.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const getOverview = vi.fn()
const getReports = vi.fn()
const getOpenQuestions = vi.fn()
const getLatestRulings = vi.fn()
const ruleLink = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const actual = await vi.importActual('../../lib/supabase/vendorReports')
  return {
    ...actual,
    vendorReports: {
      getOverview: (...a) => getOverview(...a),
      getReports: (...a) => getReports(...a),
      getOpenQuestions: (...a) => getOpenQuestions(...a),
      getLatestRulings: (...a) => getLatestRulings(...a),
      ruleLink: (...a) => ruleLink(...a),
    },
  }
})

import VendorResearch from '../VendorResearch'

const TALOS = {
  id: 'r-talos',
  source: 'talos',
  title: 'China-nexus UAT-11587 targets government and policy organizations across Asia',
  url: 'https://blog.talosintelligence.com/china-nexus-uat-11587/',
  published: '2026-09-30',
  summary: 'Talos has observed UAT-11587 ...',
  attributed_country: null,
  attribution_strength: null,
  attribution_phrase: null,
  attribution_decided_at: null,
  vendor_report_actors: [
    {
      actor_id: 'a-cn',
      matched_name: 'China nexus',
      confirmed: null,
      threat_actors: { id: 'a-cn', name: 'China-nexus', origin_country: null, origin_source: null },
    },
  ],
}

const SECURELIST = {
  id: 'r-sl',
  source: 'securelist',
  title: 'How APT41 revived the BlackLotus bootkit',
  url: 'https://securelist.com/apt41-blacklotus/',
  published: '2026-10-22',
  summary: null,
  attributed_country: 'CN',
  attribution_strength: 'state',
  attribution_phrase: 'a Chinese state-sponsored group',
  attribution_decided_at: '2026-10-27T00:00:00Z',
  vendor_report_actors: [
    {
      actor_id: 'a-41',
      matched_name: 'APT41',
      confirmed: true,
      threat_actors: {
        id: 'a-41',
        name: 'APT41',
        origin_country: 'CN',
        origin_source: 'misp-galaxy',
      },
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <VendorResearch />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getOverview.mockResolvedValue({
    data: {
      reports: 377,
      links: 27,
      linksUnruled: 27,
      attributionRuled: 0,
      questionsOpen: 12,
      bySource: { talos: 35, securelist: 16 },
    },
    error: null,
  })
  getReports.mockResolvedValue({ data: { reports: [TALOS, SECURELIST], total: 377 }, error: null })
  getOpenQuestions.mockResolvedValue({
    data: { [TALOS.url]: { id: 'f-1', phrase: 'China-nexus' } },
    error: null,
  })
  getLatestRulings.mockResolvedValue({ data: {}, error: null })
  ruleLink.mockResolvedValue({ data: {}, error: null })
})

function card(title) {
  return screen.getByText(title).closest('article')
}

describe('a blank attribution is not an answer', () => {
  it('says an unruled report has not been read, never that it names no one', async () => {
    renderPage()
    await screen.findByText(TALOS.title)
    const talos = card(TALOS.title)
    expect(talos).toHaveTextContent(/not yet read by anyone at Vigil/)
    expect(talos).not.toHaveTextContent(/names no country/)
  })

  it('shows a ruled attribution with its strength and the words it rests on', async () => {
    renderPage()
    await screen.findByText(SECURELIST.title)
    const sl = card(SECURELIST.title)
    expect(sl).toHaveTextContent('CN (state)')
    expect(sl).toHaveTextContent('a Chinese state-sponsored group')
  })

  it('points an open attribution question at the review queue', async () => {
    renderPage()
    await screen.findByText(TALOS.title)
    const talos = card(TALOS.title)
    expect(talos).toHaveTextContent('“China-nexus”')
    expect(within(talos).getByRole('link', { name: /review queue/ })).toHaveAttribute(
      'href',
      '/review'
    )
  })
})

describe('proposed links are questions', () => {
  it('shows a name match as proposed, with what it matched on', async () => {
    renderPage()
    await screen.findByText(TALOS.title)
    const talos = card(TALOS.title)
    expect(talos).toHaveTextContent('matched on “China nexus”')
    expect(talos).toHaveTextContent('Proposed, not ruled on')
    expect(talos).toHaveTextContent('no origin on record')
  })

  it('shows a confirmed link, and the actor origin with its source', async () => {
    renderPage()
    await screen.findByText(SECURELIST.title)
    const sl = card(SECURELIST.title)
    expect(sl).toHaveTextContent('Confirmed')
    expect(sl).toHaveTextContent('origin CN per misp-galaxy')
    expect(within(sl).getByRole('link', { name: 'APT41' })).toHaveAttribute('href', '/actors/a-41')
  })

  it('shows a deferral as a ruling, not as nobody having looked', async () => {
    getLatestRulings.mockResolvedValue({
      data: {
        'r-talos:a-cn': {
          verdict: 'deferred',
          rationale: 'Need the full article first.',
          decided_at: '2026-10-27T01:00:00Z',
        },
      },
      error: null,
    })
    renderPage()
    await screen.findByText(/Need the full article first/)
    expect(card(TALOS.title)).toHaveTextContent('Deferred')
  })
})

describe('ruling on a link', () => {
  it('needs a ruling and ten characters of reasoning before it can be recorded', async () => {
    renderPage()
    await screen.findByText(TALOS.title)
    const talos = card(TALOS.title)
    fireEvent.click(within(talos).getByRole('button', { name: 'Rule on this link' }))

    const record = within(talos).getByRole('button', { name: 'Record ruling' })
    expect(record).toBeDisabled()

    fireEvent.click(within(talos).getByLabelText(/Rejected/))
    fireEvent.change(within(talos).getByLabelText(/Reasoning/), { target: { value: 'too short' } })
    expect(record).toBeDisabled()

    fireEvent.change(within(talos).getByLabelText(/Reasoning/), {
      target: { value: 'A descriptive phrase, not a named group.' },
    })
    expect(record).toBeEnabled()
  })

  it('records the ruling with the ids, and reloads', async () => {
    renderPage()
    await screen.findByText(TALOS.title)
    const talos = card(TALOS.title)
    fireEvent.click(within(talos).getByRole('button', { name: 'Rule on this link' }))
    fireEvent.click(within(talos).getByLabelText(/Rejected/))
    fireEvent.change(within(talos).getByLabelText(/Reasoning/), {
      target: { value: '  A descriptive phrase, not a named group.  ' },
    })
    fireEvent.click(within(talos).getByRole('button', { name: 'Record ruling' }))

    await waitFor(() =>
      expect(ruleLink).toHaveBeenCalledWith({
        reportId: 'r-talos',
        actorId: 'a-cn',
        verdict: 'rejected',
        rationale: 'A descriptive phrase, not a named group.',
      })
    )
    await waitFor(() => expect(getReports).toHaveBeenCalledTimes(2))
  })

  it('says when a ruling was not recorded', async () => {
    ruleLink.mockResolvedValue({
      data: null,
      error: { message: 'a ruling must be made by a signed-in reviewer' },
    })
    renderPage()
    await screen.findByText(TALOS.title)
    const talos = card(TALOS.title)
    fireEvent.click(within(talos).getByRole('button', { name: 'Rule on this link' }))
    fireEvent.click(within(talos).getByLabelText(/Confirmed/))
    fireEvent.change(within(talos).getByLabelText(/Reasoning/), {
      target: { value: 'The title names the group.' },
    })
    fireEvent.click(within(talos).getByRole('button', { name: 'Record ruling' }))

    expect(
      await within(talos).findByText(/was not recorded: a ruling must be made/)
    ).toBeInTheDocument()
  })
})

describe('the page around the reports', () => {
  it('shows database counts and states the licence', async () => {
    renderPage()
    expect(await screen.findByText('377')).toBeInTheDocument()
    expect(screen.getByText(/27 not yet ruled on/)).toBeInTheDocument()
    expect(screen.getByText(/registered as not sellable/)).toBeInTheDocument()
    expect(screen.getByText(/Showing 1–2 of 377 reports/)).toBeInTheDocument()
  })

  it('asks for linked reports only when the box is ticked', async () => {
    renderPage()
    await screen.findByText(TALOS.title)
    fireEvent.click(screen.getByLabelText(/Only reports with a proposed actor link/))
    await waitFor(() =>
      expect(getReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ linkedOnly: true, page: 0 })
      )
    )
  })

  it('says the reports did not load instead of showing an empty page', async () => {
    getReports.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    renderPage()
    expect(await screen.findByText(/The reports did not load: timeout/)).toBeInTheDocument()
  })
})
