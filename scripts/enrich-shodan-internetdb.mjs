// Shodan InternetDB IP Enrichment
// Free API - enriches IPs with open ports, tags, vulnerabilities
// Run: node scripts/enrich-shodan-internetdb.mjs
// API Docs: https://internetdb.shodan.io/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// InternetDB is completely free, no API key required
const INTERNETDB_API = 'https://internetdb.shodan.io'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Vigil-CTI-Dashboard/1.0',
        'Accept': 'application/json',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function lookupIP(ip) {
  const url = `${INTERNETDB_API}/${ip}`
  return fetchJSON(url)
}

async function enrichExistingIOCs() {
  console.log('Enriching IP IOCs with Shodan InternetDB data...')
  console.log('Note: InternetDB is free with no rate limit (be respectful)')
  console.log('')

  // Get IP IOCs that haven't been enriched with Shodan yet
  const { data: ipIOCs, error } = await supabase
    .from('iocs')
    .select('id, value, metadata, tags')
    .eq('type', 'ip')
    .is('metadata->shodan_checked', null)
    .limit(200)

  if (error) {
    console.error('Error fetching IOCs:', error.message)
    return { enriched: 0, vulnerable: 0, failed: 0 }
  }

  console.log(`Found ${ipIOCs?.length || 0} IPs to check`)

  let enriched = 0
  let vulnerable = 0
  let failed = 0

  for (const ioc of ipIOCs || []) {
    try {
      const { status, data } = await lookupIP(ioc.value)

      if (status === 200 && data) {
        const metadata = {
          ...ioc.metadata,
          shodan_checked: new Date().toISOString(),
          shodan_found: true,
          shodan_ports: data.ports || [],
          shodan_hostnames: data.hostnames || [],
          shodan_tags: data.tags || [],
          shodan_vulns: data.vulns || [],
          shodan_cpes: data.cpes || [],
        }

        // Update tags based on Shodan data
        let tags = ioc.tags || []

        // Add vulnerability tags
        if (data.vulns && data.vulns.length > 0) {
          tags = [...new Set([...tags, 'has-vulns', 'shodan-vuln'])]
          vulnerable++
        }

        // Add honeypot tag if detected
        if (data.tags && data.tags.includes('honeypot')) {
          tags = [...new Set([...tags, 'honeypot'])]
        }

        // Add tags for interesting services
        if (data.ports) {
          if (data.ports.includes(22)) tags = [...new Set([...tags, 'ssh'])]
          if (data.ports.includes(3389)) tags = [...new Set([...tags, 'rdp'])]
          if (data.ports.includes(445)) tags = [...new Set([...tags, 'smb'])]
          if (data.ports.includes(23)) tags = [...new Set([...tags, 'telnet'])]
        }

        await supabase
          .from('iocs')
          .update({ metadata, tags })
          .eq('id', ioc.id)

        enriched++
      } else if (status === 404) {
        // IP not found in InternetDB - mark as checked
        await supabase
          .from('iocs')
          .update({
            metadata: {
              ...ioc.metadata,
              shodan_checked: new Date().toISOString(),
              shodan_found: false,
            }
          })
          .eq('id', ioc.id)
        enriched++
      } else {
        failed++
      }

      // Be respectful with rate - 500ms between requests
      await sleep(500)

      // Progress update
      if ((enriched + failed) % 50 === 0) {
        console.log(`  Progress: ${enriched + failed}/${ipIOCs.length} (${vulnerable} with vulnerabilities)`)
      }
    } catch (e) {
      failed++
      if (failed < 5) {
        console.error(`Error checking ${ioc.value}:`, e.message)
      }
    }
  }

  return { enriched, vulnerable, failed }
}

async function generateVulnReport() {
  console.log('\nGenerating vulnerability summary...')

  // Get all IPs with vulnerabilities
  const { data: vulnIPs } = await supabase
    .from('iocs')
    .select('value, metadata')
    .eq('type', 'ip')
    .not('metadata->shodan_vulns', 'is', null)

  const vulnCounts = {}

  for (const ip of vulnIPs || []) {
    const vulns = ip.metadata?.shodan_vulns || []
    for (const vuln of vulns) {
      vulnCounts[vuln] = (vulnCounts[vuln] || 0) + 1
    }
  }

  // Sort by frequency
  const sortedVulns = Object.entries(vulnCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  if (sortedVulns.length > 0) {
    console.log('\nTop 10 vulnerabilities across tracked IPs:')
    for (const [vuln, count] of sortedVulns) {
      console.log(`  ${vuln}: ${count} IPs`)
    }
  }

  return vulnCounts
}

async function ingestShodanInternetDB() {
  console.log('Starting Shodan InternetDB Enrichment...')
  console.log('Source: https://internetdb.shodan.io/')
  console.log('Note: This is a FREE API - no payment required!')
  console.log('')

  const { enriched, vulnerable, failed } = await enrichExistingIOCs()

  // Generate vulnerability summary
  await generateVulnReport()

  console.log('\n' + '='.repeat(50))
  console.log('Shodan InternetDB Enrichment Complete')
  console.log('='.repeat(50))
  console.log(`IPs enriched: ${enriched}`)
  console.log(`IPs with vulnerabilities: ${vulnerable}`)
  console.log(`Failed lookups: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'shodan-internetdb',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: enriched + failed,
    records_added: enriched,
    metadata: { vulnerable_ips: vulnerable }
  })

  return { enriched, vulnerable, failed }
}

ingestShodanInternetDB().catch(console.error)
