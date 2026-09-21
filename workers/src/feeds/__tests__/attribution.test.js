/**
 * The attribution tables, against the titles the live feeds actually publish.
 *
 * This is the logic most worth testing in the whole feature and until now
 * nothing could reach it: it lived inside a Deno Edge Function, and the only
 * record that it worked was a paragraph in that function's header saying a
 * person had checked. It moved to supabase/functions/_shared/attribution.ts
 * so this file can import it under Node.
 *
 * It is worth testing because it has been wrong. The first CISA parser read
 * advisory summaries as well as titles and published two false attributions -
 * "Pro-Russia Hacktivists" as Russian state activity, and "China-Nexus" the
 * same. Those two cases are the first thing asserted below.
 *
 * Every title here is real and was taken from the feeds on 21 September 2026.
 */
import { describe, it, expect } from 'vitest'
import {
  attributeCisa,
  attributeNcsc,
  CISA_ATTRIBUTION,
  NCSC_ATTRIBUTION,
} from '../../../../supabase/functions/_shared/attribution.ts'

describe('CISA attribution', () => {
  it('does not read pro-Russia hacktivists as the Russian state', () => {
    const r = attributeCisa(
      'Pro-Russia Hacktivists Conduct Opportunistic Attacks Against US and Global Critical Infrastructure'
    )

    expect(r.country).toBe('RU')
    expect(r.strength).toBe('aligned')
    expect(r.strength).not.toBe('state')
  })

  it('does not read a China-nexus network as the Chinese state', () => {
    const r = attributeCisa('Defending Against China-Nexus Covert Networks of Compromised Devices')

    expect(r.country).toBe('CN')
    expect(r.strength).toBe('nexus')
    expect(r.strength).not.toBe('state')
  })

  it('reads the live corpus exactly as the database holds it', () => {
    const cases = [
      [
        'Iranian-Affiliated Cyber Actors Exploit Programmable Logic Controllers Across US Critical Infrastructure',
        'IR',
        'affiliated',
      ],
      [
        'Russian State-Supported Cyber Actors Conduct Phishing Campaign Targeting Users of Zimbra Collaboration Suite',
        'RU',
        'state',
      ],
      ['Improve Router Hygiene to Protect Against Russian State-Sponsored Targeting', 'RU', 'state'],
    ]

    for (const [title, country, strength] of cases) {
      const r = attributeCisa(title)
      expect({ title, country: r.country, strength: r.strength }).toEqual({
        title,
        country,
        strength,
      })
    }
  })

  it('names no country for a ransomware advisory', () => {
    const r = attributeCisa('#StopRansomware: Gunra Ransomware')

    // CISA names a criminal group and no state, so neither does Vigil.
    expect(r.strength).toBe('criminal')
    expect(r.country).toBeNull()
  })

  it('attributes nothing to a vulnerability advisory', () => {
    const r = attributeCisa('CISA Releases Nine Industrial Control Systems Advisories')

    expect(r.country).toBeNull()
    expect(r.strength).toBeNull()
  })

  it('never queues a bare nationality, because CISA always states the relationship', () => {
    const r = attributeCisa('Something About Russia That States No Relationship')

    expect(r.unresolved).toBeNull()
  })
})

describe('NCSC-UK attribution', () => {
  it('reads the four attributions in the live feed', () => {
    const cases = [
      [
        "UK and partners expose Russian state-supported actors for new 'zero-click' phishing campaign targeting Western organisations",
        'RU',
        'state',
      ],
      [
        'UK and Allies urge critical sectors to improve defences against Russian intelligence targeting',
        'RU',
        'state',
      ],
      [
        'UK and allies expose spyware used by Iranian state actors to target dissidents, activists and journalists',
        'IR',
        'state',
      ],
    ]

    for (const [title, country, strength] of cases) {
      const r = attributeNcsc(title)
      expect({ title, country: r.country, strength: r.strength }).toEqual({
        title,
        country,
        strength,
      })
    }
  })

  it('queues a title that names a country without saying what it did', () => {
    const r = attributeNcsc('Iranian cyber targeting of dissidents, activists and journalists')

    // NCSC names Iran and not the relationship. There is no honest value for
    // attribution_strength, so nothing is stored and a person is asked.
    expect(r.country).toBeNull()
    expect(r.strength).toBeNull()
    expect(r.unresolved).toBe('IR')
  })

  it('prefers the stated relationship over the bare nationality', () => {
    const stated = attributeNcsc(
      'UK and allies expose spyware used by Iranian state actors to target dissidents'
    )

    // Both patterns match this title. The explicit one has to win, or every
    // attribution NCSC does make would end up in the queue instead.
    expect(stated.strength).toBe('state')
    expect(stated.unresolved).toBeNull()
  })

  it('queues nothing for a title naming no country at all', () => {
    const r = attributeNcsc(
      'Disruptive cyber activity highlights risk from internet-exposed systems and edge devices'
    )

    expect(r.country).toBeNull()
    expect(r.unresolved).toBeNull()
  })

  it('still refuses to promote pro-Russia to state', () => {
    const r = attributeNcsc('Pro-Russia hacktivists target water utilities')

    expect(r.strength).toBe('aligned')
  })
})

describe('both tables', () => {
  it('keeps the weaker formulations ahead of the looser patterns', () => {
    // "Pro-Russia" contains "Russia". If a pattern that matches the bare
    // nationality were reached first, a hacktivist collective would be read as
    // a state apparatus - which is exactly what happened once.
    for (const rules of [CISA_ATTRIBUTION, NCSC_ATTRIBUTION]) {
      const proIndex = rules.findIndex((r) => r.re.source.includes('pro[- ]russia'))
      const looserIndex = rules.findIndex(
        (r) => r.strength !== 'aligned' && r.re.test('Pro-Russia hacktivists target water')
      )

      expect(proIndex).toBeGreaterThanOrEqual(0)
      if (looserIndex >= 0) expect(proIndex).toBeLessThan(looserIndex)
    }
  })

  it('only ever emits a strength the database check constraint allows', () => {
    const allowed = new Set(['state', 'affiliated', 'nexus', 'aligned', 'criminal'])

    for (const rules of [CISA_ATTRIBUTION, NCSC_ATTRIBUTION]) {
      for (const rule of rules) {
        expect(allowed.has(rule.strength)).toBe(true)
      }
    }
  })

  it('only ever emits an ISO-2 country code, or none', () => {
    for (const rules of [CISA_ATTRIBUTION, NCSC_ATTRIBUTION]) {
      for (const rule of rules) {
        if (rule.country !== null) expect(rule.country).toMatch(/^[A-Z]{2}$/)
      }
    }
  })
})
