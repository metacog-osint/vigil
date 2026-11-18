import { describe, it, expect } from 'vitest'
import { adpLine } from '../CisaAdpAssessment'

const row = (exploitation) => ({
  cve_id: 'CVE-2026-0009',
  exploitation,
  assessed_at: '2026-10-27T09:00:00Z',
})

describe("CISA's ADP line on the vulnerability panel (176)", () => {
  it('says active, with the date, and marks a CVE KEV does not list', () => {
    const line = adpLine(row('active'), false)
    expect(line).toMatch(
      /^CISA's ADP assessment: exploitation active \(assessed .*2026.*\); not in CISA's KEV catalog$/
    )
    expect(adpLine(row('active'), true)).not.toMatch(/KEV/)
  })

  it('never calls a poc or none rating anything but what it is', () => {
    expect(adpLine(row('poc'), false)).toMatch(/exploitation poc \(public proof of concept\)/)
    expect(adpLine(row('poc'), false)).not.toMatch(/KEV|exploited/)
    expect(adpLine(row('none'), false)).toMatch(/exploitation none/)
    expect(adpLine(null, false)).toBeNull()
  })
})
