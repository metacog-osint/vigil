// @vitest-environment node
/**
 * cisa-kev only ever upserted, so an entry CISA removed stayed KEV in Vigil for
 * good (CVE-2026-69836, added 21 Aug 2026, gone from catalogue 2026.11.18).
 * After a complete run the job hands the full list to reconcile_kev_catalog
 * (migration 180); after a failed batch it must not.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ingestCISAKEV } from '../cisa-kev.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const catalogue = (n) => ({
  catalogVersion: '2026.11.18',
  vulnerabilities: Array.from({ length: n }, (_, i) => ({
    cveID: `CVE-2026-${1000 + i}`,
    dateAdded: '2026-11-18',
    dueDate: '2026-12-09',
    knownRansomwareCampaignUse: 'Unknown',
  })),
})

const fakeDb = ({ upsertError = null, rpcResult = { cleared: 0, cve_ids: [] } } = {}) => {
  const rpc = vi.fn(() => Promise.resolve({ data: rpcResult, error: null }))
  return {
    rpc,
    from: () => ({
      upsert: () => Promise.resolve({ error: upsertError, inserted: [] }),
    }),
  }
}

const stubFetch = (body) =>
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })))

describe('ingestCISAKEV reconcile', () => {
  it('sends every catalogue id and the catalogue version after a complete run', async () => {
    stubFetch(catalogue(600))
    const db = fakeDb({ rpcResult: { cleared: 1, cve_ids: ['CVE-2026-69836'] } })
    const out = await ingestCISAKEV(db)
    expect(db.rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = db.rpc.mock.calls[0]
    expect(fn).toBe('reconcile_kev_catalog')
    expect(args.p_cve_ids).toHaveLength(600)
    expect(args.p_catalog_version).toBe('2026.11.18')
    expect(out.success).toBe(true)
    expect(out.reconcile.cleared).toBe(1)
  })

  it('does not reconcile when a batch failed', async () => {
    stubFetch(catalogue(300))
    const db = fakeDb({ upsertError: { message: 'boom' } })
    const out = await ingestCISAKEV(db)
    expect(db.rpc).not.toHaveBeenCalled()
    expect(out.failed).toBe(300)
    expect(out.reconcile).toBeNull()
  })

  it('reports a reconcile error without failing the job', async () => {
    stubFetch(catalogue(10))
    const db = fakeDb()
    db.rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: 'refusing' } }))
    const out = await ingestCISAKEV(db)
    expect(out.success).toBe(true)
    expect(out.reconcile).toEqual({ error: 'refusing' })
  })
})
