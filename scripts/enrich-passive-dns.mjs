#!/usr/bin/env node
/**
 * Passive DNS Enrichment Script
 * Enriches domain and IP IOCs with passive DNS data
 */

import { createClient } from '@supabase/supabase-js'
import dns from 'dns'
import { promisify } from 'util'

const dnsResolve = promisify(dns.resolve)
const dnsReverse = promisify(dns.reverse)
const dnsResolveMx = promisify(dns.resolveMx)
const dnsResolveTxt = promisify(dns.resolveTxt)
const dnsResolveNs = promisify(dns.resolveNs)
const dnsResolveCname = promisify(dns.resolveCname)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Known malicious DNS indicators
const SUSPICIOUS_PATTERNS = {
  // DGA-like patterns (long random-looking strings)
  dga: /^[a-z0-9]{15,}$/i,
  // Fast-flux indicators (many IPs)
  fastFluxThreshold: 10,
  // Suspicious TLDs
  suspiciousTlds: [
    '.tk', '.ml', '.ga', '.cf', '.gq', // Free TLDs often abused
    '.top', '.xyz', '.club', '.work', '.click',
    '.zip', '.mov', '.app', '.onion',
  ],
  // Bulletproof hosting ranges (simplified)
  bulletproofRanges: [
    '185.215.', '185.234.', '91.215.', '91.234.',
    '94.102.', '195.133.', '185.141.',
  ],
}

/**
 * Get DNS records for a domain
 */
async function getDomainRecords(domain) {
  const records = {
    a: [],
    aaaa: [],
    mx: [],
    ns: [],
    txt: [],
    cname: [],
  }

  try {
    records.a = await dnsResolve(domain, 'A').catch(() => [])
  } catch {}

  try {
    records.aaaa = await dnsResolve(domain, 'AAAA').catch(() => [])
  } catch {}

  try {
    records.mx = await dnsResolveMx(domain).catch(() => [])
  } catch {}

  try {
    records.ns = await dnsResolveNs(domain).catch(() => [])
  } catch {}

  try {
    records.txt = await dnsResolveTxt(domain).catch(() => [])
    records.txt = records.txt.flat()
  } catch {}

  try {
    records.cname = await dnsResolveCname(domain).catch(() => [])
  } catch {}

  return records
}

/**
 * Perform reverse DNS lookup for an IP
 */
async function getReverseDns(ip) {
  try {
    const hostnames = await dnsReverse(ip)
    return hostnames
  } catch {
    return []
  }
}

/**
 * Analyze DNS records for suspicious indicators
 */
function analyzeDnsRecords(domain, records) {
  const indicators = []
  let riskScore = 0

  // Check for DGA-like domain
  const domainParts = domain.split('.')
  const mainDomain = domainParts.slice(0, -1).join('')
  if (SUSPICIOUS_PATTERNS.dga.test(mainDomain)) {
    indicators.push({ type: 'dga_pattern', message: 'Domain resembles DGA-generated name' })
    riskScore += 30
  }

  // Check TLD
  for (const tld of SUSPICIOUS_PATTERNS.suspiciousTlds) {
    if (domain.endsWith(tld)) {
      indicators.push({ type: 'suspicious_tld', message: `Suspicious TLD: ${tld}` })
      riskScore += 15
      break
    }
  }

  // Check for fast-flux (many A records)
  if (records.a.length > SUSPICIOUS_PATTERNS.fastFluxThreshold) {
    indicators.push({ type: 'fast_flux', message: `Possible fast-flux: ${records.a.length} A records` })
    riskScore += 25
  }

  // Check for bulletproof hosting IPs
  for (const ip of records.a) {
    for (const range of SUSPICIOUS_PATTERNS.bulletproofRanges) {
      if (ip.startsWith(range)) {
        indicators.push({ type: 'bulletproof_hosting', message: `IP ${ip} in suspicious range` })
        riskScore += 20
        break
      }
    }
  }

  // No MX records but has A record (potential C2)
  if (records.a.length > 0 && records.mx.length === 0) {
    indicators.push({ type: 'no_mx', message: 'No MX records (not a mail domain)' })
    // Not inherently suspicious, but worth noting
  }

  // Check TXT for SPF/DMARC (legitimate domains usually have these)
  const hasSPF = records.txt.some(t => t.includes('spf'))
  const hasDMARC = records.txt.some(t => t.includes('dmarc'))
  if (!hasSPF && !hasDMARC && records.txt.length > 0) {
    indicators.push({ type: 'no_email_security', message: 'No SPF/DMARC records' })
  }

  // Check for CNAME chains (can indicate CDN or traffic distribution)
  if (records.cname.length > 0) {
    indicators.push({ type: 'cname_redirect', message: `CNAME to: ${records.cname[0]}` })
  }

  return {
    indicators,
    riskScore: Math.min(100, riskScore),
    verdict: riskScore >= 40 ? 'suspicious' : riskScore >= 20 ? 'caution' : 'normal',
  }
}

/**
 * Analyze IP address
 */
