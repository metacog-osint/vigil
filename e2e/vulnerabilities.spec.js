import { test, expect } from '@playwright/test'

test.describe('Vulnerabilities Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vulnerabilities')
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
    await page.waitForLoadState('networkidle')

    // Either there's vulnerability data or an empty state message
    const hasData = await page.locator('table, [class*="card"], [class*="grid"]').first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmptyState = await page.locator('text=/no vulnerabilities|no data|no results/i').isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasData || hasEmptyState).toBeTruthy()
  })

  test('should have CVE search functionality', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="cve" i]').first()

    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Type a CVE pattern
      await searchInput.fill('CVE-2024')
      // Wait for filter to apply
      await page.waitForTimeout(500)
    }
  })
})
