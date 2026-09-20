import { test, expect } from '@playwright/test'
import { openApp, navigateTo } from './support/app'

test.describe('Demo mode entry', () => {
  test('opens the dashboard without an account', async ({ page }) => {
    await openApp(page)
    await expect(page.locator('header')).toBeVisible()
  })

  test('reaches the IOC page', async ({ page }) => {
    await openApp(page)
    await navigateTo(page, '/iocs')
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  })
})
