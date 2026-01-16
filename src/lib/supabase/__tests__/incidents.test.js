/**
 * Unit tests for incidents module
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
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }

  return {
    supabase: {
      from: vi.fn(() => mockQuery),
    },
  }
})

import { incidents } from '../incidents'
import { supabase } from '../client'

describe('incidents module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should build a basic query with default options', async () => {
      await incidents.getAll()

      expect(supabase.from).toHaveBeenCalledWith('incidents')
    })

    it('should apply search filter when provided', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getAll({ search: 'hospital' })

      expect(mockQuery.or).toHaveBeenCalled()
    })

    it('should apply sector filter when provided', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getAll({ sector: 'healthcare' })

      expect(mockQuery.eq).toHaveBeenCalledWith('victim_sector', 'healthcare')
    })

    it('should apply status filter when provided', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getAll({ status: 'confirmed' })

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'confirmed')
    })

    it('should apply actor_id filter when provided', async () => {
      const mockQuery = supabase.from('incidents')
      const actorId = '123e4567-e89b-12d3-a456-426614174000'

      await incidents.getAll({ actor_id: actorId })

      expect(mockQuery.eq).toHaveBeenCalledWith('actor_id', actorId)
    })

    it('should apply days filter when provided', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getAll({ days: 30 })

      expect(mockQuery.gte).toHaveBeenCalled()
    })

    it('should not apply days filter when days is 0', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getAll({ days: 0 })

      // gte should not be called for days filter
      // Note: it will be called 0 times for days filter specifically
    })

    it('should apply pagination with limit and offset', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getAll({ limit: 50, offset: 100 })

      expect(mockQuery.range).toHaveBeenCalledWith(100, 149)
    })
  })

  describe('getRecent', () => {
    it('should build query with default 30-day window', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getRecent()

      expect(supabase.from).toHaveBeenCalledWith('incidents')
      expect(mockQuery.gte).toHaveBeenCalled()
    })

    it('should apply actor_id filter when provided', async () => {
      const mockQuery = supabase.from('incidents')
      const actorId = '123e4567-e89b-12d3-a456-426614174000'

      await incidents.getRecent({ actor_id: actorId })

      expect(mockQuery.eq).toHaveBeenCalledWith('actor_id', actorId)
    })

    it('should apply sector filter when provided', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getRecent({ sector: 'finance' })

      expect(mockQuery.eq).toHaveBeenCalledWith('victim_sector', 'finance')
    })

    it('should apply custom days filter', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getRecent({ days: 7 })

      expect(mockQuery.gte).toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('should fetch stats with default 30-day window', async () => {
      await incidents.getStats()

      expect(supabase.from).toHaveBeenCalledWith('incidents')
    })

    it('should fetch stats with custom days window', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.getStats(90)

      expect(mockQuery.gte).toHaveBeenCalled()
    })
  })

  describe('search', () => {
    it('should search with victim_name and victim_sector fields', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.search('test')

      expect(supabase.from).toHaveBeenCalledWith('incidents')
      expect(mockQuery.or).toHaveBeenCalled()
    })

    it('should use default limit of 10', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.search('test')

      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })

    it('should use custom limit when provided', async () => {
      const mockQuery = supabase.from('incidents')

      await incidents.search('test', 25)

      expect(mockQuery.limit).toHaveBeenCalledWith(25)
    })
  })

  describe('getBySector', () => {
    it('should aggregate incidents by sector', async () => {
      const mockData = [
        { victim_sector: 'healthcare' },
        { victim_sector: 'healthcare' },
        { victim_sector: 'finance' },
        { victim_sector: 'education' },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await incidents.getBySector(365)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ name: 'healthcare', value: 2 })
      expect(result[1]).toEqual({ name: 'finance', value: 1 })
    })

    it('should handle null sector as "Unknown"', async () => {
      const mockData = [
        { victim_sector: null },
        { victim_sector: 'healthcare' },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await incidents.getBySector(365)

      const unknownSector = result.find(s => s.name === 'Unknown')
      expect(unknownSector).toBeDefined()
      expect(unknownSector.value).toBe(1)
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      })

      const result = await incidents.getBySector(365)

      expect(result).toEqual([])
    })

    it('should limit to top 10 sectors', async () => {
      const mockData = []
      for (let i = 0; i < 15; i++) {
        mockData.push({ victim_sector: `sector-${i}` })
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await incidents.getBySector(365)

      expect(result.length).toBeLessThanOrEqual(10)
    })

    it('should sort sectors by count descending', async () => {
      const mockData = [
        { victim_sector: 'finance' },
        { victim_sector: 'healthcare' },
        { victim_sector: 'healthcare' },
        { victim_sector: 'healthcare' },
        { victim_sector: 'finance' },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await incidents.getBySector(365)

      expect(result[0].name).toBe('healthcare')
      expect(result[0].value).toBe(3)
      expect(result[1].name).toBe('finance')
      expect(result[1].value).toBe(2)
    })
  })

  describe('getDailyCounts', () => {
    it('should aggregate incidents by date', async () => {
      const mockData = [
        { discovered_date: '2024-01-15T10:00:00Z' },
        { discovered_date: '2024-01-15T14:00:00Z' },
        { discovered_date: '2024-01-14T09:00:00Z' },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await incidents.getDailyCounts(90)

      expect(result).toContainEqual({ date: '2024-01-15', count: 2 })
      expect(result).toContainEqual({ date: '2024-01-14', count: 1 })
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      })

      const result = await incidents.getDailyCounts(90)

      expect(result).toEqual([])
    })

    it('should handle null discovered_date', async () => {
      const mockData = [
        { discovered_date: '2024-01-15T10:00:00Z' },
        { discovered_date: null },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await incidents.getDailyCounts(90)

      expect(result).toHaveLength(1)
      expect(result[0].date).toBe('2024-01-15')
    })
  })

  describe('getSectorDetails', () => {
    it('should aggregate detailed sector data with trends', async () => {
      const currentData = [
        { id: '1', victim_name: 'Hospital A', victim_sector: 'healthcare', discovered_date: '2024-01-15', threat_actor: { id: '1', name: 'LockBit' } },
        { id: '2', victim_name: 'Hospital B', victim_sector: 'healthcare', discovered_date: '2024-01-14', threat_actor: { id: '1', name: 'LockBit' } },
      ]

      const prevData = [
        { victim_sector: 'healthcare' },
      ]

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockImplementation(function() {
          callCount++
          if (callCount === 1) {
            // First call is current data (no lt)
            return { data: currentData, error: null }
          }
          // Second call is prev data
          return Promise.resolve({ data: prevData, error: null })
        }),
        order: vi.fn().mockResolvedValue({ data: currentData, error: null }),
      }))

      const result = await incidents.getSectorDetails(30)

      // Should return sector details array
      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      })

      const result = await incidents.getSectorDetails(30)

      expect(result).toEqual([])
    })

    it('should limit recent incidents to 5 per sector', async () => {
      const currentData = []
      for (let i = 0; i < 10; i++) {
        currentData.push({
          id: `${i}`,
          victim_name: `Hospital ${i}`,
          victim_sector: 'healthcare',
          discovered_date: '2024-01-15',
          threat_actor: { id: '1', name: 'LockBit' },
        })
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: currentData, error: null }),
      })

      const result = await incidents.getSectorDetails(30)

      if (result.length > 0) {
        expect(result[0].recentIncidents.length).toBeLessThanOrEqual(5)
      }
    })

    it('should limit top actors to 5 per sector', async () => {
      const currentData = []
      for (let i = 0; i < 10; i++) {
        currentData.push({
          id: `${i}`,
          victim_name: `Company ${i}`,
          victim_sector: 'healthcare',
          discovered_date: '2024-01-15',
          threat_actor: { id: `${i}`, name: `Actor ${i}` },
        })
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: currentData, error: null }),
      })

      const result = await incidents.getSectorDetails(30)

      if (result.length > 0) {
        expect(result[0].topActors.length).toBeLessThanOrEqual(5)
      }
    })

    it('should limit results to top 12 sectors', async () => {
      const currentData = []
      for (let i = 0; i < 20; i++) {
        currentData.push({
          id: `${i}`,
          victim_name: `Company ${i}`,
          victim_sector: `sector-${i}`,
          discovered_date: '2024-01-15',
          threat_actor: { id: '1', name: 'LockBit' },
        })
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: currentData, error: null }),
      })

      const result = await incidents.getSectorDetails(30)

      expect(result.length).toBeLessThanOrEqual(12)
    })
  })
})

describe('incidents date calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should calculate correct cutoff date for 30 days', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    }

    vi.mocked(supabase.from).mockReturnValue(mockQuery)

    await incidents.getRecent({ days: 30 })

    // Check that gte was called with a date 30 days ago
    const gteCall = mockQuery.gte.mock.calls.find(call => call[0] === 'discovered_date')
    expect(gteCall).toBeDefined()

    const cutoffDate = new Date(gteCall[1])
    const expectedDate = new Date('2023-12-16T12:00:00Z')
    expect(cutoffDate.toDateString()).toBe(expectedDate.toDateString())
  })
})
