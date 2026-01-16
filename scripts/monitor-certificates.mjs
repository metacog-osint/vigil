// Certificate Transparency Monitoring
// Monitors domains for new certificates via crt.sh
// Run: node scripts/monitor-certificates.mjs
// No API key required - uses public crt.sh API

import { createClient } from '@supabase/supabase-js'
import { fetchJSON, sleep } from './lib/http.mjs'
import { supabaseUrl, supabaseKey } from './env.mjs'

const CRT_SH_API = 'https://crt.sh'

// Rate limit: 2 seconds between requests
const RATE_LIMIT_MS = 2000

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function searchCertificates(domain) {
  const url = `${CRT_SH_API}/?q=${encodeURIComponent(`%.${domain}`)}&output=json`

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Error searching certs for ${domain}:`, error.message)
    return []
  }
}

async function processCertificate(cert, domain) {
  // Extract subject alternative names
  const san = cert.name_value?.split(/\n/)?.filter(Boolean) || []

  const certData = {
    fingerprint_sha256: cert.id?.toString() || `crtsh-${cert.serial_number}`,
    subject_cn: cert.common_name,
    subject_org: cert.organization,
    issuer_cn: cert.issuer_name,
    issuer_org: cert.issuer_ca_id?.toString(),
    not_before: cert.not_before,
    not_after: cert.not_after,
    is_expired: new Date(cert.not_after) < new Date(),
    subject_san: san,
    source: 'crt_sh',
    metadata: {
      crt_sh_id: cert.id,
      serial_number: cert.serial_number,
      entry_timestamp: cert.entry_timestamp,
    },
  }

  const { data: existing } = await supabase
    .from('certificates')
    .select('id')
    .eq('fingerprint_sha256', certData.fingerprint_sha256)
    .single()

  if (existing) {
    // Update last_seen
    await supabase
      .from('certificates')
      .update({
        last_seen: new Date().toISOString(),
        seen_count: supabase.sql`seen_count + 1`,
      })
      .eq('id', existing.id)

    return { isNew: false, id: existing.id }
  }

  const { data: newCert, error } = await supabase
    .from('certificates')
    .insert(certData)
    .select('id')
    .single()

  if (error) {
    console.error(`Error inserting certificate: ${error.message}`)
    return { isNew: false, id: null }
  }

  return { isNew: true, id: newCert?.id }
}

async function checkDomain(domain, userId, teamId) {
  console.log(`\nChecking certificates for: ${domain}`)

  const certs = await searchCertificates(domain)

  if (!certs || certs.length === 0) {
    console.log(`  No certificates found`)
    return { total: 0, new: 0 }
  }

  console.log(`  Found ${certs.length} certificates`)

  // Deduplicate by ID and take recent ones
  const uniqueCerts = [...new Map(certs.map(c => [c.id, c])).values()]
    .sort((a, b) => new Date(b.entry_timestamp) - new Date(a.entry_timestamp))
    .slice(0, 100) // Limit to 100 most recent

  let newCount = 0

  for (const cert of uniqueCerts) {
    const result = await processCertificate(cert, domain)

    if (result.isNew) {
      newCount++

      // Create alert for new certificate
      const notAfter = new Date(cert.not_after)
      const daysToExpiry = Math.floor((notAfter - new Date()) / (1000 * 60 * 60 * 24))

      // Alert if certificate is new (in last 24 hours)
      const entryTime = new Date(cert.entry_timestamp)
      const isRecent = (new Date() - entryTime) < 24 * 60 * 60 * 1000

      if (isRecent) {
        await supabase.from('certificate_alerts').insert({
          user_id: userId,
          team_id: teamId,
          domain: domain,
          alert_type: 'new_cert',
          certificate_id: result.id,
          title: `New certificate issued for ${cert.common_name || domain}`,
          description: `Certificate issued by ${cert.issuer_name || 'Unknown CA'}, valid until ${notAfter.toDateString()}`,
          severity: 'info',
        })
      }

      // Alert if expiring soon
      if (daysToExpiry > 0 && daysToExpiry <= 30) {
        await supabase.from('certificate_alerts').insert({
          user_id: userId,
          team_id: teamId,
          domain: domain,
          alert_type: 'expiring',
          certificate_id: result.id,
          title: `Certificate expiring in ${daysToExpiry} days`,
          description: `Certificate for ${cert.common_name || domain} expires on ${notAfter.toDateString()}`,
          severity: daysToExpiry <= 7 ? 'high' : 'medium',
        })
      }
    }
  }

  console.log(`  New certificates: ${newCount}`)

  return { total: uniqueCerts.length, new: newCount }
}

async function monitorAllDomains() {
  console.log('\n=== Certificate Transparency Monitor ===\n')

  // Get all monitored domains
  const { data: domains, error } = await supabase
    .from('monitored_domains')
    .select('*')
    .eq('is_enabled', true)
    .eq('monitor_certificates', true)

  if (error) {
    console.error('Error fetching domains:', error)
    return
  }

  if (!domains || domains.length === 0) {
    console.log('No domains configured for monitoring')
    console.log('\nTo add a domain, insert into monitored_domains table or use the UI')
    return
  }

  console.log(`Monitoring ${domains.length} domains`)

  let totalCerts = 0
  let newCerts = 0

  for (const domainConfig of domains) {
    const result = await checkDomain(domainConfig.domain, domainConfig.user_id, domainConfig.team_id)
    totalCerts += result.total
    newCerts += result.new

    // Update last_checked
    await supabase
      .from('monitored_domains')
      .update({
        last_checked: new Date().toISOString(),
        check_count: supabase.sql`check_count + 1`,
      })
      .eq('id', domainConfig.id)

    await sleep(RATE_LIMIT_MS)
  }

  console.log(`\n=== Summary ===`)
  console.log(`Domains checked: ${domains.length}`)
  console.log(`Certificates found: ${totalCerts}`)
  console.log(`New certificates: ${newCerts}`)
}

// Single domain lookup
async function lookupDomain(domain) {
  console.log(`\nSearching certificates for: ${domain}\n`)

  const certs = await searchCertificates(domain)

  if (!certs || certs.length === 0) {
    console.log('No certificates found')
    return
  }

  // Dedupe and sort
  const uniqueCerts = [...new Map(certs.map(c => [c.id, c])).values()]
    .sort((a, b) => new Date(b.entry_timestamp) - new Date(a.entry_timestamp))

  console.log(`Found ${uniqueCerts.length} unique certificates:\n`)

  uniqueCerts.slice(0, 15).forEach(cert => {
    const notAfter = new Date(cert.not_after)
    const isExpired = notAfter < new Date()
    const daysToExpiry = Math.floor((notAfter - new Date()) / (1000 * 60 * 60 * 24))

    console.log(`  ${cert.common_name}`)
    console.log(`    Issuer: ${cert.issuer_name}`)
    console.log(`    Valid: ${cert.not_before?.split('T')[0]} to ${cert.not_after?.split('T')[0]}`)
    console.log(`    Status: ${isExpired ? 'EXPIRED' : daysToExpiry <= 30 ? `Expires in ${daysToExpiry} days` : 'Valid'}`)
    console.log(`    SANs: ${cert.name_value?.split('\n').slice(0, 3).join(', ')}${cert.name_value?.split('\n').length > 3 ? '...' : ''}`)
    console.log()
  })

  if (uniqueCerts.length > 15) {
    console.log(`... and ${uniqueCerts.length - 15} more certificates`)
  }
}

// Main
const args = process.argv.slice(2)
if (args[0] === '--domain' && args[1]) {
  lookupDomain(args[1])
} else {
  monitorAllDomains()
}
