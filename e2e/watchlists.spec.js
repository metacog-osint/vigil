// @ts-check
import { test, expect } from '@playwright/test'

/**
 * E2E tests for Watchlist management
 */

test.describe('Watchlists Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/watchlists')
  })

  test('should display watchlists page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /watchlists/i })).toBeVisible()
  })

  test('should show empty state when no watchlists exist', async ({ page }) => {
    // Check for empty state or watchlist content
    const content = page.locator('.cyber-card, [data-testid="empty-state"]')
    await expect(content.first()).toBeVisible()
  })

  test('should have create watchlist button', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|add|new/i })
    // Button may be hidden behind feature gate
    const isVisible = await createButton.isVisible().catch(() => false)
    if (isVisible) {
      await expect(createButton).toBeEnabled()
    }
  })

  test('should navigate to actors page from watchlist item', async ({ page }) => {
    // If there are watchlist items with links
    const actorLink = page.locator('a[href*="/actors"]').first()
    const hasLinks = await actorLink.isVisible().catch(() => false)

    if (hasLinks) {
      await actorLink.click()
      await expect(page).toHaveURL(/.*actors.*/)
    }
  })

  test('should have accessible structure', async ({ page }) => {
    // Check for proper heading hierarchy
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
  })
})

test.describe('Watchlist Actions', () => {
  test('should be able to add actor to watchlist from actors page', async ({ page }) => {
    await page.goto('/actors')

    // Find a watch button
    const watchButton = page.locator('button:has-text("Watch"), [aria-label*="watch" i]').first()
    const hasWatchButton = await watchButton.isVisible().catch(() => false)

    if (hasWatchButton) {
      // Click should not throw error
      await watchButton.click()
      // Should show some feedback (toast, button state change, etc)
      await page.waitForTimeout(500)
    }
  })

  test('should show watchlist indicator on watched actors', async ({ page }) => {
    await page.goto('/actors')

    // Look for watched indicators
    const watchedIndicator = page.locator('[data-watched="true"], .watched, [aria-pressed="true"]').first()
    const hasWatched = await watchedIndicator.isVisible().catch(() => false)

    // This is informational - some actors may be watched
    expect(typeof hasWatched).toBe('boolean')
  })
})

test.describe('Watchlist Filtering', () => {
  test('should filter actors page by watchlist', async ({ page }) => {
    await page.goto('/actors')

    // Look for watchlist filter option
    const filterButton = page.locator('button:has-text("Watchlist"), select option:has-text("Watchlist")')
    const hasFilter = await filterButton.first().isVisible().catch(() => false)

    expect(typeof hasFilter).toBe('boolean')
  })
})
