// Domain WHOIS and Age Enrichment
// Enriches domain IOCs with registration data, age, and SSL info
// Run: node scripts/enrich-domain-whois.mjs

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Known suspicious TLDs
const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'club', 'work', 'click', 'link', 'gq', 'ml', 'cf', 'tk', 'ga',
  'pw', 'cc', 'ws', 'buzz', 'surf', 'icu', 'monster', 'cam', 'rest', 'fit'
])

// Known registrar patterns that are often abused
const SUSPICIOUS_REGISTRARS = [
  'namecheap', 'namesilo', 'porkbun', 'nicenic', 'alibaba'
]

// Calculate domain age risk score
function calculateDomainAgeRisk(createdDate) {
  if (!createdDate) return { score: 50, reason: 'unknown_age' }

  const ageMs = Date.now() - new Date(createdDate).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays < 7) return { score: 90, reason: 'very_new', ageDays }
  if (ageDays < 30) return { score: 75, reason: 'new', ageDays }
  if (ageDays < 90) return { score: 50, reason: 'recent', ageDays }
  if (ageDays < 365) return { score: 30, reason: 'moderate', ageDays }
  return { score: 10, reason: 'established', ageDays }
}

// Parse RDAP response for domain info
function parseRDAPResponse(rdap, domain) {
  const info = {
    domain,
    enriched: true,
    enriched_at: new Date().toISOString(),
    source: 'rdap',
  }

  // Events (created, updated, expires)
  if (rdap.events) {
    for (const event of rdap.events) {
      if (event.eventAction === 'registration') {
        info.created_date = event.eventDate
      } else if (event.eventAction === 'last changed' || event.eventAction === 'last update of RDAP database') {
        info.updated_date = event.eventDate
      } else if (event.eventAction === 'expiration') {
        info.expiry_date = event.eventDate
      }
    }
  }

  // Registrar
  if (rdap.entities) {
    for (const entity of rdap.entities) {
      if (entity.roles?.includes('registrar')) {
        info.registrar = entity.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || entity.handle
      }
    }
  }

  // Status
  info.status = rdap.status || []

  // Nameservers
  if (rdap.nameservers) {
    info.nameservers = rdap.nameservers.map(ns => ns.ldhName)
  }

  // Calculate age risk
  if (info.created_date) {
    info.age_risk = calculateDomainAgeRisk(info.created_date)
  }

  // Check TLD
  const tld = domain.split('.').pop().toLowerCase()
  info.tld = tld
  info.suspicious_tld = SUSPICIOUS_TLDS.has(tld)

  // Check registrar
  if (info.registrar) {
    info.suspicious_registrar = SUSPICIOUS_REGISTRARS.some(r =>
      info.registrar.toLowerCase().includes(r)
    )
  }

  return info
}

// Fetch WHOIS via RDAP
async function fetchRDAP(domain) {
  const tld = domain.split('.').pop().toLowerCase()

  // RDAP bootstrap for common TLDs
  const rdapServers = {
    com: 'https://rdap.verisign.com/com/v1',
    net: 'https://rdap.verisign.com/net/v1',
    org: 'https://rdap.publicinterestregistry.org/rdap',
    io: 'https://rdap.nic.io',
    co: 'https://rdap.nic.co',
    me: 'https://rdap.nic.me',
  }

  const server = rdapServers[tld]
  if (!server) {
    return { error: 'unsupported_tld', tld }
  }

  try {
    const response = await fetch(`${server}/domain/${domain}`, {
      headers: { 'Accept': 'application/rdap+json' },
      timeout: 10000,
    })

    if (!response.ok) {
      return { error: 'rdap_error', status: response.status }
    }

    const data = await response.json()
    return parseRDAPResponse(data, domain)
  } catch (e) {
    return { error: e.message, domain }
  }
}

