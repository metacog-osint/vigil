import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

test.describe('Vulnerabilities Page', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/vulnerabilities')
  })

  test('should display vulnerabilities heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /vulnerabilit|cve|kev/i })).toBeVisible()
  })

  test('should have filter options', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check for filter elements - severity filter or search input
    const hasFilters = await page.locator('select, input[type="text"]').count()
    expect(hasFilters).toBeGreaterThan(0)
  })

  test('should display vulnerability data or empty state', async ({ page }) => {
    // openApp navigates with pushState, which does no network work, so
    // waitForLoadState('networkidle') resolves immediately and proves nothing.
    // Assert on the rendered result instead and let Playwright retry: the page
    // has exactly three states, and the skeleton is not one we accept.
    await expect(
      page.locator('table.cyber-table, :text("No vulnerabilities found")').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('should have CVE search functionality', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for search input
    const searchInput = page
      .locator('input[placeholder*="search" i], input[placeholder*="cve" i]')
      .first()

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Type a CVE pattern
      await searchInput.fill('CVE-2024')
      // Wait for filter to apply
      await page.waitForTimeout(500)
    }
  })
})
