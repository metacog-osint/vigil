import { describe, expect, it } from 'vitest'
import {
  EXTRA_FORMS,
  INSIDE_WORDS,
  inferSector,
  inferSectorBySubstring,
  SECTOR_KEYWORDS,
} from '../victimSector.js'
import { toIncident } from '../../feeds/ransomlook.js'

describe('victim sector from the name', () => {
  it('no longer reads a keyword inside another word (the names the 23 Nov 2026 review found)', () => {
    const cases = {
      'Midwest Soils': ['energy', null],
      'Associated Gastroenterologists': ['energy', null],
      'Magasin Dupont': ['energy', null],
      'Acme Biotechnology': ['technology', null],
      eMarketer: ['retail', null],
      Shopify: ['retail', null],
      'Powerhouse Gym': ['energy', null],
      'Aimbridge Hospitality': ['healthcare', null],
      'Accredited Builders': ['finance', null],
      'Las Vegas Sands': ['energy', null],
      'Precision Workshop': ['retail', null],
      'Northwestern Polytechnic': ['technology', null],
    }
    for (const [name, [before, now]] of Object.entries(cases)) {
      expect(inferSectorBySubstring(name), name).toBe(before)
      expect(inferSector(name), name).toBe(now)
    }
  })

  it('still reads the keyword as a whole word, in any case, between punctuation', () => {
    expect(inferSector('St. Mary’s Hospital')).toBe('healthcare')
    expect(inferSector('NORTHWEST HEALTH-CARE')).toBe('healthcare')
    expect(inferSector('First National Bank')).toBe('finance')
    expect(inferSector('City of Springfield')).toBe('government')
    expect(inferSector('City  of  Springfield')).toBe('government')
    expect(inferSector('Lake County')).toBe('government')
    expect(inferSector('Acme Tech')).toBe('technology')
    expect(inferSector('healthcare.com')).toBe('healthcare')
    expect(inferSector('Gulf Oil & Gas')).toBe('energy')
  })

  it('reads plurals and the forms the shorter keyword used to catch on purpose', () => {
    expect(inferSector('Valley Hospitals')).toBe('healthcare')
    expect(inferSector('Three Counties Council')).toBe('government')
    expect(inferSector('Riverside Utilities')).toBe('energy')
    expect(inferSector('Nova Pharmaceuticals')).toBe('healthcare')
    expect(inferSector('Corner Pharmacy')).toBe('healthcare')
    expect(inferSector('Orbit Technologies')).toBe('technology')
    expect(inferSector('Fresh Supermarkets')).toBe('retail')
    expect(inferSector('Online Banking Group')).toBe('finance')
    // Each extra form contains its sector's own keyword, so it adds nothing the old rule missed.
    for (const [sector, forms] of Object.entries(EXTRA_FORMS)) {
      for (const form of forms) {
        expect(
          SECTOR_KEYWORDS[sector].some((kw) => form.includes(kw)),
          form
        ).toBe(true)
      }
    }
  })

  it('treats a letter or digit in any script as part of the word', () => {
    expect(inferSectorBySubstring('Großbank AG')).toBe('finance')
    expect(inferSector('Großbank AG')).toBeNull()
    expect(inferSector('Gas2Go')).toBeNull()
    expect(inferSector('Banque Bank')).toBe('finance')
  })

  it('keeps the sector order: the first sector with a whole-word match wins', () => {
    expect(inferSector('Health Insurance Bank')).toBe('healthcare')
    expect(inferSector('Acme Biotechnology Bank')).toBe('finance')
    expect(inferSector('Software Store')).toBe('technology')
  })

  it('still finds the distinctive keywords inside a run-together name or a domain', () => {
    const kept = {
      UCHealth: 'healthcare',
      'shannonhealth.com': 'healthcare',
      'Siemens Healthineers': 'healthcare',
      'risingpharma.com': 'healthcare',
      'Clinica Suiza Lab': 'healthcare',
      'megastarfinancial.com': 'finance',
      'dorsiacademy.it': 'education',
      'Municipalidad de Cieneguilla': 'government',
      SoftwareOne: 'technology',
      'www.retailinmotion.com': 'retail',
    }
    for (const [name, sector] of Object.entries(kept)) {
      expect(inferSectorBySubstring(name), name).toBe(sector)
      expect(inferSector(name), name).toBe(sector)
    }
    // Each one is a keyword of the rule, not a new word.
    const all = new Set(Object.values(SECTOR_KEYWORDS).flat())
    for (const w of INSIDE_WORDS) expect(all.has(w), w).toBe(true)
    // The short or common keywords stay whole words.
    for (const w of [
      'hospital',
      'credit',
      'gas',
      'oil',
      'tech',
      'bank',
      'shop',
      'market',
      'power',
    ]) {
      expect(INSIDE_WORDS.has(w), w).toBe(false)
    }
  })

  it('gives none for no name, and for names with no sector word', () => {
    expect(inferSector(null)).toBeNull()
    expect(inferSector('')).toBeNull()
    expect(inferSector('Company #12')).toBeNull()
    expect(inferSectorBySubstring(undefined)).toBeNull()
  })

  it('is what the RansomLook feed writes', () => {
    const post = { post_title: 'Midwest Soils', group_name: 'x', discovered: '2026-11-20 10:00:00' }
    expect(toIncident(post, {}).victim_sector).toBeNull()
    expect(toIncident({ ...post, post_title: 'Lake County' }, {}).victim_sector).toBe('government')
  })
})
