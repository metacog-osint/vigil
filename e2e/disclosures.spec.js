// @ts-check
import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

/**
 * Regulator disclosures.
 *
 * The suite runs against the stubbed boundary, so the figures here are zero —
 * what is worth asserting is not the numbers but the claims the page makes
 * around them. Two in particular have to survive any future edit:
 *
 *   the statement that the state counts are not comparable, because Washington
 *   counts its own residents and Oregon counts everyone worldwide; and
 *
 *   the statement that an unreviewed filing does not mean no attacker is
 *   known. Both exist so a reader is not invited to a conclusion the data does
 *   not support, and both are one careless edit away from disappearing.
 */

test.describe('Disclosures page', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/disclosures')
  })

  test('renders its own content rather than the error boundary', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Regulator disclosures', level: 1 })
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: /page error/i })).toHaveCount(0)
  })

  test('says the state counts cannot be compared', async ({ page }) => {
    await expect(page.getByText(/not comparable with each other/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Washington counts its own residents/i)).toBeVisible()
    await expect(page.getByText(/Oregon counts everyone affected worldwide/i)).toBeVisible()
  })

  test('does not let unreviewed be read as "no attacker known"', async ({ page }) => {
    await expect(page.getByText(/does not mean no attacker is known/i)).toBeVisible({
      timeout: 15000,
    })
  })

  test('offers a registry filter and a name search', async ({ page }) => {
    await expect(page.getByLabel('Registry')).toBeVisible({ timeout: 15000 })
    await expect(page.getByLabel('Organisation')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible()
  })

  test('names the registry a filing came from in every row it draws', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Registry' })).toBeVisible({
      timeout: 15000,
    })
    // A filing with no attributable authority would be a claim with no source.
    await expect(page.getByRole('columnheader', { name: 'Organisation' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Filing' })).toBeVisible()
  })
})
