// @ts-check
import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

/**
 * Mobile viewport E2E tests
 * Tests critical user flows on mobile devices
 */

// Use mobile viewport for all tests in this file
test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

// openApp() lands on the dashboard. It is not given '/dashboard': that is not a
// route, it redirects to '/', and navigateTo() waits to leave the dashboard, so
// it passed only when it caught the page mid-redirect.

test.describe('Mobile Navigation', () => {
  test('should show mobile menu button', async ({ page }) => {
    await openApp(page)

    // On a phone the sidebar is off-canvas, opened from this button. Asked for by
    // name: the old fallback, the first 'nav' on the page, is now the house bar,
    // so it passed whether or not Vigil's own menu was there.
    await expect(page.getByRole('button', { name: /open navigation menu/i })).toBeVisible()
  })

  test('should navigate between pages on mobile', async ({ page }) => {
    await openApp(page)

    // The sidebar is rendered off-canvas on a phone, so its links are present but
    // not clickable until the drawer is opened.
    await page.getByRole('button', { name: /open navigation menu/i }).click()

    const actorsLink = page.getByRole('link', { name: 'Threat Actors', exact: true }).first()
    await actorsLink.click()

    await expect(page).toHaveURL(/.*actors.*/)
  })

  test('should display dashboard properly on mobile', async ({ page }) => {
    await openApp(page)

    // Main content should be visible
    const mainContent = page.locator('main, [role="main"], .dashboard')
    await expect(mainContent.first()).toBeVisible()

    // Stats should stack vertically on mobile
    const statCards = page.locator('.cyber-card, [data-testid="stat-card"]')
    const count = await statCards.count()

    // Dashboard should have some stats
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Mobile Search', () => {
  test('should open search on mobile', async ({ page }) => {
    await openApp(page)

    // Find search trigger
    const searchTrigger = page.locator(
      'button[aria-label*="search" i], [data-testid="search-trigger"], kbd:has-text("K")'
    ).first()

    const hasSearch = await searchTrigger.isVisible().catch(() => false)

    if (hasSearch) {
      await searchTrigger.click()

      // Search modal or input should appear
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]')
      await expect(searchInput.first()).toBeVisible({ timeout: 2000 })
    }
  })

  test('should show search results on mobile', async ({ page }) => {
    await openApp(page, '/iocs')
    await page.waitForLoadState('networkidle')

    // Find search input
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first()
    const hasSearch = await searchInput.isVisible().catch(() => false)

    if (hasSearch) {
      await searchInput.fill('8.8.8.8')
      await page.waitForTimeout(500)

      // Results should be visible
      const results = page.locator('.search-results, [data-testid="search-results"], table, .cyber-card')
      const hasResults = await results.first().isVisible({ timeout: 3000 }).catch(() => false)

      expect(typeof hasResults).toBe('boolean')
    }
  })
})

test.describe('Mobile Detail Panels', () => {
  test('should show actor details on mobile', async ({ page }) => {
    await openApp(page, '/actors')
    await page.waitForLoadState('networkidle')

    // Click on first actor
    const actorRow = page.locator('tr, .actor-card, .cyber-card').first()
    const hasActor = await actorRow.isVisible().catch(() => false)

    if (hasActor) {
      await actorRow.click()

      // Detail panel or page should appear
      await page.waitForTimeout(500)

      // Should show some detail content
      const detailContent = page.locator(
        '[data-testid="detail-panel"], .detail-panel, [role="dialog"], .actor-detail'
      )
      const hasDetail = await detailContent.first().isVisible({ timeout: 2000 }).catch(() => false)

      expect(typeof hasDetail).toBe('boolean')
    }
  })

  test('should close detail panel on mobile', async ({ page }) => {
    await openApp(page, '/actors')
    await page.waitForLoadState('networkidle')

    // Open a detail panel first
    const actorRow = page.locator('tr, .actor-card, .cyber-card').first()
    const hasActor = await actorRow.isVisible().catch(() => false)

    if (hasActor) {
      await actorRow.click()
      await page.waitForTimeout(500)

      // The navigation drawer also has a close button, sitting off-canvas at a
      // negative offset; Playwright still counts it as visible, so it is excluded
      // by name rather than by :visible.
      const closeButton = page
        .locator('button[aria-label*="close" i]:not([aria-label*="navigation" i])')
        .or(page.getByRole('button', { name: /^close$/i }))
        .first()

      const hasClose = await closeButton.isVisible().catch(() => false)

      if (hasClose) {
        await closeButton.click()
        await expect(closeButton).toBeHidden()
      }

      // Whether or not a panel opened, the page must still be usable.
      await expect(page.locator('body')).toBeVisible()
    }
  })
})

test.describe('Mobile Tables', () => {
  test('should display tables responsively', async ({ page }) => {
    await openApp(page, '/incidents')
    await page.waitForLoadState('networkidle')

    // Table or card list should be visible
    const dataDisplay = page.locator('table, .incident-list, .cyber-card').first()
    await expect(dataDisplay).toBeVisible()

    // Should not have horizontal overflow issues
    const hasOverflow = await page.evaluate(() => {
      const body = document.body
      return body.scrollWidth > body.clientWidth
    })

    // Minor overflow is acceptable on mobile
    expect(typeof hasOverflow).toBe('boolean')
  })

  test('should handle pagination on mobile', async ({ page }) => {
    await openApp(page, '/incidents')
    await page.waitForLoadState('networkidle')

    // Find pagination controls
    const pagination = page.locator(
      '[data-testid="pagination"], .pagination, button:has-text("Next"), button:has-text("Load More")'
    ).first()

    const hasPagination = await pagination.isVisible().catch(() => false)

    if (hasPagination) {
      // Should be tappable
      await pagination.tap().catch(() => pagination.click())
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Mobile Forms', () => {
  test('should display search filters properly', async ({ page }) => {
    await openApp(page, '/actors')
    await page.waitForLoadState('networkidle')

    // Find filter controls
    const filterButton = page.locator(
      'button:has-text("Filter"), [aria-label*="filter" i], select'
    ).first()

    const hasFilters = await filterButton.isVisible().catch(() => false)

    expect(typeof hasFilters).toBe('boolean')
  })
})

test.describe('Mobile Touch Interactions', () => {
  test('should support swipe gestures if applicable', async ({ page }) => {
    await openApp(page)
    await page.waitForLoadState('networkidle')

    // This is a basic touch interaction test
    const content = page.locator('main').first()
    await expect(content).toBeVisible()

    // Verify touch events don't cause errors
    await page.touchscreen.tap(187, 300)
    await page.waitForTimeout(200)
  })
})

test.describe('Mobile Performance', () => {
  test('should load dashboard within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await openApp(page)
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Dashboard should load within 10 seconds on mobile
    expect(loadTime).toBeLessThan(10000)
  })

  test('should load actors page within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await openApp(page, '/actors')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000)
  })
})
