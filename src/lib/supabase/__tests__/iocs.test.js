/**
 * Unit tests for iocs module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('../client', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }

  return {
    supabase: {
      from: vi.fn(() => mockQuery),
    },
  }
})

import { iocs, detectIOCType } from '../iocs'
import { supabase } from '../client'

describe('iocs module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('detectIOCType', () => {
    it('should return unknown for null/empty values', () => {
      expect(detectIOCType(null)).toBe('unknown')
      expect(detectIOCType('')).toBe('unknown')
      expect(detectIOCType(undefined)).toBe('unknown')
    })

    it('should detect CVE patterns', () => {
      expect(detectIOCType('CVE-2024-1234')).toBe('cve')
      expect(detectIOCType('cve-2023-45678')).toBe('cve')
      expect(detectIOCType('CVE-2021-44228')).toBe('cve')
    })

    it('should detect IPv4 addresses', () => {
      expect(detectIOCType('192.168.1.1')).toBe('ip')
      expect(detectIOCType('8.8.8.8')).toBe('ip')
      expect(detectIOCType('10.0.0.1')).toBe('ip')
      expect(detectIOCType('255.255.255.255')).toBe('ip')
    })

    it('should detect IPv6 addresses', () => {
      expect(detectIOCType('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('ip')
    })

    it('should detect SHA256 hashes', () => {
      expect(detectIOCType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('hash_sha256')
    })

    it('should detect SHA1 hashes', () => {
      expect(detectIOCType('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('hash_sha1')
    })

    it('should detect MD5 hashes', () => {
      expect(detectIOCType('d41d8cd98f00b204e9800998ecf8427e')).toBe('hash_md5')
    })

    it('should detect URLs', () => {
      expect(detectIOCType('https://example.com/malware.exe')).toBe('url')
      expect(detectIOCType('http://malicious-site.com')).toBe('url')
      expect(detectIOCType('HTTPS://EXAMPLE.COM')).toBe('url')
    })

    it('should detect domains', () => {
      expect(detectIOCType('example.com')).toBe('domain')
      expect(detectIOCType('evil.net')).toBe('domain')
      expect(detectIOCType('test-site.org')).toBe('domain')
      // Note: current regex only matches single-level domains
      // Multi-level like 'sub.example.com' return 'unknown'
    })

    it('should detect email addresses', () => {
      expect(detectIOCType('attacker@evil.com')).toBe('email')
      expect(detectIOCType('phishing@fake-bank.net')).toBe('email')
    })

    it('should return unknown for unrecognized patterns', () => {
      expect(detectIOCType('random-text')).toBe('unknown')
      expect(detectIOCType('12345')).toBe('unknown')
      expect(detectIOCType('not-a-valid-ioc!')).toBe('unknown')
    })
  })

  describe('getAll', () => {
    it('should build a basic query with default options', async () => {
      await iocs.getAll()

      expect(supabase.from).toHaveBeenCalledWith('iocs')
    })

    it('should apply type filter when provided', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getAll({ type: 'ip' })

      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'ip')
    })

    it('should apply search filter when provided', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getAll({ search: '192.168' })

      expect(mockQuery.ilike).toHaveBeenCalledWith('value', '%192.168%')
    })

    it('should apply confidence filter when provided', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getAll({ confidence: 'high' })

      expect(mockQuery.eq).toHaveBeenCalledWith('confidence', 'high')
    })

    it('should apply pagination with limit and offset', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getAll({ limit: 50, offset: 100 })

      expect(mockQuery.range).toHaveBeenCalledWith(100, 149)
    })

    it('should order by last_seen descending', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getAll()

      expect(mockQuery.order).toHaveBeenCalledWith('last_seen', { ascending: false })
    })

    it('should combine multiple filters', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getAll({
        type: 'domain',
        search: 'malware',
        confidence: 'medium',
      })

      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'domain')
      expect(mockQuery.ilike).toHaveBeenCalledWith('value', '%malware%')
      expect(mockQuery.eq).toHaveBeenCalledWith('confidence', 'medium')
    })
  })

  describe('search', () => {
    it('should search by value with ilike', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.search('evil.com')

      expect(supabase.from).toHaveBeenCalledWith('iocs')
      expect(mockQuery.ilike).toHaveBeenCalledWith('value', '%evil.com%')
    })

    it('should apply type filter when provided', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.search('192.168', 'ip')

      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'ip')
    })

    it('should limit results to 100', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.search('test')

      expect(mockQuery.limit).toHaveBeenCalledWith(100)
    })

    it('should order results by last_seen descending', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.search('malware')

      expect(mockQuery.order).toHaveBeenCalledWith('last_seen', { ascending: false })
    })
  })

  describe('getByActor', () => {
    it('should fetch IOCs for a specific actor', async () => {
      const mockQuery = supabase.from('iocs')
      const actorId = '123e4567-e89b-12d3-a456-426614174000'

      await iocs.getByActor(actorId)

      expect(supabase.from).toHaveBeenCalledWith('iocs')
      expect(mockQuery.eq).toHaveBeenCalledWith('actor_id', actorId)
    })

    it('should use default limit of 50', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getByActor('test-actor-id')

      expect(mockQuery.limit).toHaveBeenCalledWith(50)
    })

    it('should use custom limit when provided', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getByActor('test-actor-id', 25)

      expect(mockQuery.limit).toHaveBeenCalledWith(25)
    })

    it('should order by last_seen descending', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getByActor('test-actor-id')

      expect(mockQuery.order).toHaveBeenCalledWith('last_seen', { ascending: false })
    })
  })

  describe('getRecent', () => {
    it('should fetch recent IOCs ordered by created_at', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getRecent()

      expect(supabase.from).toHaveBeenCalledWith('iocs')
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('should use default limit of 100', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getRecent()

      expect(mockQuery.limit).toHaveBeenCalledWith(100)
    })

    it('should use custom limit when provided', async () => {
      const mockQuery = supabase.from('iocs')

      await iocs.getRecent(50)

      expect(mockQuery.limit).toHaveBeenCalledWith(50)
    })
  })

  describe('quickLookup', () => {
    beforeEach(() => {
      // Setup mock for Promise.all pattern used in quickLookup
      vi.mocked(supabase.from).mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }))
    })

    it('should detect IOC type for the search', async () => {
      const result = await iocs.quickLookup('192.168.1.1')

      expect(result.type).toBe('ip')
    })

    it('should detect CVE type and search vulnerabilities', async () => {
      const result = await iocs.quickLookup('CVE-2024-1234')

      expect(result.type).toBe('cve')
      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
    })

    it('should search IOCs table', async () => {
      await iocs.quickLookup('test-value')

      expect(supabase.from).toHaveBeenCalledWith('iocs')
    })

    it('should search malware_samples table', async () => {
      await iocs.quickLookup('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

      expect(supabase.from).toHaveBeenCalledWith('malware_samples')
    })

    it('should return found: true when IOCs are found', async () => {
      vi.mocked(supabase.from).mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: table === 'iocs' ? [{ id: '1', value: 'test' }] : [],
          error: null,
        }),
      }))

      const result = await iocs.quickLookup('test')

      expect(result.found).toBe(true)
    })

    it('should return found: false when no results', async () => {
      const result = await iocs.quickLookup('nonexistent-value')

      expect(result.found).toBe(false)
    })

    it('should return structured result with iocs, malware, vulnerabilities', async () => {
      const result = await iocs.quickLookup('test')

      expect(result).toHaveProperty('iocs')
      expect(result).toHaveProperty('malware')
      expect(result).toHaveProperty('vulnerabilities')
      expect(result).toHaveProperty('type')
      expect(result).toHaveProperty('found')
    })
  })

  describe('getEnrichmentLinks', () => {
    it('should return IP enrichment links', () => {
      const links = iocs.getEnrichmentLinks('8.8.8.8', 'ip')

      expect(links).toHaveLength(4)
      expect(links.map((l) => l.name)).toContain('VirusTotal')
      expect(links.map((l) => l.name)).toContain('Shodan')
      expect(links.map((l) => l.name)).toContain('AbuseIPDB')
      expect(links.map((l) => l.name)).toContain('Censys')
    })

    it('should include IP value in URLs', () => {
      const links = iocs.getEnrichmentLinks('1.2.3.4', 'ip')

      expect(links[0].url).toContain('1.2.3.4')
    })

    it('should return hash enrichment links for SHA256', () => {
      const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      const links = iocs.getEnrichmentLinks(hash, 'hash_sha256')

      expect(links).toHaveLength(3)
      expect(links.map((l) => l.name)).toContain('VirusTotal')
      expect(links.map((l) => l.name)).toContain('MalwareBazaar')
      expect(links.map((l) => l.name)).toContain('Hybrid Analysis')
    })

    it('should return hash enrichment links for MD5', () => {
      const links = iocs.getEnrichmentLinks('d41d8cd98f00b204e9800998ecf8427e', 'hash_md5')

      expect(links).toHaveLength(3)
    })

    it('should return hash enrichment links for SHA1', () => {
      const links = iocs.getEnrichmentLinks('da39a3ee5e6b4b0d3255bfef95601890afd80709', 'hash_sha1')

      expect(links).toHaveLength(3)
    })

    it('should return hash enrichment links for generic hash type', () => {
      const links = iocs.getEnrichmentLinks('somehash', 'hash')

      expect(links).toHaveLength(3)
    })

    it('should return domain enrichment links', () => {
      const links = iocs.getEnrichmentLinks('evil.com', 'domain')

      expect(links).toHaveLength(3)
      expect(links.map((l) => l.name)).toContain('VirusTotal')
      expect(links.map((l) => l.name)).toContain('URLhaus')
      expect(links.map((l) => l.name)).toContain('Shodan')
    })

    it('should return URL enrichment links', () => {
      const links = iocs.getEnrichmentLinks('https://malware.com/bad.exe', 'url')

      expect(links).toHaveLength(2)
      expect(links.map((l) => l.name)).toContain('VirusTotal')
      expect(links.map((l) => l.name)).toContain('URLhaus')
    })

    it('should URL-encode URL values', () => {
      const links = iocs.getEnrichmentLinks('https://evil.com/path?a=1&b=2', 'url')

      expect(links[0].url).toContain(encodeURIComponent('https://evil.com/path?a=1&b=2'))
    })

    it('should return CVE enrichment links', () => {
      const links = iocs.getEnrichmentLinks('CVE-2024-1234', 'cve')

      expect(links).toHaveLength(4)
      expect(links.map((l) => l.name)).toContain('NVD')
      expect(links.map((l) => l.name)).toContain('CISA KEV')
      expect(links.map((l) => l.name)).toContain('CVE.org')
      expect(links.map((l) => l.name)).toContain('Exploit-DB')
    })

    it('should include CVE ID in URLs', () => {
      const links = iocs.getEnrichmentLinks('CVE-2021-44228', 'cve')

      expect(links[0].url).toContain('CVE-2021-44228')
    })

    it('should return default VirusTotal link for unknown types', () => {
      const links = iocs.getEnrichmentLinks('unknown-value', 'unknown')

      expect(links).toHaveLength(1)
      expect(links[0].name).toBe('VirusTotal')
    })

    it('should URL-encode unknown values', () => {
      const links = iocs.getEnrichmentLinks('value with spaces', 'unknown')

      expect(links[0].url).toContain(encodeURIComponent('value with spaces'))
    })
  })
})
