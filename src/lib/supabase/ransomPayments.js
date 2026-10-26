/**
 * Ransom payments by family, from the Ransomwhere deposit on Zenodo.
 *
 * 136 families, 21,790 transactions and 11,178 addresses, imported by the
 * ransomwhere-archive Edge Function (migration 152). CC BY 4.0, which makes it
 * the one ransom-payment source Vigil holds that may be sold, with attribution.
 * It was in the database from 4 October and nothing rendered it.
 *
 * Three rules, each one a commit away from being undone:
 *
 * THERE IS NO SINGLE TOTAL
 *
 * The deposit sums to about USD 1.016 billion, and USD 682 million of that -
 * two thirds - belongs to "Unlabeled", the dataset's own name for addresses it
 * could not attribute. "Over a billion dollars tracked" would be two thirds
 * unattributed, the same mistake as the 1.45 billion "people affected" that
 * disclosures.js refuses to produce. So the summary returns attributed and
 * unlabeled separately, plus the unlabeled share, and nothing that adds them.
 * A test asserts the absence.
 *
 * THE DATA HAS AN AGE, AND IT IS NOT THE IMPORT'S
 *
 * v1.1.0 was published on 27 October 2024 and its last payment is 19 August
 * 2024. The import runs weekly and finds nothing new, so its feed reads fresh;
 * the payments do not. The summary carries the snapshot version, the
 * publication date and the last payment date, and the page states them before
 * any figure. If rows ever come from two snapshots - a family a new version
 * dropped keeps its old row - the summary says so rather than adding them up.
 *
 * EVERY FIGURE FROM ALL THE ROWS, OR NONE
 *
 * PostgREST caps a plain select at 1,000 rows. 136 fit today, but a sum over
 * a capped result is a smaller number that looks fine. The rows are fetched
 * with an exact count, and if fewer come back than exist, every summed figure
 * is null and renders as a dash.
 *
 * Two smaller ones. USD is the value at the time of each payment, as the
 * dataset records it, never today's price. And BTC is held but not exposed:
 * the deposit does not say every address is a Bitcoin address, and a BTC sum
 * across chains would be a figure about nothing.
 *
 * Family names are the dataset's labels, not Vigil's attribution. They are
 * not linked to actor records, because deciding that a payment family is a
 * tracked group is a judgment, and judgments go through the review queue.
 */

import { supabase } from './client'

export const RANSOM_PAYMENTS_SOURCE = 'ransomwhere-archive'

/** The dataset's own label for addresses it could not attribute. */
export const UNLABELED_FAMILY = 'Unlabeled'

/** CC BY 4.0 requires attribution and a note of changes. Rendered on the page. */
export const RANSOMWHERE_CITATION = {
  author: 'Jack Cable',
  title: 'Ransomwhere: A Crowdsourced Ransomware Payment Dataset',
  publisher: 'Zenodo',
  doi: '10.5281/zenodo.6512122',
  url: 'https://doi.org/10.5281/zenodo.6512122',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  changes: 'Transactions aggregated per family by Vigil; figures otherwise unaltered.',
}

const COLUMNS =
  'family_name, total_usd, payment_count, unique_addresses, first_payment, last_payment, metadata'

function isUnlabeled(row) {
  return row.metadata?.attributed === false || row.family_name === UNLABELED_FAMILY
}

function toFamily(row) {
  return {
    name: row.family_name,
    usd: row.total_usd === null ? null : Number(row.total_usd),
    payments: row.payment_count,
    addresses: row.unique_addresses,
    firstPayment: row.first_payment,
    lastPayment: row.last_payment,
  }
}

function sum(list, key) {
  return list.reduce((acc, f) => acc + (typeof f[key] === 'number' ? f[key] : 0), 0)
}

function extreme(values, pick) {
  const present = values.filter(Boolean).sort()
  if (!present.length) return null
  return pick === 'min' ? present[0] : present[present.length - 1]
}

/**
 * Pure, so the rules above can be tested without a database.
 *
 * `count` is the database's exact count. When `rows` is shorter, the summed
 * figures are null: they would be sums over part of the data.
 */
export function summarise(rows, count) {
  const complete = Array.isArray(rows) && typeof count === 'number' && rows.length === count
  const list = rows ?? []

  const unlabeledRow = list.find(isUnlabeled) ?? null
  const named = list.filter((r) => !isUnlabeled(r)).map(toFamily)
  const unlabeled = unlabeledRow ? toFamily(unlabeledRow) : null

  const versions = [...new Set(list.map((r) => r.metadata?.snapshot_version).filter(Boolean))]
  const published = [...new Set(list.map((r) => r.metadata?.snapshot_published).filter(Boolean))]

  const attributedUsd = complete ? sum(named, 'usd') : null
  const unlabeledUsd = complete ? (unlabeled?.usd ?? 0) : null
  const both = attributedUsd !== null && unlabeledUsd !== null ? attributedUsd + unlabeledUsd : null

  return {
    complete,
    familiesHeld: typeof count === 'number' ? count : null,
    namedFamilies: complete ? named.length : null,
    attributedUsd,
    attributedPayments: complete ? sum(named, 'payments') : null,
    attributedAddresses: complete ? sum(named, 'addresses') : null,
    unlabeledUsd,
    unlabeledPayments: complete ? (unlabeled?.payments ?? 0) : null,
    unlabeledAddresses: complete ? (unlabeled?.addresses ?? 0) : null,
    // A share, not a sum: how much of the money the dataset could not attribute.
    unlabeledShare: both ? unlabeledUsd / both : null,
    snapshot: {
      version: versions.length === 1 ? versions[0] : null,
      published: published.length === 1 ? published[0] : null,
      mixed: versions.length > 1,
      versions,
      firstPayment: extreme(
        list.map((r) => r.first_payment),
        'min'
      ),
      lastPayment: extreme(
        list.map((r) => r.last_payment),
        'max'
      ),
    },
  }
}

export const ransomPayments = {
  /**
   * Every family row, the named families most money first, Unlabeled apart,
   * and the summary. One request: 136 rows.
   */
  async getPayments() {
    const { data, count, error } = await supabase
      .from('ransomware_payments')
      .select(COLUMNS, { count: 'exact' })
      .eq('source', RANSOM_PAYMENTS_SOURCE)
      .order('total_usd', { ascending: false })

    if (error) return { data: null, error }

    const summary = summarise(data, count)
    const families = (data ?? []).filter((r) => !isUnlabeled(r)).map(toFamily)
    const unlabeledRow = (data ?? []).find(isUnlabeled)

    return {
      data: {
        summary,
        families,
        unlabeled: unlabeledRow ? toFamily(unlabeledRow) : null,
      },
      error: null,
    }
  },
}
