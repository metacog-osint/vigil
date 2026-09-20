import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ActorProfilePanel from '../ActorProfilePanel'

const getActorProfile = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  profiles: { getActorProfile: (...args) => getActorProfile(...args) },
}))

const EMPTY = { tools: [], sites: [], sanctions: [] }

describe('ActorProfilePanel', () => {
  beforeEach(() => {
    getActorProfile.mockReset()
    getActorProfile.mockResolvedValue(EMPTY)
  })

  it('groups tooling by category', async () => {
    getActorProfile.mockResolvedValue({
      ...EMPTY,
      tools: [
        { tool_name: 'Mimikatz', category: 'Offsec' },
        { tool_name: 'vssadmin', category: 'LOLBAS' },
      ],
    })
    render(<ActorProfilePanel actorId="a1" />)

    expect(await screen.findByText('Tooling (2)')).toBeInTheDocument()
    expect(screen.getByText('Offsec')).toBeInTheDocument()
    expect(screen.getByText('Mimikatz')).toBeInTheDocument()
  })

  it('shows an OFAC designation with its programs', async () => {
    getActorProfile.mockResolvedValue({
      ...EMPTY,
      sanctions: [
        {
          entity_uid: '27307',
          entity_name: 'LAZARUS GROUP',
          programs: ['DPRK3'],
          match_basis: 'name',
        },
      ],
    })
    render(<ActorProfilePanel actorId="a1" />)

    expect(await screen.findByText('OFAC DESIGNATED')).toBeInTheDocument()
    expect(screen.getByText(/Matched on the designated entity name/)).toBeInTheDocument()
  })

  it('reports how many leak sites were reachable at the last check', async () => {
    getActorProfile.mockResolvedValue({
      ...EMPTY,
      sites: [
        { fqdn: 'aaa.onion', available: true },
        { fqdn: 'bbb.onion', available: false },
      ],
    })
    render(<ActorProfilePanel actorId="a1" />)

    expect(await screen.findByText('Leak sites (2, 1 reachable)')).toBeInTheDocument()
  })

  it('renders nothing for an actor with no profile data', async () => {
    const { container } = render(<ActorProfilePanel actorId="a1" />)
    await waitFor(() => expect(getActorProfile).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
