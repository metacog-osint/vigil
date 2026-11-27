import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SiteFooter, { LICENSE_URL } from '../SiteFooter'
import { commercialUseStatus } from '../../../lib/supabase/sourceLicences'

const renderFooter = () =>
  render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>
  )

describe('SiteFooter: the credits the data licences require', () => {
  it('names the code licence and links to it', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: 'AGPL-3.0' })).toHaveAttribute('href', LICENSE_URL)
  })

  it('says the code licence does not cover the data', () => {
    renderFooter()
    expect(screen.getByText(/The code licence does not cover the data/)).toBeInTheDocument()
  })

  it.each([
    ['RansomLook', 'https://www.ransomlook.io/'],
    // ransomware.live's terms, section 6: named, and linked back
    ['Ransomware.live', 'https://www.ransomware.live/'],
    ['DB-IP', 'https://db-ip.com/'],
    ['Ransomwhere', 'https://doi.org/10.5281/zenodo.6512122'],
  ])('credits %s with a link', (name, href) => {
    renderFooter()
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
  })

  it("carries MITRE's copyright for ATT&CK", () => {
    renderFooter()
    expect(screen.getByText(/ATT&CK® © The MITRE Corporation/)).toBeInTheDocument()
  })

  it('links to the full list of sources, terms and privacy', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: 'Sources' })).toHaveAttribute('href', '/sources')
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })
})

describe('SiteFooter: versions and coverage', () => {
  const info = {
    version: '9.8.7',
    commit: null,
    registry: { fingerprint: 'abcd1234', jobCount: 43, scheduledCount: 43, jobs: [] },
  }

  it('shows the site version and the feed registry it was built with', () => {
    render(
      <MemoryRouter>
        <SiteFooter buildInfo={info} />
      </MemoryRouter>
    )
    expect(screen.getByTestId('site-versions')).toHaveTextContent(
      'Vigil 9.8.7, feed registry abcd1234 (43 jobs).'
    )
  })

  it('leaves the versions out when the build carries none', () => {
    render(
      <MemoryRouter>
        <SiteFooter buildInfo={{ version: null, commit: null, registry: null }} />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('site-versions')).toBeNull()
  })

  it('carries the real build by default', () => {
    renderFooter()
    expect(screen.getByTestId('site-versions')).toHaveTextContent(
      /^Vigil \d+\.\d+\.\d+, feed registry [0-9a-f]{8} \(\d+ jobs\)\.$/
    )
  })

  it('links to what Vigil does not cover', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: 'What Vigil does not cover' })).toHaveAttribute(
      'href',
      '/coverage'
    )
  })
})

describe('commercialUseStatus: an unread licence is never shown as plainly allowed', () => {
  it.each([
    [{ commercial_use: true, checked_on: '2026-10-26' }, 'Allowed'],
    [{ commercial_use: true, checked_on: null }, 'Allowed, terms not re-read'],
    [{ commercial_use: false, checked_on: '2026-10-26' }, 'Not allowed'],
    [{ commercial_use: false, checked_on: null }, 'Not yet read'],
  ])('%o -> %s', (row, label) => {
    expect(commercialUseStatus(row).label).toBe(label)
  })
})
