// @ts-check
import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

/**
 * Sanctions.
 *
 * The suite runs against the stubbed boundary, so the figures are zero. What is
 * worth asserting is not the numbers but the three claims the page makes around
 * them, each of which exists to stop a reader reaching a conclusion the data
 * does not support, and each of which is one careless edit from vanishing:
 *
 *   that none of Vigil's wallets appear on the SDN list and that this is the
 *   expected answer rather than a gap - ransom addresses are per-victim, OFAC
 *   designates exchange deposit and actor-controlled addresses;
 *
 *   that a lookup miss is "not on this list", never "clean"; and
 *
 *   that a delisted address is a third answer rather than a no.
 */

test.describe('Sanctions page', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page, '/sanctions')
  })

  test('renders its own content rather than the error boundary', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sanctions', level: 1 })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: /page error/i })).toHaveCount(0)
  })

  test('says the wallet overlap is expected, not a gap', async ({ page }) => {
    // Putting "wallets held" and "sanctioned addresses" on one screen without
    // this invites the reader to infer that a victim paid a sanctioned address.
    await expect(page.getByText(/expected answer/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/generated per victim/i)).toBeVisible()
    await expect(page.getByText(/says nothing about whether any victim paid/i)).toBeVisible()
  })

  test('offers a lookup and does not call a miss clean', async ({ page }) => {
    const input = page.getByLabel('Wallet address')
    await expect(input).toBeVisible({ timeout: 15000 })

    // An address that is not designated. The stub returns nothing either way;
    // what matters is the wording of the miss.
    await input.fill('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')
    await page.getByRole('button', { name: /check/i }).click()

    await expect(page.getByText(/not on the SDN list/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/not the same as clean/i)).toBeVisible()
  })

  test('explains that match_basis is the claim being made', async ({ page }) => {
    // 'name' states itself; 'alias_reviewed' rests on a recorded verdict.
    // Without this the two read as equally strong.
    await expect(page.getByText(/without a recorded verdict/i)).toBeVisible({ timeout: 15000 })
  })
})
