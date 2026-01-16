/**
 * Vulnerabilities Module Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vulnerabilities } from '../vulnerabilities'
import { supabase } from '../client'

// Mock supabase client
vi.mock('../client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('vulnerabilities module', () => {
  let mockQuery

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    }
    supabase.from.mockReturnValue(mockQuery)
  })

  describe('getAll', () => {
    it('returns vulnerabilities with default options', async () => {
      await vulnerabilities.getAll()

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(mockQuery.order).toHaveBeenCalledWith('cvss_score', { ascending: false, nullsFirst: false })
      expect(mockQuery.range).toHaveBeenCalledWith(0, 99)
    })

    it('applies search filter', async () => {
      await vulnerabilities.getAll({ search: 'CVE-2024' })

      expect(mockQuery.or).toHaveBeenCalledWith('cve_id.ilike.%CVE-2024%,description.ilike.%CVE-2024%')
    })

    it('applies minimum CVSS filter', async () => {
      await vulnerabilities.getAll({ minCvss: 7.0 })

      expect(mockQuery.gte).toHaveBeenCalledWith('cvss_score', 7.0)
    })

    it('filters KEV only when requested', async () => {
      await vulnerabilities.getAll({ kevOnly: true })

      expect(mockQuery.not).toHaveBeenCalledWith('kev_date', 'is', null)
    })

    it('applies pagination options', async () => {
      await vulnerabilities.getAll({ limit: 50, offset: 100 })

      expect(mockQuery.range).toHaveBeenCalledWith(100, 149)
    })
  })

  describe('getKEV', () => {
    it('returns KEV vulnerabilities', async () => {
      await vulnerabilities.getKEV()

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.not).toHaveBeenCalledWith('kev_date', 'is', null)
      expect(mockQuery.order).toHaveBeenCalledWith('kev_date', { ascending: false })
    })

    it('filters by exploited status', async () => {
      await vulnerabilities.getKEV({ exploited: true })

      expect(mockQuery.eq).toHaveBeenCalledWith('exploited_in_wild', true)
    })

    it('applies pagination', async () => {
      await vulnerabilities.getKEV({ limit: 25, offset: 50 })

      expect(mockQuery.range).toHaveBeenCalledWith(50, 74)
    })
  })

  describe('getByCVE', () => {
    it('fetches vulnerability by CVE ID', async () => {
      await vulnerabilities.getByCVE('CVE-2024-1234')

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.eq).toHaveBeenCalledWith('cve_id', 'CVE-2024-1234')
      expect(mockQuery.single).toHaveBeenCalled()
    })
  })

  describe('getCritical', () => {
    it('fetches critical vulnerabilities with default threshold', async () => {
      await vulnerabilities.getCritical()

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.gte).toHaveBeenCalledWith('cvss_score', 9.0)
      expect(mockQuery.limit).toHaveBeenCalledWith(50)
    })

    it('accepts custom CVSS threshold', async () => {
      await vulnerabilities.getCritical(8.5)

      expect(mockQuery.gte).toHaveBeenCalledWith('cvss_score', 8.5)
    })
  })

  describe('getRecentKEV', () => {
    it('fetches recent KEV vulnerabilities', async () => {
      await vulnerabilities.getRecentKEV(30)

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.not).toHaveBeenCalledWith('kev_date', 'is', null)
      expect(mockQuery.order).toHaveBeenCalledWith('kev_date', { ascending: false })
      expect(mockQuery.limit).toHaveBeenCalledWith(20)
    })

    it('applies date filter when days > 0', async () => {
      await vulnerabilities.getRecentKEV(30)

      expect(mockQuery.gte).toHaveBeenCalled()
    })

    it('skips date filter when days is 0', async () => {
      await vulnerabilities.getRecentKEV(0)

      expect(mockQuery.gte).not.toHaveBeenCalled()
    })
  })

  describe('search', () => {
    it('searches vulnerabilities by query', async () => {
      await vulnerabilities.search('buffer overflow')

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.or).toHaveBeenCalledWith('cve_id.ilike.%buffer overflow%,description.ilike.%buffer overflow%')
      expect(mockQuery.order).toHaveBeenCalledWith('cvss_score', { ascending: false })
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })

    it('accepts custom limit', async () => {
      await vulnerabilities.search('RCE', 25)

      expect(mockQuery.limit).toHaveBeenCalledWith(25)
    })
  })

  describe('getBySeverity', () => {
    it('returns severity distribution', async () => {
      mockQuery.select.mockResolvedValue({
        data: [
          { cvss_score: 9.5 },
          { cvss_score: 9.1 },
          { cvss_score: 7.5 },
          { cvss_score: 5.0 },
          { cvss_score: 3.0 },
        ],
        error: null,
      })

      const result = await vulnerabilities.getBySeverity()

      expect(result).toEqual([
        { name: 'Critical', value: 2, severity: 'critical' },
        { name: 'High', value: 1, severity: 'high' },
        { name: 'Medium', value: 1, severity: 'medium' },
        { name: 'Low', value: 1, severity: 'low' },
      ])
    })

    it('handles empty data', async () => {
      mockQuery.select.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await vulnerabilities.getBySeverity()

      expect(result).toEqual([
        { name: 'Critical', value: 0, severity: 'critical' },
        { name: 'High', value: 0, severity: 'high' },
        { name: 'Medium', value: 0, severity: 'medium' },
        { name: 'Low', value: 0, severity: 'low' },
      ])
    })

    it('handles error', async () => {
      mockQuery.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const result = await vulnerabilities.getBySeverity()

      expect(result).toEqual([
        { name: 'Critical', value: 0, severity: 'critical' },
        { name: 'High', value: 0, severity: 'high' },
        { name: 'Medium', value: 0, severity: 'medium' },
        { name: 'Low', value: 0, severity: 'low' },
      ])
    })

    it('handles null cvss_score with severity field', async () => {
      mockQuery.select.mockResolvedValue({
        data: [
          { cvss_score: null, severity: 'CRITICAL' },
          { cvss_score: null, severity: 'high' },
          { cvss_score: null, severity: 'Medium' },
          { cvss_score: null, severity: 'LOW' },
        ],
        error: null,
      })

      const result = await vulnerabilities.getBySeverity()

      expect(result).toEqual([
        { name: 'Critical', value: 1, severity: 'critical' },
        { name: 'High', value: 1, severity: 'high' },
        { name: 'Medium', value: 1, severity: 'medium' },
        { name: 'Low', value: 1, severity: 'low' },
      ])
    })

    it('counts unknown severity', async () => {
      mockQuery.select.mockResolvedValue({
        data: [
          { cvss_score: null, severity: null },
          { cvss_score: null, severity: 'invalid' },
        ],
        error: null,
      })

      const result = await vulnerabilities.getBySeverity()

      expect(result).toContainEqual({ name: 'Unknown', value: 2, severity: 'none' })
    })
  })

  describe('getActivelyExploited', () => {
    it('returns empty array on error', async () => {
      mockQuery.limit.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      })

      const result = await vulnerabilities.getActivelyExploited()

      expect(result).toEqual([])
    })

    it('fetches and enriches KEV vulnerabilities with actor correlations', async () => {
      const mockKevs = [
        { cve_id: 'CVE-2024-001', cvss_score: 9.8, kev_date: '2024-01-01' },
        { cve_id: 'CVE-2024-002', cvss_score: 7.5, kev_date: '2024-01-02' },
      ]

      const mockCorrelations = [
        { cve_id: 'CVE-2024-001', actor: { id: '1', name: 'APT29', actor_type: 'nation-state' } },
      ]

      // First call returns KEVs
      mockQuery.limit.mockResolvedValueOnce({
        data: mockKevs,
        error: null,
      })

      // Second call returns correlations
      mockQuery.in.mockResolvedValueOnce({
        data: mockCorrelations,
        error: null,
      })

      const result = await vulnerabilities.getActivelyExploited(30, 10)

      expect(result.length).toBeLessThanOrEqual(10)
      expect(result[0]).toHaveProperty('actors')
      expect(result[0]).toHaveProperty('severity')
    })
  })

  describe('getRecentForServices', () => {
    it('fetches recent vulnerabilities for service matching', async () => {
      mockQuery.limit.mockResolvedValue({
        data: [
          { cve_id: 'CVE-2024-001', affected_products: ['Apache'], cvss_score: 9.0 },
        ],
        error: null,
      })

      const result = await vulnerabilities.getRecentForServices(30)

      expect(supabase.from).toHaveBeenCalledWith('vulnerabilities')
      expect(mockQuery.select).toHaveBeenCalledWith('cve_id, affected_products, affected_vendors, description, cvss_score')
      expect(mockQuery.limit).toHaveBeenCalledWith(500)
      expect(result).toHaveLength(1)
    })

    it('returns empty array on error', async () => {
      mockQuery.limit.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      })

      const result = await vulnerabilities.getRecentForServices()

      expect(result).toEqual([])
    })
  })
})
