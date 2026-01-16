import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  classifySeverity,
  detectIOCType,
  formatNumber,
  truncate,
  parseDate,
  relativeTime,
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

  it('returns none for score of 0', () => {
    expect(classifySeverity(0)).toBe('none')
  })
})

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for recent times', () => {
    const date = new Date('2025-01-15T11:59:30Z') // 30 seconds ago
    expect(relativeTime(date)).toBe('just now')
  })

  it('returns minutes ago for times within the hour', () => {
    const date = new Date('2025-01-15T11:30:00Z') // 30 minutes ago
    expect(relativeTime(date)).toBe('30m ago')
  })

  it('returns hours ago for times within the day', () => {
    const date = new Date('2025-01-15T06:00:00Z') // 6 hours ago
    expect(relativeTime(date)).toBe('6h ago')
  })

  it('returns days ago for times within the week', () => {
    const date = new Date('2025-01-12T12:00:00Z') // 3 days ago
    expect(relativeTime(date)).toBe('3d ago')
  })

  it('returns weeks ago for times within the month', () => {
    const date = new Date('2025-01-01T12:00:00Z') // 2 weeks ago
    expect(relativeTime(date)).toBe('2w ago')
  })

  it('returns months ago for times within the year', () => {
    const date = new Date('2024-11-15T12:00:00Z') // 2 months ago
    expect(relativeTime(date)).toBe('2mo ago')
  })

  it('returns formatted date for times over a year ago', () => {
    const date = new Date('2023-01-15T12:00:00Z') // 2 years ago
    expect(relativeTime(date)).toMatch(/\d+\/\d+\/\d+/)
  })

  it('handles string dates', () => {
    expect(relativeTime('2025-01-15T11:30:00Z')).toBe('30m ago')
  })

  it('returns "Unknown" for null/undefined', () => {
    expect(relativeTime(null)).toBe('Unknown')
    expect(relativeTime(undefined)).toBe('Unknown')
  })

  it('returns "Invalid date" for invalid date strings', () => {
    expect(relativeTime('not a date')).toBe('Invalid date')
  })
})

describe('detectIOCType', () => {
  it('detects IPv4 addresses', () => {
    expect(detectIOCType('192.168.1.1')).toBe('ip')
    expect(detectIOCType('8.8.8.8')).toBe('ip')
    expect(detectIOCType('192.168.1.1:8080')).toBe('ip')
  })

  it('detects IPv6 addresses', () => {
    expect(detectIOCType('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('ip')
  })

  it('detects URLs', () => {
    expect(detectIOCType('http://example.com')).toBe('url')
    expect(detectIOCType('https://malware.com/payload.exe')).toBe('url')
  })

  it('detects MD5 hashes', () => {
    expect(detectIOCType('d41d8cd98f00b204e9800998ecf8427e')).toBe('hash_md5')
  })

  it('detects SHA1 hashes', () => {
    expect(detectIOCType('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('hash_sha1')
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
