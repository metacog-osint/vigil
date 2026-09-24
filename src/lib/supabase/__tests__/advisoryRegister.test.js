/**
 * The advisory-register query layer.
 *
 * The test that matters most asserts an absence: there is no method that
 * returns red flags, indicators or a typology, because Vigil holds none. The
 * register says a document exists and links to it; what the document tells an
 * institution to look for is inside the PDF and reading it is a person's job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../client', () => ({
  supabase: { from: vi.fn() },
  subscribeToTable: vi.fn(),
}))

import { supabase } from '../client'
import { advisoryRegister, ADVISORY_KINDS, ADVISORY_SOURCES } from '../advisoryRegister'

/** A chainable stub that resolves to whatever the test hands it. */
function stubQuery(result) {
  const chain = {}
  for (const method of [
    'select',
    'order',
    'range',
    'limit',
    'eq',
    'neq',
    'not',
    'is',
    'or',
    'ilike',
  ]) {
    chain[method] = vi.fn(() => chain)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the register holds documents, not indicators', () => {
  it('exposes no method that returns red flags or a typology', () => {
    const inventing = Object.keys(advisoryRegister).filter((m) =>
      /redflag|red_flag|indicators$|typolog|extract|parseDocument/i.test(m)
    )
    expect(inventing).toEqual([])
  })

  it('reads what is outstanding from the review queue rather than recomputing it', async () => {
    const chain = stubQuery({ data: [], count: 29, error: null })
    supabase.from.mockReturnValue(chain)

    const { count } = await advisoryRegister.getQueuedForReading()

    expect(supabase.from).toHaveBeenCalledWith('data_quality_findings')
    expect(chain.eq).toHaveBeenCalledWith('check_name', 'advisory_indicators_unread')
    expect(chain.eq).toHaveBeenCalledWith('status', 'open')
    expect(count).toBe(29)
  })
})

describe('an unreadable queue is not an empty one', () => {
  /**
   * The case this guards. PostgREST answers an RLS-filtered read with an empty
   * set and count 0 rather than a 403 — verified against the live API with the
   * anon key, whose Content-Range header reported a range of zero rows while
   * 29 documents were in fact queued.
   */
  it('returns null, not zero, when the queue reads empty but documents are unread', async () => {
    supabase.from.mockImplementation((table) =>
      table === 'data_quality_findings'
        ? stubQuery({ data: [], count: 0, error: null })
        : stubQuery({ count: 183, error: null })
    )

    const { count } = await advisoryRegister.getQueuedForReading()

    expect(count).toBeNull()
  })

  it('believes a zero when the register agrees there is nothing left to read', async () => {
    supabase.from.mockImplementation((table) =>
      table === 'data_quality_findings'
        ? stubQuery({ data: [], count: 0, error: null })
        : stubQuery({ count: 0, error: null })
    )

    const { count } = await advisoryRegister.getQueuedForReading()

    expect(count).toBe(0)
  })

  it('does not suppress a real count', async () => {
    supabase.from.mockImplementation((table) =>
      table === 'data_quality_findings'
        ? stubQuery({ data: [], count: 29, error: null })
        : stubQuery({ count: 183, error: null })
    )

    const { count } = await advisoryRegister.getQueuedForReading()

    expect(count).toBe(29)
  })
})

describe('a rescinded document is history, not a mistake', () => {
  it('includes rescinded documents unless a caller excludes them', async () => {
    const chain = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(chain)

    await advisoryRegister.getAll()

    expect(chain.eq).not.toHaveBeenCalledWith('rescinded', false)
  })

  it('excludes them only when asked', async () => {
    const chain = stubQuery({ data: [], count: 0, error: null })
    supabase.from.mockReturnValue(chain)

    await advisoryRegister.getAll({ includeRescinded: false })

    expect(chain.eq).toHaveBeenCalledWith('rescinded', false)
  })
})

describe('every figure is a database count', () => {
  it('never reads rows to produce a total', async () => {
    const chain = stubQuery({ count: 183, data: { published: '2007-10-01' }, error: null })
    supabase.from.mockReturnValue(chain)

    await advisoryRegister.getCoverage()

    // The two edge queries read one row each on purpose; everything counted
    // uses head:true so PostgREST's 1,000-row cap cannot understate a total.
    const counting = chain.select.mock.calls.filter((c) => c[1])
    expect(counting.length).toBeGreaterThan(0)
    for (const call of counting) {
      expect(call[1]).toMatchObject({ count: 'exact', head: true })
    }
  })

  it('counts each kind in the database rather than grouping in the client', async () => {
    const chain = stubQuery({ count: 27, error: null })
    supabase.from.mockReturnValue(chain)

    await advisoryRegister.countsByKind()

    for (const call of chain.select.mock.calls) {
      expect(call[1]).toMatchObject({ count: 'exact', head: true })
    }
  })

  it('returns null rather than zero when a count fails', async () => {
    supabase.from.mockReturnValue(stubQuery({ count: null, data: null, error: { message: 'no' } }))

    const { data } = await advisoryRegister.getCoverage()

    expect(data.documents).toBeNull()
    expect(data.indicatorsRead).toBeNull()
    expect(data.earliest).toBeNull()
  })
})

describe('the vocabulary a page renders', () => {
  it('describes every kind the check constraint allows', () => {
    expect(Object.keys(ADVISORY_KINDS).sort()).toEqual(
      ['advisory', 'alert', 'bulletin', 'fact_sheet', 'notice'].sort()
    )
    for (const meta of Object.values(ADVISORY_KINDS)) {
      expect(meta.note).toBeTruthy()
    }
  })

  it('names the authority and the licence, because both are shown', () => {
    expect(ADVISORY_SOURCES.fincen.authority).toMatch(/Treasury/)
    expect(ADVISORY_SOURCES.fincen.licence).toBe('US public domain')
  })
})
