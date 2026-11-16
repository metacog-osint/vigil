/**
 * The reading evidence on a review card (172), kind by kind. What matters: it
 * shows what Vigil holds, and says plainly when it holds nothing, so a missing
 * link or sentence is never mistaken for a checked one.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase/reviewQueue', () => ({ reviewQueue: {}, VERDICTS: [] }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))

import { ReadingEvidence } from '../ReviewQueue'

function show(kind, evidence) {
  return render(
    <MemoryRouter>
      <ReadingEvidence kind={kind} evidence={evidence} />
    </MemoryRouter>
  )
}

describe('ReadingEvidence', () => {
  it('quotes the report sentences holding the phrase, and links the report', () => {
    show('vendor_attribution_candidate', {
      phrase: 'Chinese speaking',
      title: 'A report',
      url: 'https://v/1',
      sentences: ['The operators are Chinese speaking.'],
    })
    expect(screen.getByText('The operators are Chinese speaking.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'A report' })).toHaveAttribute('href', 'https://v/1')
  })

  it('says the phrase is only in the title when no sentence holds it', () => {
    show('vendor_attribution_candidate', {
      phrase: 'Traced to',
      title: 'Activity Traced to Iran',
      url: 'https://v/2',
      sentences: [],
    })
    expect(
      screen.getByText(/The phrase is in the title, not the stored summary/)
    ).toBeInTheDocument()
  })

  it('shows a claim value and warns that no primary source link is stored', () => {
    show('claim_value_unverified', {
      question: 'How much moved?',
      value_numeric: 400,
      unit: 'USD',
      publisher: 'Chainalysis',
      publisher_tier: '2',
      citation: 'endnote [21]',
      source_url: null,
    })
    expect(screen.getByText(/400 USD/)).toBeInTheDocument()
    expect(screen.getByText(/No primary-source link is stored/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('links the primary source when one is stored', () => {
    show('claim_value_unverified', { value_text: 'more than 400%', source_url: 'https://p/1' })
    expect(screen.getByRole('link', { name: 'https://p/1' })).toHaveAttribute('href', 'https://p/1')
  })

  it('links an advisory document and the reading page', () => {
    show('advisory_indicators_unread', {
      source: 'fincen',
      advisory_id: 'FIN-2020-A003',
      title: 'Advisory',
      published: '2020-07-07',
      document_url: 'https://f/en.pdf',
    })
    expect(screen.getByRole('link', { name: 'Open the document' })).toHaveAttribute(
      'href',
      'https://f/en.pdf'
    )
    expect(screen.getByRole('link', { name: 'All advisories waiting to be read' })).toHaveAttribute(
      'href',
      '/review/reading'
    )
  })

  it('renders nothing for other kinds or without evidence', () => {
    const { container } = show('victim_country_disagreement', { anything: 1 })
    expect(container).toBeEmptyDOMElement()
    const empty = show('claim_value_unverified', undefined)
    expect(empty.container).toBeEmptyDOMElement()
  })
})