function analyzeIp(ip, hostnames) {
  const indicators = []
  let riskScore = 0

  // Check for bulletproof hosting
  for (const range of SUSPICIOUS_PATTERNS.bulletproofRanges) {
    if (ip.startsWith(range)) {
      indicators.push({ type: 'bulletproof_hosting', message: 'IP in known bulletproof hosting range' })
      riskScore += 30
      break
    }
  }

  // No reverse DNS
  if (hostnames.length === 0) {
    indicators.push({ type: 'no_rdns', message: 'No reverse DNS record' })
    riskScore += 10
  }

  // Multiple reverse DNS entries
  if (hostnames.length > 5) {
    indicators.push({ type: 'many_rdns', message: `${hostnames.length} reverse DNS entries` })
    riskScore += 15
  }

  // Check for suspicious TLDs in reverse DNS
  for (const hostname of hostnames) {
    for (const tld of SUSPICIOUS_PATTERNS.suspiciousTlds) {
      if (hostname.endsWith(tld)) {
        indicators.push({ type: 'suspicious_rdns_tld', message: `rDNS has suspicious TLD: ${hostname}` })
        riskScore += 15
        break
      }
    }
  }

  return {
    indicators,
    riskScore: Math.min(100, riskScore),
    verdict: riskScore >= 40 ? 'suspicious' : riskScore >= 20 ? 'caution' : 'normal',
  }
}

/**
 * Enrich a domain IOC
 */
async function enrichDomain(domain) {
  console.log(`  DNS lookup: ${domain}`)

  const records = await getDomainRecords(domain)
  const analysis = analyzeDnsRecords(domain, records)

  return {
    pdns: {
      checked_at: new Date().toISOString(),
      has_records: records.a.length > 0 || records.aaaa.length > 0,
      records: {
        a: records.a,
        aaaa: records.aaaa,
        mx: records.mx.map(r => ({ priority: r.priority, exchange: r.exchange })),
        ns: records.ns,
        txt: records.txt.slice(0, 10), // Limit TXT records
        cname: records.cname,
      },
      ip_count: records.a.length + records.aaaa.length,
      indicators: analysis.indicators,
      risk_score: analysis.riskScore,
      verdict: analysis.verdict,
    },
  }
}

/**
 * Enrich an IP IOC
 */
async function enrichIP(ip) {
  console.log(`  Reverse DNS: ${ip}`)

  const hostnames = await getReverseDns(ip)
  const analysis = analyzeIp(ip, hostnames)

  return {
    pdns: {
      checked_at: new Date().toISOString(),
      reverse_dns: hostnames,
      hostname_count: hostnames.length,
      indicators: analysis.indicators,
      risk_score: analysis.riskScore,
      verdict: analysis.verdict,
    },
  }
}

/**
 * Main enrichment function
 */
async function enrichIOCs(limit = 100) {
  console.log('Starting Passive DNS enrichment...')

  // Fetch IOCs that haven't been pDNS-enriched recently
  const { data: iocs, error: fetchError } = await supabase
    .from('iocs')
    .select('id, value, type, metadata')
    .in('type', ['domain', 'ip', 'ipv4', 'ipv6'])
    .or('metadata->pdns.is.null,metadata->pdns->checked_at.lt.' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(limit)

  if (fetchError) {
    console.error('Error fetching IOCs:', fetchError)
    return
  }

  console.log(`Found ${iocs?.length || 0} IOCs to enrich`)

  let enriched = 0
  let errors = 0

  for (const ioc of iocs || []) {
    try {
      let enrichment

      if (ioc.type === 'domain') {
        // Clean domain
        const domain = ioc.value
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
          .replace(/:\d+$/, '')
          .toLowerCase()
          .trim()

        if (!domain || domain.includes('/')) {
          console.log(`Skipping invalid domain: ${ioc.value}`)
          continue
        }

        enrichment = await enrichDomain(domain)
      } else {
        // IP address
        enrichment = await enrichIP(ioc.value)
      }

      // Merge with existing metadata
      const metadata = {
        ...(ioc.metadata || {}),
        ...enrichment,
        enriched: true,
        enriched_at: new Date().toISOString(),
      }

      // Update IOC
      const { error: updateError } = await supabase
        .from('iocs')
        .update({ metadata })
        .eq('id', ioc.id)

      if (updateError) {
        console.error(`Error updating ${ioc.value}:`, updateError)
        errors++
      } else {
        enriched++

        // Log findings
        const verdict = enrichment.pdns?.verdict
        if (verdict === 'suspicious') {
          console.log(`  ⚠️  SUSPICIOUS (score: ${enrichment.pdns.risk_score})`)
          enrichment.pdns.indicators?.forEach(ind => {
            console.log(`      - ${ind.type}: ${ind.message}`)
          })
        } else if (verdict === 'caution') {
          console.log(`  ⚡ Caution (score: ${enrichment.pdns.risk_score})`)
        } else {
          console.log(`  ✓ Normal`)
        }
      }

      // Rate limit (be nice to DNS servers)
      await new Promise(r => setTimeout(r, 200))

    } catch (error) {
      console.error(`Error enriching ${ioc.value}:`, error.message)
      errors++
    }
  }

  console.log(`\nEnrichment complete: ${enriched} enriched, ${errors} errors`)
}

// Run
const limit = parseInt(process.argv[2]) || 100
enrichIOCs(limit).catch(console.error)
