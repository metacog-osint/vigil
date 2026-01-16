// crt.sh Certificate Transparency Ingestion
// Discovers subdomains and certificates via Certificate Transparency logs
// Source: https://crt.sh
// Run: node scripts/ingest-crtsh.mjs [domain]
// Example: node scripts/ingest-crtsh.mjs example.com

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Rate limit: crt.sh is free but has rate limits
const RATE_LIMIT_DELAY = 2000 // 2 seconds between requests

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Vigil-CTI/1.0 (Threat Intelligence Platform)'
      }
    }, (res) => {
      if (res.statusCode === 429) {
        reject(new Error('Rate limited - try again later'))
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('Invalid JSON response'))
        }
      })
    }).on('error', reject)
  })
}

async function queryCrtsh(domain) {
  // crt.sh JSON API endpoint
  const url = `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`
  console.log(`  Querying crt.sh for *.${domain}...`)

  try {
    const certs = await fetchJSON(url)
    return certs || []
  } catch (err) {
    console.error(`  Error querying ${domain}:`, err.message)
    return []
  }
}

function extractSubdomains(certs) {
  const subdomains = new Set()

  for (const cert of certs) {
    // name_value contains the CN or SAN entries
    if (cert.name_value) {
      const names = cert.name_value.split('\n')
      for (const name of names) {
        const cleaned = name.trim().toLowerCase()
        // Skip wildcards entries, extract actual subdomain pattern
        if (cleaned && !cleaned.startsWith('*')) {
          subdomains.add(cleaned)
        }
      }
    }
  }

  return [...subdomains]
}

async function ingestDomainCertificates(domain) {
  console.log(`\nProcessing domain: ${domain}`)

  const certs = await queryCrtsh(domain)
  console.log(`  Found ${certs.length} certificate entries`)

  if (certs.length === 0) {
    return { domain, subdomains: 0, certs: 0, added: 0 }
  }

  // Extract unique subdomains
  const subdomains = extractSubdomains(certs)
  console.log(`  Unique subdomains discovered: ${subdomains.length}`)

  // Store discovered subdomains as IOCs (domain type)
  let added = 0
  let failed = 0
  const now = new Date().toISOString()

  // Process in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < subdomains.length; i += BATCH_SIZE) {
    const batch = subdomains.slice(i, i + BATCH_SIZE)

    const records = batch.map(subdomain => ({
      type: 'domain',
      value: subdomain,
      malware_family: null,
      confidence: 'info', // CT discovery, not necessarily malicious
      first_seen: now,
      last_seen: now,
      source: 'crtsh',
      source_url: `https://crt.sh/?q=${encodeURIComponent(subdomain)}`,
      tags: ['certificate-transparency', 'subdomain-discovery'],
      metadata: {
        parent_domain: domain,
        discovery_method: 'certificate_transparency',
        cert_count: certs.filter(c => c.name_value?.includes(subdomain)).length
      }
    }))

    const { error } = await supabase
      .from('iocs')
      .upsert(records, {
        onConflict: 'type,value',
        ignoreDuplicates: false
      })

    if (error) {
      failed += batch.length
      if (failed <= 3) console.error(`  Batch error: ${error.message}`)
    } else {
      added += batch.length
    }
  }

  console.log(`  Stored: ${added} subdomains, Failed: ${failed}`)
  return { domain, subdomains: subdomains.length, certs: certs.length, added }
}

async function getMonitoredDomains() {
  // Try to get domains from org_profile
  const { data: profiles } = await supabase
    .from('org_profile')
    .select('tech_domains, domain')
    .limit(10)

  const domains = new Set()

  if (profiles) {
    for (const profile of profiles) {
      if (profile.domain) domains.add(profile.domain)
      if (profile.tech_domains && Array.isArray(profile.tech_domains)) {
        profile.tech_domains.forEach(d => domains.add(d))
      }
    }
  }

  return [...domains]
}

async function ingestCrtsh() {
  console.log('=== crt.sh Certificate Transparency Ingestion ===')
  console.log('Discovering subdomains via Certificate Transparency logs\n')

  // Check for command line argument
  const cmdDomain = process.argv[2]

  let domains = []
  if (cmdDomain) {
    domains = [cmdDomain]
    console.log(`Processing single domain: ${cmdDomain}`)
  } else {
    // Get domains from org profiles
    domains = await getMonitoredDomains()
    if (domains.length === 0) {
      console.log('No domains found in org_profile.')
      console.log('Usage: node scripts/ingest-crtsh.mjs <domain>')
      console.log('Example: node scripts/ingest-crtsh.mjs example.com')
      return
    }
    console.log(`Found ${domains.length} domains to monitor from org_profile`)
  }

  const results = []
  let totalAdded = 0

  for (const domain of domains) {
    try {
      const result = await ingestDomainCertificates(domain)
      results.push(result)
      totalAdded += result.added

      // Rate limit between requests
      if (domains.length > 1) {
        await sleep(RATE_LIMIT_DELAY)
      }
    } catch (err) {
      console.error(`Error processing ${domain}:`, err.message)
      results.push({ domain, error: err.message })
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Total Subdomains Stored: ${totalAdded}`)
  console.log('\nBy Domain:')
  results.forEach(r => {
    if (r.error) {
      console.log(`  ${r.domain}: Error - ${r.error}`)
    } else {
      console.log(`  ${r.domain}: ${r.subdomains} subdomains (${r.certs} certs)`)
    }
  })

  await supabase.from('sync_log').insert({
    source: 'crtsh',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: results.reduce((sum, r) => sum + (r.subdomains || 0), 0),
    records_added: totalAdded,
    metadata: {
      domains_processed: domains.length,
      results: results.map(r => ({
        domain: r.domain,
        subdomains: r.subdomains || 0,
        certs: r.certs || 0
      }))
    }
  })

  return { totalAdded, results }
}

ingestCrtsh().catch(console.error)
