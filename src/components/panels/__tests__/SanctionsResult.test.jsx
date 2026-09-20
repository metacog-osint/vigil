import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SanctionsResult from '../SanctionsResult'

const lookupSanctionedAddress = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  profiles: { lookupSanctionedAddress: (...args) => lookupSanctionedAddress(...args) },
}))

const LISTED = {
  address: '0x08723392Ed15743cc38513C4925f5e6be5c17243',
  currency: 'ETH',
  entity_name: 'LAZARUS GROUP',
  programs: ['DPRK3'],
  aliases: ['HIDDEN COBRA'],
  delisted_at: null,
}

describe('SanctionsResult', () => {
  beforeEach(() => {
    lookupSanctionedAddress.mockReset()
    lookupSanctionedAddress.mockResolvedValue(null)
  })

  it('names the designating entity and programs for a listed address', async () => {
    lookupSanctionedAddress.mockResolvedValue(LISTED)
    render(<SanctionsResult value={LISTED.address} />)

    expect(await screen.findByText('OFAC SANCTIONED ADDRESS')).toBeInTheDocument()
    expect(screen.getByText('LAZARUS GROUP')).toBeInTheDocument()
    expect(screen.getByText(/DPRK3/)).toBeInTheDocument()
  })

  it('distinguishes a delisted address from a current designation', async () => {
    lookupSanctionedAddress.mockResolvedValue({ ...LISTED, delisted_at: '2025-03-21' })
    render(<SanctionsResult value={LISTED.address} />)

    expect(await screen.findByText('PREVIOUSLY OFAC DESIGNATED')).toBeInTheDocument()
    expect(screen.getByText(/2025-03-21/)).toBeInTheDocument()
  })

  it('renders nothing when the address is not on the list', async () => {
    const { container } = render(<SanctionsResult value={LISTED.address} />)
    await waitFor(() => expect(lookupSanctionedAddress).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('does not query for values that are not addresses', async () => {
    render(<SanctionsResult value="evil.example.com" />)
    await waitFor(() => expect(lookupSanctionedAddress).not.toHaveBeenCalled())
  })
})
