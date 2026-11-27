import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { JOBS_BY_ID } from '../../../workers/src/feeds/registry.js'
import Coverage, { COVERAGE } from '../Coverage'
import { describeInterval } from '../../lib/buildInfo'

const renderPage = () =>
  render(
    <MemoryRouter>
      <Coverage />
    </MemoryRouter>
  )

describe('Coverage: what Vigil does not cover', () => {
  it('names only jobs that are in the feed registry', () => {
    const named = COVERAGE.flatMap((area) => area.reads.map((source) => source.job))
    expect(named.length).toBeGreaterThan(20)
    for (const job of named) expect(JOBS_BY_ID, job).toHaveProperty([job])
  })

  it('states that a claim is a claim, in those words', () => {
    renderPage()
    expect(
      screen.getAllByText(/A ransomware claim is a claim, never a confirmed breach\./).length
    ).toBeGreaterThan(0)
  })

  it('shows each cadence from the registry, not from the page', () => {
    renderPage()
    const expected = describeInterval(JOBS_BY_ID.ransomlook.intervalMinutes)
    const item = screen.getByText('RansomLook').closest('li')
    expect(item).toHaveTextContent(`(${expected})`)
  })

  it('has a heading for every area, and links to the licences', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What Vigil does not cover')
    for (const area of COVERAGE) {
      expect(screen.getByRole('heading', { level: 2, name: area.title })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Sources' })).toHaveAttribute('href', '/sources')
  })

  it('every area says what it leaves out', () => {
    for (const area of COVERAGE) expect(area.gaps.length, area.id).toBeGreaterThan(0)
  })
})
