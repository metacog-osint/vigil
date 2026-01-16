// Vendor Risk Monitoring
// Checks vendors against breach databases and vulnerability feeds
// Run: node scripts/monitor-vendors.mjs

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Risk score calculation weights
const RISK_WEIGHTS = {
  criticality: { critical: 40, high: 30, medium: 20, low: 10 },
  data_access: { pii: 15, financial: 15, health: 20, proprietary: 10, none: 0 },
  integration_type: { api: 10, sso: 15, network: 20, physical: 5 },
  incidents: { per_breach: 15, per_vulnerability: 5, per_outage: 3 },
  questionnaire: { missing: 10, failed: 20, passed: -5 },
}

async function checkBreaches(vendor) {
  if (!vendor.domain) return []

  // Check if domain appears in any breach data
  const { data: breaches } = await supabase
    .from('breaches')
    .select('*')
    .ilike('domain', `%${vendor.domain}%`)
    .order('breach_date', { ascending: false })
    .limit(10)

  return breaches || []
}

async function checkVulnerabilities(vendor) {
  // Check if vendor's products have known vulnerabilities
  const vendorKeywords = [
    vendor.name?.toLowerCase(),
    vendor.domain?.split('.')[0],
  ].filter(Boolean)

  if (vendorKeywords.length === 0) return []

  const { data: vulns } = await supabase
    .from('vulnerabilities')
    .select('cve_id, description, cvss_score, is_kev, epss_score')
    .or(vendorKeywords.map(k => `description.ilike.%${k}%`).join(','))
    .eq('is_kev', true)
    .order('cvss_score', { ascending: false })
    .limit(10)

  return vulns || []
}

async function getExistingEvents(vendorId) {
  const { data } = await supabase
    .from('vendor_risk_events')
    .select('source_id')
    .eq('vendor_id', vendorId)

  return new Set((data || []).map(i => i.source_id))
}

function calculateRiskScore(vendor, breaches, vulnerabilities) {
  let score = 0
  const factors = []

  // Base score from criticality
  const criticalityScore = RISK_WEIGHTS.criticality[vendor.criticality] || 0
  score += criticalityScore
  if (criticalityScore > 0) {
    factors.push({ factor: 'criticality', value: vendor.criticality, points: criticalityScore })
  }

  // Data access types
  if (vendor.data_access?.length > 0) {
    for (const access of vendor.data_access) {
      const accessScore = RISK_WEIGHTS.data_access[access] || 0
      score += accessScore
      if (accessScore > 0) {
        factors.push({ factor: 'data_access', value: access, points: accessScore })
      }
    }
  }

  // Integration types
  if (vendor.integration_type?.length > 0) {
    for (const integration of vendor.integration_type) {
      const intScore = RISK_WEIGHTS.integration_type[integration] || 0
      score += intScore
      if (intScore > 0) {
        factors.push({ factor: 'integration', value: integration, points: intScore })
      }
    }
  }

  // Breaches (recent ones count more)
  for (const breach of breaches.slice(0, 5)) {
    const breachScore = RISK_WEIGHTS.incidents.per_breach
    score += breachScore
    factors.push({ factor: 'breach', value: breach.name || breach.id, points: breachScore })
  }

  // Critical vulnerabilities
  const criticalVulns = vulnerabilities.filter(v => v.cvss_score >= 9.0)
  const highVulns = vulnerabilities.filter(v => v.cvss_score >= 7.0 && v.cvss_score < 9.0)

  for (const vuln of criticalVulns.slice(0, 3)) {
    score += RISK_WEIGHTS.incidents.per_vulnerability * 2
    factors.push({ factor: 'critical_cve', value: vuln.cve_id, points: RISK_WEIGHTS.incidents.per_vulnerability * 2 })
  }

  for (const vuln of highVulns.slice(0, 3)) {
    score += RISK_WEIGHTS.incidents.per_vulnerability
    factors.push({ factor: 'high_cve', value: vuln.cve_id, points: RISK_WEIGHTS.incidents.per_vulnerability })
  }

  // Cap at 100
  score = Math.min(Math.round(score), 100)

  // Determine risk level
  let riskLevel
  if (score >= 80) riskLevel = 'critical'
  else if (score >= 60) riskLevel = 'high'
  else if (score >= 40) riskLevel = 'medium'
  else if (score >= 20) riskLevel = 'low'
  else riskLevel = 'unknown'

  return { score, riskLevel, factors }
}

