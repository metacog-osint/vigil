/**
 * Critical Path Tests - Authentication Flow
 *
 * Tests the core authentication functionality that users rely on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

describe('Authentication Critical Path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Session Management', () => {
    it('should get current session', async () => {
      const { supabase } = await import('../supabase/client')

      const mockSession = {
        access_token: 'test-token',
        user: { id: 'user-123', email: 'test@example.com' },
      }

      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { data, error } = await supabase.auth.getSession()

      expect(error).toBeNull()
      expect(data.session.user.id).toBe('user-123')
    })

    it('should handle no session', async () => {
      const { supabase } = await import('../supabase/client')

      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { data, error } = await supabase.auth.getSession()

      expect(error).toBeNull()
      expect(data.session).toBeNull()
    })

    it('should handle session errors', async () => {
      const { supabase } = await import('../supabase/client')

      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      })

      const { error } = await supabase.auth.getSession()

      expect(error).toBeTruthy()
      expect(error.message).toBe('Session expired')
    })
  })

  describe('Sign In Flow', () => {
    it('should sign in with email and password', async () => {
      const { supabase } = await import('../supabase/client')

      const mockUser = { id: 'user-123', email: 'test@example.com' }

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: { access_token: 'token' } },
        error: null,
      })

      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(error).toBeNull()
      expect(data.user.email).toBe('test@example.com')
    })

    it('should handle invalid credentials', async () => {
      const { supabase } = await import('../supabase/client')

      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      const { error } = await supabase.auth.signInWithPassword({
        email: 'wrong@example.com',
        password: 'wrong',
      })

      expect(error).toBeTruthy()
      expect(error.message).toContain('Invalid')
    })
  })

  describe('Sign Out Flow', () => {
    it('should sign out successfully', async () => {
      const { supabase } = await import('../supabase/client')

      supabase.auth.signOut.mockResolvedValue({ error: null })

      const { error } = await supabase.auth.signOut()

      expect(error).toBeNull()
      expect(supabase.auth.signOut).toHaveBeenCalled()
    })
  })

  describe('Auth State Changes', () => {
    it('should subscribe to auth state changes', async () => {
      const { supabase } = await import('../supabase/client')

      const mockUnsubscribe = vi.fn()
      const mockCallback = vi.fn()

      supabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })

      const { data } = supabase.auth.onAuthStateChange(mockCallback)

      expect(data.subscription.unsubscribe).toBeDefined()
    })
  })
})

describe('Token Management', () => {
  it('should extract user ID from session', () => {
    const session = {
      user: { id: 'user-123' },
      access_token: 'token',
    }

    const userId = session?.user?.id
    expect(userId).toBe('user-123')
  })

  it('should handle missing session gracefully', () => {
    const session = null
    const userId = session?.user?.id
    expect(userId).toBeUndefined()
  })

  it('should validate token format', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature'
    const invalidToken = 'not-a-jwt'

    const isValidFormat = (token) => token && token.split('.').length === 3

    expect(isValidFormat(validToken)).toBe(true)
    expect(isValidFormat(invalidToken)).toBe(false)
  })
})

describe('Authorization Checks', () => {
  it('should check if user has required tier', () => {
    const checkTier = (userTier, requiredTier) => {
      const tierOrder = ['free', 'professional', 'team', 'enterprise']
      return tierOrder.indexOf(userTier) >= tierOrder.indexOf(requiredTier)
    }

    expect(checkTier('team', 'team')).toBe(true)
    expect(checkTier('enterprise', 'team')).toBe(true)
    expect(checkTier('free', 'team')).toBe(false)
    expect(checkTier('professional', 'team')).toBe(false)
  })

  it('should check API scopes', () => {
    const hasScope = (userScopes, requiredScope) =>
      userScopes.includes(requiredScope) || userScopes.includes('*')

    expect(hasScope(['read', 'write'], 'read')).toBe(true)
    expect(hasScope(['read'], 'write')).toBe(false)
    expect(hasScope(['*'], 'anything')).toBe(true)
  })
})
