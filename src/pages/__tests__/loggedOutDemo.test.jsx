import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DemoProvider, useDemo } from '../../contexts/DemoContext'
import Landing from '../Landing'
import Header from '../../components/Header'
import DemoWatermark from '../../components/demo/DemoWatermark'

vi.mock('../../lib/supabase', () => ({
  landing: {
    getSnapshot: vi.fn(async () => ({ stats: null, escalating: [], incidents: [], kev: [] })),
  },
}))
vi.mock('../../lib/supabase/client', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
vi.mock('../../lib/supabase/syncLog', () => ({
  syncLog: { getLastCollected: vi.fn(async () => '2026-11-24T01:15:46Z') },
}))
vi.mock('../../components/NotificationBell', () => ({ default: () => null }))
vi.mock('../../components/common/WhatsNewBadge', () => ({ default: () => null }))
vi.mock('../../components/common/FocusModeToggle', () => ({ default: () => null }))
vi.mock('../../components/common/QuickIOCInput', () => ({ default: () => null }))
vi.mock('../../components/common/TimeSettingsButton', () => ({ default: () => null }))

function DemoState() {
  const { isDemoMode } = useDemo()
  return <output data-testid="demo">{String(isDemoMode)}</output>
}

function DemoOn() {
  const { enterDemoMode } = useDemo()
  return <button onClick={enterDemoMode}>turn demo on</button>
}

function landing() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <DemoProvider>
        <DemoState />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<div>sign-in page</div>} />
        </Routes>
      </DemoProvider>
    </MemoryRouter>
  )
}

describe('logged-out visitors and sample data', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a nav item opens sign-in and does not enter the demo', async () => {
    landing()
    fireEvent.click(screen.getByRole('button', { name: /Threat Actors/ }))
    await screen.findByText('sign-in page')
    expect(screen.getByTestId('demo').textContent).toBe('false')
  })

  it('the labelled button is what enters the demo', () => {
    landing()
    fireEvent.click(screen.getByRole('button', { name: 'Explore a demo with sample data' }))
    expect(screen.getByTestId('demo').textContent).toBe('true')
  })

  it('the header shows the collection time, and no Live stamp or time in the demo', async () => {
    render(
      <MemoryRouter>
        <DemoProvider>
          <DemoOn />
          <Header isOnline user={null} onMenuClick={() => {}} onSearchClick={() => {}} />
          <DemoWatermark />
        </DemoProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/Last collected:/)).toBeTruthy())
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.queryByTestId('demo-watermark')).toBeNull()

    fireEvent.click(screen.getByText('turn demo on'))
    expect(screen.queryByText('Live')).toBeNull()
    expect(screen.queryByText(/Last collected:/)).toBeNull()
    expect(screen.getByTestId('demo-watermark')).toBeTruthy()
  })
})
