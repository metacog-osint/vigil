/**
 * The page itself. These cover the behaviours that make the review queue
 * worth having: that a finding arrives with its evidence, that a verdict
 * cannot be recorded without a reason, and that nothing here ever claims an
 * empty queue it has not actually read.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const recordVerdict = vi.fn()
const getFindings = vi.fn()
const getCounts = vi.fn()

vi.mock('../../lib/supabase/reviewQueue', () => ({
  reviewQueue: {
    getFindings: (...a) => getFindings(...a),
    getCounts: (...a) => getCounts(...a),
    recordVerdict: (...a) => recordVerdict(...a),
  },
  VERDICTS: [
    { value: 'confirmed', label: 'Confirmed', summary: 'The finding is real.' },
    { value: 'rejected', label: 'Not a problem', summary: 'The check read this wrongly.' },
    {
      value: 'deferred',
      label: 'Not enough evidence',
      summary: 'Stays queued, with the reason on the record.',
    },
  ],
}))

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

import ReviewQueue from '../ReviewQueue'

const FINDING = {
  id: 'f-1',
  check_name: 'leak_site_notice_candidate',
  subject: 'ciphbit / Affiliate',
  severity: 'warning',
  status: 'open',
  details: {
    question: 'Is this post a victim claim, or something else on the same leak site?',
    instruction: 'Read the source post before deciding; titles alone have been wrong both ways',
    posted_on: '2026-02-10',
  },
  first_seen: '2026-09-20T00:00:00Z',
  latest_verdict: null,
  verdict_count: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ user: { id: 'u-1' }, loading: false })
  getFindings.mockResolvedValue({ data: [FINDING], error: null })
  getCounts.mockResolvedValue({ data: { open: 1, resolved: 0, dismissed: 0, all: 1 }, error: null })
})

describe('ReviewQueue', () => {
  it('shows the finding with the question the check asked', async () => {
    render(<ReviewQueue />)

    expect(await screen.findByText('ciphbit / Affiliate')).toBeTruthy()
    expect(screen.getByText(/Is this post a victim claim, or something else/)).toBeTruthy()
  })

  it('shows evidence the page was never told about', async () => {
    render(<ReviewQueue />)

    // posted_on is not in the page's list of known keys. A finding is
    // evidence, and dropping part of it to keep the layout tidy would
    // defeat the point.
    await screen.findByText('ciphbit / Affiliate')
    expect(screen.getByText('Posted on')).toBeTruthy()
    expect(screen.getByText('2026-02-10')).toBeTruthy()
  })

  it('will not record a verdict without a reason', async () => {
    render(<ReviewQueue />)
    await screen.findByText('ciphbit / Affiliate')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }))

    const submit = screen.getByRole('button', { name: /Record verdict/ })
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'too short' } })
    expect(screen.getByRole('button', { name: /Record verdict/ }).disabled).toBe(true)

    expect(recordVerdict).not.toHaveBeenCalled()
  })

  it('records the verdict with its reasoning', async () => {
    recordVerdict.mockResolvedValue({ data: {}, error: null })

    render(<ReviewQueue />)
    await screen.findByText('ciphbit / Affiliate')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Read the source post; it names the victim in the markup.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Record verdict/ }))

    await waitFor(() =>
      expect(recordVerdict).toHaveBeenCalledWith({
        findingId: 'f-1',
        verdict: 'confirmed',
        rationale: 'Read the source post; it names the victim in the markup.',
      })
    )
  })

  it('surfaces a refusal from the database instead of pretending it saved', async () => {
    recordVerdict.mockResolvedValue({
      data: null,
      error: { message: 'a verdict needs its reasoning, in at least ten characters' },
    })

    render(<ReviewQueue />)
    await screen.findByText('ciphbit / Affiliate')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmed' }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A reason long enough to pass the client check.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Record verdict/ }))

    expect(await screen.findByText(/a verdict needs its reasoning/)).toBeTruthy()
  })

  it('says a failed read is a failed read, not an empty queue', async () => {
    getFindings.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    render(<ReviewQueue />)

    expect(await screen.findByText(/permission denied/)).toBeTruthy()
    expect(screen.getByText(/not an empty queue/i)).toBeTruthy()
    expect(screen.queryByText(/Nothing is waiting on a verdict/)).toBeNull()
  })

  it('does not claim an empty queue to someone who is not signed in', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<ReviewQueue />)

    expect(await screen.findByText(/readable by signed-in reviewers/)).toBeTruthy()
    expect(screen.queryByText(/Nothing is waiting on a verdict/)).toBeNull()
    // and it must not have gone looking with no reader
    expect(getFindings).not.toHaveBeenCalled()
  })

  it('shows a verdict already recorded, with its reasoning', async () => {
    getFindings.mockResolvedValue({
      data: [
        {
          ...FINDING,
          status: 'resolved',
          latest_verdict: 'confirmed',
          latest_rationale: 'The source post names the victim inside the markup.',
          latest_decided_at: '2026-09-20T12:00:00Z',
          verdict_count: 2,
        },
      ],
      error: null,
    })

    render(<ReviewQueue />)

    expect(
      await screen.findByText('The source post names the victim inside the markup.')
    ).toBeTruthy()
    // the history is kept, and the page says so
    expect(screen.getByText(/2 rulings on this finding/)).toBeTruthy()
  })
})
