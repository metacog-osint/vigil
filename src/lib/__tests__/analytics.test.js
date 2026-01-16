/**
 * Unit tests for analytics module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((callback) => callback({ error: null })),
    })),
  },
}))

// Mock browser globals
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
}

const mockLocalStorage = {
  getItem: vi.fn(),
}

const mockWindow = {
  location: { pathname: '/test' },
}

const mockDocument = {
  referrer: 'https://google.com',
}

const mockNavigator = {
  userAgent: 'test-agent',
}

// Set up global mocks
vi.stubGlobal('sessionStorage', mockSessionStorage)
vi.stubGlobal('localStorage', mockLocalStorage)
vi.stubGlobal('window', mockWindow)
vi.stubGlobal('document', mockDocument)
vi.stubGlobal('navigator', mockNavigator)

import {
  EVENT_TYPES,
  trackEvent,
  trackPageView,
  trackSearch,
  trackExport,
  trackWatchlist,
  trackAlert,
  trackReport,
  trackFeature,
  trackApiUsage,
  analyticsQueries,
} from '../analytics'
import { supabase } from '../supabase'

describe('analytics module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.getItem.mockReturnValue(null)
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  describe('EVENT_TYPES', () => {
    it('should export expected event types', () => {
      expect(EVENT_TYPES.PAGE_VIEW).toBe('page_view')
      expect(EVENT_TYPES.SEARCH).toBe('search')
      expect(EVENT_TYPES.EXPORT).toBe('export')
      expect(EVENT_TYPES.WATCHLIST).toBe('watchlist')
      expect(EVENT_TYPES.ALERT).toBe('alert')
      expect(EVENT_TYPES.REPORT).toBe('report')
      expect(EVENT_TYPES.API).toBe('api')
      expect(EVENT_TYPES.FEATURE).toBe('feature')
    })
  })

  describe('trackEvent', () => {
    it('should call supabase to insert event', async () => {
      await trackEvent(EVENT_TYPES.PAGE_VIEW, 'test_page', { foo: 'bar' })

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })

    it('should generate session ID when not exists', async () => {
      mockSessionStorage.getItem.mockReturnValue(null)

      await trackEvent(EVENT_TYPES.PAGE_VIEW, 'test')

      expect(mockSessionStorage.setItem).toHaveBeenCalled()
    })

    it('should reuse existing session ID', async () => {
      mockSessionStorage.getItem.mockReturnValue('existing_session')

      await trackEvent(EVENT_TYPES.PAGE_VIEW, 'test')

      expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
    })

    it('should get user ID from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ uid: 'user123' }))

      await trackEvent(EVENT_TYPES.PAGE_VIEW, 'test')

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('vigil_auth_user')
    })

    it('should use anonymous when no auth user', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      await trackEvent(EVENT_TYPES.PAGE_VIEW, 'test')

      // Event should still be tracked with anonymous user
      expect(supabase.from).toHaveBeenCalled()
    })

    it('should handle localStorage parse errors gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')

      // Should not throw
      await expect(trackEvent(EVENT_TYPES.PAGE_VIEW, 'test')).resolves.not.toThrow()
    })
  })

  describe('trackPageView', () => {
    it('should call trackEvent with PAGE_VIEW type', async () => {
      await trackPageView('dashboard', { section: 'main' })

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackSearch', () => {
    it('should track search with truncated query', async () => {
      const longQuery = 'a'.repeat(200)
      await trackSearch('ioc', longQuery, 50)

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })

    it('should handle null query', async () => {
      await trackSearch('ioc', null, 0)

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackExport', () => {
    it('should track export with format and count', async () => {
      await trackExport('incidents', 'csv', 100)

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackWatchlist', () => {
    it('should track watchlist actions', async () => {
      await trackWatchlist('add', 'actor', 'actor-123')

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackAlert', () => {
    it('should track alert actions', async () => {
      await trackAlert('create', 'ransomware')

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackReport', () => {
    it('should track report actions', async () => {
      await trackReport('generate', 'report-123', 'weekly')

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackFeature', () => {
    it('should track feature usage', async () => {
      await trackFeature('dark_mode', { enabled: true })

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('trackApiUsage', () => {
    it('should track API calls', async () => {
      await trackApiUsage('/api/v1/iocs', 'GET', 200)

      expect(supabase.from).toHaveBeenCalledWith('analytics_events')
    })
  })

  describe('analyticsQueries', () => {
    describe('getEngagementSummary', () => {
      it('should query v_engagement_summary view', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { total_users: 100 }, error: null }),
        })

        const result = await analyticsQueries.getEngagementSummary()

        expect(supabase.from).toHaveBeenCalledWith('v_engagement_summary')
        expect(result).toEqual({ total_users: 100 })
      })

      it('should throw on error', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        })

        await expect(analyticsQueries.getEngagementSummary()).rejects.toThrow()
      })
    })

    describe('getFeatureAdoption', () => {
      it('should query v_feature_adoption view', async () => {
        const mockData = [
          { feature: 'search', adoption_rate: 85 },
          { feature: 'export', adoption_rate: 45 },
        ]

        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        })

        const result = await analyticsQueries.getFeatureAdoption()

        expect(supabase.from).toHaveBeenCalledWith('v_feature_adoption')
        expect(result).toEqual(mockData)
      })

      it('should return empty array on null data', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

        const result = await analyticsQueries.getFeatureAdoption()

        expect(result).toEqual([])
      })
    })

    describe('getDailyStats', () => {
      it('should aggregate stats by date', async () => {
        const mockData = [
          { date: '2024-01-15', page_views: 100, searches: 50, exports: 10, api_calls: 200 },
          { date: '2024-01-15', page_views: 50, searches: 25, exports: 5, api_calls: 100 },
          { date: '2024-01-14', page_views: 80, searches: 40, exports: 8, api_calls: 150 },
        ]

        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        })

        const result = await analyticsQueries.getDailyStats(30)

        expect(supabase.from).toHaveBeenCalledWith('analytics_daily')
        expect(result).toHaveLength(2) // Two unique dates

        const jan15 = result.find((r) => r.date === '2024-01-15')
        expect(jan15.page_views).toBe(150) // 100 + 50 aggregated
      })

      it('should throw on error', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        })

        await expect(analyticsQueries.getDailyStats()).rejects.toThrow()
      })
    })

    describe('getTopUsers', () => {
      it('should query user_engagement table', async () => {
        const mockData = [{ user_id: 'user1', engagement_score: 95 }]

        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        })

        const result = await analyticsQueries.getTopUsers(10)

        expect(supabase.from).toHaveBeenCalledWith('user_engagement')
        expect(result).toEqual(mockData)
      })

      it('should return empty array on null data', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

        const result = await analyticsQueries.getTopUsers()

        expect(result).toEqual([])
      })
    })

    describe('getAtRiskUsers', () => {
      it('should query at-risk users', async () => {
        const mockData = [{ user_id: 'user1', days_since_last_activity: 14 }]

        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        })

        const result = await analyticsQueries.getAtRiskUsers()

        expect(supabase.from).toHaveBeenCalledWith('user_engagement')
        expect(result).toEqual(mockData)
      })
    })

    describe('getEventsByType', () => {
      it('should aggregate events by type', async () => {
        const mockData = [
          { event_type: 'page_view' },
          { event_type: 'page_view' },
          { event_type: 'search' },
          { event_type: 'export' },
        ]

        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        })

        const result = await analyticsQueries.getEventsByType(7)

        expect(supabase.from).toHaveBeenCalledWith('analytics_events')
        expect(result).toContainEqual({ type: 'page_view', count: 2 })
        expect(result).toContainEqual({ type: 'search', count: 1 })
        expect(result).toContainEqual({ type: 'export', count: 1 })
      })

      it('should throw on error', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        })

        await expect(analyticsQueries.getEventsByType()).rejects.toThrow()
      })

      it('should handle empty data', async () => {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        })

        const result = await analyticsQueries.getEventsByType()

        expect(result).toEqual([])
      })
    })
  })
})
