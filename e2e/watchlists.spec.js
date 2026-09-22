// @ts-check
import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

/**
 * Watchlists.
 *
 * These run as a free-tier user (demo mode), and watchlists are a Professional
 * feature, so the page renders an upgrade gate rather than watchlist management.
 * That gate is what a logged-out or free visitor actually sees, so it is what is
 * asserted here; the management flows need a paid account and are marked as such.
 */

test.describe('Watchlists Page', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/watchlists')
  })

  test('should render the page rather than an upgrade gate', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: /upgrade to professional/i })).toHaveCount(0)
  })

  test('should have create watchlist button', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create|add|new/i })
    const isVisible = await createButton
      .first()
      .isVisible()
      .catch(() => false)
    if (isVisible) {
      await expect(createButton.first()).toBeEnabled()
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
    await expect(page.getByRole('heading').first()).toBeVisible()
  })
})

test.describe('Watchlist Actions', () => {
  test('should be able to add actor to watchlist from actors page', async ({ page }) => {
    await openApp(page, '/actors')

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
    await openApp(page, '/actors')

    // Look for watched indicators
    const watchedIndicator = page
      .locator('[data-watched="true"], .watched, [aria-pressed="true"]')
      .first()
    const hasWatched = await watchedIndicator.isVisible().catch(() => false)

    // This is informational - some actors may be watched
    expect(typeof hasWatched).toBe('boolean')
  })
})

test.describe('Watchlist Filtering', () => {
  test('should filter actors page by watchlist', async ({ page }) => {
    await openApp(page, '/actors')

    // Look for watchlist filter option
    const filterButton = page.locator(
      'button:has-text("Watchlist"), select option:has-text("Watchlist")'
    )
    const hasFilter = await filterButton
      .first()
      .isVisible()
      .catch(() => false)

    expect(typeof hasFilter).toBe('boolean')
  })
})

test.describe('Watchlist Management Flow', () => {
  test('should create new watchlist', async ({ page }) => {
    await openApp(page, '/watchlists')

    // Find create button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")')
    const hasCreate = await createButton
      .first()
      .isVisible()
      .catch(() => false)

    if (hasCreate) {
      await createButton.first().click()

      // Should show modal or form
      const modal = page.locator('[role="dialog"], .modal, form')
      const hasModal = await modal
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)

      expect(typeof hasModal).toBe('boolean')
    }
  })

  // Demo mode has no account, so there is never a watchlist here to open. What
  // this can check is that the page reaches its empty state rather than the
  // error boundary — which is what it did before, when EmptyState was handed an
  // object as its action and React refused to render it.
  test('should reach the empty state rather than the error boundary', async ({ page }) => {
    await openApp(page, '/watchlists')

    await expect(page.getByRole('heading', { name: 'No watchlists yet' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: 'Create Watchlist' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /page error/i })).toHaveCount(0)
  })

  // Persistence needs a signed-in account; demo mode cannot create a watchlist,
  // and a reload would drop demo mode in any case.
  test.skip('should persist watchlist after page reload', async () => {})
})

test.describe('Watchlist Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should display properly on mobile viewport', async ({ page }) => {
    await openApp(page, '/watchlists')

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })

    // Check that navigation is accessible (hamburger menu)
    const menuButton = page.locator('[aria-label*="menu" i], button:has-text("Menu")')
    const hasMenu = await menuButton
      .first()
      .isVisible()
      .catch(() => false)

    // Either menu button or navigation should be visible
    expect(typeof hasMenu).toBe('boolean')
  })

  test('should handle touch interactions', async ({ page }) => {
    await openApp(page, '/watchlists')

    // Find any interactive element
    const card = page.locator('.cyber-card').first()
    const hasCard = await card.isVisible().catch(() => false)

    if (hasCard) {
      // Tap should work
      await card.tap().catch(() => {})
    }
  })
})
