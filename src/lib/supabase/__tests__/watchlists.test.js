/**
 * Watchlists Module Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { watchlists } from '../watchlists'
import { supabase } from '../client'

// Mock supabase client
vi.mock('../client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('watchlists module', () => {
  let mockQuery

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    }
    supabase.from.mockReturnValue(mockQuery)
  })

  describe('getAll', () => {
    it('fetches all watchlists for a user', async () => {
      await watchlists.getAll('user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(mockQuery.select).toHaveBeenCalledWith(`
        *,
        items:watchlist_items(count)
      `)
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('uses anonymous user by default', async () => {
      await watchlists.getAll()

      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'anonymous')
    })
  })

  describe('getById', () => {
    it('fetches watchlist by id with items', async () => {
      await watchlists.getById('wl-123', 'user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(mockQuery.select).toHaveBeenCalledWith(`
        *,
        items:watchlist_items(*)
      `)
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'wl-123')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockQuery.single).toHaveBeenCalled()
    })

    it('fetches watchlist without ownership check when userId not provided', async () => {
      await watchlists.getById('wl-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'wl-123')
      expect(mockQuery.eq).not.toHaveBeenCalledWith('user_id', expect.any(String))
    })
  })

  describe('create', () => {
    it('creates a new watchlist', async () => {
      const newWatchlist = {
        name: 'Test Watchlist',
        description: 'Test description',
        entity_type: 'actor',
        user_id: 'user-123',
      }

      await watchlists.create(newWatchlist)

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(mockQuery.insert).toHaveBeenCalledWith(newWatchlist)
      expect(mockQuery.select).toHaveBeenCalled()
      expect(mockQuery.single).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('updates a watchlist with timestamp and ownership check', async () => {
      const updates = { name: 'Updated Name' }

      await watchlists.update('wl-123', updates, 'user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          updated_at: expect.any(String),
        })
      )
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'wl-123')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockQuery.select).toHaveBeenCalled()
      expect(mockQuery.single).toHaveBeenCalled()
    })

    it('returns error when userId not provided', async () => {
      const updates = { name: 'Updated Name' }

      const result = await watchlists.update('wl-123', updates)

      expect(result.data).toBeNull()
      expect(result.error.message).toBe('User ID required for update')
    })
  })

  describe('delete', () => {
    it('deletes a watchlist with ownership check', async () => {
      await watchlists.delete('wl-123', 'user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'wl-123')
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123')
    })

    it('returns error when userId not provided', async () => {
      const result = await watchlists.delete('wl-123')

      expect(result.error.message).toBe('User ID required for delete')
    })
  })

  describe('addItem', () => {
    it('adds an item to a watchlist with ownership verification', async () => {
      // First call: ownership verification returns success
      const verifyQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'wl-123' }, error: null }),
      }
      // Second call: insert item
      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }),
      }

      supabase.from.mockReturnValueOnce(verifyQuery).mockReturnValueOnce(insertQuery)

      await watchlists.addItem('wl-123', 'entity-456', 'user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(supabase.from).toHaveBeenCalledWith('watchlist_items')
      expect(insertQuery.insert).toHaveBeenCalledWith({
        watchlist_id: 'wl-123',
        entity_id: 'entity-456',
        notes: null,
      })
    })

    it('adds an item with notes', async () => {
      const verifyQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'wl-123' }, error: null }),
      }
      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }),
      }

      supabase.from.mockReturnValueOnce(verifyQuery).mockReturnValueOnce(insertQuery)

      await watchlists.addItem('wl-123', 'entity-456', 'user-123', 'Important actor')

      expect(insertQuery.insert).toHaveBeenCalledWith({
        watchlist_id: 'wl-123',
        entity_id: 'entity-456',
        notes: 'Important actor',
      })
    })

    it('returns error when userId not provided', async () => {
      const result = await watchlists.addItem('wl-123', 'entity-456')

      expect(result.data).toBeNull()
      expect(result.error.message).toBe('User ID required')
    })

    it('returns error when watchlist not found or access denied', async () => {
      const verifyQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }

      supabase.from.mockReturnValueOnce(verifyQuery)

      const result = await watchlists.addItem('wl-123', 'entity-456', 'user-123')

      expect(result.data).toBeNull()
      expect(result.error.message).toBe('Watchlist not found or access denied')
    })
  })

  describe('removeItem', () => {
    it('removes an item from a watchlist with ownership verification', async () => {
      // First call: ownership verification returns success
      const verifyQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'wl-123' }, error: null }),
      }
      // Second call: delete item
      const deleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }

      supabase.from.mockReturnValueOnce(verifyQuery).mockReturnValueOnce(deleteQuery)

      await watchlists.removeItem('wl-123', 'entity-456', 'user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlists')
      expect(supabase.from).toHaveBeenCalledWith('watchlist_items')
      expect(deleteQuery.delete).toHaveBeenCalled()
      expect(deleteQuery.eq).toHaveBeenCalledWith('watchlist_id', 'wl-123')
      expect(deleteQuery.eq).toHaveBeenCalledWith('entity_id', 'entity-456')
    })

    it('returns error when userId not provided', async () => {
      const result = await watchlists.removeItem('wl-123', 'entity-456')

      expect(result.error.message).toBe('User ID required')
    })

    it('returns error when watchlist not found or access denied', async () => {
      const verifyQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }

      supabase.from.mockReturnValueOnce(verifyQuery)

      const result = await watchlists.removeItem('wl-123', 'entity-456', 'user-123')

      expect(result.error.message).toBe('Watchlist not found or access denied')
    })
  })

  describe('isWatched', () => {
    it('returns true when entity is in a watchlist', async () => {
      // Chain: select -> eq -> eq (returns promise)
      const mockEq2 = vi.fn().mockResolvedValue({
        data: [{ id: 'item-1', entity_id: 'entity-456' }],
        error: null,
      })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      mockQuery.select.mockReturnValue({ eq: mockEq1 })

      const result = await watchlists.isWatched('entity-456', 'user-123')

      expect(supabase.from).toHaveBeenCalledWith('watchlist_items')
      expect(mockQuery.select).toHaveBeenCalledWith(`
        *,
        watchlist:watchlists!inner(user_id)
      `)
      expect(mockEq1).toHaveBeenCalledWith('entity_id', 'entity-456')
      expect(mockEq2).toHaveBeenCalledWith('watchlist.user_id', 'user-123')
      expect(result).toBe(true)
    })

    it('returns false when entity is not watched', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      mockQuery.select.mockReturnValue({ eq: mockEq1 })

      const result = await watchlists.isWatched('entity-456', 'user-123')

      expect(result).toBe(false)
    })

    it('returns falsy when data is null', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      mockQuery.select.mockReturnValue({ eq: mockEq1 })

      const result = await watchlists.isWatched('entity-456')

      expect(result).toBeFalsy()
    })

    it('uses anonymous user by default', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ data: [], error: null })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      mockQuery.select.mockReturnValue({ eq: mockEq1 })

      await watchlists.isWatched('entity-456')

      expect(mockEq2).toHaveBeenCalledWith('watchlist.user_id', 'anonymous')
    })
  })
})
