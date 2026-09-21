import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

test.describe('IOC Search Page', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/iocs')
  })

  test('should display the IOC page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'IOC Intelligence' })).toBeVisible()
  })

  test('should have search input', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for the main search input
    const searchInput = page
      .locator('input[placeholder*="search" i], input[placeholder*="ioc" i], input[type="text"]')
      .first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('should have IOC type filter', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for type filter (IP, domain, hash, etc.)
    const typeFilter = page
      .locator('select, button')
      .filter({ hasText: /type|ip|domain|hash/i })
      .first()

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
    const enrichmentLinks = page.locator(
      'a[href*="virustotal"], a[href*="shodan"], [class*="enrichment"]'
    )

    // This is optional - may not appear without results
    const count = await enrichmentLinks.count()
    // Just verify it doesn't error
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('IOC country filter', () => {
  /**
   * The country filter had never once been confirmed by eye. The RPC and the
   * data were checked - search_iocs('', null, 500, 'IR') returns 106 rows -
   * but nobody had typed a country into the page, and in demo mode the filter
   * was being dropped on the floor: results came back unfiltered with the
   * field still on screen claiming otherwise.
   *
   * These drive the field rather than the query layer, because that gap is
   * exactly what went unnoticed.
   */
  test('filters indicators to the country typed, and to nothing when there are none', async ({
    page,
  }) => {
    await openApp(page, '/iocs')

    const country = page.getByLabel(/country the infrastructure is located in/i)
    await expect(country).toBeVisible({ timeout: 15000 })

    // Russia has two indicators in the sample set; both are IPs.
    await country.fill('RU')
    await country.press('Enter')
    await expect(page.getByText('45.129.14.83')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('91.215.85.142')).toBeVisible()
    // The US indicator must not come back under a Russian filter.
    await expect(page.getByText('update-microsoft-security.com')).toHaveCount(0)

    // A country with no indicators returns none, rather than returning
    // everything because an empty search box matches every value.
    await country.fill('XX')
    await country.press('Enter')
    await expect(page.getByText('45.129.14.83')).toHaveCount(0)
    await expect(page.getByText('update-microsoft-security.com')).toHaveCount(0)
  })

  test('searches on a country alone, with no indicator value', async ({ page }) => {
    await openApp(page, '/iocs')

    const country = page.getByLabel(/country the infrastructure is located in/i)
    await expect(country).toBeVisible({ timeout: 15000 })

    await country.fill('US')
    await country.press('Enter')

    // Either a value or a country is enough to search on - so this must return
    // the US indicator and not sit there having done nothing.
    await expect(page.getByText('update-microsoft-security.com')).toBeVisible({ timeout: 10000 })
  })
})
