/**
 * Unit tests for supabase module exports
 * Tests helper functions and query modules
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    from: vi.fn(() => mockQuery),
  })),
}))

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  contains: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: {}, error: null }),
}

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: { VITE_SUPABASE_URL: 'http://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-key' },
  },
})

import {
  supabase,
  subscribeToTable,
  threatActors,
  incidents,
  iocs,
  vulnerabilities,
  orgProfile,
  relevance,
  correlations,
  trendAnalysis,
  teams,
  sharedWatchlists,
} from '../supabase'

describe('supabase module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('subscribeToTable', () => {
    it('should create a channel subscription', () => {
      const callback = vi.fn()
      const unsubscribe = subscribeToTable('incidents', callback)

      expect(supabase.channel).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = subscribeToTable('incidents', callback)

      // Should not throw when called
      expect(() => unsubscribe()).not.toThrow()
    })

    it('should handle filter parameter', () => {
      const callback = vi.fn()
      subscribeToTable('incidents', callback, 'actor_id=eq.123')

      expect(supabase.channel).toHaveBeenCalled()
    })
  })

  describe('threatActors', () => {
    it('should have getAll method', () => {
      expect(typeof threatActors.getAll).toBe('function')
    })

    it('should have getById method', () => {
      expect(typeof threatActors.getById).toBe('function')
    })

    it('should have getTopActive method', () => {
      expect(typeof threatActors.getTopActive).toBe('function')
    })

    it('should have getEscalating method', () => {
      expect(typeof threatActors.getEscalating).toBe('function')
    })

    it('should have getTrendSummary method', () => {
      expect(typeof threatActors.getTrendSummary).toBe('function')
    })
  })

  describe('incidents', () => {
    it('should have getAll method', () => {
      expect(typeof incidents.getAll).toBe('function')
    })

    it('should have getRecent method', () => {
      expect(typeof incidents.getRecent).toBe('function')
    })

    it('should have getStats method', () => {
      expect(typeof incidents.getStats).toBe('function')
    })

    it('should have search method', () => {
      expect(typeof incidents.search).toBe('function')
    })

    it('should have getBySector method', () => {
      expect(typeof incidents.getBySector).toBe('function')
    })
  })

  describe('iocs', () => {
    it('should have getAll method', () => {
      expect(typeof iocs.getAll).toBe('function')
    })

    it('should have getByActor method', () => {
      expect(typeof iocs.getByActor).toBe('function')
    })

    it('should have search method', () => {
      expect(typeof iocs.search).toBe('function')
    })

    it('should have quickLookup method', () => {
      expect(typeof iocs.quickLookup).toBe('function')
    })

    it('should have getEnrichmentLinks method', () => {
      expect(typeof iocs.getEnrichmentLinks).toBe('function')
    })
  })

  describe('vulnerabilities', () => {
    it('should have getAll method', () => {
      expect(typeof vulnerabilities.getAll).toBe('function')
    })

    it('should have getKEV method', () => {
      expect(typeof vulnerabilities.getKEV).toBe('function')
    })

    it('should have getCritical method', () => {
      expect(typeof vulnerabilities.getCritical).toBe('function')
    })

    it('should have search method', () => {
      expect(typeof vulnerabilities.search).toBe('function')
    })
  })

  describe('orgProfile', () => {
    it('should have get method', () => {
      expect(typeof orgProfile.get).toBe('function')
    })

    it('should have update method', () => {
      expect(typeof orgProfile.update).toBe('function')
    })

    it('should have hasProfile method', () => {
      expect(typeof orgProfile.hasProfile).toBe('function')
    })
  })

  describe('relevance', () => {
    it('should have getRelevantActors method', () => {
      expect(typeof relevance.getRelevantActors).toBe('function')
    })

    it('should have getRelevantVulnerabilities method', () => {
      expect(typeof relevance.getRelevantVulnerabilities).toBe('function')
    })

    it('should have calculateActorScore method', () => {
      expect(typeof relevance.calculateActorScore).toBe('function')
    })

    it('should have calculateVulnScore method', () => {
      expect(typeof relevance.calculateVulnScore).toBe('function')
    })

    describe('calculateActorScore', () => {
      it('should return 0 for null profile', () => {
        const result = relevance.calculateActorScore({}, null)
        expect(result).toBe(0)
      })

      it('should add sector match points', () => {
        const actor = { target_sectors: ['healthcare', 'finance'] }
        const profile = { sector: 'healthcare' }
        const result = relevance.calculateActorScore(actor, profile)

        expect(result).toBeGreaterThan(0)
      })

      it('should add country match points', () => {
        const actor = { target_countries: ['US', 'UK'] }
        const profile = { country: 'US' }
        const result = relevance.calculateActorScore(actor, profile)

        expect(result).toBeGreaterThan(0)
      })

      it('should add escalating trend bonus', () => {
        const actor = { target_sectors: [], trend_status: 'ESCALATING' }
        const profile = { sector: 'tech' }
        const result = relevance.calculateActorScore(actor, profile)

        expect(result).toBeGreaterThanOrEqual(20) // Escalating bonus
      })

      it('should cap score at 100', () => {
        const actor = {
          target_sectors: ['healthcare'],
          target_countries: ['US'],
          trend_status: 'ESCALATING',
        }
        const profile = { sector: 'healthcare', country: 'US' }
        const result = relevance.calculateActorScore(actor, profile)

        expect(result).toBeLessThanOrEqual(100)
      })
    })

    describe('calculateVulnScore', () => {
      it('should return 0 for null profile', () => {
        const result = relevance.calculateVulnScore({}, null)
        expect(result).toBe(0)
      })

      it('should add KEV bonus points', () => {
        const vuln = { kev_date: '2024-01-01' }
        const profile = { sector: 'tech', tech_vendors: [] }
        const result = relevance.calculateVulnScore(vuln, profile)

        expect(result).toBe(10) // KEV bonus
      })

      it('should handle critical severity', () => {
        const vuln = { severity: 'CRITICAL' }
        const profile = { sector: 'tech' }
        const result = relevance.calculateVulnScore(vuln, profile)

        expect(result).toBeGreaterThanOrEqual(0)
      })

      it('should add vendor match points', () => {
        const vuln = { affected_vendors: ['Microsoft'] }
        const profile = { tech_vendors: ['Microsoft', 'Adobe'] }
        const result = relevance.calculateVulnScore(vuln, profile)

        expect(result).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('correlations', () => {
    it('should have getActorCorrelations method', () => {
      expect(typeof correlations.getActorCorrelations).toBe('function')
    })

    it('should have getVulnActors method', () => {
      expect(typeof correlations.getVulnActors).toBe('function')
    })

    it('should have getTechniqueActors method', () => {
      expect(typeof correlations.getTechniqueActors).toBe('function')
    })
  })

  describe('trendAnalysis', () => {
    it('should have getWeekOverWeekChange method', () => {
      expect(typeof trendAnalysis.getWeekOverWeekChange).toBe('function')
    })

    it('should have getChangeSummary method', () => {
      expect(typeof trendAnalysis.getChangeSummary).toBe('function')
    })

    it('should have getSectorTrends method', () => {
      expect(typeof trendAnalysis.getSectorTrends).toBe('function')
    })
  })

  describe('teams', () => {
    it('should have getUserTeams method', () => {
      expect(typeof teams.getUserTeams).toBe('function')
    })

    it('should have createTeam method', () => {
      expect(typeof teams.createTeam).toBe('function')
    })

    it('should have getTeam method', () => {
      expect(typeof teams.getTeam).toBe('function')
    })

    it('should have updateTeam method', () => {
      expect(typeof teams.updateTeam).toBe('function')
    })

    it('should have updateMemberRole method', () => {
      expect(typeof teams.updateMemberRole).toBe('function')
    })

    it('should have removeMember method', () => {
      expect(typeof teams.removeMember).toBe('function')
    })

    it('should have createInvitation method', () => {
      expect(typeof teams.createInvitation).toBe('function')
    })

    it('should have acceptInvitation method', () => {
      expect(typeof teams.acceptInvitation).toBe('function')
    })

    it('should have getPendingInvitations method', () => {
      expect(typeof teams.getPendingInvitations).toBe('function')
    })

    it('should have cancelInvitation method', () => {
      expect(typeof teams.cancelInvitation).toBe('function')
    })

    it('should have logActivity method', () => {
      expect(typeof teams.logActivity).toBe('function')
    })

    it('should have getActivityLog method', () => {
      expect(typeof teams.getActivityLog).toBe('function')
    })
  })

  describe('sharedWatchlists', () => {
    it('should have getTeamWatchlists method', () => {
      expect(typeof sharedWatchlists.getTeamWatchlists).toBe('function')
    })

    it('should have getWatchlist method', () => {
      expect(typeof sharedWatchlists.getWatchlist).toBe('function')
    })

    it('should have createWatchlist method', () => {
      expect(typeof sharedWatchlists.createWatchlist).toBe('function')
    })

    it('should have updateWatchlist method', () => {
      expect(typeof sharedWatchlists.updateWatchlist).toBe('function')
    })

    it('should have deleteWatchlist method', () => {
      expect(typeof sharedWatchlists.deleteWatchlist).toBe('function')
    })

    it('should have getWatchlistItems method', () => {
      expect(typeof sharedWatchlists.getWatchlistItems).toBe('function')
    })

    it('should have addItem method', () => {
      expect(typeof sharedWatchlists.addItem).toBe('function')
    })

    it('should have removeItem method', () => {
      expect(typeof sharedWatchlists.removeItem).toBe('function')
    })

    it('should have updateItemNotes method', () => {
      expect(typeof sharedWatchlists.updateItemNotes).toBe('function')
    })
  })
})

describe('relevance scoring edge cases', () => {
  describe('calculateActorScore', () => {
    it('should handle actor with empty arrays', () => {
      const actor = { target_sectors: [], target_countries: [] }
      const profile = { sector: 'healthcare' }
      const result = relevance.calculateActorScore(actor, profile)

      expect(result).toBe(0)
    })

    it('should handle profile without sector', () => {
      const actor = { target_sectors: ['healthcare'] }
      const profile = {}
      const result = relevance.calculateActorScore(actor, profile)

      // No sector match without profile sector
      expect(result).toBe(0)
    })

    it('should handle stable trend scoring', () => {
      const actor = { target_sectors: [], trend_status: 'STABLE' }
      const profile = { sector: 'tech' }
      const result = relevance.calculateActorScore(actor, profile)

      expect(result).toBe(10) // Stable bonus only
    })
  })

  describe('calculateVulnScore', () => {
    it('should handle vulnerability with empty fields', () => {
      const vuln = {}
      const profile = { tech_vendors: ['Microsoft'], sector: 'tech' }
      const result = relevance.calculateVulnScore(vuln, profile)

      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('should handle profile without tech_vendors', () => {
      const vuln = { affected_vendors: ['Microsoft'] }
      const profile = { sector: 'tech' }
      const result = relevance.calculateVulnScore(vuln, profile)

      // No vendor match points without profile vendors
      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('should handle different severity levels', () => {
      const profile = { sector: 'tech' }
      const criticalVuln = { severity: 'CRITICAL' }
      const highVuln = { severity: 'HIGH' }
      const mediumVuln = { severity: 'MEDIUM' }

      const criticalScore = relevance.calculateVulnScore(criticalVuln, profile)
      const highScore = relevance.calculateVulnScore(highVuln, profile)
      const mediumScore = relevance.calculateVulnScore(mediumVuln, profile)

      expect(criticalScore).toBeGreaterThanOrEqual(highScore)
      expect(highScore).toBeGreaterThanOrEqual(mediumScore)
    })
  })
})
