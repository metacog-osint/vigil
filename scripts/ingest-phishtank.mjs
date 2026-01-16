// PhishTank Verified Phishing URL Ingestion
// Ingests verified phishing URLs from PhishTank database
// Run: node scripts/ingest-phishtank.mjs
// API Docs: https://phishtank.org/developer_info.php

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'
import { createGunzip } from 'zlib'
import { supabaseUrl, supabaseKey } from './env.mjs'

// PhishTank API - requires free registration for app key
const PHISHTANK_APP_KEY = process.env.PHISHTANK_API_KEY || ''
const PHISHTANK_URL = PHISHTANK_APP_KEY
  ? `http://data.phishtank.com/data/${PHISHTANK_APP_KEY}/online-valid.json`
  : 'http://data.phishtank.com/data/online-valid.json'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'phishtank/Vigil-CTI-Dashboard',
        'Accept': 'application/json',
      },
    }

    const req = protocol.request(options, (res) => {
      let data = ''

      // Handle gzip compression if present
      const encoding = res.headers['content-encoding']
      let stream = res

      if (encoding === 'gzip') {
        stream = res.pipe(createGunzip())
      }

      stream.on('data', chunk => data += chunk)
      stream.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch (e) {
          // Sometimes the response is too large, try to parse what we have
          console.error('JSON parse error, attempting to salvage data...')
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
      stream.on('error', reject)
    })

    req.on('error', reject)
    req.setTimeout(120000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    req.end()
  })
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    // Try to extract domain from malformed URLs
    const match = url.match(/(?:https?:\/\/)?([^\/\s:]+)/i)
    return match ? match[1] : null
  }
}

function extractIP(url) {
  // Check if the URL contains an IP address
  const ipMatch = url.match(/(?:https?:\/\/)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i)
  if (ipMatch) {
    const ip = ipMatch[1]
    // Validate IP
    const parts = ip.split('.')
    if (parts.every(p => parseInt(p) >= 0 && parseInt(p) <= 255)) {
      return ip
    }
  }
  return null
}