// Check SSL certificate via crt.sh
async function checkSSL(domain) {
  try {
    const response = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`,
      { timeout: 15000 }
    )

    if (!response.ok) return { ssl_checked: false }

    const certs = await response.json()

    if (!certs || certs.length === 0) {
      return { ssl_checked: true, has_ssl: false }
    }

    // Get the most recent certificate
    const sorted = certs.sort((a, b) =>
      new Date(b.not_before) - new Date(a.not_before)
    )
    const latest = sorted[0]

    return {
      ssl_checked: true,
      has_ssl: true,
      ssl_issuer: latest.issuer_name,
      ssl_valid_from: latest.not_before,
      ssl_valid_to: latest.not_after,
      ssl_cert_count: certs.length,
    }
  } catch (e) {
    return { ssl_checked: false, ssl_error: e.message }
  }
}

// Enrich a single domain
async function enrichDomain(domain) {
  const enrichment = {
    domain,
    enriched: true,
    enriched_at: new Date().toISOString(),
  }

  // Fetch RDAP/WHOIS data
  const rdapData = await fetchRDAP(domain)
  Object.assign(enrichment, rdapData)

  // Check SSL
  const sslData = await checkSSL(domain)
  Object.assign(enrichment, sslData)

  // Calculate overall risk score
  let riskScore = 0
  const riskFactors = []

  // Age-based risk
  if (enrichment.age_risk) {
    riskScore += enrichment.age_risk.score * 0.4
    if (enrichment.age_risk.score >= 50) {
      riskFactors.push({ factor: 'domain_age', score: enrichment.age_risk.score, reason: enrichment.age_risk.reason })
    }
  }

  // TLD risk
  if (enrichment.suspicious_tld) {
    riskScore += 20
    riskFactors.push({ factor: 'suspicious_tld', score: 20, tld: enrichment.tld })
  }

  // Registrar risk
  if (enrichment.suspicious_registrar) {
    riskScore += 15
    riskFactors.push({ factor: 'suspicious_registrar', score: 15, registrar: enrichment.registrar })
  }

  // No SSL
  if (enrichment.ssl_checked && !enrichment.has_ssl) {
    riskScore += 10
    riskFactors.push({ factor: 'no_ssl', score: 10 })
  }

  enrichment.risk_score = Math.min(Math.round(riskScore), 100)
  enrichment.risk_factors = riskFactors
  enrichment.risk_level = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low'

  return enrichment
}

// Main enrichment function
async function enrichDomainIOCs(limit = 100, skipRecent = true) {
  console.log('=== Domain WHOIS Enrichment ===\n')

  // Get domain IOCs that need enrichment
  let query = supabase
    .from('iocs')
    .select('id, value, metadata')
    .eq('type', 'domain')
    .eq('is_active', true)
    .limit(limit)

  if (skipRecent) {
    // Skip domains enriched in the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`metadata->whois_enriched_at.is.null,metadata->whois_enriched_at.lt.${weekAgo}`)
  }

  const { data: domains, error } = await query

  if (error) {
    console.error('Error fetching domains:', error)
    return
  }

  console.log(`Found ${domains.length} domains to enrich\n`)

  let enriched = 0
  let errors = 0

  for (const ioc of domains) {
    console.log(`Enriching: ${ioc.value}`)

    try {
      const enrichment = await enrichDomain(ioc.value)

      // Update IOC metadata
      const { error: updateError } = await supabase
        .from('iocs')
        .update({
          metadata: {
            ...(ioc.metadata || {}),
            whois: enrichment,
            whois_enriched_at: enrichment.enriched_at,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', ioc.id)

      if (updateError) {
        console.error(`  Error updating: ${updateError.message}`)
        errors++
      } else {
        console.log(`  Risk: ${enrichment.risk_level} (${enrichment.risk_score})`)
        enriched++
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`)
      errors++
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n=== Summary ===')
  console.log(`Enriched: ${enriched}`)
  console.log(`Errors: ${errors}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'domain_whois_enrichment',
    status: 'completed',
    records_processed: domains.length,
    records_inserted: enriched,
    metadata: { errors },
  })
}

// CLI
const args = process.argv.slice(2)
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 100

if (args.includes('--help') || args.includes('-h')) {
  console.log('Domain WHOIS Enrichment')
  console.log('')
  console.log('Usage: node scripts/enrich-domain-whois.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --limit=N      Process N domains (default: 100)')
  console.log('  --all          Include recently enriched domains')
} else {
  enrichDomainIOCs(limit, !args.includes('--all'))
}
