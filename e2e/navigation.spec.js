import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

/**
 * Sidebar navigation. Links are scoped to the sidebar - the dashboard links to the
 * same routes from its cards - and .first() is needed even then, because the sidebar
 * renders each entry twice for its collapsed and expanded states.
 */
const navLink = (page, name) =>
  page.locator('nav, aside').first().getByRole('link', { name, exact: true }).first()

test.describe('Navigation', () => {
  test('should navigate to the Activity feed', async ({ page }) => {
    await openApp(page)

    await navLink(page, 'Activity').click()

    await expect(page).toHaveURL(/\/events/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('should navigate to Threat Actors page', async ({ page }) => {
    await openApp(page)

    await navLink(page, 'Threat Actors').click()

    await expect(page).toHaveURL(/\/actors/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('should navigate to the Incidents page', async ({ page }) => {
    await openApp(page)

    await navLink(page, 'Alerts').click()

    await expect(page).toHaveURL(/\/alerts/)
    await expect(page.getByRole('heading').first()).toBeVisible()
  })

  test('should navigate to Vulnerabilities page', async ({ page }) => {
    await openApp(page)

    await navLink(page, 'Vulnerabilities').click()

    await expect(page).toHaveURL(/\/vulnerabilities/)
    await expect(page.getByRole('heading', { name: /vulnerabilit|cve|kev/i }).first()).toBeVisible()
  })

  test('should navigate to IOCs page', async ({ page }) => {
    await openApp(page)

    await navLink(page, 'IOC Search').click()

    await expect(page).toHaveURL(/\/iocs/)
    await expect(page.getByRole('heading', { name: 'IOC Intelligence' })).toBeVisible()
  })

  test('should display Watchlists page', async ({ page }) => {
    await openApp(page, '/watchlists')

    await expect(page).toHaveURL(/\/watchlists/)
    await expect(page.getByText(/watchlist/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('should display Settings page', async ({ page }) => {
    await openApp(page, '/settings')

    await expect(page).toHaveURL(/\/settings/)
    await expect(page.locator('h1')).toContainText(/settings/i)
  })
})
