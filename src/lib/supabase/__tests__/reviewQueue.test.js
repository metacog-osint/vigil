/**
 * The review queue is the mechanism Vigil's central claim rests on, so these
 * assert the parts that would quietly undermine it: that a verdict carries
 * its reasoning, that the queue is ordered by how loud a finding is, and
 * that a failed read is not reported as an empty queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { supabase } from '../client'
import { reviewQueue, VERDICTS } from '../reviewQueue'

/** A chainable query whose terminal order() resolves to `result`. */
function queryResolving(result) {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  }
  return q
}

describe('the verdict vocabulary', () => {
  it('offers a way to decline to decide', () => {
    // Without this a reviewer facing thin evidence has only two buttons, and
    // a queue gets cleared by guessing - the thing the queue exists to stop.
    expect(VERDICTS.map((v) => v.value)).toContain('deferred')
  })

  it('offers exactly the three the database accepts', () => {
    expect(VERDICTS.map((v) => v.value).sort()).toEqual(['confirmed', 'deferred', 'rejected'])
  })
})

describe('reviewQueue.getFindings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the joined view, not the raw table', () => {
    supabase.from.mockReturnValue(queryResolving({ data: [], error: null }))
    reviewQueue.getFindings()
    expect(supabase.from).toHaveBeenCalledWith('review_queue')
  })

  it('filters to a status, and does not filter for "all"', async () => {
    const open = queryResolving({ data: [], error: null })
    supabase.from.mockReturnValue(open)
    await reviewQueue.getFindings({ status: 'open' })
    expect(open.eq).toHaveBeenCalledWith('status', 'open')

    const all = queryResolving({ data: [], error: null })
    supabase.from.mockReturnValue(all)
    await reviewQueue.getFindings({ status: 'all' })
    expect(all.eq).not.toHaveBeenCalled()
  })

  it('puts the loudest findings first', async () => {
    supabase.from.mockReturnValue(
      queryResolving({
        data: [
          { id: 'a', severity: 'info' },
          { id: 'b', severity: 'error' },
          { id: 'c', severity: 'warning' },
        ],
        error: null,
      })
    )

    const { data } = await reviewQueue.getFindings()

    expect(data.map((f) => f.severity)).toEqual(['error', 'warning', 'info'])
  })

  it('reports a failed read as an error, never as an empty queue', async () => {
    supabase.from.mockReturnValue(
      queryResolving({ data: null, error: { message: 'permission denied' } })
    )

    const { data, error } = await reviewQueue.getFindings()

    // An empty array here would let the page say "nothing is waiting on a
    // verdict", which is a claim, and a false one.
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })
})

describe('reviewQueue.recordVerdict', () => {
  beforeEach(() => vi.clearAllMocks())

  it('goes through the function, so identity is not the caller to choose', async () => {
    supabase.rpc.mockResolvedValue({ data: {}, error: null })

    await reviewQueue.recordVerdict({
      findingId: 'f-1',
      verdict: 'confirmed',
      rationale: 'Read the source post; it names the victim in the markup.',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('record_verdict', {
      p_finding_id: 'f-1',
      p_verdict: 'confirmed',
      p_rationale: 'Read the source post; it names the victim in the markup.',
    })

    // Nothing in the payload names the reviewer: record_verdict takes that
    // from the JWT.
    const payload = supabase.rpc.mock.calls[0][1]
    expect(Object.keys(payload)).not.toContain('p_decided_by')
  })

  it('passes a failure back rather than swallowing it', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'a verdict needs its reasoning, in at least ten characters' },
    })

    const { error } = await reviewQueue.recordVerdict({
      findingId: 'f-1',
      verdict: 'confirmed',
      rationale: 'no',
    })

    expect(error).toBeTruthy()
  })
})

describe('reviewQueue.getCounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts each status and the total', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn(() =>
        Promise.resolve({
          data: [
            { status: 'open' },
            { status: 'open' },
            { status: 'resolved' },
            { status: 'dismissed' },
          ],
          error: null,
        })
      ),
    })

    const { data } = await reviewQueue.getCounts()

    expect(data.open).toBe(2)
    expect(data.resolved).toBe(1)
    expect(data.dismissed).toBe(1)
    expect(data.all).toBe(4)
  })

  it('returns null rather than zeroes when the read fails', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: null, error: { message: 'nope' } })),
    })

    const { data, error } = await reviewQueue.getCounts()

    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })
})
