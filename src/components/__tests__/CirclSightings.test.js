import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ vulnerabilities: {} }))

import { groupSightings } from '../CirclSightings'
import { classifySighting, windowEnd } from '../../../supabase/functions/_shared/circlSightings.ts'

const base = {
  type: 'exploited',
  vulnerability: 'CVE-2026-12345',
  creation_timestamp: '2026-11-20T00:00:00+00:00',
  vulnerability_lookup_origin: '1a89b78e-f703-45f3-bb86-59eb712668bd',
}
const entry = 'https://vulnerability.circl.lu/known-exploited-vulnerabilities-catalog/abc'

describe('classifySighting', () => {
  it('keeps Shadowserver honeypots, as text and as a catalogue entry', () => {
    const text = classifySighting({
      ...base,
      source: 'The Shadowserver (honeypot/exploited-vulnerabilities) - (2026-11-20)',
    })
    const catalogue = classifySighting({
      ...base,
      source: entry,
      vulnerability_lookup_origin: 'c8fb6bf1-f81f-4cb8-95b1-eadbb3b54ee8',
    })
    expect(text.row.source_class).toBe('honeypot')
    expect(catalogue.row.source_name).toBe(text.row.source_name)
  })

  it.each([
    ['caeb2787-0d58-4236-9039-7c86c3e566f3', 'previdian'],
    ['1a89b78e-f703-45f3-bb86-59eb712668bd', 'circl_combined'],
    ['405284c2-e461-4670-8979-7fd2c9755a60', 'cisa_catalogue'],
    ['fc16d4f5-594d-5807-9bf1-71af4407c589', 'siberkapan'],
    ['00000000-0000-0000-0000-000000000000', 'unlisted_catalogue'],
  ])('leaves out catalogue %s', (origin, reason) => {
    expect(
      classifySighting({ ...base, source: entry, vulnerability_lookup_origin: origin }).excluded
    ).toBe(reason)
  })

  it('leaves out anything naming VulnCheck and any unlisted host', () => {
    expect(classifySighting({ ...base, source: 'https://vulncheck.com/x' }).excluded).toBe(
      'vulncheck'
    )
    expect(classifySighting({ ...base, source: 'https://example.org/x' }).excluded).toBe(
      'unlisted_source'
    )
  })

  it('names social sources by platform, with no link', () => {
    const { row } = classifySighting({ ...base, source: 'https://t.me/SomeChannel/1' })
    expect(row).toMatchObject({
      source_class: 'social_code',
      source_name: 'Telegram',
      source_link: '',
    })
  })

  it('keeps a vendor link without its query string', () => {
    const { row } = classifySighting({
      ...base,
      source: 'https://www.securelist.com/post/?utm=x#top',
    })
    expect(row).toMatchObject({
      source_class: 'vendor_press',
      source_name: 'securelist.com',
      source_link: 'https://www.securelist.com/post/',
    })
  })

  it('rejects other types and ids that are not CVEs', () => {
    expect(classifySighting({ ...base, type: 'seen', source: 'x' }).excluded).toBe(
      'not_exploited_type'
    )
    expect(classifySighting({ ...base, vulnerability: 'GHSA-1', source: 'x' }).excluded).toBe(
      'not_a_cve'
    )
  })
})

describe('windowEnd', () => {
  it('spans 30 days and never passes today', () => {
    expect(windowEnd('2026-01-01', '2026-11-21')).toBe('2026-01-30')
    expect(windowEnd('2026-11-10', '2026-11-21')).toBe('2026-11-21')
  })
})

describe('groupSightings', () => {
  it('keeps classes apart, strongest first', () => {
    const groups = groupSightings([
      { source_class: 'social_code', source_name: 'Telegram' },
      { source_class: 'honeypot', source_name: 'Shadowserver honeypots' },
    ])
    expect(groups.map((g) => g.key)).toEqual(['honeypot', 'social_code'])
  })
})
