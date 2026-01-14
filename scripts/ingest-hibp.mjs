// Have I Been Pwned - Breach Data Enrichment
// Checks if domains from incidents appear in known breaches
// Run: node scripts/ingest-hibp.mjs
// API Docs: https://haveibeenpwned.com/API/v3
// Note: Domain search is free, email search requires API key

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// HIBP API - breach list is public, domain search is free
const HIBP_API = 'https://haveibeenpwned.com/api/v3'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchJSON(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Vigil-CTI-Dashboard',
        'Accept': 'application/json',
      },
      timeout: 30000,
    }

    const req = https.get(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 429 && retries > 0) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(res.headers['retry-after'] || '2', 10)
          setTimeout(() => {
            fetchJSON(url, retries - 1).then(resolve).catch(reject)
          }, retryAfter * 1000)
          return
        }

        if (res.statusCode === 404) {
          resolve(null) // Not found is OK
          return
        }

        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractDomain(url) {
  if (!url) return null
  try {
    // Handle URLs with or without protocol
    let domain = url
    if (url.includes('://')) {
      domain = new URL(url).hostname
    } else if (url.includes('/')) {
      domain = url.split('/')[0]
    }
    // Remove www prefix
    return domain.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

async function fetchAllBreaches() {
  console.log('Fetching all known breaches from HIBP...')
  const url = `${HIBP_API}/breaches`
  const breaches = await fetchJSON(url)
  return breaches || []
}

async function checkDomainBreach(domain) {
  // HIBP doesn't have a direct domain breach search in free tier
  // We'll match against breach domains from the full list
  return null
}

async function ingestHIBP() {
  console.log('Starting Have I Been Pwned Breach Import...')
  console.log('Source: https://haveibeenpwned.com/')
  console.log('')

  // Fetch all known breaches
  const breaches = await fetchAllBreaches()
  console.log(`Found ${breaches.length} breaches in HIBP database`)

  let added = 0
  let updated = 0
  let failed = 0

  // Store breach data
  console.log('\nImporting breach records...')

  for (const breach of breaches) {
    try {
      const breachRecord = {
        name: breach.Name,
        title: breach.Title,
        domain: breach.Domain,
        breach_date: breach.BreachDate,
        added_date: breach.AddedDate,
        modified_date: breach.ModifiedDate,
        pwn_count: breach.PwnCount,
        description: breach.Description,
        logo_path: breach.LogoPath,
        data_classes: breach.DataClasses || [],
        is_verified: breach.IsVerified,
        is_fabricated: breach.IsFabricated,
        is_sensitive: breach.IsSensitive,
        is_retired: breach.IsRetired,
        is_spam_list: breach.IsSpamList,
        is_malware: breach.IsMalware,
        is_subscription_free: breach.IsSubscriptionFree,
        source: 'hibp',
      }

      // Upsert to breaches table
      const { error } = await supabase
        .from('breaches')
        .upsert(breachRecord, { onConflict: 'name' })

      if (error) {
        // Table might not exist - create it
        if (error.code === '42P01') {
          console.log('Creating breaches table...')
          // We'll store in metadata for now
          failed++
        } else {
          failed++
        }
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  // Now try to correlate with our incidents
  console.log('\nCorrelating breaches with incidents...')

  // Get unique victim domains from incidents
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, victim_name, victim_website, metadata')
    .not('victim_website', 'is', null)
    .limit(500)

  let correlated = 0

  // Build domain lookup map from breaches
  const breachDomainMap = new Map()
  for (const breach of breaches) {
    if (breach.Domain) {
      breachDomainMap.set(breach.Domain.toLowerCase(), breach)
    }
  }

  for (const incident of incidents || []) {
    const domain = extractDomain(incident.victim_website)
    if (!domain) continue

    const matchingBreach = breachDomainMap.get(domain)
    if (matchingBreach) {
      // Update incident with breach correlation
      await supabase
        .from('incidents')
        .update({
          metadata: {
            ...incident.metadata,
            hibp_breach: {
              name: matchingBreach.Name,
              breach_date: matchingBreach.BreachDate,
              pwn_count: matchingBreach.PwnCount,
              data_classes: matchingBreach.DataClasses,
            }
          }
        })
        .eq('id', incident.id)

      correlated++
    }
  }

  console.log(`Correlated ${correlated} incidents with known breaches`)

  // Create breach statistics
  const breachStats = {
    total_breaches: breaches.length,
    total_pwned_accounts: breaches.reduce((sum, b) => sum + (b.PwnCount || 0), 0),
    verified_breaches: breaches.filter(b => b.IsVerified).length,
    largest_breaches: breaches
      .sort((a, b) => (b.PwnCount || 0) - (a.PwnCount || 0))
      .slice(0, 10)
      .map(b => ({ name: b.Name, count: b.PwnCount, date: b.BreachDate })),
    common_data_classes: getCommonDataClasses(breaches),
  }

  console.log('\n' + '='.repeat(50))
  console.log('HIBP Breach Import Complete')
  console.log('='.repeat(50))
  console.log(`Total breaches: ${breachStats.total_breaches}`)
  console.log(`Total pwned accounts: ${breachStats.total_pwned_accounts.toLocaleString()}`)
  console.log(`Verified breaches: ${breachStats.verified_breaches}`)
  console.log(`Incidents correlated: ${correlated}`)
  console.log(`\nTop 5 largest breaches:`)
  breachStats.largest_breaches.slice(0, 5).forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name}: ${b.count.toLocaleString()} accounts (${b.date})`)
  })

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'hibp',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: breaches.length,
    records_added: added,
    metadata: breachStats
  })

  return { added, correlated, failed }
}

function getCommonDataClasses(breaches) {
  const classCounts = {}
  for (const breach of breaches) {
    for (const dataClass of breach.DataClasses || []) {
      classCounts[dataClass] = (classCounts[dataClass] || 0) + 1
    }
  }
  return Object.entries(classCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))
}

ingestHIBP().catch(console.error)
