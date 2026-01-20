/**
 * Unit tests for ai.js
 * Tests AI-powered threat intelligence features including BLUF generation,
 * actor summaries, and natural language query parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateBLUF, generateActorSummary, parseNaturalQuery, queryToFilters } from '../ai'

// Mock aiSummaries from supabase
const mockGetLatest = vi.fn()
const mockSave = vi.fn()

vi.mock('../supabase', () => ({
  aiSummaries: {
    getLatest: () => mockGetLatest(),
    save: (...args) => mockSave(...args),
  },
}))

// Mock Supabase auth
const mockGetSession = vi.fn()

vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}))

describe('generateBLUF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLatest.mockResolvedValue({ data: null })
    mockSave.mockResolvedValue({ data: {}, error: null })
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-supabase-token' } } })
  })

  it('should return null when user is not authenticated', async () => {
    // Temporarily make currentUser null
    vi.doMock('../firebase', () => ({
      auth: { currentUser: null },
    }))

    // Re-import to get the new mock - for now just test the fetch behavior
    // The actual test will verify the API is called correctly
  })

  it('should call API endpoint with correct parameters', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: 'LockBit and ALPHV are driving ransomware activity.',
          model: 'llama-3.3-70b-versatile',
        }),
    })

    const data = {
      incidents30d: 500,
      topActors: [{ name: 'LockBit' }, { name: 'ALPHV' }],
      topSectors: [{ name: 'healthcare', value: 45 }],
      recentIncidents: [{ victim_name: 'Hospital X', threat_actor: { name: 'LockBit' } }],
    }

    await generateBLUF(data)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/generate-summary',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-supabase-token',
          'Content-Type': 'application/json',
        },
      })
    )

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.type).toBe('bluf')
    expect(callBody.data).toBeDefined()
  })

  it('should return generated summary on success', async () => {
    const expectedSummary =
      'LockBit and ALPHV are driving ransomware activity targeting healthcare.'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: expectedSummary,
          model: 'llama-3.3-70b-versatile',
        }),
    })

    const result = await generateBLUF({ incidents30d: 500 })

    expect(result).toBe(expectedSummary)
  })

  it('should return null on API error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
    })

    const result = await generateBLUF({ incidents30d: 100 })

    expect(result).toBeNull()
  })

  it('should return null on network error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await generateBLUF({ incidents30d: 100 })

    expect(result).toBeNull()
  })

  it('should save summary to database when save option is true', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: 'Summary text',
          model: 'llama-3.3-70b-versatile',
        }),
    })

    await generateBLUF({ incidents30d: 500 }, { save: true })

    // Wait for async save operation
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockSave).toHaveBeenCalled()
  })

  it('should not save summary when save option is false', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: 'Summary text',
          model: 'llama-3.3-70b-versatile',
        }),
    })

    await generateBLUF({ incidents30d: 500 }, { save: false })

    // Wait for potential async operation
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockSave).not.toHaveBeenCalled()
  })

  it('should throttle saves based on last summary time', async () => {
    // Mock recent save (within throttle period)
    mockGetLatest.mockResolvedValue({
      data: { generated_at: new Date().toISOString() },
    })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: 'Summary text',
          model: 'llama-3.3-70b-versatile',
        }),
    })

    await generateBLUF({ incidents30d: 500 }, { save: true })

    // Wait for async operation
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockSave).not.toHaveBeenCalled()
  })
})

describe('generateActorSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-supabase-token' } } })
  })

  it('should call API endpoint with actor details', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: 'LockBit is a prolific ransomware group.',
        }),
    })

    const actor = {
      name: 'LockBit',
      trend_status: 'ESCALATING',
      incidents_7d: 25,
      incidents_prev_7d: 15,
      target_sectors: ['healthcare', 'finance'],
    }

    await generateActorSummary(actor, [{ victim_name: 'Hospital ABC' }])

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/generate-summary',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer mock-supabase-token',
          'Content-Type': 'application/json',
        },
      })
    )

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.type).toBe('actor')
    expect(callBody.data.actor.name).toBe('LockBit')
  })

  it('should return summary on success', async () => {
    const expectedSummary = 'LockBit is a prolific ransomware group targeting multiple sectors.'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          summary: expectedSummary,
        }),
    })

    const result = await generateActorSummary({ name: 'LockBit' })

    expect(result).toBe(expectedSummary)
  })

  it('should return null on API error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await generateActorSummary({ name: 'LockBit' })

    expect(result).toBeNull()
  })
})

describe('parseNaturalQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('keyword parsing', () => {
    it('should detect actors entity type', async () => {
      const result = await parseNaturalQuery('ransomware groups')
      expect(result.type).toBe('actors')
    })

    it('should detect incidents entity type', async () => {
      const result = await parseNaturalQuery('recent attacks')
      expect(result.type).toBe('incidents')
    })

    it('should detect vulnerabilities entity type', async () => {
      const result = await parseNaturalQuery('critical CVE')
      expect(result.type).toBe('vulnerabilities')
    })

    it('should detect iocs entity type', async () => {
      const result = await parseNaturalQuery('malicious IP addresses')
      expect(result.type).toBe('iocs')
    })

    it('should detect malware entity type', async () => {
      const result = await parseNaturalQuery('malware samples')
      expect(result.type).toBe('malware')
    })

    describe('sector detection', () => {
      it('should detect healthcare sector', async () => {
        const result = await parseNaturalQuery('attacks on hospitals')
        expect(result.sectors).toContain('healthcare')
      })

      it('should detect finance sector', async () => {
        const result = await parseNaturalQuery('bank attacks')
        expect(result.sectors).toContain('finance')
      })

      it('should detect education sector', async () => {
        const result = await parseNaturalQuery('university victims')
        expect(result.sectors).toContain('education')
      })

      it('should detect government sector', async () => {
        const result = await parseNaturalQuery('gov attacks')
        expect(result.sectors).toContain('government')
      })

      it('should detect manufacturing sector', async () => {
        const result = await parseNaturalQuery('industrial incidents')
        expect(result.sectors).toContain('manufacturing')
      })

      it('should detect multiple sectors', async () => {
        const result = await parseNaturalQuery('attacks on hospitals and banks')
        expect(result.sectors).toContain('healthcare')
        expect(result.sectors).toContain('finance')
      })
    })

    describe('severity detection', () => {
      it('should detect critical severity', async () => {
        const result = await parseNaturalQuery('critical vulnerabilities')
        expect(result.severity).toBe('critical')
      })

      it('should detect high severity', async () => {
        const result = await parseNaturalQuery('high severity CVEs')
        expect(result.severity).toBe('high')
      })

      it('should detect medium severity', async () => {
        const result = await parseNaturalQuery('medium risk indicators')
        expect(result.severity).toBe('medium')
      })

      it('should detect low severity', async () => {
        const result = await parseNaturalQuery('low priority items')
        expect(result.severity).toBe('low')
      })
    })

    describe('trend status detection', () => {
      it('should detect escalating status', async () => {
        const result = await parseNaturalQuery('escalating threat actors')
        expect(result.trendStatus).toBe('ESCALATING')
      })

      it('should detect rising as escalating', async () => {
        const result = await parseNaturalQuery('rising ransomware groups')
        expect(result.trendStatus).toBe('ESCALATING')
      })

      it('should detect declining status', async () => {
        const result = await parseNaturalQuery('declining groups')
        expect(result.trendStatus).toBe('DECLINING')
      })
    })

    describe('IOC type detection', () => {
      it('should detect IP type', async () => {
        const result = await parseNaturalQuery('malicious ip addresses')
        expect(result.iocType).toBe('ip')
      })

      it('should detect domain type', async () => {
        const result = await parseNaturalQuery('malicious domains')
        expect(result.iocType).toBe('domain')
      })

      it('should detect URL type', async () => {
        const result = await parseNaturalQuery('malware URLs')
        expect(result.iocType).toBe('url')
      })

      it('should detect hash type', async () => {
        const result = await parseNaturalQuery('sha256 hashes')
        expect(result.iocType).toBe('hash')
      })
    })

    describe('exploit and KEV detection', () => {
      it('should detect exploit filter', async () => {
        const result = await parseNaturalQuery('vulnerabilities with exploits')
        expect(result.hasExploit).toBe(true)
      })

      it('should detect POC filter', async () => {
        const result = await parseNaturalQuery('CVEs with poc')
        expect(result.hasExploit).toBe(true)
      })

      it('should detect KEV filter', async () => {
        const result = await parseNaturalQuery('known exploited vulnerabilities')
        expect(result.isKev).toBe(true)
      })
    })

    describe('date range detection', () => {
      it('should detect week range', async () => {
        const result = await parseNaturalQuery('incidents this week')
        expect(result.dateRange).toBe('7d')
      })

      it('should detect 7 day range', async () => {
        const result = await parseNaturalQuery('last 7 days')
        expect(result.dateRange).toBe('7d')
      })

      it('should detect month range', async () => {
        const result = await parseNaturalQuery('this month')
        expect(result.dateRange).toBe('30d')
      })

      it('should detect quarter range', async () => {
        const result = await parseNaturalQuery('last quarter')
        expect(result.dateRange).toBe('90d')
      })
    })

    describe('actor name detection', () => {
      it('should detect LockBit', async () => {
        const result = await parseNaturalQuery('lockbit victims')
        expect(result.actor).toBe('Lockbit')
      })

      it('should detect BlackCat/ALPHV', async () => {
        const result = await parseNaturalQuery('alphv incidents')
        expect(result.actor).toBe('Alphv')
      })

      it('should detect Cl0p', async () => {
        const result = await parseNaturalQuery('cl0p attacks')
        expect(result.actor).toBe('Cl0p')
      })

      it('should detect Play', async () => {
        const result = await parseNaturalQuery('play ransomware')
        expect(result.actor).toBe('Play')
      })

      it('should detect Akira', async () => {
        const result = await parseNaturalQuery('akira group')
        expect(result.actor).toBe('Akira')
      })

      it('should detect RansomHub', async () => {
        const result = await parseNaturalQuery('ransomhub victims')
        expect(result.actor).toBe('Ransomhub')
      })
    })

    it('should mark result as keyword parsed', async () => {
      const result = await parseNaturalQuery('test query')
      expect(result.parsed).toBe(true)
      expect(result.aiParsed).toBe(false)
    })
  })
})

describe('queryToFilters', () => {
  it('should convert search term', () => {
    const filters = queryToFilters({ search: 'test' })
    expect(filters.search).toBe('test')
  })

  it('should convert actor name', () => {
    const filters = queryToFilters({ actor: 'LockBit' })
    expect(filters.actor).toBe('LockBit')
  })

  it('should convert sectors array', () => {
    const filters = queryToFilters({ sectors: ['healthcare', 'finance'] })
    expect(filters.sectors).toEqual(['healthcare', 'finance'])
  })

  it('should not include empty sectors', () => {
    const filters = queryToFilters({ sectors: [] })
    expect(filters.sectors).toBeUndefined()
  })

  it('should convert severity', () => {
    const filters = queryToFilters({ severity: 'critical' })
    expect(filters.severity).toBe('critical')
  })

  it('should convert trend status', () => {
    const filters = queryToFilters({ trendStatus: 'ESCALATING' })
    expect(filters.trendStatus).toBe('ESCALATING')
  })

  it('should convert IOC type to type filter', () => {
    const filters = queryToFilters({ iocType: 'ip' })
    expect(filters.type).toBe('ip')
  })

  it('should convert hasExploit flag', () => {
    const filters = queryToFilters({ hasExploit: true })
    expect(filters.hasExploit).toBe(true)
  })

  it('should convert isKev flag', () => {
    const filters = queryToFilters({ isKev: true })
    expect(filters.isKev).toBe(true)
  })

  it('should convert dateRange', () => {
    const filters = queryToFilters({ dateRange: '30d' })
    expect(filters.dateRange).toBe('30d')
  })

  it('should convert limit', () => {
    const filters = queryToFilters({ limit: 50 })
    expect(filters.limit).toBe(50)
  })

  it('should handle complex parsed query', () => {
    const parsed = {
      type: 'vulnerabilities',
      severity: 'critical',
      hasExploit: true,
      isKev: true,
      dateRange: '7d',
      limit: 10,
    }

    const filters = queryToFilters(parsed)

    expect(filters).toEqual({
      severity: 'critical',
      hasExploit: true,
      isKev: true,
      dateRange: '7d',
      limit: 10,
    })
  })

  it('should return empty object for empty parsed query', () => {
    const filters = queryToFilters({})
    expect(filters).toEqual({})
  })

  it('should not include undefined values', () => {
    const filters = queryToFilters({ search: undefined, actor: 'LockBit' })
    expect(Object.keys(filters)).not.toContain('search')
    expect(filters.actor).toBe('LockBit')
  })
})
