import { describe, it, expect } from 'vitest'
import {
  classifySeverity,
  detectIOCType,
  formatNumber,
  truncate,
  parseDate,
  sanitize,
  stringToColor,
} from './utils'

describe('classifySeverity', () => {
  it('returns critical for scores >= 9.0', () => {
    expect(classifySeverity(9.0)).toBe('critical')
    expect(classifySeverity(10.0)).toBe('critical')
    expect(classifySeverity(9.5)).toBe('critical')
  })

  it('returns high for scores >= 7.0 and < 9.0', () => {
    expect(classifySeverity(7.0)).toBe('high')
    expect(classifySeverity(8.9)).toBe('high')
  })

  it('returns medium for scores >= 4.0 and < 7.0', () => {
    expect(classifySeverity(4.0)).toBe('medium')
    expect(classifySeverity(6.9)).toBe('medium')
  })

  it('returns low for scores >= 0.1 and < 4.0', () => {
    expect(classifySeverity(0.1)).toBe('low')
    expect(classifySeverity(3.9)).toBe('low')
  })

  it('returns unknown for null/undefined', () => {
    expect(classifySeverity(null)).toBe('unknown')
    expect(classifySeverity(undefined)).toBe('unknown')
  })
})

describe('detectIOCType', () => {
  it('detects IPv4 addresses', () => {
    expect(detectIOCType('192.168.1.1')).toBe('ip')
    expect(detectIOCType('8.8.8.8')).toBe('ip')
    expect(detectIOCType('192.168.1.1:8080')).toBe('ip')
  })

  it('detects URLs', () => {
    expect(detectIOCType('http://example.com')).toBe('url')
    expect(detectIOCType('https://malware.com/payload.exe')).toBe('url')
  })

  it('detects MD5 hashes', () => {
    expect(detectIOCType('d41d8cd98f00b204e9800998ecf8427e')).toBe('hash_md5')
  })

  it('detects SHA256 hashes', () => {
    expect(detectIOCType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('hash_sha256')
  })

  it('detects domains', () => {
    expect(detectIOCType('example.com')).toBe('domain')
    expect(detectIOCType('malware.evil.com')).toBe('domain')
  })

  it('detects CVE IDs', () => {
    expect(detectIOCType('CVE-2024-1234')).toBe('cve')
    expect(detectIOCType('CVE-2025-12345')).toBe('cve')
  })

  it('detects emails', () => {
    expect(detectIOCType('attacker@evil.com')).toBe('email')
  })

  it('returns unknown for unrecognized patterns', () => {
    expect(detectIOCType('random string')).toBe('unknown')
    expect(detectIOCType('')).toBe('unknown')
    expect(detectIOCType(null)).toBe('unknown')
  })
})

describe('formatNumber', () => {
  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K')
    expect(formatNumber(1500)).toBe('1.5K')
    expect(formatNumber(999999)).toBe('1000.0K')
  })

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M')
    expect(formatNumber(2500000)).toBe('2.5M')
  })

  it('formats billions with B suffix', () => {
    expect(formatNumber(1000000000)).toBe('1.0B')
  })

  it('returns number as-is for small values', () => {
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(0)).toBe('0')
  })

  it('handles null/undefined', () => {
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber(undefined)).toBe('0')
  })
})

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('This is a very long string', 10)).toBe('This is...')
  })

  it('returns short strings unchanged', () => {
    expect(truncate('Short', 10)).toBe('Short')
  })

  it('handles empty/null input', () => {
    expect(truncate('')).toBe('')
    expect(truncate(null)).toBe('')
  })
})

describe('parseDate', () => {
  it('parses ISO date strings', () => {
    const date = parseDate('2024-01-15T10:30:00')
    expect(date).toBeInstanceOf(Date)
    expect(date.getFullYear()).toBe(2024)
  })

  it('parses ransomwatch format', () => {
    const date = parseDate('2024-01-15 10:30:00.123456')
    expect(date).toBeInstanceOf(Date)
  })

  it('returns null for invalid dates', () => {
    expect(parseDate('not a date')).toBe(null)
    expect(parseDate('')).toBe(null)
    expect(parseDate(null)).toBe(null)
  })
})

describe('sanitize', () => {
  it('escapes HTML special characters', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('handles empty input', () => {
    expect(sanitize('')).toBe('')
    expect(sanitize(null)).toBe('')
  })
})

describe('stringToColor', () => {
  it('returns consistent color for same string', () => {
    const color1 = stringToColor('LockBit')
    const color2 = stringToColor('LockBit')
    expect(color1).toBe(color2)
  })

  it('returns different colors for different strings', () => {
    const color1 = stringToColor('LockBit')
    const color2 = stringToColor('BlackCat')
    expect(color1).not.toBe(color2)
  })

  it('returns gray for empty input', () => {
    expect(stringToColor('')).toBe('hsl(0, 0%, 50%)')
    expect(stringToColor(null)).toBe('hsl(0, 0%, 50%)')
  })
})
