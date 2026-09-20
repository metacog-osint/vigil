import { expect } from '@playwright/test'

/**
 * Open the application.
 *
 * Vigil gates its pages behind sign-in, so "/" serves the landing page to a
 * logged-out visitor and every app route redirects to /auth. The landing page
 * offers demo mode, which renders the full application against a fixed mock
 * dataset — that is what these tests drive, so they neither need credentials
 * nor depend on what the live feeds happen to hold today.
 *
 * Demo mode lives in React state, so it is entered once per page and lost on a
 * full reload; navigate within the app rather than calling page.goto() again.
 */
export async function openApp(page, path = '/') {
  // The onboarding tour covers the app with a full-screen overlay that swallows
  // clicks, and it only stays down once this flag is set.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('vigil_tour_completed', 'true')
    } catch {
      // private mode or blocked storage: the tour will show, tests will say so
    }
  })

  await page.goto('/')

  const demoButton = page.getByRole('button', { name: /exploring demo/i })
  await demoButton.click()

  // The dashboard is the demo landing spot.
  await expect(page.getByRole('heading', { name: 'Vigil Dashboard' })).toBeVisible({
    timeout: 15000,
  })

  if (path !== '/') {
    await navigateTo(page, path)
  }
}

/** Move to another route without reloading, which would drop demo mode. */
export async function navigateTo(page, path) {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}
