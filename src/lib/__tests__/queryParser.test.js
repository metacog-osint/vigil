/**
 * Unit tests for queryParser.js
 */

import { describe, it, expect } from 'vitest'
import {
  parseQuery,
  validateQuery,
  getQuerySuggestions,
} from '../queryParser'

describe('parseQuery', () => {
  describe('basic parsing', () => {
    it('should return null for empty query', () => {
      expect(parseQuery('')).toBe(null)
      expect(parseQuery('   ')).toBe(null)
      expect(parseQuery(null)).toBe(null)
      expect(parseQuery(undefined)).toBe(null)
    })

    it('should parse simple field:value conditions', () => {
      const result = parseQuery('type:ip')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'condition',
        field: 'type',
        operator: 'eq',
        value: 'ip',
      })
    })

    it('should handle field aliases', () => {
      const result = parseQuery('actor:lockbit')
      expect(result[0].field).toBe('name')
      expect(result[0].originalField).toBe('actor')
    })

    it('should parse multiple conditions with AND', () => {
      const result = parseQuery('type:ip country:RU')
      expect(result).toHaveLength(2)
      expect(result[0].booleanOp).toBe('AND')
      expect(result[1].booleanOp).toBe('AND')
    })

    it('should parse explicit AND operator', () => {
      const result = parseQuery('type:ip AND country:RU')
      expect(result).toHaveLength(2)
    })

    it('should parse OR operator', () => {
      const result = parseQuery('type:ip OR type:domain')
      expect(result).toHaveLength(2)
      expect(result[1].booleanOp).toBe('OR')
    })

    it('should parse NOT operator', () => {
      const result = parseQuery('NOT type:ip')
      expect(result).toHaveLength(1)
      expect(result[0].negate).toBe(true)
    })
  })

  describe('comparison operators', () => {
    it('should parse greater than (:>)', () => {
      const result = parseQuery('cvss:>9.0')
      expect(result[0]).toMatchObject({
        field: 'cvss_score',
        operator: 'gt',
        value: 9.0,
      })
    })

    it('should parse greater than or equal (:>=)', () => {
      const result = parseQuery('cvss:>=7.0')
      expect(result[0]).toMatchObject({
        operator: 'gte',
        value: 7.0,
      })
    })

    it('should parse less than (:<)', () => {
      const result = parseQuery('confidence:<50')
      expect(result[0]).toMatchObject({
        operator: 'lt',
        value: 50,
      })
    })

    it('should parse less than or equal (:<=)', () => {
      const result = parseQuery('confidence:<=25')
      expect(result[0]).toMatchObject({
        operator: 'lte',
        value: 25,
      })
    })

    it('should parse not equal (:!)', () => {
      const result = parseQuery('type:!ip')
      expect(result[0]).toMatchObject({
        operator: 'neq',
        value: 'ip',
      })
    })
  })

  describe('value parsing', () => {
    it('should parse boolean values', () => {
      const trueResult = parseQuery('kev:true')
      expect(trueResult[0].value).toBe(true)

      const falseResult = parseQuery('exploited:false')
      expect(falseResult[0].value).toBe(false)
    })

    it('should parse numeric values', () => {
      const result = parseQuery('cvss:9.5')
      expect(result[0].value).toBe(9.5)
    })

    it('should parse integer values', () => {
      const result = parseQuery('confidence:75')
      expect(result[0].value).toBe(75)
    })

    it('should parse date values to ISO format', () => {
      const result = parseQuery('first_seen:>2024-01-01')
      expect(result[0].value).toMatch(/^2024-01-01/)
    })

    it('should parse wildcard contains (*value*)', () => {
      const result = parseQuery('name:*lock*')
      expect(result[0].value).toEqual({
        type: 'contains',
        value: 'lock',
      })
    })

    it('should parse wildcard startsWith (value*)', () => {
      const result = parseQuery('name:lock*')
      expect(result[0].value).toEqual({
        type: 'startsWith',
        value: 'lock',
      })
    })

    it('should parse wildcard endsWith (*value)', () => {
      const result = parseQuery('name:*bit')
      expect(result[0].value).toEqual({
        type: 'endsWith',
        value: 'bit',
      })
    })
  })

  describe('free text search', () => {
    it('should handle free text without field prefix', () => {
      const result = parseQuery('lockbit')
      expect(result[0]).toMatchObject({
        type: 'freetext',
        value: 'lockbit',
      })
    })

    it('should handle mixed conditions and free text', () => {
      const result = parseQuery('type:ip malware')
      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('condition')
      expect(result[1].type).toBe('freetext')
    })
  })

  describe('quoted values', () => {
    it('should handle quoted values with spaces', () => {
      const result = parseQuery('victim:"Acme Corporation"')
      expect(result[0].value).toBe('Acme Corporation')
    })
  })
})

