// Censys IP Enrichment Script
// Enriches existing IOC IPs with Censys host data (services, ASN, location)
// Run: node scripts/ingest-censys.mjs
//
// Censys Platform free tier only supports individual host lookups.
// This script enriches IPs already in our database from other sources
// (Pulsedive, ThreatFox, Feodo, etc.) with Censys host intelligence.
//
// For search functionality, upgrade to Censys Starter or Enterprise.
// API docs: https://docs.censys.com/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, censysApiKey } from './env.mjs'

// Detect token type and use appropriate API
// PAT tokens (censys_xxx) = Platform API v3 (requires paid tier for search)
// Legacy ID:Secret format (xxxx:yyyy) = Legacy API v2 (free tier supports limited searches)
const isPAT = censysApiKey?.startsWith('censys_')
const isLegacy = censysApiKey?.includes(':') && !isPAT
const CENSYS_API_BASE = isPAT
  ? 'https://api.platform.censys.io/v3/global'  // Platform API v3 for PATs
  : 'https://search.censys.io/api/v2'  // Legacy API for ID:Secret

if (isPAT) {
  console.log('Using Platform API v3 (PAT token detected)')
  console.log('Note: Search endpoint requires paid subscription.')
} else if (isLegacy) {
  console.log('Using Legacy API v2 (ID:Secret credentials)')
} else {
  console.log('Warning: Unrecognized credential format')
  console.log('Expected: PAT (censys_xxx) or Legacy (api_id:api_secret)')
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!censysApiKey) {
  console.error('Missing CENSYS_API_KEY. Get your token at https://search.censys.io/account/api')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)

    // PAT uses Bearer auth, legacy uses Basic auth (ID:Secret base64)
    const authHeader = isPAT
      ? `Bearer ${censysApiKey}`
      : `Basic ${Buffer.from(censysApiKey).toString('base64')}`

    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vigil-ThreatIntel/1.0',
        ...options.headers
      }
    }

    const req = https.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          } else {
            resolve(JSON.parse(data))
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

// Search for hosts with specific criteria
async function searchHosts(query, cursor = null, perPage = 100) {
  if (isPAT) {
    // Platform API v3 uses unified search endpoint
    const url = `${CENSYS_API_BASE}/search/query`
    const body = {
      query: query,
      page_size: Math.min(perPage, 50), // Platform API max is 50 per page
      ...(cursor && { cursor })
    }
    return await fetch(url, { method: 'POST', body })
  } else {
    // Legacy API v2
    const url = `${CENSYS_API_BASE}/hosts/search`
    const body = {
      q: query,
      per_page: perPage,
      ...(cursor && { cursor })
    }
    return await fetch(url, { method: 'POST', body })
  }
}

// Search for certificates
async function searchCertificates(query, cursor = null, perPage = 100) {
  if (isPAT) {
    // Platform API v3 - certificates are searched via unified endpoint with type filter
    const url = `${CENSYS_API_BASE}/search/query`
    const body = {
      query: `${query} and labels: certificate`,
      page_size: Math.min(perPage, 50),
      ...(cursor && { cursor })
    }
    return await fetch(url, { method: 'POST', body })
  } else {
    // Legacy API v2
    const url = `${CENSYS_API_BASE}/certificates/search`
    const body = {
      q: query,
      per_page: perPage,
      ...(cursor && { cursor })
    }
    return await fetch(url, { method: 'POST', body })
  }
}

// Get host details
async function getHostDetails(ip) {
  if (isPAT) {
    const url = `${CENSYS_API_BASE}/asset/host/${ip}`
    return await fetch(url)
  } else {
    const url = `${CENSYS_API_BASE}/hosts/${ip}`
    return await fetch(url)
  }
}

// Get certificate details
async function getCertificateDetails(fingerprint) {
  if (isPAT) {
    const url = `${CENSYS_API_BASE}/asset/certificate/${fingerprint}`
    return await fetch(url)
  } else {
    const url = `${CENSYS_API_BASE}/certificates/${fingerprint}`
    return await fetch(url)
  }
}

async function ingestCensys() {
  console.log('Starting Censys enrichment...')
  console.log('')
  console.log('Note: Censys Platform free tier only supports individual IP lookups.')
  console.log('      This script enriches existing IPs from other threat feeds.')
  console.log('      (Search requires Starter/Enterprise subscription)')
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0
  let enriched = 0

  // Get IPs from our database that could benefit from Censys enrichment
  // Focus on high-risk IPs without Censys metadata
  console.log('Fetching IPs to enrich from database...')

  const { data: ipsToEnrich, error: fetchError } = await supabase
    .from('iocs')
    .select('id, value, metadata, source')
    .eq('type', 'ip')
    .or('metadata->>censys_enriched.is.null,metadata->>censys_enriched.eq.false')
    .in('source', ['pulsedive', 'threatfox', 'feodo', 'tor-exits', 'abusech'])
    .order('created_at', { ascending: false })
    .limit(50) // Limit to conserve API quota (free tier has 1 concurrent action)

  if (fetchError) {
    console.error('Error fetching IPs:', fetchError.message)
    return { processed: 0, added: 0, updated: 0, failed: 0 }
  }

  console.log(`Found ${ipsToEnrich?.length || 0} IPs to enrich`)
  console.log('')

  if (!ipsToEnrich || ipsToEnrich.length === 0) {
    console.log('No IPs need enrichment. Run other ingestion scripts first.')
    return { processed: 0, added: 0, updated: 0, failed: 0 }
  }

  // Enrich each IP with Censys data
  for (const ioc of ipsToEnrich) {
    processed++
    console.log(`[${processed}/${ipsToEnrich.length}] Enriching ${ioc.value}...`)

    try {
      const hostData = await getHostDetails(ioc.value)

      if (hostData && (hostData.result || hostData.ip)) {
        const host = hostData.result || hostData

        // Merge Censys data into existing metadata
        const enrichedMetadata = {
          ...ioc.metadata,
          censys_enriched: true,
          censys_updated: new Date().toISOString(),
          autonomous_system: host.autonomous_system || null,
          location: host.location || null,
          operating_system: host.operating_system || null,
          services: (host.services || []).slice(0, 10).map(s => ({
            port: s.port,
            service_name: s.service_name,
            software: s.software?.map(sw => sw.product)?.slice(0, 5) || []
          })),
          last_updated_at: host.last_updated_at || null
        }

        const { error: updateError } = await supabase
          .from('iocs')
          .update({
            metadata: enrichedMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', ioc.id)

        if (updateError) {
          failed++
          console.log(`  ❌ Error: ${updateError.message}`)
        } else {
          enriched++
          updated++
          const services = host.services?.length || 0
          const asn = host.autonomous_system?.asn || 'unknown'
          console.log(`  ✓ Enriched: ${services} services, ASN ${asn}`)
        }
      } else {
        // No data found, mark as checked to avoid re-querying
        await supabase
          .from('iocs')
          .update({
            metadata: { ...ioc.metadata, censys_enriched: true, censys_no_data: true },
            updated_at: new Date().toISOString()
          })
          .eq('id', ioc.id)

        console.log(`  - No Censys data available`)
      }

    } catch (e) {
      if (e.message.includes('404')) {
        // IP not in Censys, mark as checked
        await supabase
          .from('iocs')
          .update({
            metadata: { ...ioc.metadata, censys_enriched: true, censys_no_data: true },
            updated_at: new Date().toISOString()
          })
          .eq('id', ioc.id)
        console.log(`  - Not found in Censys`)
      } else if (e.message.includes('429')) {
        console.log(`  ⚠ Rate limited, stopping...`)
        break
      } else {
        failed++
        console.log(`  ❌ Error: ${e.message}`)
      }
    }

    // Rate limiting - free tier has 1 concurrent action limit
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('')
  console.log('Censys Enrichment Complete:')
  console.log(`  Processed: ${processed}`)
  console.log(`  Enriched: ${enriched}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'censys-enrichment',
    status: failed > enriched ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: processed,
    records_added: 0,
    records_updated: enriched,
    metadata: { failed, enriched }
  })

  return { processed, added: 0, updated: enriched, failed }
}

function determineSeverity(searchName) {
  const severityMap = {
    'Cobalt Strike C2': 'critical',
    'Metasploit': 'high',
    'Brute Ratel C4': 'critical',
    'Sliver C2': 'critical',
    'Open RDP': 'medium',
    'Exposed Databases': 'high'
  }
  return severityMap[searchName] || 'medium'
}

// Enrichment function - can be called separately to enrich existing IOCs
async function enrichIPWithCensys(ip) {
  try {
    const details = await getHostDetails(ip)
    return {
      autonomous_system: details.result?.autonomous_system,
      location: details.result?.location,
      services: details.result?.services,
      operating_system: details.result?.operating_system,
      last_updated: details.result?.last_updated_at
    }
  } catch (e) {
    return null
  }
}

// Export for use as enrichment module
export { enrichIPWithCensys }

// Main execution
ingestCensys().catch(console.error)
