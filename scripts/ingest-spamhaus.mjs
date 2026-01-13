// Spamhaus DROP List Ingestion
// Fetches IP blocklists (DROP, EDROP) for known malicious IP ranges
// Run: node scripts/ingest-spamhaus.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const DROP_URL = 'https://www.spamhaus.org/drop/drop.txt'
const EDROP_URL = 'https://www.spamhaus.org/drop/edrop.txt'
const DROPV6_URL = 'https://www.spamhaus.org/drop/dropv6.txt'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function parseDropList(text, listType) {
  const lines = text.split('\n')
  const entries = []

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith(';') || line.trim() === '') continue

    // Format: IP_RANGE ; SBL_ID
    const parts = line.split(';')
    if (parts.length >= 1) {
      const ipRange = parts[0].trim()
      const sblId = parts[1]?.trim() || ''

      if (ipRange) {
        entries.push({
          value: ipRange,
          type: ipRange.includes(':') ? 'ipv6_range' : 'ip_range',
          source: 'spamhaus_' + listType,
          confidence: 95,
          tags: ['blocklist', 'spamhaus', listType],
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          metadata: {
            sbl_id: sblId,
            list_type: listType,
          }
        })
      }
    }
  }

  return entries
}

async function ingestSpamhaus() {
  console.log('Fetching Spamhaus DROP lists...')

  let allEntries = []

  // Fetch DROP list
  try {
    console.log('Fetching DROP list...')
    const dropText = await fetchText(DROP_URL)
    const dropEntries = parseDropList(dropText, 'drop')
    console.log(`  DROP: ${dropEntries.length} entries`)
    allEntries = allEntries.concat(dropEntries)
  } catch (e) {
    console.error('Error fetching DROP:', e.message)
  }

  // Fetch EDROP list
  try {
    console.log('Fetching EDROP list...')
    const edropText = await fetchText(EDROP_URL)
    const edropEntries = parseDropList(edropText, 'edrop')
    console.log(`  EDROP: ${edropEntries.length} entries`)
    allEntries = allEntries.concat(edropEntries)
  } catch (e) {
    console.error('Error fetching EDROP:', e.message)
  }

  // Fetch DROPv6 list
  try {
    console.log('Fetching DROPv6 list...')
    const dropv6Text = await fetchText(DROPV6_URL)
    const dropv6Entries = parseDropList(dropv6Text, 'dropv6')
    console.log(`  DROPv6: ${dropv6Entries.length} entries`)
    allEntries = allEntries.concat(dropv6Entries)
  } catch (e) {
    console.error('Error fetching DROPv6:', e.message)
  }

  console.log(`\nTotal entries: ${allEntries.length}`)

  let added = 0
  let failed = 0

  // Batch insert
  const batchSize = 100
  for (let i = 0; i < allEntries.length; i += batchSize) {
    const batch = allEntries.slice(i, i + batchSize)

    const { error } = await supabase
      .from('iocs')
      .upsert(batch, { onConflict: 'value', ignoreDuplicates: false })

    if (error) {
      failed += batch.length
      console.error(`Batch error at ${i}:`, error.message)
    } else {
      added += batch.length
    }
  }

  console.log(`\nSpamhaus DROP Ingestion Complete:`)
  console.log(`  Added/Updated: ${added}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'spamhaus_drop',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: allEntries.length,
    records_added: added,
  })

  return { added, failed }
}

ingestSpamhaus().catch(console.error)
