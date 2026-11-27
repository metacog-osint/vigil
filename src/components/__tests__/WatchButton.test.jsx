import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockUseAuth = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

const api = vi.hoisted(() => ({
  getAll: vi.fn(),
  containing: vi.fn(),
  addItem: vi.fn(),
  removeItem: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ watchlists: api }))

import { WatchButton } from '../WatchButton'

const LISTS = [
  { id: 'wl-1', name: 'Groups I follow', entity_type: 'actor', color: '#fff' },
  { id: 'wl-2', name: 'Second list', entity_type: 'actor', color: '#000' },
  { id: 'wl-3', name: 'Incidents', entity_type: 'incident', color: '#f00' },
]

describe('WatchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } })
    api.getAll.mockResolvedValue({ data: LISTS, error: null })
    api.containing.mockResolvedValue({ data: ['wl-2'], error: null })
    api.addItem.mockResolvedValue({ data: {}, error: null })
    api.removeItem.mockResolvedValue({ error: null })
  })

  it("reads the signed-in user's lists and which of them hold the entity", async () => {
    render(<WatchButton entityType="actor" entityId="actor-9" />)

    await waitFor(() => expect(api.getAll).toHaveBeenCalledWith('user-123'))
    expect(api.containing).toHaveBeenCalledWith('actor-9', 'user-123')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove from watchlist' })).toBeInTheDocument()
    )
  })

  it("adds to a list with the user's id", async () => {
    render(<WatchButton entityType="actor" entityId="actor-9" />)
    await waitFor(() => expect(api.containing).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /watchlist/ }))
    fireEvent.click(await screen.findByText('Groups I follow'))

    await waitFor(() => expect(api.addItem).toHaveBeenCalledWith('wl-1', 'actor-9', 'user-123'))
    expect(api.removeItem).not.toHaveBeenCalled()
  })

  it("removes from a list that holds the entity, with the user's id", async () => {
    render(<WatchButton entityType="actor" entityId="actor-9" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove from watchlist' })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove from watchlist' }))
    fireEvent.click(await screen.findByText('Second list'))

    await waitFor(() => expect(api.removeItem).toHaveBeenCalledWith('wl-2', 'actor-9', 'user-123'))
    expect(api.addItem).not.toHaveBeenCalled()
  })

  it('offers only lists of its own entity type', async () => {
    render(<WatchButton entityType="actor" entityId="actor-9" />)
    await waitFor(() => expect(api.containing).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /watchlist/ }))
    expect(await screen.findByText('Groups I follow')).toBeInTheDocument()
    expect(screen.queryByText('Incidents')).not.toBeInTheDocument()
  })

  it('signed out, sends no watchlist query', async () => {
    mockUseAuth.mockReturnValue({ user: null })
    render(<WatchButton entityType="actor" entityId="actor-9" />)

    fireEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(await screen.findByText('No watchlists for this type')).toBeInTheDocument()
    expect(api.getAll).not.toHaveBeenCalled()
    expect(api.containing).not.toHaveBeenCalled()
  })
})
