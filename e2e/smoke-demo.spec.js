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

test.describe('Demo mode exit', () => {
  test('"Exit Demo" returns to the landing page with the demo off', async ({ page }) => {
    // Leave from a page other than the dashboard, so the exit has to move the
    // visitor rather than re-render the address they are already on.
    await openApp(page, '/iocs')

    await page.getByRole('button', { name: 'Exit Demo' }).click()

    await expect(page).toHaveURL((url) => url.pathname === '/')
    await expect(page.getByRole('button', { name: /exploring demo/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Not found' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Exit Demo' })).toHaveCount(0)
  })
})
