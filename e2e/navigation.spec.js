import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should navigate to Events page', async ({ page }) => {
    await page.goto('/')

    // Click on Events link
    await page.getByRole('link', { name: /events/i }).click()

    // Verify URL changed
    await expect(page).toHaveURL(/\/events/)

    // Verify page content
    await expect(page.getByRole('heading', { name: /event/i })).toBeVisible()
  })

  test('should navigate to Threat Actors page', async ({ page }) => {
    await page.goto('/')

    // Click on Actors link
    await page.getByRole('link', { name: /actors/i }).click()

    // Verify URL changed
    await expect(page).toHaveURL(/\/actors/)

    // Verify page content
    await expect(page.getByRole('heading', { name: /actor/i })).toBeVisible()
  })

  test('should navigate to Ransomware/Incidents page', async ({ page }) => {
    await page.goto('/')

    // Click on Ransomware or Incidents link
    const link = page.getByRole('link', { name: /ransomware|incidents/i })
    await link.click()

    // Verify URL changed
    await expect(page).toHaveURL(/\/ransomware|\/incidents/)

    // Verify page content
    await expect(page.getByRole('heading', { name: /ransomware|incidents/i })).toBeVisible()
  })

  test('should navigate to Vulnerabilities page', async ({ page }) => {
    await page.goto('/')

    // Click on Vulnerabilities link
    await page.getByRole('link', { name: /vulnerabilities|cve/i }).click()

    // Verify URL changed
    await expect(page).toHaveURL(/\/vulnerabilities/)

    // Verify page content
    await expect(page.getByRole('heading', { name: /vulnerabilit|cve|kev/i })).toBeVisible()
  })

  test('should navigate to IOCs page', async ({ page }) => {
    await page.goto('/')

    // Click on IOC Search link (exact name in sidebar)
    await page.getByRole('link', { name: 'IOC Search' }).click()

    // Verify URL changed
    await expect(page).toHaveURL(/\/iocs/)

    // Verify page content - be specific about the h1 heading
    await expect(page.getByRole('heading', { name: 'IOC Search', level: 1 })).toBeVisible()
  })

  test('should display Watchlists page', async ({ page }) => {
    // Navigate directly to watchlists page
    await page.goto('/watchlists')

    // Verify URL
    await expect(page).toHaveURL(/\/watchlists/)

    // Wait for page to load and verify heading
    await expect(page.getByRole('heading', { name: 'Watchlists' })).toBeVisible({ timeout: 10000 })
  })

  test('should display Settings page', async ({ page }) => {
    // Navigate directly to settings page
    await page.goto('/settings')

    // Verify URL
    await expect(page).toHaveURL(/\/settings/)

    // Verify page content - look for h1 specifically
    await expect(page.locator('h1')).toContainText(/settings/i)
  })
})
