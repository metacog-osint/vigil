/**
 * Alerts Module Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { alerts } from '../alerts'
import { supabase } from '../client'

// Mock supabase client
vi.mock('../client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('alerts module', () => {
  let mockQuery

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    }
    supabase.from.mockReturnValue(mockQuery)
  })

  describe('getAll', () => {
    it('fetches all alerts with default options', async () => {
      await alerts.getAll()

      expect(supabase.from).toHaveBeenCalledWith('alerts')
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(mockQuery.order).toHaveBeenCalledWith('published_date', { ascending: false })
      expect(mockQuery.range).toHaveBeenCalledWith(0, 99)
    })

    it('applies search filter', async () => {
      await alerts.getAll({ search: 'ransomware' })

      expect(mockQuery.or).toHaveBeenCalledWith('title.ilike.%ransomware%,description.ilike.%ransomware%')
    })

    it('applies category filter', async () => {
      await alerts.getAll({ category: 'ICS' })

      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'ICS')
    })

    it('applies severity filter', async () => {
      await alerts.getAll({ severity: 'critical' })

      expect(mockQuery.eq).toHaveBeenCalledWith('severity', 'critical')
    })

    it('applies pagination', async () => {
      await alerts.getAll({ limit: 25, offset: 50 })

      expect(mockQuery.range).toHaveBeenCalledWith(50, 74)
    })

    it('applies multiple filters together', async () => {
      await alerts.getAll({
        search: 'APT',
        category: 'AA',
        severity: 'high',
      })

      expect(mockQuery.or).toHaveBeenCalledWith('title.ilike.%APT%,description.ilike.%APT%')
      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'AA')
      expect(mockQuery.eq).toHaveBeenCalledWith('severity', 'high')
    })
  })

  describe('getRecent', () => {
    it('fetches recent alerts with default options', async () => {
      await alerts.getRecent()

      expect(supabase.from).toHaveBeenCalledWith('alerts')
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(mockQuery.order).toHaveBeenCalledWith('published_date', { ascending: false })
      expect(mockQuery.range).toHaveBeenCalledWith(0, 49)
    })

    it('applies date filter when days > 0', async () => {
      await alerts.getRecent({ days: 7 })

      expect(mockQuery.gte).toHaveBeenCalled()
    })

    it('skips date filter when days is 0', async () => {
      await alerts.getRecent({ days: 0 })

      expect(mockQuery.gte).not.toHaveBeenCalled()
    })

    it('applies category filter', async () => {
      await alerts.getRecent({ category: 'TA' })

      expect(mockQuery.eq).toHaveBeenCalledWith('category', 'TA')
    })

    it('applies severity filter', async () => {
      await alerts.getRecent({ severity: 'medium' })

      expect(mockQuery.eq).toHaveBeenCalledWith('severity', 'medium')
    })

    it('applies pagination', async () => {
      await alerts.getRecent({ limit: 10, offset: 20 })

      expect(mockQuery.range).toHaveBeenCalledWith(20, 29)
    })
  })

  describe('getById', () => {
    it('fetches alert by id', async () => {
      await alerts.getById('alert-123')

      expect(supabase.from).toHaveBeenCalledWith('alerts')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'alert-123')
      expect(mockQuery.single).toHaveBeenCalled()
    })
  })

  describe('getByCVE', () => {
    it('fetches alerts containing a specific CVE', async () => {
      await alerts.getByCVE('CVE-2024-1234')

      expect(supabase.from).toHaveBeenCalledWith('alerts')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.contains).toHaveBeenCalledWith('cve_ids', ['CVE-2024-1234'])
      expect(mockQuery.order).toHaveBeenCalledWith('published_date', { ascending: false })
    })
  })
})
