// IP Geolocation Enrichment
// Adds country data to IP IOCs using free geolocation APIs
// Run: node scripts/enrich-geolocation.mjs
// Uses: ip-api.com (free, 45 requests/minute)

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'
import { supabaseUrl, supabaseKey } from './env.mjs'

// Free IP geolocation API (no key required)
// Rate limit: 45 requests per minute
const IPAPI_URL = 'http://ip-api.com/json'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchGeoIP(ip) {
  return new Promise((resolve, reject) => {
    const url = `${IPAPI_URL}/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,asname`

    // ip-api.com uses HTTP (not HTTPS) for free tier
    const req = http.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.status === 'fail') {
            reject(new Error(result.message))
          } else {
            resolve(result)
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Batch lookup using ip-api.com batch endpoint
function fetchGeoBatch(ips) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(ips)

    const options = {
      hostname: 'ip-api.com',
      path: '/batch?fields=status,query,country,countryCode,region,regionName,city,lat,lon,isp,org,as,asname',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }

    const req = http.request(options, (res) => {
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
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
    req.write(postData)
    req.end()
  })
}

async function enrichIPIOCs() {
  console.log('Starting IP Geolocation Enrichment...')
  console.log('Source: ip-api.com (free tier)')
  console.log('')

  // Get IP IOCs without country data
  const { data: ipIOCs, error } = await supabase
    .from('iocs')
    .select('id, value, metadata')
    .eq('type', 'ip')
    .is('metadata->country', null)
    .limit(500)

  if (error) {
    console.error('Error fetching IOCs:', error.message)
    return
  }

  console.log(`Found ${ipIOCs?.length || 0} IPs without geolocation data`)

  if (!ipIOCs || ipIOCs.length === 0) {
    console.log('No IPs to enrich')
    return { enriched: 0, failed: 0 }
  }

  let enriched = 0
  let failed = 0
  const countryStats = {}

  // Process in batches of 100 (ip-api batch limit)
  const batchSize = 100

  for (let i = 0; i < ipIOCs.length; i += batchSize) {
    const batch = ipIOCs.slice(i, i + batchSize)
    const ips = batch.map(ioc => ioc.value)

    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ipIOCs.length / batchSize)} (${ips.length} IPs)...`)

    try {
      const results = await fetchGeoBatch(ips)

      for (let j = 0; j < results.length; j++) {
        const result = results[j]
        const ioc = batch[j]

        if (result.status === 'success') {
          const geoData = {
            country: result.country,
            country_code: result.countryCode,
            region: result.regionName,
            city: result.city,
            lat: result.lat,
            lon: result.lon,
            isp: result.isp,
            org: result.org,
            asn: result.as,
            asname: result.asname,
          }

          await supabase
            .from('iocs')
            .update({
              metadata: {
                ...ioc.metadata,
                ...geoData,
                geo_enriched: new Date().toISOString(),
              }
            })
            .eq('id', ioc.id)

          enriched++

          // Track country stats
          const country = result.countryCode || 'Unknown'
          countryStats[country] = (countryStats[country] || 0) + 1
        } else {
          failed++
        }
      }

      // Rate limit: max 45/minute, we'll do 15/minute to be safe
      // With batch of 100, wait 4 seconds between batches
      await sleep(4000)
    } catch (e) {
      console.error(`Batch error:`, e.message)
      failed += batch.length
      await sleep(5000)
    }
  }

  // Also enrich incidents with victim country from website
  console.log('\nEnriching incidents with victim country data...')
  await enrichIncidentCountries()

  // Print country distribution
  const sortedCountries = Object.entries(countryStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  console.log('\n' + '='.repeat(50))
  console.log('IP Geolocation Enrichment Complete')
  console.log('='.repeat(50))
  console.log(`IPs enriched: ${enriched}`)
  console.log(`Failed lookups: ${failed}`)
  console.log(`\nTop 15 Countries:`)
  sortedCountries.forEach(([country, count]) => {
    console.log(`  ${country}: ${count}`)
  })

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'geolocation',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: ipIOCs.length,
    records_added: enriched,
    metadata: { country_distribution: countryStats }
  })

  return { enriched, failed, countryStats }
}

async function enrichIncidentCountries() {
  // Get incidents without country that have a website
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, victim_website, victim_country')
    .is('victim_country', null)
    .not('victim_website', 'is', null)
    .limit(200)

  if (!incidents || incidents.length === 0) {
    console.log('No incidents to enrich')
    return
  }

  console.log(`Found ${incidents.length} incidents without country data`)

  // Country inference from TLD
  const tldCountryMap = {
    'uk': 'GB', 'co.uk': 'GB',
    'de': 'DE',
    'fr': 'FR',
    'it': 'IT',
    'es': 'ES',
    'nl': 'NL',
    'be': 'BE',
    'au': 'AU', 'com.au': 'AU',
    'ca': 'CA',
    'br': 'BR', 'com.br': 'BR',
    'jp': 'JP', 'co.jp': 'JP',
    'cn': 'CN',
    'in': 'IN', 'co.in': 'IN',
    'ru': 'RU',
    'mx': 'MX', 'com.mx': 'MX',
    'za': 'ZA', 'co.za': 'ZA',
    'kr': 'KR', 'co.kr': 'KR',
    'se': 'SE',
    'no': 'NO',
    'dk': 'DK',
    'fi': 'FI',
    'pl': 'PL',
    'ch': 'CH',
    'at': 'AT',
    'nz': 'NZ', 'co.nz': 'NZ',
    'ie': 'IE',
    'sg': 'SG', 'com.sg': 'SG',
    'hk': 'HK', 'com.hk': 'HK',
    'tw': 'TW', 'com.tw': 'TW',
    'ae': 'AE',
    'il': 'IL', 'co.il': 'IL',
  }

  let enriched = 0

  for (const incident of incidents) {
    try {
      const website = incident.victim_website.toLowerCase()
      let country = null

      // Extract TLD
      const parts = website.replace(/^(https?:\/\/)?(www\.)?/, '').split('.')
      if (parts.length >= 2) {
        // Try compound TLD first (e.g., co.uk)
        const compoundTld = parts.slice(-2).join('.')
        if (tldCountryMap[compoundTld]) {
          country = tldCountryMap[compoundTld]
        } else {
          const tld = parts[parts.length - 1]
          if (tldCountryMap[tld]) {
            country = tldCountryMap[tld]
          }
        }
      }

      // Default .com/.org/.net to US if no other indicator
      if (!country && ['com', 'org', 'net', 'edu'].includes(parts[parts.length - 1])) {
        country = 'US'
      }

      if (country) {
        await supabase
          .from('incidents')
          .update({ victim_country: country })
          .eq('id', incident.id)
        enriched++
      }
    } catch (e) {
      // Skip on error
    }
  }

  console.log(`Enriched ${enriched} incidents with country from TLD`)
}

enrichIPIOCs().catch(console.error)
