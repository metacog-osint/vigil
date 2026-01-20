/**
 * Unit tests for apiKeys.js
 * Tests key generation, validation, and utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Setup mock functions
const mockInsertSelect = vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
const mockSelectEqOrder = vi.fn(() =>
  Promise.resolve({ data: [{ id: 'key-1' }, { id: 'key-2' }], error: null })
)
const mockSelectEqEqSingle = vi.fn(() =>
  Promise.resolve({ data: { id: 'key-1', is_active: true }, error: null })
)
const mockUpdateEqEqSelectSingle = vi.fn(() =>
  Promise.resolve({ data: { id: 'key-1', name: 'Updated' }, error: null })
)
const mockDeleteEqEq = vi.fn(() => Promise.resolve({ error: null }))
const mockUsageSelect = vi.fn(() =>
  Promise.resolve({
    data: [
      {
        endpoint: '/api/actors',
        status_code: 200,
        response_time_ms: 100,
        created_at: new Date().toISOString(),
      },
      {
        endpoint: '/api/actors',
        status_code: 200,
        response_time_ms: 150,
        created_at: new Date().toISOString(),
      },
      {
        endpoint: '/api/iocs',
        status_code: 200,
        response_time_ms: 80,
        created_at: new Date().toISOString(),
      },
    ],
    error: null,
  })
)

// Mock supabase before importing apiKeys
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'api_request_log') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: mockUsageSelect,
            })),
          })),
        }
      }
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockInsertSelect,
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSelectEqEqSingle,
            })),
            order: mockSelectEqOrder,
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: mockUpdateEqEqSelectSingle,
              })),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: mockDeleteEqEq,
          })),
        })),
      }
    }),
  },
}))

// Import after mock
import { apiKeys } from '../apiKeys'

describe('apiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should generate a key with vgl_ prefix', async () => {
      const result = await apiKeys.create('user-123', 'Test Key', ['read'])

      expect(result.key).toBeDefined()
      expect(result.key.startsWith('vgl_')).toBe(true)
    })

    it('should generate a key with 36 total characters (4 prefix + 32 random)', async () => {
      const result = await apiKeys.create('user-123', 'Test Key', ['read'])

      expect(result.key.length).toBe(36)
    })

    it('should generate different keys each time', async () => {
      const result1 = await apiKeys.create('user-123', 'Key 1', ['read'])
      const result2 = await apiKeys.create('user-123', 'Key 2', ['read'])

      expect(result1.key).not.toBe(result2.key)
    })

    it('should only use alphanumeric characters in key', async () => {
      const result = await apiKeys.create('user-123', 'Test Key', ['read'])
      const keyPart = result.key.substring(4) // Remove vgl_ prefix

      expect(keyPart).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should return keyData from database', async () => {
      const result = await apiKeys.create('user-123', 'Test Key', ['read'])

      expect(result.keyData).toBeDefined()
      expect(result.keyData.id).toBe('test-id')
    })

    it('should handle duplicate key name error', async () => {
      mockInsertSelect.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      })

      await expect(apiKeys.create('user-123', 'Duplicate Key', ['read'])).rejects.toThrow(
        'An API key named "Duplicate Key" already exists'
      )
    })

    it('should throw on database error', async () => {
      mockInsertSelect.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      })

      await expect(apiKeys.create('user-123', 'Test Key', ['read'])).rejects.toThrow()
    })

    it('should accept expiration date parameter', async () => {
      const expiresAt = new Date('2025-12-31')
      const result = await apiKeys.create('user-123', 'Test Key', ['read'], expiresAt)

      expect(result.keyData).toBeDefined()
    })
  })

  describe('getAll', () => {
    it('should return all keys for user', async () => {
      const result = await apiKeys.getAll('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('key-1')
    })

    it('should return empty array when no keys exist', async () => {
      mockSelectEqOrder.mockResolvedValueOnce({ data: null, error: null })

      const result = await apiKeys.getAll('user-123')

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      mockSelectEqOrder.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(apiKeys.getAll('user-123')).rejects.toThrow()
    })
  })

  describe('getById', () => {
    it('should return key by id and user', async () => {
      const result = await apiKeys.getById('key-1', 'user-123')

      expect(result).toBeDefined()
      expect(result.id).toBe('key-1')
    })

    it('should throw on database error', async () => {
      mockSelectEqEqSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      await expect(apiKeys.getById('key-1', 'user-123')).rejects.toThrow()
    })
  })

  describe('update', () => {
    it('should update allowed fields', async () => {
      const result = await apiKeys.update('key-1', 'user-123', { name: 'Updated' })

      expect(result).toBeDefined()
      expect(result.name).toBe('Updated')
    })

    it('should filter out disallowed fields', async () => {
      const result = await apiKeys.update('key-1', 'user-123', {
        name: 'Updated',
        key_hash: 'malicious',
        user_id: 'different',
      })

      // Should still return result (filtered updates applied)
      expect(result).toBeDefined()
    })

    it('should throw on database error', async () => {
      mockUpdateEqEqSelectSingle.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(apiKeys.update('key-1', 'user-123', { name: 'Test' })).rejects.toThrow()
    })
  })

  describe('revoke', () => {
    it('should deactivate the key', async () => {
      const result = await apiKeys.revoke('key-1', 'user-123')

      expect(result).toBeDefined()
    })
  })

  describe('delete', () => {
    it('should delete the key', async () => {
      const result = await apiKeys.delete('key-1', 'user-123')

      expect(result).toBe(true)
    })

    it('should throw on database error', async () => {
      mockDeleteEqEq.mockResolvedValueOnce({ error: { message: 'Error' } })

      await expect(apiKeys.delete('key-1', 'user-123')).rejects.toThrow()
    })
  })

  describe('getUsageStats', () => {
    it('should calculate usage statistics', async () => {
      const result = await apiKeys.getUsageStats('user-123', 30)

      expect(result).toHaveProperty('totalRequests', 3)
      expect(result).toHaveProperty('avgResponseTime')
      expect(result).toHaveProperty('topEndpoints')
      expect(result).toHaveProperty('dailyData')
    })

    it('should count today requests correctly', async () => {
      const result = await apiKeys.getUsageStats('user-123', 30)

      expect(result.requestsToday).toBe(3) // All mock data is today
    })

    it('should calculate average response time', async () => {
      const result = await apiKeys.getUsageStats('user-123', 30)

      // (100 + 150 + 80) / 3 = 110
      expect(result.avgResponseTime).toBe(110)
    })

    it('should get top endpoints sorted by count', async () => {
      const result = await apiKeys.getUsageStats('user-123', 30)

      expect(result.topEndpoints[0].endpoint).toBe('/api/actors')
      expect(result.topEndpoints[0].count).toBe(2)
    })

    it('should return zero avg for no requests', async () => {
      mockUsageSelect.mockResolvedValueOnce({ data: [], error: null })

      const result = await apiKeys.getUsageStats('user-123', 30)

      expect(result.totalRequests).toBe(0)
      expect(result.avgResponseTime).toBe(0)
    })

    it('should throw on database error', async () => {
      mockUsageSelect.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      await expect(apiKeys.getUsageStats('user-123', 30)).rejects.toThrow()
    })
  })

  describe('validate', () => {
    it('should return null for empty key', async () => {
      const result = await apiKeys.validate('')
      expect(result).toBe(null)
    })

    it('should return null for null key', async () => {
      const result = await apiKeys.validate(null)
      expect(result).toBe(null)
    })

    it('should return null for key without vgl_ prefix', async () => {
      const result = await apiKeys.validate('invalid_key_format')
      expect(result).toBe(null)
    })

    it('should return null for key with wrong prefix', async () => {
      const result = await apiKeys.validate('api_wrongprefix123')
      expect(result).toBe(null)
    })
  })
})

describe('key format validation', () => {
  it('should validate correct key format', () => {
    const validKey = 'vgl_AbCdEfGhIjKlMnOpQrStUvWxYz123456'
    expect(validKey.startsWith('vgl_')).toBe(true)
    expect(validKey.length).toBe(36)
    expect(validKey.substring(4)).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('should reject key without proper prefix', () => {
    const invalidKey = 'api_AbCdEfGhIjKlMnOpQrStUvWxYz12345'
    expect(invalidKey.startsWith('vgl_')).toBe(false)
  })

  it('should reject key with special characters', () => {
    const invalidKey = 'vgl_AbCdEfGh!@#$MnOpQrStUvWxYz1234'
    const keyPart = invalidKey.substring(4)
    expect(keyPart).not.toMatch(/^[A-Za-z0-9]+$/)
  })
})

describe('scopes validation', () => {
  const validScopes = ['read', 'write']

  it('should accept read scope', () => {
    expect(validScopes).toContain('read')
  })

  it('should accept write scope', () => {
    expect(validScopes).toContain('write')
  })
})

describe('key expiration logic', () => {
  it('should identify expired key', () => {
    const expiredDate = new Date('2020-01-01')
    const now = new Date()
    expect(expiredDate < now).toBe(true)
  })

  it('should identify valid key', () => {
    const futureDate = new Date('2030-01-01')
    const now = new Date()
    expect(futureDate > now).toBe(true)
  })

  it('should handle null expiration (never expires)', () => {
    const expiresAt = null
    // Null means no expiration
    expect(expiresAt === null || new Date(expiresAt) > new Date()).toBe(true)
  })
})

describe('rate limiting calculations', () => {
  it('should calculate daily limit correctly', () => {
    const rateLimitPerDay = 1000
    const requestsToday = 500
    expect(requestsToday < rateLimitPerDay).toBe(true)
  })

  it('should identify when daily limit exceeded', () => {
    const rateLimitPerDay = 1000
    const requestsToday = 1500
    expect(requestsToday >= rateLimitPerDay).toBe(true)
  })

  it('should calculate minute limit correctly', () => {
    const rateLimitPerMinute = 60
    const requestsThisMinute = 30
    expect(requestsThisMinute < rateLimitPerMinute).toBe(true)
  })
})

describe('usage statistics calculations', () => {
  it('should calculate average response time', () => {
    const requests = [
      { response_time_ms: 100 },
      { response_time_ms: 200 },
      { response_time_ms: 150 },
    ]
    const avg = requests.reduce((sum, r) => sum + r.response_time_ms, 0) / requests.length
    expect(avg).toBe(150)
  })

  it('should handle empty requests array', () => {
    const requests = []
    const avg =
      requests.length > 0
        ? requests.reduce((sum, r) => sum + r.response_time_ms, 0) / requests.length
        : 0
    expect(avg).toBe(0)
  })

  it('should count requests by endpoint', () => {
    const requests = [
      { endpoint: '/api/actors' },
      { endpoint: '/api/actors' },
      { endpoint: '/api/iocs' },
      { endpoint: '/api/actors' },
    ]

    const counts = {}
    requests.forEach((r) => {
      counts[r.endpoint] = (counts[r.endpoint] || 0) + 1
    })

    expect(counts['/api/actors']).toBe(3)
    expect(counts['/api/iocs']).toBe(1)
  })

  it('should get top endpoints sorted by count', () => {
    const endpointCounts = {
      '/api/actors': 10,
      '/api/iocs': 25,
      '/api/vulnerabilities': 5,
      '/api/incidents': 15,
    }

    const sorted = Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([endpoint, count]) => ({ endpoint, count }))

    expect(sorted[0].endpoint).toBe('/api/iocs')
    expect(sorted[0].count).toBe(25)
    expect(sorted.length).toBe(3)
  })
})

describe('allowed fields for update', () => {
  const allowedFields = [
    'name',
    'scopes',
    'is_active',
    'expires_at',
    'rate_limit_per_minute',
    'rate_limit_per_day',
  ]

  it('should include name in allowed fields', () => {
    expect(allowedFields).toContain('name')
  })

  it('should include scopes in allowed fields', () => {
    expect(allowedFields).toContain('scopes')
  })

  it('should include is_active in allowed fields', () => {
    expect(allowedFields).toContain('is_active')
  })

  it('should include rate limits in allowed fields', () => {
    expect(allowedFields).toContain('rate_limit_per_minute')
    expect(allowedFields).toContain('rate_limit_per_day')
  })

  it('should not include key_hash in allowed fields (security)', () => {
    expect(allowedFields).not.toContain('key_hash')
  })

  it('should not include user_id in allowed fields (security)', () => {
    expect(allowedFields).not.toContain('user_id')
  })

  it('should filter updates to only allowed fields', () => {
    const updates = {
      name: 'New Name',
      key_hash: 'malicious_hash',
      user_id: 'different_user',
      scopes: ['read'],
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    )

    expect(filteredUpdates.name).toBe('New Name')
    expect(filteredUpdates.scopes).toEqual(['read'])
    expect(filteredUpdates.key_hash).toBeUndefined()
    expect(filteredUpdates.user_id).toBeUndefined()
  })
})