describe('validateQuery', () => {
  it('should validate empty query', () => {
    const result = validateQuery('')
    expect(result.valid).toBe(true)
    expect(result.message).toBe('Empty query matches all')
  })

  it('should validate correct queries', () => {
    const result = validateQuery('type:ip cvss:>7.0')
    expect(result.valid).toBe(true)
    expect(result.parsed).toBeDefined()
  })

  it('should reject unknown fields', () => {
    const result = validateQuery('unknownfield:value')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Unknown field')
  })

  it('should accept known field aliases', () => {
    const result = validateQuery('actor:lockbit')
    expect(result.valid).toBe(true)
  })
})

describe('getQuerySuggestions', () => {
  it('should suggest fields based on entity type', () => {
    const suggestions = getQuerySuggestions('iocs', 'con')
    expect(suggestions.some(s => s.text.startsWith('confidence'))).toBe(true)
  })

  it('should suggest fields for actors entity', () => {
    const suggestions = getQuerySuggestions('actors', 'tr')
    expect(suggestions.some(s => s.text.startsWith('trend'))).toBe(true)
  })

  it('should suggest fields for vulnerabilities', () => {
    const suggestions = getQuerySuggestions('vulnerabilities', 'cv')
    expect(suggestions.some(s => s.text.startsWith('cve') || s.text.startsWith('cvss'))).toBe(true)
  })

  it('should suggest values for known fields', () => {
    const suggestions = getQuerySuggestions('iocs', 'type:')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some(s => s.text.includes('ip'))).toBe(true)
  })

  it('should suggest severity values', () => {
    const suggestions = getQuerySuggestions('vulnerabilities', 'severity:')
    expect(suggestions.some(s => s.text.includes('critical'))).toBe(true)
  })
})

describe('field aliases', () => {
  const aliasTests = [
    ['actor', 'name'],
    ['ip', 'value'],
    ['hash', 'value'],
    ['domain', 'value'],
    ['cve', 'cve_id'],
    ['cvss', 'cvss_score'],
    ['victim', 'victim_name'],
    ['sector', 'target_sectors'],
    ['country', 'origin_country'],
    ['trend', 'trend_status'],
  ]

  aliasTests.forEach(([alias, expectedField]) => {
    it(`should map "${alias}" to "${expectedField}"`, () => {
      const result = parseQuery(`${alias}:test`)
      expect(result[0].field).toBe(expectedField)
    })
  })
})

describe('complex queries', () => {
  it('should parse multi-condition AND/OR query', () => {
    const result = parseQuery('type:ip AND country:RU OR country:CN')
    expect(result).toHaveLength(3)
    expect(result[0].booleanOp).toBe('AND')
    expect(result[1].booleanOp).toBe('AND')
    expect(result[2].booleanOp).toBe('OR')
  })

  it('should parse query with numeric comparison and boolean', () => {
    const result = parseQuery('cvss:>=9.0 AND kev:true')
    expect(result).toHaveLength(2)
    expect(result[0].value).toBe(9.0)
    expect(result[0].operator).toBe('gte')
    expect(result[1].value).toBe(true)
  })

  it('should parse real-world IOC query', () => {
    const result = parseQuery('type:ip confidence:>75 first_seen:>2024-01-01')
    expect(result).toHaveLength(3)
    expect(result[0].field).toBe('type')
    expect(result[1].field).toBe('confidence')
    expect(result[1].operator).toBe('gt')
  })

  it('should parse real-world vulnerability query', () => {
    const result = parseQuery('cvss:>=9.0 kev:true vendor:*cisco*')
    expect(result).toHaveLength(3)
    expect(result[2].value).toEqual({ type: 'contains', value: 'cisco' })
  })
})
