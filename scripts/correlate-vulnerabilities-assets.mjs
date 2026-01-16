#!/usr/bin/env node

/**
 * Vulnerability-to-Asset Correlation Script
 *
 * Correlates vulnerabilities with organizational assets based on:
 * - Technology stack (software, versions)
 * - Vendor products
 * - CPE matching
 *
 * Usage:
 *   npm run correlate:vuln-assets [--dry-run] [--cve CVE-2024-1234]
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const specificCve = args.find((a) => a.startsWith('--cve='))?.split('=')[1]

// ============================================
// CONSTANTS
// ============================================

// Common vendor to product mappings for matching
const VENDOR_PRODUCTS = {
  microsoft: [
    'windows',
    'office',
    'exchange',
    'sharepoint',
    'azure',
    'sql server',
    'iis',
    '.net',
    'outlook',
    'teams',
  ],
  cisco: ['ios', 'asa', 'webex', 'anyconnect', 'meraki', 'umbrella', 'firepower'],
  apache: ['httpd', 'tomcat', 'struts', 'kafka', 'spark', 'cassandra', 'hadoop'],
  oracle: ['database', 'java', 'weblogic', 'mysql', 'virtualbox'],
  vmware: ['vsphere', 'vcenter', 'esxi', 'horizon', 'workstation', 'nsx'],
  fortinet: ['fortigate', 'fortimanager', 'fortianalyzer', 'fortios', 'forticlient'],
  paloalto: ['pan-os', 'cortex', 'prisma', 'globalprotect'],
  juniper: ['junos', 'srx', 'ex', 'qfx', 'mx'],
  citrix: ['netscaler', 'xenapp', 'xendesktop', 'adc', 'gateway'],
  f5: ['big-ip', 'nginx', 'f5os'],
  adobe: ['acrobat', 'reader', 'flash', 'coldfusion', 'photoshop'],
  sap: ['s/4hana', 'businessobjects', 'netweaver', 'hana'],
  linux: ['ubuntu', 'debian', 'redhat', 'rhel', 'centos', 'kernel'],
  google: ['chrome', 'android', 'workspace', 'cloud'],
  amazon: ['aws', 'ec2', 's3', 'lambda', 'rds'],
}

// CPE component extractors
function extractCPEVendor(cpe) {
  if (!cpe) return null
  const parts = cpe.split(':')
  return parts[3] || null
}

function extractCPEProduct(cpe) {
  if (!cpe) return null
  const parts = cpe.split(':')
  return parts[4] || null
}

function extractCPEVersion(cpe) {
  if (!cpe) return null
  const parts = cpe.split(':')
  return parts[5] || null
}

// ============================================
// MATCHING FUNCTIONS
// ============================================

/**
 * Check if an asset's technology matches a vulnerability
 */
function matchesVulnerability(asset, vulnerability) {
  const matches = []

  // Get vulnerability products/vendors
  const vulnProducts = vulnerability.affected_products || []
  const vulnVendor = vulnerability.vendor_project?.toLowerCase()
  const vulnProduct = vulnerability.product_name?.toLowerCase()
  const vulnCpes = vulnerability.cpes || []

  // Get asset technologies
  const assetTech = (asset.technology_stack || []).map((t) => t.toLowerCase())
  const assetVendors = (asset.vendors || []).map((v) => v.toLowerCase())
  const assetDescription = (asset.description || '').toLowerCase()
  const assetName = (asset.name || '').toLowerCase()

  // Match by vendor
  if (vulnVendor) {
    if (assetVendors.includes(vulnVendor)) {
      matches.push({ type: 'vendor', value: vulnVendor, confidence: 0.7 })
    }
    // Check if asset tech includes vendor products
    const vendorProds = VENDOR_PRODUCTS[vulnVendor] || []
    vendorProds.forEach((prod) => {
      if (assetTech.some((t) => t.includes(prod)) || assetDescription.includes(prod)) {
        matches.push({ type: 'vendor_product', value: `${vulnVendor}:${prod}`, confidence: 0.6 })
      }
    })
  }

  // Match by product name
  if (vulnProduct) {
    if (assetTech.some((t) => t.includes(vulnProduct))) {
      matches.push({ type: 'product', value: vulnProduct, confidence: 0.8 })
    }
    if (assetDescription.includes(vulnProduct) || assetName.includes(vulnProduct)) {
      matches.push({ type: 'product_description', value: vulnProduct, confidence: 0.5 })
    }
  }

  // Match by CPE
  vulnCpes.forEach((cpe) => {
    const cpeVendor = extractCPEVendor(cpe)
    const cpeProduct = extractCPEProduct(cpe)

    if (cpeVendor && assetVendors.includes(cpeVendor.toLowerCase())) {
      matches.push({ type: 'cpe_vendor', value: cpeVendor, confidence: 0.7 })
    }
    if (cpeProduct && assetTech.some((t) => t.includes(cpeProduct.toLowerCase()))) {
      matches.push({ type: 'cpe_product', value: cpeProduct, confidence: 0.9 })
    }
  })

  // Match by affected products array
  vulnProducts.forEach((prod) => {
    const prodLower = prod.toLowerCase()
    if (assetTech.some((t) => t.includes(prodLower))) {
      matches.push({ type: 'affected_product', value: prod, confidence: 0.85 })
    }
  })

  return matches
}

