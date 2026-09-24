// @ts-check
import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

/**
 * Pages that used to sit behind a subscription gate.
 *
 * Until the tier system was removed, every one of these rendered an upgrade
 * prompt instead of itself for anyone without the right plan — which, in demo
 * mode and for a logged-out visitor, was everyone. So their own render path had
 * never run in a browser, and at least one of them was broken: Watchlists
 * handed EmptyState an object as its `action` and React refused to render it,
 * which surfaced as "Page Error" the moment the gate came off.
 *
 * This asserts the minimum that was not true before: each page reaches its own
 * content, empty or not, rather than the error boundary.
 */

// [path, expected <h1>, or null to accept any heading]
//
// /assets is deliberately absent. It renders "Please sign in to manage your
// assets." and no heading, and openApp() treats a heading in <main> as the
// signal that the destination painted — so the helper retries four times and
// the test times out on a page that rendered correctly. Checked by hand
// instead; relaxing that signal destabilised every other spec.
const PAGES = [
  ['/watchlists', 'Watchlists'],
  ['/threat-hunts', 'Threat Hunts'],
  ['/investigations', 'Investigations'],
  ['/custom-iocs', null],
  ['/advanced-search', null],
  ['/bulk-search', null],
  ['/audit-logs', null],
  ['/reports', 'Scheduled Reports'],
  ['/api-docs', 'API Documentation'],
  ['/status', 'System Status'],
  ['/benchmarks', null],
  ['/chat-integrations', null],
]

test.describe('Previously gated pages render', () => {
  for (const [path, heading] of PAGES) {
    test(`${path} should not render the error boundary`, async ({ page }) => {
      await openApp(page, path)

      // Wait for the page's own content before asserting anything is absent.
      // toHaveCount(0) is satisfied by a page that has not rendered yet, so
      // running the two negative checks first made them pass on a blank
      // document — they would have reported success for a page that was still
      // painting, which is the state a broken page spends its whole life in.
      if (heading) {
        await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible({
          timeout: 15000,
        })
      } else {
        // No specific heading to expect, so the error boundary's own "Page
        // Error" heading can satisfy this. The next assertion is what rules
        // that out.
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 })
      }

      // The error boundary is what a render-time throw looks like to a user.
      await expect(page.getByRole('heading', { name: /page error/i })).toHaveCount(0)

      // And nothing should be offering an upgrade any more.
      await expect(page.getByRole('heading', { name: /upgrade to/i })).toHaveCount(0)
    })
  }
})
