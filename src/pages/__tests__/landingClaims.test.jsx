import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DemoProvider } from '../../contexts/DemoContext'
import Landing from '../Landing'

vi.mock('../../lib/supabase', () => ({
  landing: {
    getSnapshot: vi.fn(async () => ({
      stats: null,
      kev: [],
      escalating: [
        {
          id: 'a',
          name: 'Namesake',
          actor_type: 'apt',
          trend_status: 'ESCALATING',
          incidents_7d: 7,
        },
        {
          id: 'b',
          name: 'Group B',
          actor_type: 'ransomware',
          trend_status: 'ESCALATING',
          incidents_7d: 1,
        },
      ],
      incidents: [{ id: 'i', victim: 'Company #12', actor: 'n0n', date: '2026-11-25' }],
    })),
  },
}))

describe('landing page leak-site claims', () => {
  it('labels claims as unverified and explains a numbered label', async () => {
    render(
      <MemoryRouter>
        <DemoProvider>
          <Landing />
        </DemoProvider>
      </MemoryRouter>
    )
    await screen.findByText('Company #12')
    expect(screen.getByText('Recent Leak-Site Claims')).toBeTruthy()
    expect(screen.getByText(/Claims are unverified\./).textContent).toMatch(
      /leak site itself posted/
    )
    expect(screen.getByText('Type unconfirmed')).toBeTruthy()
    expect(screen.queryByText('APT')).toBeNull()
    expect(screen.getByText(/7 victim claims/)).toBeTruthy()
    expect(screen.getByText(/1 victim claim\s+this week/)).toBeTruthy()
  })
})