/**
 * Calculate overall correlation score
 */
function calculateCorrelationScore(matches) {
  if (matches.length === 0) return 0

  // Use max confidence + bonus for multiple matches
  const maxConfidence = Math.max(...matches.map((m) => m.confidence))
  const multiMatchBonus = Math.min(0.15, (matches.length - 1) * 0.05)

  return Math.min(1, maxConfidence + multiMatchBonus)
}

// ============================================
// MAIN CORRELATION FUNCTION
// ============================================

async function correlateVulnerabilitiesWithAssets() {
  console.log('🔗 Starting vulnerability-to-asset correlation...')
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

  // Fetch assets
  console.log('\n📦 Fetching assets...')
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .eq('status', 'active')

  if (assetsError) {
    console.error('Error fetching assets:', assetsError)
    return
  }

  console.log(`   Found ${assets.length} active assets`)

  if (assets.length === 0) {
    console.log('   No assets to correlate. Add assets via the Assets page.')
    return
  }

  // Fetch vulnerabilities
  console.log('\n🔍 Fetching vulnerabilities...')

  let vulnQuery = supabase
    .from('vulnerabilities')
    .select('*')
    .order('published_date', { ascending: false })

  if (specificCve) {
    vulnQuery = vulnQuery.eq('cve_id', specificCve)
  } else {
    // Only recent vulnerabilities (last 90 days) for performance
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    vulnQuery = vulnQuery.gte('published_date', ninetyDaysAgo.toISOString())
  }

  const { data: vulnerabilities, error: vulnError } = await vulnQuery

  if (vulnError) {
    console.error('Error fetching vulnerabilities:', vulnError)
    return
  }

  console.log(`   Found ${vulnerabilities.length} vulnerabilities to check`)

  // Perform correlations
  console.log('\n🔗 Correlating vulnerabilities with assets...')

  const correlations = []
  let processedCount = 0

  for (const vuln of vulnerabilities) {
    for (const asset of assets) {
      const matches = matchesVulnerability(asset, vuln)

      if (matches.length > 0) {
        const score = calculateCorrelationScore(matches)

        if (score >= 0.5) {
          // Only significant correlations
          correlations.push({
            asset_id: asset.id,
            asset_name: asset.name,
            vulnerability_id: vuln.id,
            cve_id: vuln.cve_id,
            severity: vuln.severity,
            cvss_score: vuln.cvss_score,
            correlation_score: score,
            match_reasons: matches,
            is_kev: vuln.is_kev || false,
            has_exploit: vuln.has_public_exploit || false,
          })
        }
      }
    }

    processedCount++
    if (processedCount % 100 === 0) {
      process.stdout.write(`\r   Processed ${processedCount}/${vulnerabilities.length} vulnerabilities`)
    }
  }

  console.log(`\n\n✅ Found ${correlations.length} correlations`)

  // Group by asset for summary
  const byAsset = {}
  correlations.forEach((c) => {
    if (!byAsset[c.asset_id]) {
      byAsset[c.asset_id] = {
        asset_name: c.asset_name,
        vulnerabilities: [],
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        kev: 0,
        exploitable: 0,
      }
    }
    byAsset[c.asset_id].vulnerabilities.push(c)
    byAsset[c.asset_id][c.severity?.toLowerCase() || 'low']++
    if (c.is_kev) byAsset[c.asset_id].kev++
    if (c.has_exploit) byAsset[c.asset_id].exploitable++
  })

  // Print summary
  console.log('\n📊 Summary by Asset:')
  console.log('─'.repeat(80))

  Object.values(byAsset)
    .sort((a, b) => b.critical + b.high - (a.critical + a.high))
    .forEach((asset) => {
      console.log(`\n   ${asset.asset_name}`)
      console.log(
        `     Critical: ${asset.critical} | High: ${asset.high} | Medium: ${asset.medium} | Low: ${asset.low}`
      )
      console.log(`     KEV: ${asset.kev} | Exploitable: ${asset.exploitable}`)

      // Show top vulnerabilities
      const top = asset.vulnerabilities.sort((a, b) => b.cvss_score - a.cvss_score).slice(0, 3)
      top.forEach((v) => {
        console.log(
          `       - ${v.cve_id} (CVSS ${v.cvss_score}) [${v.match_reasons.map((r) => r.type).join(', ')}]`
        )
      })
    })

  // Store correlations in database
  if (!dryRun && correlations.length > 0) {
    console.log('\n💾 Storing correlations...')

    // Create or get vulnerability_asset_correlations table
    // For now, store in asset_vulnerabilities table or custom table
    const records = correlations.map((c) => ({
      asset_id: c.asset_id,
      vulnerability_id: c.vulnerability_id,
      correlation_score: c.correlation_score,
      match_reasons: c.match_reasons,
      discovered_at: new Date().toISOString(),
    }))

    // Upsert correlations
    const { error: insertError } = await supabase
      .from('asset_vulnerability_correlations')
      .upsert(records, {
        onConflict: 'asset_id,vulnerability_id',
        ignoreDuplicates: false,
      })

    if (insertError) {
      // Table might not exist, create it
      if (insertError.code === '42P01') {
        console.log('   Note: asset_vulnerability_correlations table not found. Skipping storage.')
        console.log('   Run migration 045_vulnerability_asset_correlation.sql to enable storage.')
      } else {
        console.error('Error storing correlations:', insertError)
      }
    } else {
      console.log(`   Stored ${records.length} correlations`)
    }

    // Update asset exposure scores
    console.log('\n📈 Updating asset exposure scores...')

    for (const [assetId, assetData] of Object.entries(byAsset)) {
      const exposureScore = calculateExposureScore(assetData)

      const { error: updateError } = await supabase
        .from('assets')
        .update({
          exposure_score: exposureScore,
          vulnerability_count: assetData.vulnerabilities.length,
          critical_vuln_count: assetData.critical,
          high_vuln_count: assetData.high,
          last_vuln_scan: new Date().toISOString(),
        })
        .eq('id', assetId)

      if (updateError && updateError.code !== '42703') {
        // Ignore column not found
        console.error(`Error updating asset ${assetId}:`, updateError)
      }
    }

    console.log('   Asset exposure scores updated')

    // Queue alerts for critical findings
    const criticalFindings = correlations.filter(
      (c) => (c.severity === 'CRITICAL' || c.severity === 'HIGH') && (c.is_kev || c.has_exploit)
    )

    if (criticalFindings.length > 0) {
      console.log(`\n🚨 Queueing ${criticalFindings.length} critical alerts...`)

      for (const finding of criticalFindings.slice(0, 10)) {
        // Limit to 10 alerts
        const { error: alertError } = await supabase.from('alert_queue').insert({
          event_type: 'vulnerability.asset_match',
          event_id: `${finding.asset_id}_${finding.vulnerability_id}`,
          severity: finding.severity?.toLowerCase() || 'high',
          title: `Critical vulnerability affects ${finding.asset_name}`,
          message: `${finding.cve_id} (CVSS ${finding.cvss_score}) affects your asset "${finding.asset_name}". ${finding.is_kev ? 'This vulnerability is in CISA KEV.' : ''} ${finding.has_exploit ? 'Public exploit available.' : ''}`,
          metadata: {
            asset_id: finding.asset_id,
            asset_name: finding.asset_name,
            cve_id: finding.cve_id,
            cvss_score: finding.cvss_score,
            is_kev: finding.is_kev,
            has_exploit: finding.has_exploit,
          },
        })

        if (alertError && alertError.code !== '23505') {
          // Ignore duplicates
          console.error('Error queueing alert:', alertError)
        }
      }

      console.log('   Alerts queued')
    }
  }

  console.log('\n✅ Vulnerability-to-asset correlation complete!')

  return {
    correlationsFound: correlations.length,
    assetsAffected: Object.keys(byAsset).length,
    criticalFindings: correlations.filter((c) => c.severity === 'CRITICAL').length,
    kevFindings: correlations.filter((c) => c.is_kev).length,
  }
}

/**
 * Calculate exposure score for an asset based on vulnerabilities
 */
function calculateExposureScore(assetData) {
  // Weighted scoring
  const weights = {
    critical: 40,
    high: 25,
    medium: 10,
    low: 3,
    kev: 30, // Additional weight for KEV
    exploitable: 20, // Additional weight for public exploits
  }

  let score =
    assetData.critical * weights.critical +
    assetData.high * weights.high +
    assetData.medium * weights.medium +
    assetData.low * weights.low +
    assetData.kev * weights.kev +
    assetData.exploitable * weights.exploitable

  // Normalize to 0-100 scale
  return Math.min(100, Math.round(score))
}

// Run correlation
correlateVulnerabilitiesWithAssets()
  .then((result) => {
    if (result) {
      console.log('\n📋 Final Statistics:')
      console.log(`   Total correlations: ${result.correlationsFound}`)
      console.log(`   Assets affected: ${result.assetsAffected}`)
      console.log(`   Critical findings: ${result.criticalFindings}`)
      console.log(`   KEV findings: ${result.kevFindings}`)
    }
  })
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
