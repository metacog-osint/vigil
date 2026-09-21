import { expect } from '@playwright/test'
import { stubSupabase } from './supabase.js'

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
  // Nothing in this suite may reach the live project. The landing page queries
  // it on load, so this has to be in place before the first navigation.
  await stubSupabase(page)

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

/**
 * Move to another route without reloading, which would drop demo mode.
 *
 * The dispatch is not enough on its own. A synthetic popstate is a best-effort
 * nudge to the router: if React is mid-render when it fires - which webkit on
 * CI is, far more often than chromium, because it renders more slowly - the
 * event is observed and nothing re-routes. The URL changes, the page does not,
 * and every assertion afterwards fails against a dashboard that is still on
 * screen. That is what "element(s) not found" meant in
 * vulnerabilities.spec.js, incidents.spec.js and export.spec.js.
 *
 * So this waits for arrival and dispatches again if it did not happen. Leaving
 * the dashboard is the signal, because only the dashboard renders that
 * heading.
 */
export async function navigateTo(page, path) {
  const dashboardHeading = page.getByRole('heading', { name: 'Vigil Dashboard' })

  // Navigating to the dashboard has no "left the dashboard" signal to wait on.
  if (path === '/') {
    await page.evaluate((target) => {
      window.history.pushState({}, '', target)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 })
    return
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    await page.evaluate((target) => {
      window.history.pushState({}, '', target)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)

    try {
      // Leaving the dashboard is the whole signal. The destination's own
      // pathname is not usable for this: /ransomware and /incidents are both
      // <Navigate> redirects to /events?view=ransomware, so asserting that
      // location.pathname equals the requested path fails on exactly the
      // routes most of these specs use.
      await expect(dashboardHeading).toHaveCount(0, { timeout: 4000 })

      // Leaving is not arriving. The dashboard unmounting says the router
      // moved; it does not say the destination has painted, and an assertion
      // with Playwright's five-second default would then race the first
      // render. Every route puts a heading in <main>, so wait for one.
      await expect(page.locator('main').getByRole('heading').first()).toBeVisible({
        timeout: 15000,
      })
      return
    } catch {
      // The router did not pick the event up. Try again rather than let the
      // caller assert against the wrong page.
    }
  }

  throw new Error(`navigateTo(${path}) never left the dashboard after 4 attempts`)
}