async function ingestPhishTank() {
  console.log('Starting PhishTank Ingestion...')
  console.log('Source: https://phishtank.org/')
  if (!PHISHTANK_APP_KEY) {
    console.log('Note: No API key provided. Using public feed (rate limited).')
    console.log('Register at https://phishtank.org/developer_info.php for higher limits.')
  }
  console.log('')

  let phishes = []

  try {
    console.log('Fetching PhishTank database (this may take a while)...')
    const { status, data } = await fetchJSON(PHISHTANK_URL)

    if (status !== 200) {
      throw new Error(`API returned status ${status}`)
    }

    phishes = data || []
    console.log(`Received ${phishes.length} verified phishing entries`)
  } catch (error) {
    console.error('Error fetching PhishTank data:', error.message)
    return { urls: 0, domains: 0, ips: 0 }
  }

  // Process in batches
  const BATCH_SIZE = 500
  let urlsAdded = 0
  let domainsAdded = 0
  let ipsAdded = 0
  let skipped = 0

  // Only process recent entries (last 30 days) to keep database manageable
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentPhishes = phishes.filter(p => {
    if (!p.verification_time) return false
    const verifiedDate = new Date(p.verification_time)
    return verifiedDate >= thirtyDaysAgo
  })

  console.log(`Processing ${recentPhishes.length} entries from last 30 days...`)

  // Collect all IOCs to upsert
  const urlIOCs = []
  const domainIOCs = []
  const ipIOCs = []
  const seenDomains = new Set()
  const seenIPs = new Set()

  for (const phish of recentPhishes) {
    if (!phish.url || !phish.verified || phish.verified !== 'yes') {
      skipped++
      continue
    }

    const url = phish.url
    const domain = extractDomain(url)
    const ip = extractIP(url)
    const verifiedTime = phish.verification_time || new Date().toISOString()
    const submissionTime = phish.submission_time || verifiedTime

    // URL IOC
    urlIOCs.push({
      value: url.substring(0, 2048), // Truncate very long URLs
      type: 'url',
      source: 'phishtank',
      source_ref: `phishtank-${phish.phish_id}`,
      confidence: 'high', // PhishTank entries are human-verified
      first_seen: submissionTime,
      last_seen: verifiedTime,
      tags: ['phishing', 'verified'],
      metadata: {
        phishtank_id: phish.phish_id,
        target: phish.target || null,
        verified_time: verifiedTime,
        phishtank_url: phish.phish_detail_url,
      },
    })

    // Domain IOC (deduplicated)
    if (domain && !seenDomains.has(domain)) {
      seenDomains.add(domain)
      domainIOCs.push({
        value: domain,
        type: 'domain',
        source: 'phishtank',
        source_ref: `phishtank-domain-${domain}`,
        confidence: 'high',
        first_seen: submissionTime,
        last_seen: verifiedTime,
        tags: ['phishing', 'phishing-domain'],
        metadata: {
          derived_from: 'phishtank_url',
        },
      })
    }

    // IP IOC if URL contains IP (deduplicated)
    if (ip && !seenIPs.has(ip)) {
      seenIPs.add(ip)
      ipIOCs.push({
        value: ip,
        type: 'ip',
        source: 'phishtank',
        source_ref: `phishtank-ip-${ip}`,
        confidence: 'medium', // IP might be shared hosting
        first_seen: submissionTime,
        last_seen: verifiedTime,
        tags: ['phishing', 'phishing-ip'],
        metadata: {
          derived_from: 'phishtank_url',
        },
      })
    }
  }

  // Upsert URLs in batches
  console.log(`\nUpserting ${urlIOCs.length} URL IOCs...`)
  for (let i = 0; i < urlIOCs.length; i += BATCH_SIZE) {
    const batch = urlIOCs.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('iocs')
      .upsert(batch, {
        onConflict: 'source,source_ref',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`Error upserting URL batch ${i}:`, error.message)
    } else {
      urlsAdded += batch.length
    }

    if ((i + BATCH_SIZE) % 2000 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, urlIOCs.length)}/${urlIOCs.length}`)
    }
  }

  // Upsert domains in batches
  console.log(`\nUpserting ${domainIOCs.length} domain IOCs...`)
  for (let i = 0; i < domainIOCs.length; i += BATCH_SIZE) {
    const batch = domainIOCs.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('iocs')
      .upsert(batch, {
        onConflict: 'source,source_ref',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`Error upserting domain batch ${i}:`, error.message)
    } else {
      domainsAdded += batch.length
    }
  }

  // Upsert IPs in batches
  console.log(`\nUpserting ${ipIOCs.length} IP IOCs...`)
  for (let i = 0; i < ipIOCs.length; i += BATCH_SIZE) {
    const batch = ipIOCs.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('iocs')
      .upsert(batch, {
        onConflict: 'source,source_ref',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`Error upserting IP batch ${i}:`, error.message)
    } else {
      ipsAdded += batch.length
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('PhishTank Ingestion Complete')
  console.log('='.repeat(50))
  console.log(`Total entries processed: ${recentPhishes.length}`)
  console.log(`URL IOCs added/updated: ${urlsAdded}`)
  console.log(`Domain IOCs added: ${domainsAdded}`)
  console.log(`IP IOCs added: ${ipsAdded}`)
  console.log(`Skipped (unverified): ${skipped}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'phishtank',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: recentPhishes.length,
    records_added: urlsAdded + domainsAdded + ipsAdded,
    metadata: {
      urls: urlsAdded,
      domains: domainsAdded,
      ips: ipsAdded,
      skipped,
    },
  })

  return { urls: urlsAdded, domains: domainsAdded, ips: ipsAdded }
}

ingestPhishTank().catch(console.error)
