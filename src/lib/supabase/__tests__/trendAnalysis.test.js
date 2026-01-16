/**
 * Trend Analysis Module Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trendAnalysis } from '../trendAnalysis'
import { supabase } from '../client'

// Mock supabase client
vi.mock('../client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('trendAnalysis module', () => {
  let mockQuery

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    supabase.from.mockReturnValue(mockQuery)
  })

  describe('getWeeklyComparison', () => {
    it('fetches weekly summaries with default limit', async () => {
      await trendAnalysis.getWeeklyComparison()

      expect(supabase.from).toHaveBeenCalledWith('weekly_summaries')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.order).toHaveBeenCalledWith('week_start', { ascending: false })
      expect(mockQuery.limit).toHaveBeenCalledWith(8)
    })

    it('accepts custom weeks back parameter', async () => {
      await trendAnalysis.getWeeklyComparison(4)

      expect(mockQuery.limit).toHaveBeenCalledWith(4)
    })
  })

  describe('getWeekOverWeekChange', () => {
    it('returns calculated data when summaries available', async () => {
      const mockSummaries = [
        {
          incidents_total: 100,
          incident_change_pct: 25,
          incidents_by_sector: { healthcare: 30, finance: 20 },
        },
        {
          incidents_total: 80,
          incidents_by_sector: { healthcare: 25, finance: 15 },
        },
      ]

      mockQuery.limit.mockResolvedValue({
        data: mockSummaries,
        error: null,
      })

      const result = await trendAnalysis.getWeekOverWeekChange()

      expect(result).toHaveProperty('currentWeek')
      expect(result).toHaveProperty('previousWeek')
      expect(result).toHaveProperty('incidentChange', 25)
      expect(result).toHaveProperty('sectorChanges')
    })

    it('calculates week over week when insufficient summaries', async () => {
      mockQuery.limit.mockResolvedValue({
        data: [],
        error: null,
      })

      // Mock the calculateWeekOverWeek calls
      mockQuery.gte.mockReturnThis()
      mockQuery.lt.mockResolvedValue({ count: 50 })

      const result = await trendAnalysis.getWeekOverWeekChange()

      expect(result).toHaveProperty('currentWeek')
      expect(result).toHaveProperty('previousWeek')
    })
  })

  describe('calculateSectorChanges', () => {
    it('calculates changes for matching sectors', () => {
      const current = { healthcare: 30, finance: 20 }
      const previous = { healthcare: 20, finance: 25 }

      const result = trendAnalysis.calculateSectorChanges(current, previous)

      expect(result).toContainEqual(
        expect.objectContaining({ sector: 'healthcare', current: 30, previous: 20, change: 50 })
      )
      expect(result).toContainEqual(
        expect.objectContaining({ sector: 'finance', current: 20, previous: 25, change: -20 })
      )
    })

    it('handles new sectors', () => {
      const current = { healthcare: 30, tech: 10 }
      const previous = { healthcare: 20 }

      const result = trendAnalysis.calculateSectorChanges(current, previous)

      expect(result).toContainEqual(
        expect.objectContaining({ sector: 'tech', current: 10, previous: 0, change: 100 })
      )
    })

    it('handles removed sectors', () => {
      const current = { healthcare: 30 }
      const previous = { healthcare: 20, finance: 15 }

      const result = trendAnalysis.calculateSectorChanges(current, previous)

      expect(result).toContainEqual(
        expect.objectContaining({ sector: 'finance', current: 0, previous: 15 })
      )
    })

    it('handles null inputs', () => {
      const result = trendAnalysis.calculateSectorChanges(null, null)

      expect(result).toEqual([])
    })

    it('sorts by change descending', () => {
      const current = { a: 100, b: 50, c: 25 }
      const previous = { a: 50, b: 50, c: 50 }

      const result = trendAnalysis.calculateSectorChanges(current, previous)

      expect(result[0].sector).toBe('a')
      expect(result[result.length - 1].sector).toBe('c')
    })
  })

  describe('getWeekStart', () => {
    it('returns Monday of the week', () => {
      // Wednesday Jan 15, 2025
      const date = new Date('2025-01-15')
      const result = trendAnalysis.getWeekStart(date)

      expect(result).toBe('2025-01-13') // Monday
    })

    it('handles Sunday', () => {
      // Sunday Jan 19, 2025
      const date = new Date('2025-01-19')
      const result = trendAnalysis.getWeekStart(date)

      expect(result).toBe('2025-01-13') // Previous Monday
    })

    it('handles Monday', () => {
      // Monday Jan 13, 2025
      const date = new Date('2025-01-13')
      const result = trendAnalysis.getWeekStart(date)

      expect(result).toBe('2025-01-13') // Same day
    })
  })

  describe('getSectorTrends', () => {
    it('fetches incidents for sector trends', async () => {
      mockQuery.gte.mockResolvedValue({
        data: [
          { victim_sector: 'healthcare', discovered_date: '2025-01-10' },
          { victim_sector: 'healthcare', discovered_date: '2025-01-11' },
          { victim_sector: 'finance', discovered_date: '2025-01-10' },
        ],
        error: null,
      })

      const result = await trendAnalysis.getSectorTrends(30)

      expect(supabase.from).toHaveBeenCalledWith('incidents')
      expect(mockQuery.select).toHaveBeenCalledWith('victim_sector, discovered_date')
      expect(result).toHaveProperty('weeks')
      expect(result).toHaveProperty('sectors')
      expect(result).toHaveProperty('data')
    })

    it('handles empty data', async () => {
      mockQuery.gte.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await trendAnalysis.getSectorTrends()

      expect(result.weeks).toEqual([])
      expect(result.sectors).toEqual([])
    })

    it('groups unknown sectors', async () => {
      mockQuery.gte.mockResolvedValue({
        data: [
          { victim_sector: null, discovered_date: '2025-01-10' },
          { victim_sector: undefined, discovered_date: '2025-01-11' },
        ],
        error: null,
      })

      const result = await trendAnalysis.getSectorTrends()

      expect(result.sectors).toContain('Unknown')
    })
  })

  describe('getChangeSummary', () => {
    it('fetches change summary data', async () => {
      mockQuery.limit.mockResolvedValue({ data: [], error: null })
      mockQuery.gte.mockReturnThis()
      mockQuery.eq.mockReturnThis()
      mockQuery.order.mockReturnThis()

      // Mock the parallel queries
      const mockResults = { count: 10, data: [] }
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue(mockResults),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })

      const result = await trendAnalysis.getChangeSummary(7)

      expect(result).toHaveProperty('newIncidents')
      expect(result).toHaveProperty('newActors')
      expect(result).toHaveProperty('newKEVs')
      expect(result).toHaveProperty('escalatingActors')
      expect(result).toHaveProperty('sinceDays', 7)
    })
  })

  describe('getActorTrajectories', () => {
    it('fetches actor trend history', async () => {
      await trendAnalysis.getActorTrajectories(['actor-1', 'actor-2'], 30)

      expect(supabase.from).toHaveBeenCalledWith('actor_trend_history')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.in).toHaveBeenCalledWith('actor_id', ['actor-1', 'actor-2'])
      expect(mockQuery.order).toHaveBeenCalledWith('recorded_date', { ascending: true })
    })

    it('uses default days parameter', async () => {
      await trendAnalysis.getActorTrajectories(['actor-1'])

      expect(mockQuery.gte).toHaveBeenCalled()
    })
  })
})
