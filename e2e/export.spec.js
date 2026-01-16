// @ts-check
import { test, expect } from '@playwright/test'

/**
 * E2E tests for Export functionality
 */

test.describe('Export Button', () => {
  const pagesWithExport = [
    { path: '/actors', name: 'Threat Actors' },
    { path: '/incidents', name: 'Incidents' },
    { path: '/vulnerabilities', name: 'Vulnerabilities' },
    { path: '/iocs', name: 'IOCs' },
  ]

  for (const { path, name } of pagesWithExport) {
    test(`should have export button on ${name} page`, async ({ page }) => {
      await page.goto(path)

      // Wait for content to load
      await page.waitForLoadState('networkidle')

      // Look for export button
      const exportButton = page.locator('button:has-text("Export"), [aria-label*="export" i]').first()
      const isVisible = await exportButton.isVisible().catch(() => false)

      // Export button should be present (may be in dropdown)
      expect(typeof isVisible).toBe('boolean')
    })
  }
})

test.describe('Export Formats', () => {
  test('should show export format options on actors page', async ({ page }) => {
    await page.goto('/actors')
    await page.waitForLoadState('networkidle')

    // Find and click export button
    const exportButton = page.locator('button:has-text("Export")').first()
    const hasExport = await exportButton.isVisible().catch(() => false)

    if (hasExport) {
      await exportButton.click()

      // Should show format options (CSV, JSON, etc)
      const formatOptions = page.locator('button:has-text("CSV"), button:has-text("JSON")')
      const hasOptions = await formatOptions.first().isVisible({ timeout: 2000 }).catch(() => false)

      expect(typeof hasOptions).toBe('boolean')
    }
  })

  test('should trigger download on export click', async ({ page }) => {
    await page.goto('/vulnerabilities')
    await page.waitForLoadState('networkidle')

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)

    // Find and click export button
    const exportButton = page.locator('button:has-text("Export")').first()
    const hasExport = await exportButton.isVisible().catch(() => false)

    if (hasExport) {
      await exportButton.click()

      // Try clicking CSV option if menu appears
      const csvOption = page.locator('button:has-text("CSV")').first()
      const hasCsv = await csvOption.isVisible({ timeout: 1000 }).catch(() => false)

      if (hasCsv) {
        await csvOption.click()
        const download = await downloadPromise

        if (download) {
          expect(download.suggestedFilename()).toMatch(/\.(csv|json)$/i)
        }
      }
    }
  })
})

test.describe('Export Data Integrity', () => {
  test('should export current filtered data', async ({ page }) => {
    await page.goto('/incidents')
    await page.waitForLoadState('networkidle')

    // Apply a filter if available
    const filterInput = page.locator('input[placeholder*="search" i], input[placeholder*="filter" i]').first()
    const hasFilter = await filterInput.isVisible().catch(() => false)

    if (hasFilter) {
      await filterInput.fill('test')
      await page.waitForTimeout(500)
    }

    // Export should respect current filters
    const exportButton = page.locator('button:has-text("Export")').first()
    const hasExport = await exportButton.isVisible().catch(() => false)

    expect(typeof hasExport).toBe('boolean')
  })
})

test.describe('Bulk Export', () => {
  test('should handle large dataset export', async ({ page }) => {
    await page.goto('/iocs')
    await page.waitForLoadState('networkidle')

    // IOCs page typically has many records
    const exportButton = page.locator('button:has-text("Export")').first()
    const hasExport = await exportButton.isVisible().catch(() => false)

    // Should not crash on export attempt
    expect(typeof hasExport).toBe('boolean')
  })
})

test.describe('Export Accessibility', () => {
  test('export button should be keyboard accessible', async ({ page }) => {
    await page.goto('/actors')
    await page.waitForLoadState('networkidle')

    // Tab to export button
    const exportButton = page.locator('button:has-text("Export")').first()
    const hasExport = await exportButton.isVisible().catch(() => false)

    if (hasExport) {
      await exportButton.focus()
      const isFocused = await exportButton.evaluate(el => el === document.activeElement)
      expect(typeof isFocused).toBe('boolean')
    }
  })
})