async function monitorVendor(vendor) {
  console.log(`\nMonitoring: ${vendor.name}`)
  if (vendor.domain) console.log(`  Domain: ${vendor.domain}`)

  const existingEvents = await getExistingEvents(vendor.id)
  let newEvents = 0

  // Check breaches
  if (vendor.monitor_breaches) {
    const breaches = await checkBreaches(vendor)
    console.log(`  Breaches found: ${breaches.length}`)

    for (const breach of breaches) {
      const sourceId = `breach-${breach.id}`
      if (!existingEvents.has(sourceId)) {
        await supabase.from('vendor_risk_events').insert({
          vendor_id: vendor.id,
          event_type: 'breach',
          title: `Data breach: ${breach.name || breach.title || 'Unknown'}`,
          description: breach.description,
          severity: 'high',
          source: 'hibp',
          source_id: sourceId,
          source_url: breach.source_url,
          event_date: new Date().toISOString(),
        })
        newEvents++
      }
    }
  }

  // Check vulnerabilities
  if (vendor.monitor_vulnerabilities) {
    const vulns = await checkVulnerabilities(vendor)
    console.log(`  Vulnerabilities found: ${vulns.length}`)

    for (const vuln of vulns) {
      const sourceId = vuln.cve_id
      if (!existingEvents.has(sourceId)) {
        const severity = vuln.cvss_score >= 9 ? 'critical' : vuln.cvss_score >= 7 ? 'high' : 'medium'
        await supabase.from('vendor_risk_events').insert({
          vendor_id: vendor.id,
          event_type: 'vulnerability',
          title: `${vuln.cve_id} affects ${vendor.name}`,
          description: vuln.description?.slice(0, 500),
          severity,
          source: 'cve',
          source_id: sourceId,
          source_url: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
          event_date: new Date().toISOString(),
        })
        newEvents++
      }
    }
  }

  console.log(`  New events: ${newEvents}`)

  // Recalculate risk score
  const breaches = vendor.monitor_breaches ? await checkBreaches(vendor) : []
  const vulns = vendor.monitor_vulnerabilities ? await checkVulnerabilities(vendor) : []
  const risk = calculateRiskScore(vendor, breaches, vulns)

  console.log(`  Risk score: ${risk.score}/100 (${risk.riskLevel})`)

  // Update vendor risk assessment
  await supabase
    .from('vendors')
    .update({
      risk_score: risk.score,
      risk_level: risk.riskLevel,
      last_assessment_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', vendor.id)

  return { newEvents, risk }
}

async function monitorAllVendors() {
  console.log('=== Vendor Risk Monitoring ===')
  console.log('')

  // Get active vendors with monitoring enabled
  const { data: vendorList, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('status', 'active')
    .or('monitor_breaches.eq.true,monitor_vulnerabilities.eq.true')

  if (error) {
    console.error('Error fetching vendors:', error)
    return
  }

  if (!vendorList || vendorList.length === 0) {
    console.log('No vendors configured for monitoring')
    return
  }

  console.log(`Monitoring ${vendorList.length} vendors`)

  let totalEvents = 0
  const riskDistribution = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }

  for (const vendor of vendorList) {
    const result = await monitorVendor(vendor)
    totalEvents += result.newEvents
    riskDistribution[result.risk.riskLevel]++
  }

  console.log('\n=== Summary ===')
  console.log(`Vendors monitored: ${vendorList.length}`)
  console.log(`New events found: ${totalEvents}`)
  console.log('\nRisk Distribution:')
  console.log(`  Critical: ${riskDistribution.critical}`)
  console.log(`  High: ${riskDistribution.high}`)
  console.log(`  Medium: ${riskDistribution.medium}`)
  console.log(`  Low: ${riskDistribution.low}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'vendor_monitoring',
    status: 'completed',
    records_processed: vendorList.length,
    records_inserted: totalEvents,
    metadata: {
      risk_distribution: riskDistribution,
    },
  })
}

// Main
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Vendor Risk Monitoring')
  console.log('')
  console.log('Usage: node scripts/monitor-vendors.mjs')
  console.log('')
  console.log('Checks active vendors against breach and vulnerability databases.')
} else {
  monitorAllVendors()
}
