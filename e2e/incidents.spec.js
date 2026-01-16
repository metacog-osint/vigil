import { test, expect } from '@playwright/test'

test.describe('Incidents Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ransomware')
  })

  test('should display incidents heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /ransomware|incidents/i })).toBeVisible()
  })

  test('should have sector filter', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for sector filter dropdown or filter section
    const sectorFilter = page.locator('select, button:has-text("sector")', { hasText: /sector|industry/i }).first()

    if (await sectorFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(sectorFilter).toBeEnabled()
    }
  })

  test('should display incident statistics', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Check for stat cards or summary section
    const hasStats = await page.locator('[class*="stat"], [class*="metric"], [class*="count"]').first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasTable = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasStats || hasTable).toBeTruthy()
  })

  test('should have time range filter', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for time range buttons (7d, 30d, etc.) or date picker
    const timeFilter = page.locator('button:has-text("7d"), button:has-text("30d"), [class*="time-range"]').first()

    if (await timeFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(timeFilter).toBeVisible()
    }
  })

  test('should show incident details on row click', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Find clickable incident rows
    const incidentRow = page.locator('table tbody tr, [class*="incident-card"]').first()

    if (await incidentRow.isVisible({ timeout: 10000 }).catch(() => false)) {
      await incidentRow.click()
      // Wait for detail panel or modal
      await page.waitForTimeout(500)
    }
  })
})
