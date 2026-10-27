import { describe, expect, it } from 'vitest'
import { parseAliases } from '../vendors'

describe('parseAliases: the "Also trades as" field', () => {
  it('splits on commas and new lines, and trims', () => {
    expect(parseAliases(' Symitar, ProfitStars\nBanno ')).toEqual([
      'Symitar',
      'ProfitStars',
      'Banno',
    ])
  })

  it('drops empties and repeats, whatever their case', () => {
    expect(parseAliases('Banno,, banno ,BANNO,')).toEqual(['Banno'])
  })

  it('treats nothing as no aliases', () => {
    expect(parseAliases('')).toEqual([])
    expect(parseAliases(null)).toEqual([])
  })
})
