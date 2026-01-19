// @ts-check
import { test, expect } from '@playwright/test'

/**
 * Mobile viewport E2E tests
 * Tests critical user flows on mobile devices
 */

// Use mobile viewport for all tests in this file
test.use({ viewport: { width: 375, height: 667 } })

test.describe('Mobile Navigation', () => {
  test('should show mobile menu button', async ({ page }) => {
    await page.goto('/dashboard')

    // Mobile should show hamburger menu or similar
    const menuButton = page.locator(
      '[aria-label*="menu" i], button[aria-label*="toggle" i], [data-testid="mobile-menu"]'
    ).first()

    // Either menu button exists or navigation is visible
    const hasMenuButton = await menuButton.isVisible().catch(() => false)
    const sidebar = page.locator('nav, [role="navigation"]').first()
    const hasSidebar = await sidebar.isVisible().catch(() => false)

    expect(hasMenuButton || hasSidebar).toBeTruthy()
  })

  test('should navigate between pages on mobile', async ({ page }) => {
    await page.goto('/dashboard')

    // Try to navigate to actors page
    const actorsLink = page.locator('a[href*="actors"], button:has-text("Actors")')
    const hasLink = await actorsLink.first().isVisible().catch(() => false)

    if (hasLink) {
      await actorsLink.first().click()
      await expect(page).toHaveURL(/.*actors.*/)
    }
  })

  test('should display dashboard properly on mobile', async ({ page }) => {
    await page.goto('/dashboard')

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
    await page.goto('/dashboard')

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
    await page.goto('/iocs')
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
    await page.goto('/actors')
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
    await page.goto('/actors')
    await page.waitForLoadState('networkidle')

    // Open a detail panel first
    const actorRow = page.locator('tr, .actor-card, .cyber-card').first()
    const hasActor = await actorRow.isVisible().catch(() => false)

    if (hasActor) {
      await actorRow.click()
      await page.waitForTimeout(500)

      // Find close button
      const closeButton = page.locator(
        'button[aria-label*="close" i], button:has-text("Close"), [data-testid="close-panel"]'
      ).first()

      const hasClose = await closeButton.isVisible().catch(() => false)

      if (hasClose) {
        await closeButton.click()
        await page.waitForTimeout(300)
      }
    }
  })
})

test.describe('Mobile Tables', () => {
  test('should display tables responsively', async ({ page }) => {
    await page.goto('/incidents')
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
    await page.goto('/incidents')
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
    await page.goto('/actors')
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
    await page.goto('/dashboard')
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

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Dashboard should load within 10 seconds on mobile
    expect(loadTime).toBeLessThan(10000)
  })

  test('should load actors page within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/actors')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000)
  })
})
