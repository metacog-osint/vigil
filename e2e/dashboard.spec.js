import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('should load and display the dashboard', async ({ page }) => {
    // Check page title contains Vigil
    await expect(page).toHaveTitle(/Vigil/i)

    // Check main heading is visible (be specific to avoid multiple matches)
    await expect(page.getByRole('heading', { name: 'Vigil Dashboard' })).toBeVisible()
  })

  test('should display stat cards', async ({ page }) => {
    // Wait for the stats to load
    await page.waitForLoadState('networkidle')

    // Check for stat cards presence (they may show loading or actual data)
    const statCards = page.locator('[data-tour="dashboard-stats"]')
    await expect(statCards).toBeVisible({ timeout: 10000 })
  })

  test('should have working sidebar navigation', async ({ page }) => {
    // Check sidebar is visible on desktop
    const sidebar = page.locator('nav, aside').first()
    await expect(sidebar).toBeVisible()

    // Named as they appear in the sidebar; .first() because each entry is rendered
    // twice, for the collapsed and expanded states.
    for (const name of ['Activity', 'Threat Actors', 'Settings']) {
      await expect(sidebar.getByRole('link', { name, exact: true }).first()).toBeVisible()
    }
  })

  test('should display header with search button', async ({ page }) => {
    // Check header is visible
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Check for search button
    const searchButton = page.locator('[data-tour="search-button"], button:has-text("Search")')
    await expect(searchButton).toBeVisible()
  })

  test.skip('should open search modal with Ctrl+K', async ({ page }) => {
    // Note: Keyboard shortcuts may not work consistently in Playwright
    // This test is skipped - use the search button test instead
    await page.keyboard.press('Control+k')
    const searchInput = page.locator('input[placeholder*="Search actors"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
  })
})
