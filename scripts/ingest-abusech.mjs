// Abuse.ch Combined Feed Ingestion
// Uses public CSV/JSON downloads that don't require authentication
// Run: node scripts/ingest-abusech.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Public feeds that don't require auth
const FEEDS = {
  // URLhaus recent URLs (JSON)
  urlhaus: 'https://urlhaus.abuse.ch/downloads/json_recent/',
  // Feodo botnet C2s (JSON)
  feodo: 'https://feodotracker.abuse.ch/downloads/ipblocklist.json',
  // ThreatFox IOC export (recent)
  threatfox: 'https://threatfox.abuse.ch/export/json/recent/',
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject)
      }

      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          console.error('Parse error, raw data:', data.slice(0, 500))
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function ingestURLhaus() {
  console.log('\n--- URLhaus Recent Malicious URLs ---')

  try {
    const data = await fetch(FEEDS.urlhaus)

    // URLhaus JSON format has urls array
    const urls = Array.isArray(data) ? data : (data.urls || Object.values(data))
    console.log(`Found ${urls.length} entries`)

    let added = 0
    const toProcess = urls.slice(0, 500) // Limit for speed

    for (const entry of toProcess) {
      try {
        const record = {
          type: 'url',
          value: entry.url || entry,
          malware_family: entry.threat || entry.tags?.[0] || 'malware',
          confidence: 'high',
          first_seen: entry.date_added || entry.dateadded || new Date().toISOString(),
          last_seen: entry.date_added || entry.dateadded || new Date().toISOString(),
          source: 'urlhaus',
          tags: entry.tags || [],
          metadata: {
            url_status: entry.url_status,
            host: entry.host,
            urlhaus_id: entry.id,
          }
        }

        const { error } = await supabase
          .from('iocs')
          .upsert(record, { onConflict: 'type,value' })

        if (!error) added++
      } catch (e) {
        // Skip errors
      }
    }

    console.log(`Added: ${added}`)
    return added
  } catch (e) {
    console.error('URLhaus error:', e.message)
    return 0
  }
}

async function ingestFeodo() {
  console.log('\n--- Feodo Tracker Botnet C2 IPs ---')

  try {
    const data = await fetch(FEEDS.feodo)
    const entries = Array.isArray(data) ? data : []
    console.log(`Found ${entries.length} entries`)

    let added = 0

    for (const entry of entries) {
      try {
        const record = {
          type: 'ip',
          value: entry.ip_address,
          malware_family: entry.malware,
          confidence: 'high',
          first_seen: entry.first_seen,
          last_seen: entry.last_online || entry.first_seen,
          source: 'feodo',
          tags: ['botnet', 'c2', entry.malware?.toLowerCase()].filter(Boolean),
          metadata: {
            port: entry.port,
            status: entry.status,
            country: entry.country,
            as_name: entry.as_name,
          }
        }

        const { error } = await supabase
          .from('iocs')
          .upsert(record, { onConflict: 'type,value' })

        if (!error) added++
      } catch (e) {
        // Skip
      }
    }

    console.log(`Added: ${added}`)
    return added
  } catch (e) {
    console.error('Feodo error:', e.message)
    return 0
  }
}

async function ingestThreatFox() {
  console.log('\n--- ThreatFox Recent IOCs ---')

  try {
    const data = await fetch(FEEDS.threatfox)

    // ThreatFox export format
    let iocs = []
    if (Array.isArray(data)) {
      iocs = data
    } else if (data.data) {
      iocs = Object.values(data.data).flat()
    } else {
      iocs = Object.values(data).flat().filter(i => i && typeof i === 'object')
    }

    console.log(`Found ${iocs.length} entries`)

    let added = 0
    const toProcess = iocs.slice(0, 500)

    for (const ioc of toProcess) {
      try {
        let type = 'unknown'
        let value = ioc.ioc || ioc.ioc_value || ioc

        if (typeof value !== 'string') continue

        // Determine type
        if (value.includes('://')) type = 'url'
        else if (value.match(/^\d+\.\d+\.\d+\.\d+/)) type = 'ip'
        else if (value.includes('.') && !value.includes('/')) type = 'domain'
        else if (value.length === 32) type = 'hash_md5'
        else if (value.length === 64) type = 'hash_sha256'

        if (type === 'ip') {
          value = value.split(':')[0] // Remove port
        }

        const record = {
          type,
          value,
          malware_family: ioc.malware || ioc.malware_printable || 'unknown',
          confidence: 'high',
          first_seen: ioc.first_seen || new Date().toISOString(),
          last_seen: ioc.last_seen || ioc.first_seen || new Date().toISOString(),
          source: 'threatfox',
          tags: ioc.tags || [],
          metadata: {
            threat_type: ioc.threat_type,
            threatfox_id: ioc.id,
          }
        }

        const { error } = await supabase
          .from('iocs')
          .upsert(record, { onConflict: 'type,value' })

        if (!error) added++
      } catch (e) {
        // Skip
      }
    }

    console.log(`Added: ${added}`)
    return added
  } catch (e) {
    console.error('ThreatFox error:', e.message)
    return 0
  }
}

async function main() {
  console.log('='.repeat(50))
  console.log('Abuse.ch Feeds Ingestion')
  console.log('='.repeat(50))

  const results = {
    urlhaus: await ingestURLhaus(),
    feodo: await ingestFeodo(),
    threatfox: await ingestThreatFox(),
  }

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`URLhaus: ${results.urlhaus} IOCs`)
  console.log(`Feodo: ${results.feodo} IOCs`)
  console.log(`ThreatFox: ${results.threatfox} IOCs`)
  console.log(`Total: ${results.urlhaus + results.feodo + results.threatfox} IOCs`)

  await supabase.from('sync_log').insert({
    source: 'abuse_ch',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_added: results.urlhaus + results.feodo + results.threatfox,
  })
}

main().catch(console.error)
