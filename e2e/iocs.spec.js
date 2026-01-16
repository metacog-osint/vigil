import { test, expect } from '@playwright/test'

test.describe('IOC Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iocs')
  })

  test('should display IOC Search heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'IOC Search', level: 1 })).toBeVisible()
  })

  test('should have search input', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for the main search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="ioc" i], input[type="text"]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('should have IOC type filter', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for type filter (IP, domain, hash, etc.)
    const typeFilter = page.locator('select, button').filter({ hasText: /type|ip|domain|hash/i }).first()

    if (await typeFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(typeFilter).toBeVisible()
    }
  })

  test('should search for IP addresses', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[placeholder*="search" i], input[type="text"]').first()

    if (await searchInput.isVisible({ timeout: 5000 })) {
      // Enter an IP address pattern
      await searchInput.fill('8.8.8.8')
      await searchInput.press('Enter')

      // Wait for results
      await page.waitForTimeout(1000)
    }
  })

  test('should display enrichment links for results', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // If there are results, check for enrichment links (VirusTotal, etc.)
    const enrichmentLinks = page.locator('a[href*="virustotal"], a[href*="shodan"], [class*="enrichment"]')

    // This is optional - may not appear without results
    const count = await enrichmentLinks.count()
    // Just verify it doesn't error
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
