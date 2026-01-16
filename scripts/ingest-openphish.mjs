// OpenPhish Phishing URL Ingestion
// Fetches active phishing URLs from OpenPhish community feed
// Run: node scripts/ingest-openphish.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const OPENPHISH_FEED_URL = 'https://openphish.com/feed.txt'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return null
  }
}

function detectTargetBrand(url) {
  const urlLower = url.toLowerCase()
  const brandPatterns = {
    'microsoft': ['microsoft', 'office365', 'outlook', 'onedrive', 'sharepoint', 'azure', 'live.com'],
    'google': ['google', 'gmail', 'drive.google', 'docs.google'],
    'apple': ['apple', 'icloud', 'appleid'],
    'facebook': ['facebook', 'fb.com', 'meta'],
    'amazon': ['amazon', 'aws'],
    'paypal': ['paypal'],
    'netflix': ['netflix'],
    'linkedin': ['linkedin'],
    'dropbox': ['dropbox'],
    'docusign': ['docusign'],
    'adobe': ['adobe'],
    'chase': ['chase'],
    'wellsfargo': ['wellsfargo', 'wells-fargo'],
    'bankofamerica': ['bankofamerica', 'bofa'],
    'dhl': ['dhl'],
    'usps': ['usps'],
    'fedex': ['fedex'],
  }

  for (const [brand, patterns] of Object.entries(brandPatterns)) {
    if (patterns.some(p => urlLower.includes(p))) {
      return brand
    }
  }
  return null
}

async function ingestOpenPhish() {
  console.log('Fetching OpenPhish phishing URL feed...')

  const text = await fetchText(OPENPHISH_FEED_URL)
  const urls = text.split('\n')
    .map(line => line.trim())
    .filter(line => line && line.startsWith('http'))

  console.log(`Found ${urls.length} phishing URLs`)

  let added = 0
  let skipped = 0
  let failed = 0
  const now = new Date().toISOString()

  // Track brand targets for stats
  const brandCounts = {}

  // Process in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)

    const records = batch.map(url => {
      const domain = extractDomain(url)
      const targetBrand = detectTargetBrand(url)

      if (targetBrand) {
        brandCounts[targetBrand] = (brandCounts[targetBrand] || 0) + 1
      }

      return {
        type: 'url',
        value: url,
        malware_family: 'phishing',
        confidence: 'high', // OpenPhish validates URLs
        first_seen: now,
        last_seen: now,
        source: 'openphish',
        source_url: 'https://openphish.com/',
        tags: ['phishing', 'credential-theft', targetBrand].filter(Boolean),
        metadata: {
          domain: domain,
          target_brand: targetBrand,
          threat_type: 'phishing',
        }
      }
    })

    const { error } = await supabase
      .from('iocs')
      .upsert(records, {
        onConflict: 'type,value',
        ignoreDuplicates: false
      })

    if (error) {
      // Check for specific errors
      if (error.code === '23505') {
        skipped += batch.length
      } else {
        failed += batch.length
        if (failed <= 5) console.error(`Batch error: ${error.message}`)
      }
    } else {
      added += batch.length
    }

    // Progress indicator
    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= urls.length) {
      console.log(`Processed ${Math.min(i + BATCH_SIZE, urls.length)}/${urls.length} URLs...`)
    }
  }

  console.log(`\nOpenPhish Ingestion Complete:`)
  console.log(`  Processed: ${urls.length}`)
  console.log(`  Added/Updated: ${added}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)

  // Show top targeted brands
  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  if (topBrands.length > 0) {
    console.log(`\nTop targeted brands:`)
    topBrands.forEach(([brand, count]) => {
      console.log(`  ${brand}: ${count}`)
    })
  }

  await supabase.from('sync_log').insert({
    source: 'openphish',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: urls.length,
    records_added: added,
    metadata: {
      brand_targets: brandCounts,
      unique_domains: new Set(urls.map(extractDomain).filter(Boolean)).size
    }
  })

  return { added, skipped, failed, brandCounts }
}

ingestOpenPhish().catch(console.error)
