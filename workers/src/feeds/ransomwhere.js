/**
 * Ransomwhere Payment Tracking Ingestion
 * Cloudflare Worker version
 *
 * Fetches ransomware cryptocurrency payment data from Ransomwhere
 * https://ransomwhe.re/
 */

const RANSOMWHERE_API = 'https://api.ransomwhe.re/export'

export async function ingestRansomwhere(supabase) {
  console.log('Starting Ransomwhere ingestion...')

  let updated = 0
  let failed = 0
  let lastError = null

  try {
    const response = await fetch(RANSOMWHERE_API, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    let payments = data.result || data || []

    console.log(`Fetched ${payments.length} ransomware payment records`)

    if (payments.length === 0) {
      return { success: true, source: 'ransomwhere', updated: 0, skipped: true }
    }

    // Limit to most recent 2000 payments to stay under Cloudflare subrequest limits
    // Cloudflare Workers have a 50 subrequest limit per invocation
    if (payments.length > 2000) {
      payments = payments.slice(-2000)
      console.log(`Limited to ${payments.length} most recent payments`)
    }

    // Group payments by ransomware family for actor enrichment
    const familyPayments = {}
    for (const payment of payments) {
      const family = payment.family || 'unknown'
      if (!familyPayments[family]) {
        familyPayments[family] = {
          total_btc: 0,
          total_usd: 0,
          payment_count: 0,
          addresses: new Set(),
          first_seen: null,
          last_seen: null
        }
      }

      familyPayments[family].total_btc += payment.amount || 0
      familyPayments[family].total_usd += payment.amountUSD || 0
      familyPayments[family].payment_count += 1
      if (payment.address) familyPayments[family].addresses.add(payment.address)

      const txDate = payment.date || payment.timestamp
      if (txDate) {
        if (!familyPayments[family].first_seen || txDate < familyPayments[family].first_seen) {
          familyPayments[family].first_seen = txDate
        }
        if (!familyPayments[family].last_seen || txDate > familyPayments[family].last_seen) {
          familyPayments[family].last_seen = txDate
        }
      }
    }

    // Store Bitcoin addresses as IOCs
    const iocRecords = []
    for (const payment of payments) {
      if (payment.address) {
        iocRecords.push({
          value: payment.address,
          type: 'crypto_wallet',
          source: 'ransomwhere',
          malware_family: payment.family || null,
          confidence: 'high',
          first_seen: payment.date || payment.timestamp || null,
          last_seen: payment.date || payment.timestamp || null,
          tags: ['ransomware', 'bitcoin', payment.family].filter(Boolean),
          metadata: {
            blockchain: 'bitcoin',
            amount_btc: payment.amount || null,
            amount_usd: payment.amountUSD || null,
            transaction_hash: payment.tx || payment.txid || null
          }
        })
      }
    }

    // Deduplicate IOCs by address
    const uniqueIocs = []
    const seenAddresses = new Set()
    for (const ioc of iocRecords) {
      if (!seenAddresses.has(ioc.value)) {
        seenAddresses.add(ioc.value)
        uniqueIocs.push(ioc)
      }
    }

    console.log(`Processing ${uniqueIocs.length} unique wallet addresses`)

    // Insert IOCs in batches (larger batches = fewer subrequests)
    const batchSize = 500
    for (let i = 0; i < uniqueIocs.length; i += batchSize) {
      const batch = uniqueIocs.slice(i, i + batchSize)

      const { error } = await supabase
        .from('iocs')
        .upsert(batch, { onConflict: 'type,value' })

      if (error) {
        console.error(`Ransomwhere IOC batch error: ${error.message}`)
        lastError = error.message
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

    // Store aggregated family stats in ransomware_payments table if it exists
    const familyRecords = Object.entries(familyPayments).map(([family, stats]) => ({
      family_name: family,
      total_btc: stats.total_btc,
      total_usd: stats.total_usd,
      payment_count: stats.payment_count,
      unique_addresses: stats.addresses.size,
      first_payment: stats.first_seen,
      last_payment: stats.last_seen,
      source: 'ransomwhere',
      updated_at: new Date().toISOString()
    }))

    // Try to insert into ransomware_payments table (may not exist)
    const { error: familyError } = await supabase
      .from('ransomware_payments')
      .upsert(familyRecords, { onConflict: 'family_name' })

    if (familyError) {
      // Table might not exist, that's ok - we still have the IOCs
      console.log(`Note: ransomware_payments table update skipped: ${familyError.message}`)
    } else {
      console.log(`Updated ${familyRecords.length} ransomware family payment stats`)
    }

  } catch (error) {
    console.error('Ransomwhere error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Ransomwhere complete: ${updated} IOCs updated, ${failed} failed`)
  return { success: true, source: 'ransomwhere', updated, failed, lastError }
}
