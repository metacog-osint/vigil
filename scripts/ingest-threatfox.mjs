// Abuse.ch ThreatFox IOC Ingestion
// Fetches recent IOCs (IPs, domains, URLs) from ThreatFox
// Run: node scripts/ingest-threatfox.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const THREATFOX_API = 'https://threatfox-api.abuse.ch/api/v1/'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data)
    const urlObj = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

function mapIOCType(threatfoxType) {
  const typeMap = {
    'ip:port': 'ip',
    'domain': 'domain',
    'url': 'url',
    'md5_hash': 'hash_md5',
    'sha256_hash': 'hash_sha256',
  }
  return typeMap[threatfoxType] || threatfoxType
}

async function ingestThreatFox() {
  console.log('Fetching ThreatFox IOCs (last 7 days)...')

  // Get IOCs from the last 7 days
  const response = await postRequest(THREATFOX_API, {
    query: 'get_iocs',
    days: 7
  })

  if (response.query_status !== 'ok') {
    console.error('ThreatFox API error:', response.query_status)
    return
  }

  const iocs = response.data || []
  console.log(`Found ${iocs.length} IOCs`)

  let added = 0
  let skipped = 0
  let failed = 0

  for (const ioc of iocs) {
    try {
      // Extract the value (remove port from ip:port)
      let value = ioc.ioc
      if (ioc.ioc_type === 'ip:port') {
        value = ioc.ioc.split(':')[0]
      }

      const record = {
        type: mapIOCType(ioc.ioc_type),
        value: value,
        malware_family: ioc.malware || ioc.malware_printable,
        confidence: ioc.confidence_level >= 75 ? 'high' : ioc.confidence_level >= 50 ? 'medium' : 'low',
        first_seen: ioc.first_seen,
        last_seen: ioc.last_seen || ioc.first_seen,
        source: 'threatfox',
        source_url: `https://threatfox.abuse.ch/ioc/${ioc.id}`,
        tags: ioc.tags || [],
        metadata: {
          threatfox_id: ioc.id,
          threat_type: ioc.threat_type,
          malware_alias: ioc.malware_alias,
          reporter: ioc.reporter,
        }
      }

      const { error } = await supabase
        .from('iocs')
        .upsert(record, { onConflict: 'type,value' })

      if (error) {
        if (error.code === '23505') { // Duplicate
          skipped++
        } else {
          failed++
          if (failed < 5) console.error(`Error inserting IOC:`, error.message)
        }
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  console.log(`\nThreatFox Ingestion Complete:`)
  console.log(`  Added: ${added}`)
  console.log(`  Skipped (duplicates): ${skipped}`)
  console.log(`  Failed: ${failed}`)

  // Show some stats about what we got
  const malwareFamilies = [...new Set(iocs.map(i => i.malware_printable).filter(Boolean))]
  console.log(`\nMalware families found: ${malwareFamilies.slice(0, 10).join(', ')}${malwareFamilies.length > 10 ? '...' : ''}`)

  await supabase.from('sync_log').insert({
    source: 'threatfox',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: iocs.length,
    records_added: added,
  })

  return { added, skipped, failed }
}

ingestThreatFox().catch(console.error)
