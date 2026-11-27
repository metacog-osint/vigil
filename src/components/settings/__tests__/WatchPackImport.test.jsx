import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ alertRules: {}, watchlists: {}, threatActors: {} }))

import WatchPackImport from '../WatchPackImport'

function fakeApi() {
  return {
    alertRules: {
      create: vi.fn(async (rule) => ({ data: { id: 'r', ...rule }, error: null })),
    },
    threatActors: { getByIdOrName: vi.fn(async () => ({ data: null })) },
    watchlists: {
      create: vi.fn(async (w) => ({ data: { id: 'w', ...w }, error: null })),
      addItem: vi.fn(async () => ({ data: {}, error: null })),
    },
  }
}

const renderDialog = (api = fakeApi(), onImported = vi.fn()) =>
  render(<WatchPackImport userId="u1" api={api} onClose={() => {}} onImported={onImported} />)

describe('WatchPackImport', () => {
  it('offers the stock packs', () => {
    renderDialog()
    expect(screen.getByText('Healthcare')).toBeInTheDocument()
    expect(screen.getByText('Space and satellite operators')).toBeInTheDocument()
    expect(screen.getByText('Upper Midwest critical infrastructure')).toBeInTheDocument()
  })

  it('shows what a stock pack will create before anything is written', () => {
    const api = fakeApi()
    renderDialog(api)
    fireEvent.click(screen.getByRole('radio', { name: /^Healthcare/ }))
    expect(screen.getByTestId('pack-plan')).toHaveTextContent(
      'Alert rule: Healthcare: new leak-site claims'
    )
    expect(api.alertRules.create).not.toHaveBeenCalled()
  })

  it('lists what a pack file leaves out, and imports the rest', async () => {
    const api = fakeApi()
    const onImported = vi.fn()
    renderDialog(api, onImported)
    const pack = {
      schema_version: 1,
      pack_version: '1.0.0',
      name: 'Mine',
      rules: [
        { rule_type: 'kev_added', rule_name: 'KEV' },
        { rule_type: 'telegram_mention', rule_name: 'Not yet' },
      ],
      watch: [{ watchlist: 'Groups', entity_type: 'actor', entities: ['Nobody'] }],
    }
    const file = new File([JSON.stringify(pack)], 'mine.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText(/pack file/), { target: { files: [file] } })

    await waitFor(() => expect(screen.getByTestId('pack-skipped')).toBeInTheDocument())
    expect(screen.getByTestId('pack-skipped')).toHaveTextContent(
      'rule "Not yet": rule type "telegram_mention" is not one Vigil evaluates'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(screen.getByTestId('pack-result')).toBeInTheDocument())
    expect(screen.getByTestId('pack-result')).toHaveTextContent(
      'Created 1 alert rule and 0 watchlists.'
    )
    expect(screen.getByTestId('pack-result')).toHaveTextContent('actor "Nobody"')
    expect(api.alertRules.create).toHaveBeenCalledWith(
      expect.objectContaining({ ruleType: 'kev_added', userId: 'u1' })
    )
    expect(onImported).toHaveBeenCalled()
  })

  it('says so when a file is not JSON', async () => {
    renderDialog()
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText(/pack file/), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('bad.json is not valid JSON.')).toBeInTheDocument())
  })
})
