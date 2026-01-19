/**
 * Tests for utility functions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  classifySeverity,
  detectIOCType,
  formatNumber,
  truncate,
  parseDate,
  relativeTime,
  sanitize,
  stringToColor,
} from '../utils'

describe('utils', () => {
  describe('classifySeverity', () => {
    it('should return critical for scores >= 9.0', () => {
      expect(classifySeverity(9.0)).toBe('critical')
      expect(classifySeverity(9.5)).toBe('critical')
      expect(classifySeverity(10.0)).toBe('critical')
    })

    it('should return high for scores >= 7.0 and < 9.0', () => {
      expect(classifySeverity(7.0)).toBe('high')
      expect(classifySeverity(8.0)).toBe('high')
      expect(classifySeverity(8.9)).toBe('high')
    })

    it('should return medium for scores >= 4.0 and < 7.0', () => {
      expect(classifySeverity(4.0)).toBe('medium')
      expect(classifySeverity(5.5)).toBe('medium')
      expect(classifySeverity(6.9)).toBe('medium')
    })

    it('should return low for scores >= 0.1 and < 4.0', () => {
      expect(classifySeverity(0.1)).toBe('low')
      expect(classifySeverity(2.0)).toBe('low')
      expect(classifySeverity(3.9)).toBe('low')
    })

    it('should return none for score 0', () => {
      expect(classifySeverity(0)).toBe('none')
    })

    it('should return unknown for null or undefined', () => {
      expect(classifySeverity(null)).toBe('unknown')
      expect(classifySeverity(undefined)).toBe('unknown')
    })
  })

  describe('detectIOCType', () => {
    it('should detect IPv4 addresses', () => {
      expect(detectIOCType('192.168.1.1')).toBe('ip')
      expect(detectIOCType('8.8.8.8')).toBe('ip')
      expect(detectIOCType('10.0.0.1')).toBe('ip')
    })

    it('should detect IPv4 with port', () => {
      expect(detectIOCType('192.168.1.1:8080')).toBe('ip')
      expect(detectIOCType('8.8.8.8:443')).toBe('ip')
    })

    it('should detect IPv6 addresses', () => {
      expect(detectIOCType('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('ip')
    })

    it('should detect URLs', () => {
      expect(detectIOCType('https://example.com')).toBe('url')
      expect(detectIOCType('http://malware.site/path')).toBe('url')
      expect(detectIOCType('https://test.com/path?query=1')).toBe('url')
    })

    it('should detect MD5 hashes', () => {
      expect(detectIOCType('d41d8cd98f00b204e9800998ecf8427e')).toBe('hash_md5')
      expect(detectIOCType('D41D8CD98F00B204E9800998ECF8427E')).toBe('hash_md5')
    })

    it('should detect SHA1 hashes', () => {
      expect(detectIOCType('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('hash_sha1')
    })

    it('should detect SHA256 hashes', () => {
      expect(
        detectIOCType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
      ).toBe('hash_sha256')
    })

    it('should detect email addresses', () => {
      expect(detectIOCType('user@example.com')).toBe('email')
      expect(detectIOCType('test.user@subdomain.example.org')).toBe('email')
    })

    it('should detect CVE IDs', () => {
      expect(detectIOCType('CVE-2024-1234')).toBe('cve')
      expect(detectIOCType('cve-2023-12345')).toBe('cve')
    })

    it('should detect domains', () => {
      expect(detectIOCType('example.com')).toBe('domain')
      expect(detectIOCType('subdomain.example.org')).toBe('domain')
      expect(detectIOCType('malware-site.co.uk')).toBe('domain')
    })

    it('should return unknown for invalid values', () => {
      expect(detectIOCType('')).toBe('unknown')
      expect(detectIOCType(null)).toBe('unknown')
      expect(detectIOCType(undefined)).toBe('unknown')
      expect(detectIOCType('random text')).toBe('unknown')
      expect(detectIOCType(123)).toBe('unknown')
    })

    it('should trim whitespace before detection', () => {
      expect(detectIOCType('  192.168.1.1  ')).toBe('ip')
      expect(detectIOCType('\nexample.com\t')).toBe('domain')
    })
  })

  describe('formatNumber', () => {
    it('should format billions with B suffix', () => {
      expect(formatNumber(1000000000)).toBe('1.0B')
      expect(formatNumber(2500000000)).toBe('2.5B')
    })

    it('should format millions with M suffix', () => {
      expect(formatNumber(1000000)).toBe('1.0M')
      expect(formatNumber(1500000)).toBe('1.5M')
    })

    it('should format thousands with K suffix', () => {
      expect(formatNumber(1000)).toBe('1.0K')
      expect(formatNumber(2500)).toBe('2.5K')
    })

    it('should return plain number for values under 1000', () => {
      expect(formatNumber(999)).toBe('999')
      expect(formatNumber(500)).toBe('500')
      expect(formatNumber(1)).toBe('1')
    })

    it('should return 0 for null or undefined', () => {
      expect(formatNumber(null)).toBe('0')
      expect(formatNumber(undefined)).toBe('0')
    })
  })

  describe('truncate', () => {
    it('should truncate text longer than maxLength', () => {
      expect(truncate('This is a very long text', 10)).toBe('This is...')
      expect(truncate('Hello World', 8)).toBe('Hello...')
    })

    it('should not truncate text shorter than maxLength', () => {
      expect(truncate('Short', 10)).toBe('Short')
      expect(truncate('Hello', 5)).toBe('Hello')
    })

    it('should use default maxLength of 50', () => {
      const longText = 'a'.repeat(60)
      expect(truncate(longText)).toBe('a'.repeat(47) + '...')
    })

    it('should handle empty or null input', () => {
      expect(truncate('')).toBe('')
      expect(truncate(null)).toBe('')
      expect(truncate(undefined)).toBe('')
    })
  })

  describe('parseDate', () => {
    it('should parse ISO date strings', () => {
      const result = parseDate('2024-01-15T10:30:00')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(0) // January is 0
      expect(result.getDate()).toBe(15)
    })

    it('should parse ransomwatch format', () => {
      const result = parseDate('2024-01-15 10:30:00.123456')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
    })

    it('should return null for empty input', () => {
      expect(parseDate('')).toBeNull()
      expect(parseDate(null)).toBeNull()
      expect(parseDate(undefined)).toBeNull()
    })

    it('should return null for invalid date strings', () => {
      expect(parseDate('not a date')).toBeNull()
      expect(parseDate('invalid')).toBeNull()
    })
  })

  describe('relativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "just now" for times less than 60 seconds ago', () => {
      const date = new Date('2024-01-15T11:59:30')
      expect(relativeTime(date)).toBe('just now')
    })

    it('should return minutes ago for times less than 60 minutes ago', () => {
      const date = new Date('2024-01-15T11:30:00')
      expect(relativeTime(date)).toBe('30m ago')
    })

    it('should return hours ago for times less than 24 hours ago', () => {
      const date = new Date('2024-01-15T08:00:00')
      expect(relativeTime(date)).toBe('4h ago')
    })

    it('should return days ago for times less than 7 days ago', () => {
      const date = new Date('2024-01-12T12:00:00')
      expect(relativeTime(date)).toBe('3d ago')
    })

    it('should return weeks ago for times less than 4 weeks ago', () => {
      const date = new Date('2024-01-01T12:00:00')
      expect(relativeTime(date)).toBe('2w ago')
    })

    it('should return months ago for times less than 12 months ago', () => {
      const date = new Date('2023-11-15T12:00:00')
      expect(relativeTime(date)).toBe('2mo ago')
    })

    it('should return formatted date for times over 12 months ago', () => {
      const date = new Date('2022-01-15T12:00:00')
      expect(relativeTime(date)).toMatch(/\d+\/\d+\/\d+/)
    })

    it('should handle string dates', () => {
      expect(relativeTime('2024-01-15T11:30:00')).toBe('30m ago')
    })

    it('should return "Unknown" for null or undefined', () => {
      expect(relativeTime(null)).toBe('Unknown')
      expect(relativeTime(undefined)).toBe('Unknown')
    })

    it('should return "Invalid date" for invalid date strings', () => {
      expect(relativeTime('not a date')).toBe('Invalid date')
    })
  })

  describe('sanitize', () => {
    it('should escape HTML special characters', () => {
      expect(sanitize('<script>')).toBe('&lt;script&gt;')
      expect(sanitize('a & b')).toBe('a &amp; b')
      expect(sanitize('"quoted"')).toBe('&quot;quoted&quot;')
      expect(sanitize("it's")).toBe('it&#039;s')
    })

    it('should escape multiple special characters', () => {
      expect(sanitize('<div class="test">')).toBe('&lt;div class=&quot;test&quot;&gt;')
    })

    it('should handle empty or null input', () => {
      expect(sanitize('')).toBe('')
      expect(sanitize(null)).toBe('')
      expect(sanitize(undefined)).toBe('')
    })

    it('should leave safe strings unchanged', () => {
      expect(sanitize('Hello World')).toBe('Hello World')
      expect(sanitize('safe text 123')).toBe('safe text 123')
    })
  })

  describe('stringToColor', () => {
    it('should return consistent colors for same string', () => {
      const color1 = stringToColor('test')
      const color2 = stringToColor('test')
      expect(color1).toBe(color2)
    })

    it('should return different colors for different strings', () => {
      const color1 = stringToColor('apple')
      const color2 = stringToColor('banana')
      expect(color1).not.toBe(color2)
    })

    it('should return HSL color format', () => {
      const color = stringToColor('test')
      expect(color).toMatch(/^hsl\(\d+, 70%, 50%\)$/)
    })

    it('should return gray for empty or null input', () => {
      expect(stringToColor('')).toBe('hsl(0, 0%, 50%)')
      expect(stringToColor(null)).toBe('hsl(0, 0%, 50%)')
      expect(stringToColor(undefined)).toBe('hsl(0, 0%, 50%)')
    })
  })
})
