// Censys Certificate & Service Intelligence Ingestion
// Fetches certificate transparency and service data from Censys
// Run: node scripts/ingest-censys.mjs
//
// Censys provides internet-wide scanning data for certificates, hosts, and services
// API docs: https://docs.censys.com/
//
// Note: This script supports both:
// - Legacy API (v2): Requires API ID + Secret (Basic Auth)
// - Platform API (v3): Requires Personal Access Token (Bearer Auth)
// Your token format determines which API is used.

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
  console.log('Starting Censys ingestion...')
  console.log('')

  // Check if PAT user has search access (will fail on free tier)
  if (isPAT) {
    console.log('⚠️  Platform API v3 search requires paid subscription.')
    console.log('   Free tier PATs can only access data via the web UI.')
    console.log('')
    console.log('   Options:')
    console.log('   1. Get Legacy API credentials (ID + Secret) from:')
    console.log('      https://search.censys.io/account/api')
    console.log('      Then set: CENSYS_API_KEY=your_api_id:your_api_secret')
    console.log('')
    console.log('   2. Upgrade to Censys paid plan for API search access')
    console.log('')
    console.log('   Attempting search anyway (will fail on free tier)...')
    console.log('')
  }

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0

  // Define searches for threat-related infrastructure
  // Platform API v3 uses slightly different query syntax
  const hostSearches = isPAT ? [
    // Platform API v3 queries
    { name: 'Cobalt Strike C2', query: 'host.services.software.product: "Cobalt Strike"' },
    { name: 'Metasploit', query: 'host.services.software.product: "Metasploit"' },
    { name: 'Brute Ratel C4', query: 'host.services.software.product: "Brute Ratel"' },
    { name: 'Open RDP', query: 'host.services.port: 3389' },
    { name: 'Exposed MongoDB', query: 'host.services.port: 27017' },
    { name: 'Exposed Redis', query: 'host.services.port: 6379' }
  ] : [
    // Legacy API v2 queries
    { name: 'Cobalt Strike C2', query: 'services.software.product: "Cobalt Strike"' },
    { name: 'Metasploit', query: 'services.software.product: "Metasploit"' },
    { name: 'Brute Ratel C4', query: 'services.software.product: "Brute Ratel"' },
    { name: 'Sliver C2', query: 'services.http.response.body: "sliver"' },
    { name: 'Open RDP', query: 'services.port: 3389 and services.service_name: RDP' },
    { name: 'Exposed Databases', query: 'services.port: 27017 or services.port: 6379 or services.port: 9200' }
  ]

  // Search for malicious infrastructure
  for (const search of hostSearches) {
    console.log(`Searching for: ${search.name}...`)

    try {
      let cursor = null
      let pageCount = 0
      const maxPages = 5 // Limit pages per search to conserve API quota

      do {
        const response = await searchHosts(search.query, cursor, 100)

        // Handle different response formats between v2 and v3
        let hosts, nextCursor
        if (isPAT) {
          // Platform API v3 response format
          hosts = response.hits || response.result?.hits || []
          nextCursor = response.cursor || response.links?.next || null
        } else {
          // Legacy API v2 response format
          hosts = response.result?.hits || []
          nextCursor = response.result?.links?.next || null
        }
        cursor = nextCursor
        pageCount++

        console.log(`  Page ${pageCount}: Found ${hosts.length} hosts`)

        for (const host of hosts) {
          processed++

          try {
            // Store as IOC (IP address)
            const iocRecord = {
              value: host.ip,
              type: 'ip',
              source: 'censys',
              confidence: 70,
              severity: determineSeverity(search.name),
              tags: [search.name.toLowerCase().replace(/\s+/g, '-')],
              first_seen: host.last_updated_at ? new Date(host.last_updated_at).toISOString() : null,
              last_seen: new Date().toISOString(),
              metadata: {
                censys_search: search.name,
                autonomous_system: host.autonomous_system || null,
                location: host.location || null,
                services: (host.services || []).map(s => ({
                  port: s.port,
                  service_name: s.service_name,
                  software: s.software || []
                })),
                operating_system: host.operating_system || null
              },
              updated_at: new Date().toISOString()
            }

            const { error } = await supabase
              .from('iocs')
              .upsert(iocRecord, {
                onConflict: 'value,type',
                ignoreDuplicates: false
              })

            if (error) {
              failed++
              if (failed <= 5) {
                console.error(`    Error upserting ${host.ip}:`, error.message)
              }
            } else {
              updated++
            }

          } catch (e) {
            failed++
          }
        }

        // Rate limiting - Censys has quota limits
        await new Promise(resolve => setTimeout(resolve, 500))

      } while (cursor && pageCount < maxPages)

    } catch (e) {
      console.error(`  Error searching ${search.name}:`, e.message)
    }
  }

  // Search for suspicious certificates (optional, if certificates table exists)
  console.log('')
  console.log('Searching for suspicious certificates...')

  const certSearches = [
    { name: 'Self-signed recent', query: 'parsed.issuer.common_name: * and parsed.validity.start: [now-7d TO now]' },
    { name: 'Let\'s Encrypt suspicious', query: 'parsed.issuer.organization: "Let\'s Encrypt" and names: *login*' }
  ]

  for (const search of certSearches) {
    console.log(`  Searching: ${search.name}...`)

    try {
      const response = await searchCertificates(search.query, null, 50)
      const certs = response.result?.hits || []

      console.log(`    Found ${certs.length} certificates`)

      for (const cert of certs) {
        processed++

        try {
          // Store certificate data (using schema from migration 033)
          const certRecord = {
            fingerprint_sha256: cert.fingerprint_sha256,
            subject_cn: cert.parsed?.subject?.common_name?.[0] || null,
            subject_org: cert.parsed?.subject?.organization?.[0] || null,
            subject_san: cert.names || [],
            issuer_cn: cert.parsed?.issuer?.common_name?.[0] || null,
            issuer_org: cert.parsed?.issuer?.organization?.[0] || null,
            is_self_signed: cert.parsed?.issuer?.common_name?.[0] === cert.parsed?.subject?.common_name?.[0],
            not_before: cert.parsed?.validity?.start || null,
            not_after: cert.parsed?.validity?.end || null,
            key_algorithm: cert.parsed?.subject_key_info?.key_algorithm?.name || null,
            signature_algorithm: cert.parsed?.signature?.signature_algorithm?.name || null,
            source: 'censys',
            last_seen: new Date().toISOString(),
            metadata: {
              serial_number: cert.parsed?.serial_number || null,
              search_category: search.name
            },
            updated_at: new Date().toISOString()
          }

          const { error } = await supabase
            .from('certificates')
            .upsert(certRecord, {
              onConflict: 'fingerprint_sha256',
              ignoreDuplicates: false
            })

          if (error) {
            // Table might not exist, that's okay
            if (!error.message.includes('does not exist')) {
              failed++
            }
          } else {
            updated++
          }

        } catch (e) {
          failed++
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (e) {
      console.error(`    Error searching certificates:`, e.message)
    }
  }

  console.log('')
  console.log('Censys Ingestion Complete:')
  console.log(`  Processed: ${processed}`)
  console.log(`  Added/Updated: ${updated}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'censys',
    status: failed > updated ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: processed,
    records_added: added,
    records_updated: updated,
    metadata: { failed }
  })

  return { processed, added, updated, failed }
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
