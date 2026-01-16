#!/usr/bin/env node
/**
 * SSL Certificate Enrichment Script
 * Enriches domain IOCs with SSL certificate data
 */

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import tls from 'tls'
import dns from 'dns'
import { promisify } from 'util'

const dnsResolve = promisify(dns.resolve)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Suspicious certificate indicators
const SUSPICIOUS_ISSUERS = [
  'Let\'s Encrypt', // Not inherently suspicious but often used by malware
  'cPanel', // Free certs, commonly abused
  'Cloudflare',
  'ZeroSSL',
]

const SUSPICIOUS_PATTERNS = {
  shortValidity: 30, // Days - very short validity can indicate automation
  selfSigned: true,
  wildcardCert: true,
  mismatchedDomain: true,
  expiredCert: true,
  futureCert: true, // Not yet valid
}

/**
 * Get SSL certificate for a domain
 */
async function getSSLCertificate(domain, port = 443, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const options = {
      host: domain,
      port,
      servername: domain,
      rejectUnauthorized: false, // We want to see all certs, even invalid ones
    }

    const socket = tls.connect(options, () => {
      try {
        const cert = socket.getPeerCertificate(true)
        socket.end()
        resolve(cert)
      } catch (error) {
        socket.end()
        reject(error)
      }
    })

    socket.setTimeout(timeout)

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Connection timeout'))
    })

    socket.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Parse certificate subject/issuer fields
 */
function parseDistinguishedName(dn) {
  if (!dn) return {}

  const result = {}
  const fields = ['CN', 'O', 'OU', 'L', 'ST', 'C']

  for (const field of fields) {
    if (dn[field]) {
      result[field.toLowerCase()] = dn[field]
    }
  }

  return result
}

/**
 * Analyze SSL certificate for suspicious indicators
 */
function analyzeCertificate(cert, domain) {
  const indicators = []
  let riskScore = 0

  if (!cert || !cert.subject) {
    return { indicators: [{ type: 'no_cert', message: 'No SSL certificate found' }], riskScore: 50 }
  }

  const now = new Date()
  const validFrom = new Date(cert.valid_from)
  const validTo = new Date(cert.valid_to)

  // Check if self-signed
  const isSelfSigned = JSON.stringify(cert.subject) === JSON.stringify(cert.issuer)
  if (isSelfSigned) {
    indicators.push({ type: 'self_signed', message: 'Self-signed certificate' })
    riskScore += 30
  }

  // Check if expired
  if (validTo < now) {
    indicators.push({ type: 'expired', message: `Certificate expired on ${validTo.toISOString()}` })
    riskScore += 40
  }

  // Check if not yet valid
  if (validFrom > now) {
    indicators.push({ type: 'future_cert', message: `Certificate not valid until ${validFrom.toISOString()}` })
    riskScore += 50
  }

  // Check validity period
  const validityDays = Math.floor((validTo - validFrom) / (1000 * 60 * 60 * 24))
  if (validityDays < 30) {
    indicators.push({ type: 'short_validity', message: `Very short validity period: ${validityDays} days` })
    riskScore += 20
  }

  // Check for wildcard certificates
  const cn = cert.subject?.CN || ''
  if (cn.startsWith('*')) {
    indicators.push({ type: 'wildcard', message: 'Wildcard certificate' })
    riskScore += 5
  }

  // Check for domain mismatch
  const altNames = cert.subjectaltname?.split(', ').map(s => s.replace('DNS:', '')) || []
  const allNames = [cn, ...altNames]

  const domainMatches = allNames.some(name => {
    if (name.startsWith('*.')) {
      // Wildcard match
      const baseDomain = name.slice(2)
      return domain.endsWith(baseDomain)
    }
    return name.toLowerCase() === domain.toLowerCase()
  })

  if (!domainMatches) {
    indicators.push({ type: 'domain_mismatch', message: 'Domain not in certificate' })
    riskScore += 35
  }

  // Check issuer
  const issuerOrg = cert.issuer?.O || ''
  const issuerCN = cert.issuer?.CN || ''
  const issuerStr = `${issuerOrg} ${issuerCN}`.toLowerCase()

  // Free cert issuers (not necessarily suspicious, but worth noting)
  for (const suspiciousIssuer of SUSPICIOUS_ISSUERS) {
    if (issuerStr.includes(suspiciousIssuer.toLowerCase())) {
      indicators.push({ type: 'free_cert', message: `Certificate from ${suspiciousIssuer}` })
      // Don't add to risk score - free certs aren't inherently bad
      break
    }
  }

  // Check for certificate age (very new certs can be suspicious)
  const certAgeDays = Math.floor((now - validFrom) / (1000 * 60 * 60 * 24))
  if (certAgeDays < 7) {
    indicators.push({ type: 'very_new', message: `Certificate only ${certAgeDays} days old` })
    riskScore += 10
  }

  // Check for unusual fingerprint patterns (simplified)
  const fingerprintLength = cert.fingerprint256?.length || 0
  if (fingerprintLength === 0) {
    indicators.push({ type: 'no_fingerprint', message: 'No certificate fingerprint' })
    riskScore += 20
  }

  return {
    indicators,
    riskScore: Math.min(100, riskScore),
  }
}

