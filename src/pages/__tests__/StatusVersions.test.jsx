import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BuildVersions } from '../Status'
import { describeInterval } from '../../lib/buildInfo'

const info = {
  version: '9.8.7',
  commit: 'abc1234',
  registry: {
    fingerprint: 'abcd1234',
    jobCount: 2,
    scheduledCount: 1,
    jobs: [
      { id: 'ransomlook', intervalMinutes: 60, priority: 1, paused: false },
      { id: 'old-feed', intervalMinutes: 1440, priority: 4, paused: true },
    ],
  },
}

describe('/status: Versions', () => {
  it('shows the site version, its commit and the feed registry', () => {
    render(<BuildVersions info={info} />)
    expect(screen.getByText(/Vigil 9\.8\.7/)).toBeInTheDocument()
    expect(screen.getByText(/commit abc1234/)).toBeInTheDocument()
    expect(screen.getByText('abcd1234: 2 jobs, 1 scheduled')).toBeInTheDocument()
  })

  it('lists each job with when it is due, and says when one is paused', () => {
    render(<BuildVersions info={info} />)
    expect(screen.getByText('ransomlook').closest('tr')).toHaveTextContent('every hour')
    expect(screen.getByText('old-feed').closest('tr')).toHaveTextContent('paused')
  })

  it('says the running worker may hold an earlier registry', () => {
    render(<BuildVersions info={info} />)
    expect(screen.getByText(/may hold an earlier registry/)).toBeInTheDocument()
  })

  it('says so when the build carries no version or registry', () => {
    render(<BuildVersions info={{ version: null, commit: null, registry: null }} />)
    expect(screen.getByText('Not recorded in this build')).toBeInTheDocument()
    expect(screen.getByText('Not available in this build')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('describeInterval', () => {
  it.each([
    [60, 'every hour'],
    [360, 'every 6 hours'],
    [1440, 'daily'],
    [10080, 'weekly'],
    [30, 'every 30 minutes'],
    [2880, 'every 2 days'],
    [null, 'no set interval'],
  ])('%s -> %s', (minutes, text) => {
    expect(describeInterval(minutes)).toBe(text)
  })
})
