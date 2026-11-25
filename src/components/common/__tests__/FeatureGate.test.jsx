import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const limit = vi.fn()
vi.mock('../../../lib/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ limit: (...a) => limit(...a) }) }) },
}))

import FeatureGate, { isMissingTableError } from '../FeatureGate'

describe('isMissingTableError', () => {
  it('recognises a missing table and nothing else', () => {
    expect(isMissingTableError({ code: 'PGRST205', message: 'x' })).toBe(true)
    expect(isMissingTableError({ code: '42P01', message: 'x' })).toBe(true)
    expect(isMissingTableError({ message: 'relation "webhooks" does not exist' })).toBe(true)
    expect(isMissingTableError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
  })
})

describe('FeatureGate', () => {
  beforeEach(() => limit.mockReset())

  it('says "Not set up yet" and hides the page when the table is missing', async () => {
    limit.mockResolvedValue({ error: { code: 'PGRST205', message: 'Could not find the table' } })
    render(
      <FeatureGate table="webhooks" title="Webhooks" what="Webhook delivery">
        <button>Create your first webhook</button>
      </FeatureGate>
    )
    await waitFor(() => expect(screen.getByText('Not set up yet')).toBeTruthy())
    expect(screen.queryByText('Create your first webhook')).toBeNull()
  })

  it('shows the page when the table exists', async () => {
    limit.mockResolvedValue({ error: null })
    render(
      <FeatureGate table="webhooks" title="Webhooks" what="Webhook delivery">
        <p>the page</p>
      </FeatureGate>
    )
    await waitFor(() => expect(screen.getByText('the page')).toBeTruthy())
  })

  it('shows the page on a permissions error rather than hiding it', async () => {
    limit.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } })
    render(
      <FeatureGate table="webhooks" title="Webhooks" what="Webhook delivery">
        <p>the page</p>
      </FeatureGate>
    )
    await waitFor(() => expect(screen.getByText('the page')).toBeTruthy())
  })
})
