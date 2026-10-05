/**
 * Ransom payments, from the archive rather than the API that died.
 *
 * WHY THIS EXISTS
 *
 * api.ransomwhe.re/export has returned HTTP 502 since 20 September 2026. The
 * host answers, the export path does not, and ransomwhe.re still links to that
 * exact URL - so it is the service, not a move, and not ours to fix. It left
 * ransomware_payments holding 13 rows, which was the whole of what Vigil knew
 * about where ransom money goes.
 *
 * The same dataset is deposited on Zenodo under CC-BY-4.0: 11,178 addresses,
 * 136 families, 21,790 transactions with per-transaction amounts. Commercial
 * use with attribution, which no other ransom-payment source Vigil can reach
 * permits.
 *
 * WHY IT IS AN EDGE FUNCTION
 *
 * The file is 5.5 MB of JSON and the aggregation walks every transaction. That
 * is CPU the Cloudflare worker does not have, and one subrequest it does.
 *
 * WHY IT CHECKS THE VERSION FIRST
 *
 * The concept DOI (6512122) always resolves to the newest deposit, and one call
 * to the record API returns the version, the publication date and the file URL.
 * If the version matches what was imported last time, nothing is downloaded -
 * re-importing an unchanged snapshot would cost 5.5 MB to write the same rows.
 *
 * WHAT THIS IS NOT
 *
 * A live feed. v1.1.0 ends in 2024, so payments since are missing and no amount
 * of re-running will add them. Every row carries snapshot_version and
 * snapshot_published for that reason: a page can then show the age of the data
 * instead of the age of the import.
 *
 * Full reasoning: supabase/migrations/152_ransomwhere_archive.sql
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CONCEPT_RECORD = 'https://zenodo.org/api/records/6512122'
const SOURCE = 'ransomwhere-archive'
const FEED_ID = 'ransomwhere'
const UA = 'Vigil-ThreatIntel/1.0'
const SATS_PER_BTC = 100_000_000

interface Transaction {
  time?: number
  amount?: number
  amountUSD?: number
}

interface Entry {
  address?: string
  family?: string
  blockchain?: string
  transactions?: Transaction[]
}

interface Family {
  family_name: string
  total_btc: number
  total_usd: number
  payment_count: number
  unique_addresses: number
  first_payment: string | null
  last_payment: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isoDate(seconds: number | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null
  const d = new Date(seconds * 1000)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/**
 * Per-family aggregates.
 *
 * `amount` is satoshis; `amountUSD` is the value at the time of the transaction,
 * which is the only honest basis for a total - converting today's BTC price back
 * over ten years of payments would invent a number.
 *
 * An address with no transactions still counts as an address. It was collected
 * as a ransom address; that it has no recorded payment is a fact about the
 * blockchain record, not a reason to drop it.
 */
export function aggregate(entries: Entry[]): Family[] {
  const byFamily = new Map<string, Family>()

  for (const entry of entries) {
    // The dataset's own label for an address it could not attribute. Kept as a
    // family rather than discarded or folded in: it is two thirds of the money.
    const name = entry.family?.trim() || 'Unlabeled'

    const family =
      byFamily.get(name) ??
      {
        family_name: name,
        total_btc: 0,
        total_usd: 0,
        payment_count: 0,
        unique_addresses: 0,
        first_payment: null,
        last_payment: null,
      }

    family.unique_addresses += 1

    for (const tx of entry.transactions ?? []) {
      family.payment_count += 1
      family.total_btc += (tx.amount ?? 0) / SATS_PER_BTC
      family.total_usd += tx.amountUSD ?? 0

      const date = isoDate(tx.time)
      if (date) {
        if (!family.first_payment || date < family.first_payment) family.first_payment = date
        if (!family.last_payment || date > family.last_payment) family.last_payment = date
      }
    }

    byFamily.set(name, family)
  }

  return [...byFamily.values()]
    .map((f) => ({
      ...f,
      // Satoshis are integers; the division above is not. Eight places is the
      // precision bitcoin actually has.
      total_btc: Number(f.total_btc.toFixed(8)),
      total_usd: Number(f.total_usd.toFixed(2)),
    }))
    .sort((a, b) => b.total_usd - a.total_usd)
}

Deno.serve(async (request) => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: SOURCE, error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)
  const force = new URL(request.url).searchParams.get('force') === '1'

  try {
    const recordResponse = await fetch(CONCEPT_RECORD, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    })
    if (!recordResponse.ok) {
      return json(
        { success: false, source: SOURCE, error: `Zenodo record HTTP ${recordResponse.status}` },
        502
      )
    }

    const record = await recordResponse.json()
    const version: string = record?.metadata?.version ?? 'unknown'
    const published: string | null = record?.metadata?.publication_date ?? null
    const file = (record?.files ?? []).find((f: { key?: string }) =>
      f.key?.endsWith('.json')
    )
    const fileUrl: string | undefined = file?.links?.self

    if (!fileUrl) {
      return json({ success: false, source: SOURCE, error: 'no JSON file on the Zenodo record' }, 502)
    }

    const { data: cursors } = await supabase
      .from('feed_cursors')
      .select('cursor')
      .eq('feed_id', FEED_ID)
      .limit(1)

    const seen = (cursors?.[0]?.cursor ?? {}) as { snapshot_version?: string }

    // Nothing new to import. Reported as a success with a reason, because a
    // deposit that has not changed is the normal case for a weekly job.
    if (!force && seen.snapshot_version === version) {
      return json({
        success: true,
        source: SOURCE,
        skipped: `snapshot ${version} already imported`,
        snapshot_version: version,
        snapshot_published: published,
        ms: Date.now() - started,
      })
    }

    const fileResponse = await fetch(fileUrl, { headers: { 'User-Agent': UA } })
    if (!fileResponse.ok) {
      return json(
        { success: false, source: SOURCE, error: `Zenodo file HTTP ${fileResponse.status}` },
        502
      )
    }

    const entries = (await fileResponse.json()) as Entry[]
    if (!Array.isArray(entries)) {
      return json({ success: false, source: SOURCE, error: 'archive was not a JSON array' }, 502)
    }

    const families = aggregate(entries)

    // apply_ransom_payments raises on an unregistered source and on a payload
    // short enough to be a truncated download. Let both surface.
    const { data: applied, error } = await supabase.rpc('apply_ransom_payments', {
      p_source: SOURCE,
      p_snapshot_version: version,
      p_snapshot_published: published,
      p_rows: families,
    })

    if (error) {
      return json({ success: false, source: SOURCE, error: error.message }, 500)
    }

    await supabase
      .from('feed_cursors')
      .upsert(
        {
          feed_id: FEED_ID,
          cursor: {
            snapshot_version: version,
            snapshot_published: published,
            addresses: entries.length,
            families: families.length,
          },
        },
        { onConflict: 'feed_id' }
      )

    return json({
      success: true,
      source: SOURCE,
      addresses: entries.length,
      families: families.length,
      applied,
      ms: Date.now() - started,
    })
  } catch (e) {
    return json({ success: false, source: SOURCE, error: (e as Error).message }, 500)
  }
})