/**
 * Enrich a single domain with SSL data
 */
async function enrichDomain(domain) {
  const enrichment = {
    ssl: {
      checked_at: new Date().toISOString(),
      has_ssl: false,
    },
  }

  try {
    // First check if domain resolves
    try {
      await dnsResolve(domain)
    } catch (dnsError) {
      enrichment.ssl.error = 'Domain does not resolve'
      enrichment.ssl.dns_error = true
      return enrichment
    }

    // Get SSL certificate
    const cert = await getSSLCertificate(domain)

    if (!cert || !cert.subject) {
      enrichment.ssl.has_ssl = false
      enrichment.ssl.error = 'No SSL certificate'
      return enrichment
    }

    enrichment.ssl.has_ssl = true

    // Parse certificate details
    enrichment.ssl.subject = parseDistinguishedName(cert.subject)
    enrichment.ssl.issuer = parseDistinguishedName(cert.issuer)
    enrichment.ssl.valid_from = cert.valid_from
    enrichment.ssl.valid_to = cert.valid_to
    enrichment.ssl.fingerprint = cert.fingerprint256
    enrichment.ssl.serial_number = cert.serialNumber
    enrichment.ssl.alt_names = cert.subjectaltname?.split(', ').map(s => s.replace('DNS:', '')) || []

    // Calculate validity days
    const validFrom = new Date(cert.valid_from)
    const validTo = new Date(cert.valid_to)
    enrichment.ssl.validity_days = Math.floor((validTo - validFrom) / (1000 * 60 * 60 * 24))

    // Check if currently valid
    const now = new Date()
    enrichment.ssl.is_valid = now >= validFrom && now <= validTo

    // Analyze for suspicious indicators
    const analysis = analyzeCertificate(cert, domain)
    enrichment.ssl.indicators = analysis.indicators
    enrichment.ssl.risk_score = analysis.riskScore

    // Determine overall verdict
    if (analysis.riskScore >= 50) {
      enrichment.ssl.verdict = 'suspicious'
    } else if (analysis.riskScore >= 20) {
      enrichment.ssl.verdict = 'caution'
    } else {
      enrichment.ssl.verdict = 'normal'
    }

  } catch (error) {
    enrichment.ssl.error = error.message
    enrichment.ssl.has_ssl = false

    if (error.code === 'ECONNREFUSED') {
      enrichment.ssl.error = 'Connection refused (no HTTPS)'
    } else if (error.code === 'ENOTFOUND') {
      enrichment.ssl.error = 'Domain not found'
    } else if (error.message === 'Connection timeout') {
      enrichment.ssl.error = 'Connection timeout'
    }
  }

  return enrichment
}

/**
 * Main enrichment function
 */
async function enrichIOCs(limit = 100) {
  console.log('Starting SSL certificate enrichment...')

  // Fetch domain IOCs that haven't been SSL-enriched recently
  const { data: iocs, error: fetchError } = await supabase
    .from('iocs')
    .select('id, value, type, metadata')
    .eq('type', 'domain')
    .or('metadata->ssl.is.null,metadata->ssl->checked_at.lt.' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(limit)

  if (fetchError) {
    console.error('Error fetching IOCs:', fetchError)
    return
  }

  console.log(`Found ${iocs?.length || 0} domains to enrich`)

  let enriched = 0
  let errors = 0

  for (const ioc of iocs || []) {
    try {
      // Clean domain value
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

      console.log(`Enriching: ${domain}`)

      const enrichment = await enrichDomain(domain)

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
        console.error(`Error updating ${domain}:`, updateError)
        errors++
      } else {
        enriched++

        // Log suspicious findings
        if (enrichment.ssl?.risk_score >= 30) {
          console.log(`  ⚠️  Suspicious: score=${enrichment.ssl.risk_score}`)
          enrichment.ssl.indicators?.forEach(ind => {
            console.log(`      - ${ind.type}: ${ind.message}`)
          })
        } else if (enrichment.ssl?.has_ssl) {
          console.log(`  ✓ Valid SSL from ${enrichment.ssl.issuer?.o || 'unknown issuer'}`)
        } else {
          console.log(`  ✗ No SSL: ${enrichment.ssl?.error || 'unknown error'}`)
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 500))

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
