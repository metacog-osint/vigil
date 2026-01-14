// VirusTotal IOC Enrichment
// Enriches existing IOCs with VirusTotal reputation data
// Run: node scripts/enrich-virustotal.mjs
// API Docs: https://developers.virustotal.com/reference/overview

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, virustotalApiKey } from './env.mjs'

const VT_API = 'https://www.virustotal.com/api/v3'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!virustotalApiKey) {
  console.error('Missing VirusTotal API key. Add VIRUSTOTAL_API_KEY to .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchVT(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `${VT_API}${endpoint}`
    const urlObj = new URL(url)

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'x-apikey': virustotalApiKey,
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

async function enrichHash(hash, type) {
  // VT uses 'files' endpoint for all hash types
  const { status, data } = await fetchVT(`/files/${hash}`)

  if (status === 200 && data?.data?.attributes) {
    const attrs = data.data.attributes
    const stats = attrs.last_analysis_stats || {}

    return {
      vt_checked: new Date().toISOString(),
      vt_found: true,
      vt_malicious: stats.malicious || 0,
      vt_suspicious: stats.suspicious || 0,
      vt_undetected: stats.undetected || 0,
      vt_harmless: stats.harmless || 0,
      vt_total: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.undetected || 0) + (stats.harmless || 0),
      vt_popular_threat_label: attrs.popular_threat_classification?.suggested_threat_label,
      vt_type_description: attrs.type_description,
      vt_names: attrs.names?.slice(0, 5),
      vt_link: `https://www.virustotal.com/gui/file/${hash}`,
    }
  } else if (status === 404) {
    return {
      vt_checked: new Date().toISOString(),
      vt_found: false,
    }
  }

  return null
}

async function enrichIP(ip) {
  const { status, data } = await fetchVT(`/ip_addresses/${ip}`)

  if (status === 200 && data?.data?.attributes) {
    const attrs = data.data.attributes
    const stats = attrs.last_analysis_stats || {}

    return {
      vt_checked: new Date().toISOString(),
      vt_found: true,
      vt_malicious: stats.malicious || 0,
      vt_suspicious: stats.suspicious || 0,
      vt_harmless: stats.harmless || 0,
      vt_undetected: stats.undetected || 0,
      vt_country: attrs.country,
      vt_asn: attrs.asn,
      vt_as_owner: attrs.as_owner,
      vt_link: `https://www.virustotal.com/gui/ip-address/${ip}`,
    }
  } else if (status === 404) {
    return {
      vt_checked: new Date().toISOString(),
      vt_found: false,
    }
  }

  return null
}

async function enrichDomain(domain) {
  const { status, data } = await fetchVT(`/domains/${domain}`)

  if (status === 200 && data?.data?.attributes) {
    const attrs = data.data.attributes
    const stats = attrs.last_analysis_stats || {}

    return {
      vt_checked: new Date().toISOString(),
      vt_found: true,
      vt_malicious: stats.malicious || 0,
      vt_suspicious: stats.suspicious || 0,
      vt_harmless: stats.harmless || 0,
      vt_undetected: stats.undetected || 0,
      vt_registrar: attrs.registrar,
      vt_creation_date: attrs.creation_date,
      vt_link: `https://www.virustotal.com/gui/domain/${domain}`,
    }
  } else if (status === 404) {
    return {
      vt_checked: new Date().toISOString(),
      vt_found: false,
    }
  }

  return null
}

async function enrichExistingIOCs() {
  console.log('Enriching IOCs with VirusTotal data...')
  console.log('Note: Free API allows 4 requests/minute, 500/day')
  console.log('')

  // Get IOCs that haven't been enriched with VT yet
  const { data: iocs, error } = await supabase
    .from('iocs')
    .select('id, value, type, metadata')
    .in('type', ['sha256', 'sha1', 'md5', 'ip', 'domain'])
    .is('metadata->vt_checked', null)
    .limit(100) // Stay within rate limits

  if (error) {
    console.error('Error fetching IOCs:', error.message)
    return { enriched: 0, malicious: 0, failed: 0 }
  }

  console.log(`Found ${iocs?.length || 0} IOCs to check`)

  let enriched = 0
  let malicious = 0
  let failed = 0

  for (const ioc of iocs || []) {
    try {
      let vtData = null

      if (['sha256', 'sha1', 'md5'].includes(ioc.type)) {
        vtData = await enrichHash(ioc.value, ioc.type)
      } else if (ioc.type === 'ip') {
        vtData = await enrichIP(ioc.value)
      } else if (ioc.type === 'domain') {
        vtData = await enrichDomain(ioc.value)
      }

      if (vtData) {
        const metadata = { ...ioc.metadata, ...vtData }

        // Update confidence based on VT detections
        let confidence = 'medium'
        let tags = []

        if (vtData.vt_malicious > 5) {
          confidence = 'high'
          tags.push('vt-malicious')
          malicious++
        } else if (vtData.vt_malicious > 0) {
          confidence = 'medium'
          tags.push('vt-suspicious')
        } else if (vtData.vt_found === false) {
          tags.push('vt-unknown')
        }

        await supabase
          .from('iocs')
          .update({
            metadata,
            confidence,
          })
          .eq('id', ioc.id)

        enriched++
      } else {
        failed++
      }

      // Rate limit - VT free tier: 4 requests/minute
      await sleep(15000)

      // Progress update
      if ((enriched + failed) % 10 === 0) {
        console.log(`  Progress: ${enriched + failed}/${iocs.length} (${malicious} malicious)`)
      }
    } catch (e) {
      failed++
      if (failed < 5) {
        console.error(`Error checking ${ioc.value}:`, e.message)
      }
    }
  }

  return { enriched, malicious, failed }
}

async function ingestVirusTotal() {
  console.log('Starting VirusTotal Enrichment...')
  console.log('Source: https://www.virustotal.com/')
  console.log('')

  const { enriched, malicious, failed } = await enrichExistingIOCs()

  console.log('\n' + '='.repeat(50))
  console.log('VirusTotal Enrichment Complete')
  console.log('='.repeat(50))
  console.log(`IOCs enriched: ${enriched}`)
  console.log(`Malicious found: ${malicious}`)
  console.log(`Failed lookups: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'virustotal',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: enriched + failed,
    records_added: enriched,
    metadata: { malicious_count: malicious }
  })

  return { enriched, malicious, failed }
}

ingestVirusTotal().catch(console.error)
