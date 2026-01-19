/**
 * Test Utilities
 *
 * Provides common utilities and wrappers for testing React components
 */

import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

/**
 * Custom render with common providers
 */
export function renderWithProviders(ui, options = {}) {
  const Wrapper = ({ children }) => (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )

  return render(ui, { wrapper: Wrapper, ...options })
}

/**
 * Create a mock Supabase response
 */
export function mockSupabaseResponse(data, error = null) {
  return {
    data,
    error,
    count: Array.isArray(data) ? data.length : null,
  }
}

/**
 * Create a mock threat actor
 */
export function createMockThreatActor(overrides = {}) {
  return {
    id: 'test-actor-id',
    name: 'Test Actor',
    aliases: ['TA0001', 'Test Group'],
    description: 'A test threat actor for testing purposes',
    trend_status: 'ESCALATING',
    incident_velocity: 2.5,
    incidents_7d: 5,
    target_sectors: ['technology', 'finance'],
    target_countries: ['US', 'UK'],
    attributed_countries: ['RU'],
    first_seen: '2024-01-01',
    last_seen: '2024-12-01',
    ...overrides,
  }
}

/**
 * Create a mock incident
 */
export function createMockIncident(overrides = {}) {
  return {
    id: 'test-incident-id',
    victim_name: 'Test Victim',
    victim_sector: 'technology',
    victim_country: 'US',
    discovered_date: '2024-12-01',
    source: 'ransomwatch',
    status: 'confirmed',
    threat_actor: createMockThreatActor(),
    ...overrides,
  }
}

/**
 * Create a mock vulnerability
 */
export function createMockVulnerability(overrides = {}) {
  return {
    id: 'test-vuln-id',
    cve_id: 'CVE-2024-12345',
    description: 'A test vulnerability',
    cvss_score: 9.8,
    severity: 'critical',
    is_kev: true,
    has_public_exploit: true,
    vendor: 'Test Vendor',
    product: 'Test Product',
    published_date: '2024-01-01',
    ...overrides,
  }
}

/**
 * Create a mock IOC
 */
export function createMockIOC(overrides = {}) {
  return {
    id: 'test-ioc-id',
    type: 'ip',
    value: '192.168.1.1',
    confidence: 90,
    source: 'threatfox',
    malware_family: 'Test Malware',
    first_seen: '2024-01-01',
    last_seen: '2024-12-01',
    ...overrides,
  }
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingToComplete(screen) {
  const { findByText } = screen
  // Wait for any loading indicators to disappear
  await vi.waitFor(() => {
    const loadingElements = document.querySelectorAll('[data-testid="loading"], .animate-pulse, .animate-spin')
    if (loadingElements.length > 0) {
      throw new Error('Still loading')
    }
  }, { timeout: 5000 })
}

/**
 * Mock console methods to prevent test output noise
 */
export function silenceConsole() {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }

  beforeEach(() => {
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    console.log = original.log
    console.warn = original.warn
    console.error = original.error
  })
}

export { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
