/**
 * Reading CISA's SSVC block from a Vulnrichment record (176). The shape below
 * is CVE-2024-3400's CISA-ADP container as published (CC0), trimmed.
 */
import { describe, it, expect } from 'vitest'
import {
  cveFromPath,
  readSsvc,
  worthStoring,
} from '../../../../supabase/functions/_shared/vulnrichment.ts'

const record = (adp) => ({
  cveMetadata: { cveId: 'CVE-2024-3400' },
  containers: { cna: {}, adp },
})

const CISA = {
  title: 'CISA ADP Vulnrichment',
  providerMetadata: { shortName: 'CISA-ADP', dateUpdated: '2024-05-01T15:37:18.613Z' },
  metrics: [
    {
      other: {
        type: 'ssvc',
        content: {
          id: 'CVE-2024-3400',
          role: 'CISA Coordinator',
          options: [
            { Exploitation: 'active' },
            { Automatable: 'yes' },
            { 'Technical Impact': 'total' },
          ],
          version: '2.0.3',
          timestamp: '2024-04-17T04:00:13.543064Z',
        },
      },
    },
    { other: { type: 'kev', content: { dateAdded: '2024-04-12' } } },
  ],
}

describe('readSsvc', () => {
  it('reads all three decision points, the times and the KEV date', () => {
    const row = readSsvc(
      record([{ title: 'CVE Program Container', providerMetadata: { shortName: 'CVE' } }, CISA])
    )
    expect(row).toEqual({
      cve_id: 'CVE-2024-3400',
      exploitation: 'active',
      automatable: 'yes',
      technical_impact: 'total',
      ssvc_version: '2.0.3',
      assessed_at: '2024-04-17T04:00:13.543Z',
      adp_updated_at: '2024-05-01T15:37:18.613Z',
      kev_date_added: '2024-04-12',
    })
  })

  it('leaves kev_date_added null when CISA gives no kev block', () => {
    const noKev = { ...CISA, metrics: [CISA.metrics[0]] }
    expect(readSsvc(record([noKev])).kev_date_added).toBeNull()
  })

  it('returns null without a CISA-ADP container or a known Exploitation value', () => {
    expect(readSsvc(record([]))).toBeNull()
    const odd = JSON.parse(JSON.stringify(CISA))
    odd.metrics[0].other.content.options[0] = { Exploitation: 'probably' }
    expect(readSsvc(record([odd]))).toBeNull()
    expect(
      readSsvc({ cveMetadata: { cveId: 'not-a-cve' }, containers: { adp: [CISA] } })
    ).toBeNull()
  })

  it('drops an unknown secondary value rather than guessing it', () => {
    const odd = JSON.parse(JSON.stringify(CISA))
    odd.metrics[0].other.content.options[1] = { Automatable: 'maybe' }
    expect(readSsvc(record([odd])).automatable).toBeNull()
  })
})

describe('cveFromPath and worthStoring', () => {
  it('names the CVE a record path holds, and nothing else', () => {
    expect(cveFromPath('2024/3xxx/CVE-2024-3400.json')).toBe('CVE-2024-3400')
    expect(cveFromPath('2021/44xxx/CVE-2021-44228.json')).toBe('CVE-2021-44228')
    expect(cveFromPath('README.md')).toBeNull()
    expect(cveFromPath('2024/3xxx/CVE-2024-3400.json.bak')).toBeNull()
  })

  it('stores active and poc, not none', () => {
    expect(worthStoring({ exploitation: 'active' })).toBe(true)
    expect(worthStoring({ exploitation: 'poc' })).toBe(true)
    expect(worthStoring({ exploitation: 'none' })).toBe(false)
  })
})
