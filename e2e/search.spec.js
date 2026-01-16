import { test, expect } from '@playwright/test'

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should open search modal when clicking search button', async ({ page }) => {
    // Click search button in header
    const searchButton = page.locator('[data-tour="search-button"]').first()
    await searchButton.click()

    // Verify search modal opens - look for the search input with specific placeholder
    const searchInput = page.locator('input[placeholder*="Search actors"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
  })

  test('should close search modal with Escape key', async ({ page }) => {
    // Open search modal via button click (more reliable than keyboard)
    const searchButton = page.locator('[data-tour="search-button"]').first()
    await searchButton.click()

    // Wait for modal to appear
    const searchInput = page.locator('input[placeholder*="Search actors"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Press Escape
    await page.keyboard.press('Escape')

    // Verify modal closed
    await expect(searchInput).not.toBeVisible({ timeout: 3000 })
  })

  test('should allow typing in search input', async ({ page }) => {
    // Open search modal via button click (more reliable)
    const searchButton = page.locator('[data-tour="search-button"]').first()
    await searchButton.click()

    // Wait for modal and get search input
    const searchInput = page.locator('input[placeholder*="Search actors"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Type search query
    await searchInput.fill('lockbit')

    // Verify input value
    await expect(searchInput).toHaveValue('lockbit')
  })
})
