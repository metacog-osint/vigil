// CIRCL Passive DNS Enrichment
// Enriches domains/IPs with historical DNS data from CIRCL
// Run: node scripts/enrich-circl-pdns.mjs
// Requires: CIRCL_PDNS_USER and CIRCL_PDNS_PASSWORD env vars
// Get credentials: https://www.circl.lu/services/passive-dns/

import { createClient } from '@supabase/supabase-js'
import { fetchWithAuth, sleep } from './lib/http.mjs'
import { supabaseUrl, supabaseKey } from './env.mjs'

const CIRCL_API_BASE = 'https://www.circl.lu/pdns/query'

// Rate limit: 1 request per second
const RATE_LIMIT_MS = 1000

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const circlUser = process.env.CIRCL_PDNS_USER
const circlPassword = process.env.CIRCL_PDNS_PASSWORD

if (!circlUser || !circlPassword) {
  console.error('Missing CIRCL credentials. Set CIRCL_PDNS_USER and CIRCL_PDNS_PASSWORD')
  console.log('\nTo get credentials, register at: https://www.circl.lu/services/passive-dns/')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const authHeader = Buffer.from(`${circlUser}:${circlPassword}`).toString('base64')

async function queryPassiveDNS(query) {
  const url = `${CIRCL_API_BASE}/${encodeURIComponent(query)}`

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // CIRCL returns NDJSON (newline-delimited JSON)
    const text = await response.text()
    const records = text.trim().split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    }).filter(Boolean)

    return records
  } catch (error) {
    console.error(`Error querying ${query}:`, error.message)
    return []
  }
}

async function enrichDomain(domain) {
  console.log(`Enriching domain: ${domain}`)

  const records = await queryPassiveDNS(domain)

  if (records.length === 0) {
    console.log(`  No records found for ${domain}`)
    return 0
  }

  console.log(`  Found ${records.length} DNS records`)

  let upsertCount = 0
  for (const record of records) {
    const dnsRecord = {
      domain: record.rrname?.replace(/\.$/, ''), // Remove trailing dot
      record_type: record.rrtype,
      record_value: record.rdata,
      first_seen: record.time_first ? new Date(record.time_first * 1000).toISOString() : null,
      last_seen: record.time_last ? new Date(record.time_last * 1000).toISOString() : null,
      times_seen: record.count || 1,
      source: 'circl_pdns',
      metadata: {
        zone_time_first: record.zone_time_first,
        zone_time_last: record.zone_time_last,
        origin: record.origin,
      },
    }

    const { error } = await supabase
      .from('dns_records')
      .upsert(dnsRecord, {
        onConflict: 'domain,record_type,record_value,source',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`  Error upserting record: ${error.message}`)
    } else {
      upsertCount++
    }
  }

  return upsertCount
}

async function enrichIP(ip) {
  console.log(`Enriching IP: ${ip}`)

  const records = await queryPassiveDNS(ip)

  if (records.length === 0) {
    console.log(`  No records found for ${ip}`)
    return 0
  }

  console.log(`  Found ${records.length} DNS records pointing to ${ip}`)

  let upsertCount = 0
  for (const record of records) {
    const dnsRecord = {
      domain: record.rrname?.replace(/\.$/, ''),
      record_type: record.rrtype,
      record_value: record.rdata || ip,
      first_seen: record.time_first ? new Date(record.time_first * 1000).toISOString() : null,
      last_seen: record.time_last ? new Date(record.time_last * 1000).toISOString() : null,
      times_seen: record.count || 1,
      source: 'circl_pdns',
    }

    const { error } = await supabase
      .from('dns_records')
      .upsert(dnsRecord, {
        onConflict: 'domain,record_type,record_value,source',
        ignoreDuplicates: false,
      })

    if (!error) upsertCount++
  }

  return upsertCount
}

async function enrichPendingIOCs(limit = 50) {
  console.log('\n=== CIRCL Passive DNS Enrichment ===\n')

  // Get domains and IPs from IOCs that haven't been enriched
  const { data: domainIOCs, error: domainError } = await supabase
    .from('iocs')
    .select('id, value')
    .eq('type', 'domain')
    .is('enriched_at', null)
    .limit(limit)

  const { data: ipIOCs, error: ipError } = await supabase
    .from('iocs')
    .select('id, value')
    .eq('type', 'ip')
    .is('enriched_at', null)
    .limit(limit)

  if (domainError || ipError) {
    console.error('Error fetching IOCs:', domainError || ipError)
    return
  }

  const allIOCs = [...(domainIOCs || []), ...(ipIOCs || [])]

  if (allIOCs.length === 0) {
    console.log('No IOCs pending enrichment')
    return
  }

  console.log(`Processing ${allIOCs.length} IOCs`)

  let totalRecords = 0

  for (const ioc of allIOCs) {
    const recordCount = ioc.value.includes('.') && !ioc.value.match(/^\d+\.\d+\.\d+\.\d+$/)
      ? await enrichDomain(ioc.value)
      : await enrichIP(ioc.value)

    totalRecords += recordCount

    // Mark IOC as enriched
    await supabase
      .from('iocs')
      .update({ enriched_at: new Date().toISOString() })
      .eq('id', ioc.id)

    // Rate limiting
    await sleep(RATE_LIMIT_MS)
  }

  console.log(`\n=== Summary ===`)
  console.log(`IOCs processed: ${allIOCs.length}`)
  console.log(`DNS records added: ${totalRecords}`)
}

// Single query mode
async function singleQuery(query) {
  console.log(`\nQuerying CIRCL PDNS for: ${query}\n`)

  const records = await queryPassiveDNS(query)

  if (records.length === 0) {
    console.log('No records found')
    return
  }

  console.log(`Found ${records.length} records:\n`)
  records.slice(0, 20).forEach(r => {
    console.log(`  ${r.rrname} ${r.rrtype} ${r.rdata}`)
    console.log(`    First: ${r.time_first ? new Date(r.time_first * 1000).toISOString() : 'N/A'}`)
    console.log(`    Last: ${r.time_last ? new Date(r.time_last * 1000).toISOString() : 'N/A'}`)
    console.log(`    Count: ${r.count || 1}`)
    console.log()
  })

  if (records.length > 20) {
    console.log(`... and ${records.length - 20} more records`)
  }
}

// Main
const args = process.argv.slice(2)
if (args[0] === '--query' && args[1]) {
  singleQuery(args[1])
} else {
  const limit = parseInt(args[0]) || 50
  enrichPendingIOCs(limit)
}
