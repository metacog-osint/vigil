/**
 * Unit tests for features.js
 */

import { describe, it, expect } from 'vitest'
import {
  canAccess,
  getTierFeatures,
  getRequiredTier,
  isLimitReached,
  getLimit,
  getUpgradeTier,
  compareTiers,
  TIERS,
  TIER_FEATURES,
} from '../features'

describe('canAccess', () => {
  it('should return true for free tier accessing free features', () => {
    expect(canAccess('free', 'view_dashboard')).toBe(true)
    expect(canAccess('free', 'view_actors')).toBe(true)
    expect(canAccess('free', 'basic_search')).toBe(true)
  })

  it('should return false for free tier accessing paid features', () => {
    expect(canAccess('free', 'api_access')).toBe(false)
    expect(canAccess('free', 'email_digests')).toBe(false)
    expect(canAccess('free', 'siem_integration')).toBe(false)
  })

  it('should return true for higher tiers accessing lower tier features', () => {
    expect(canAccess('professional', 'view_dashboard')).toBe(true)
    expect(canAccess('team', 'email_digests')).toBe(true)
    expect(canAccess('enterprise', 'api_access')).toBe(true)
  })

  it('should handle null/undefined tier as free', () => {
    expect(canAccess(null, 'view_dashboard')).toBe(true)
    expect(canAccess(undefined, 'api_access')).toBe(false)
  })

  it('should return false for invalid tier', () => {
    expect(canAccess('invalid_tier', 'view_dashboard')).toBe(false)
  })

  it('should return false for non-existent feature', () => {
    expect(canAccess('enterprise', 'non_existent_feature')).toBe(false)
  })
})

describe('getTierFeatures', () => {
  it('should return only free features for free tier', () => {
    const features = getTierFeatures('free')
    expect(features).toContain('view_dashboard')
    expect(features).not.toContain('api_access')
    expect(features).not.toContain('siem_integration')
  })

  it('should return cumulative features for higher tiers', () => {
    const professionalFeatures = getTierFeatures('professional')
    expect(professionalFeatures).toContain('view_dashboard') // free
    expect(professionalFeatures).toContain('email_digests') // professional
    expect(professionalFeatures).not.toContain('api_access') // team

    const teamFeatures = getTierFeatures('team')
    expect(teamFeatures).toContain('view_dashboard') // free
    expect(teamFeatures).toContain('email_digests') // professional
    expect(teamFeatures).toContain('api_access') // team
  })

  it('should return all features for enterprise tier', () => {
    const features = getTierFeatures('enterprise')
    expect(features).toContain('view_dashboard')
    expect(features).toContain('email_digests')
    expect(features).toContain('api_access')
    expect(features).toContain('siem_integration')
  })

  it('should not have duplicates', () => {
    const features = getTierFeatures('enterprise')
    const uniqueFeatures = [...new Set(features)]
    expect(features.length).toBe(uniqueFeatures.length)
  })
})

describe('getRequiredTier', () => {
  it('should return correct tier for each feature', () => {
    expect(getRequiredTier('view_dashboard')).toBe('free')
    expect(getRequiredTier('email_digests')).toBe('professional')
    expect(getRequiredTier('api_access')).toBe('team')
    expect(getRequiredTier('siem_integration')).toBe('enterprise')
  })

  it('should return null for non-existent feature', () => {
    expect(getRequiredTier('fake_feature')).toBeNull()
  })
})

describe('isLimitReached', () => {
  it('should return true when at or over limit', () => {
    expect(isLimitReached('free', 'watchlistItems', 10)).toBe(true)
    expect(isLimitReached('free', 'watchlistItems', 15)).toBe(true)
  })

  it('should return false when under limit', () => {
    expect(isLimitReached('free', 'watchlistItems', 5)).toBe(false)
  })

  it('should return false for unlimited (-1)', () => {
    expect(isLimitReached('team', 'watchlistItems', 1000)).toBe(false)
    expect(isLimitReached('enterprise', 'users', 10000)).toBe(false)
  })
})

describe('getLimit', () => {
  it('should return correct limits for each tier', () => {
    expect(getLimit('free', 'watchlistItems')).toBe(10)
    expect(getLimit('professional', 'watchlistItems')).toBe(100)
    expect(getLimit('team', 'watchlistItems')).toBe(-1) // unlimited
  })

  it('should return 0 for unknown limit type', () => {
    expect(getLimit('free', 'unknownLimit')).toBe(0)
  })
})

describe('getUpgradeTier', () => {
  it('should return next tier', () => {
    expect(getUpgradeTier('free')).toBe('professional')
    expect(getUpgradeTier('professional')).toBe('team')
    expect(getUpgradeTier('team')).toBe('enterprise')
  })

  it('should return null for highest tier', () => {
    expect(getUpgradeTier('enterprise')).toBeNull()
  })

  it('should handle null as free', () => {
    expect(getUpgradeTier(null)).toBe('professional')
  })
})

describe('compareTiers', () => {
  it('should return negative when first tier is lower', () => {
    expect(compareTiers('free', 'professional')).toBeLessThan(0)
    expect(compareTiers('professional', 'team')).toBeLessThan(0)
  })

  it('should return positive when first tier is higher', () => {
    expect(compareTiers('team', 'free')).toBeGreaterThan(0)
    expect(compareTiers('enterprise', 'professional')).toBeGreaterThan(0)
  })

  it('should return 0 for same tier', () => {
    expect(compareTiers('professional', 'professional')).toBe(0)
  })
})

describe('TIERS constant', () => {
  it('should have correct order', () => {
    expect(TIERS).toEqual(['free', 'professional', 'team', 'enterprise'])
  })
})

describe('TIER_FEATURES', () => {
  it('should have features for all tiers', () => {
    TIERS.forEach((tier) => {
      expect(TIER_FEATURES[tier]).toBeDefined()
      expect(Array.isArray(TIER_FEATURES[tier])).toBe(true)
      expect(TIER_FEATURES[tier].length).toBeGreaterThan(0)
    })
  })
})
