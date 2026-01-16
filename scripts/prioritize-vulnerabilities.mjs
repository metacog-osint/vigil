// Vulnerability Prioritization Calculator
// Calculates risk-based priority scores using EPSS, CVSS, KEV, exploits
// Run: node scripts/prioritize-vulnerabilities.mjs

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Priority weights (total = 100)
const WEIGHTS = {
  epss: 35,           // EPSS probability (35%)
  cvss: 20,           // CVSS base score (20%)
  kev: 20,            // CISA KEV status (20%)
  exploit: 15,        // Public exploit availability (15%)
  recency: 10,        // How recent the CVE is (10%)
}

// EPSS thresholds for scoring
const EPSS_THRESHOLDS = {
  critical: 0.7,  // 70%+ exploitation probability
  high: 0.4,      // 40-70%
  medium: 0.1,    // 10-40%
  low: 0.01,      // 1-10%
  minimal: 0,     // <1%
}

function calculatePriorityScore(vuln) {
  let score = 0
  const factors = []

  // 1. EPSS Score (0-35 points)
  if (vuln.epss_score !== null && vuln.epss_score !== undefined) {
    const epssPoints = Math.min(vuln.epss_score * 50, WEIGHTS.epss) // Cap at 35
    score += epssPoints
    factors.push({
      factor: 'EPSS',
      value: vuln.epss_score,
      points: Math.round(epssPoints * 10) / 10,
      detail: `${(vuln.epss_score * 100).toFixed(1)}% exploitation probability`,
    })
  }

  // 2. CVSS Score (0-20 points)
  if (vuln.cvss_score) {
    const cvssPoints = (vuln.cvss_score / 10) * WEIGHTS.cvss
    score += cvssPoints
    factors.push({
      factor: 'CVSS',
      value: vuln.cvss_score,
      points: Math.round(cvssPoints * 10) / 10,
      detail: `Base score ${vuln.cvss_score}`,
    })
  }

  // 3. CISA KEV Status (0 or 20 points)
  if (vuln.is_kev || vuln.in_kev) {
    score += WEIGHTS.kev
    factors.push({
      factor: 'KEV',
      value: true,
      points: WEIGHTS.kev,
      detail: 'In CISA Known Exploited Vulnerabilities',
    })
  }

  // 4. Public Exploit Availability (0-15 points)
  if (vuln.has_public_exploit || vuln.exploit_count > 0) {
    const exploitCount = vuln.exploit_count || 1
    const exploitPoints = Math.min(5 + (exploitCount * 2), WEIGHTS.exploit)
    score += exploitPoints
    factors.push({
      factor: 'Exploit',
      value: exploitCount,
      points: Math.round(exploitPoints * 10) / 10,
      detail: `${exploitCount} public exploit(s) available`,
    })
  }

  // 5. Recency (0-10 points)
  if (vuln.published_date || vuln.published_at) {
    const pubDate = new Date(vuln.published_date || vuln.published_at)
    const ageInDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24)

    let recencyPoints = 0
    if (ageInDays <= 7) {
      recencyPoints = WEIGHTS.recency // Last 7 days - full points
    } else if (ageInDays <= 30) {
      recencyPoints = WEIGHTS.recency * 0.8 // Last month
    } else if (ageInDays <= 90) {
      recencyPoints = WEIGHTS.recency * 0.5 // Last quarter
    } else if (ageInDays <= 365) {
      recencyPoints = WEIGHTS.recency * 0.2 // Last year
    }

    if (recencyPoints > 0) {
      score += recencyPoints
      factors.push({
        factor: 'Recency',
        value: Math.round(ageInDays),
        points: Math.round(recencyPoints * 10) / 10,
        detail: `Published ${Math.round(ageInDays)} days ago`,
      })
    }
  }

  // Determine priority level
  let priorityLevel
  if (score >= 70) {
    priorityLevel = 'critical'
  } else if (score >= 50) {
    priorityLevel = 'high'
  } else if (score >= 30) {
    priorityLevel = 'medium'
  } else if (score >= 15) {
    priorityLevel = 'low'
  } else {
    priorityLevel = 'info'
  }

  return {
    score: Math.round(score * 10) / 10,
    priority_level: priorityLevel,
    factors,
  }
}

async function prioritizeVulnerabilities(options = {}) {
  const {
    limit = 1000,
    recalculateAll = false,
    minEpss = 0,
  } = options

  console.log('=== Vulnerability Prioritization ===')
  console.log(`Weights: EPSS=${WEIGHTS.epss}%, CVSS=${WEIGHTS.cvss}%, KEV=${WEIGHTS.kev}%, Exploit=${WEIGHTS.exploit}%, Recency=${WEIGHTS.recency}%`)
  console.log('')

  // Fetch vulnerabilities
  let query = supabase
    .from('vulnerabilities')
    .select('cve_id, cvss_score, epss_score, epss_percentile, is_kev, in_kev, has_public_exploit, exploit_count, published_date, published_at')
    .order('epss_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (!recalculateAll) {
    query = query.or('priority_score.is.null,priority_score.eq.0')
  }

  if (minEpss > 0) {
    query = query.gte('epss_score', minEpss)
  }

  const { data: vulns, error } = await query

  if (error) {
    console.error('Error fetching vulnerabilities:', error)
    return
  }

  console.log(`Processing ${vulns.length} vulnerabilities`)

  let updated = 0
  let failed = 0
  const distribution = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

  // Process in batches
  const batchSize = 100
  for (let i = 0; i < vulns.length; i += batchSize) {
    const batch = vulns.slice(i, i + batchSize)

    for (const vuln of batch) {
      const priority = calculatePriorityScore(vuln)
      distribution[priority.priority_level]++

      const { error: updateError } = await supabase
        .from('vulnerabilities')
        .update({
          priority_score: priority.score,
          priority_level: priority.priority_level,
          priority_factors: priority.factors,
          priority_calculated_at: new Date().toISOString(),
        })
        .eq('cve_id', vuln.cve_id)

      if (updateError) {
        failed++
      } else {
        updated++
      }
    }

    // Progress update
    if ((i + batchSize) % 500 === 0 || i + batchSize >= vulns.length) {
      console.log(`Processed ${Math.min(i + batchSize, vulns.length)}/${vulns.length}...`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Updated: ${updated}`)
  console.log(`Failed: ${failed}`)
  console.log('\nPriority Distribution:')
  console.log(`  Critical: ${distribution.critical}`)
  console.log(`  High: ${distribution.high}`)
  console.log(`  Medium: ${distribution.medium}`)
  console.log(`  Low: ${distribution.low}`)
  console.log(`  Info: ${distribution.info}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'priority_calculator',
    status: 'completed',
    records_processed: vulns.length,
    records_inserted: updated,
    metadata: {
      distribution,
      weights: WEIGHTS,
    },
  })

  return { updated, failed, distribution }
}

async function showTopPriority(limit = 20) {
  console.log(`\n=== Top ${limit} Priority Vulnerabilities ===\n`)

  const { data: vulns, error } = await supabase
    .from('vulnerabilities')
    .select('cve_id, cvss_score, epss_score, priority_score, priority_level, priority_factors, is_kev, has_public_exploit')
    .order('priority_score', { ascending: false })
    .limit(limit)

  if (error || !vulns) {
    console.error('Error fetching vulnerabilities:', error)
    return
  }

  for (const vuln of vulns) {
    const level = vuln.priority_level?.toUpperCase() || 'N/A'
    const score = vuln.priority_score?.toFixed(1) || 'N/A'
    const epss = vuln.epss_score ? `${(vuln.epss_score * 100).toFixed(1)}%` : 'N/A'
    const cvss = vuln.cvss_score?.toFixed(1) || 'N/A'

    console.log(`${vuln.cve_id}`)
    console.log(`  Priority: ${score}/100 (${level})`)
    console.log(`  EPSS: ${epss} | CVSS: ${cvss} | KEV: ${vuln.is_kev ? 'Yes' : 'No'} | Exploit: ${vuln.has_public_exploit ? 'Yes' : 'No'}`)

    if (vuln.priority_factors?.length > 0) {
      const factorSummary = vuln.priority_factors
        .map(f => `${f.factor}:${f.points}`)
        .join(', ')
      console.log(`  Factors: ${factorSummary}`)
    }
    console.log()
  }
}

// Main
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Vulnerability Prioritization Calculator')
  console.log('')
  console.log('Usage: node scripts/prioritize-vulnerabilities.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --all         Recalculate all vulnerabilities')
  console.log('  --limit=N     Process N vulnerabilities (default: 1000)')
  console.log('  --min-epss=N  Only process vulnerabilities with EPSS >= N')
  console.log('  --top         Show top priority vulnerabilities')
  console.log('  --top=N       Show top N priority vulnerabilities')
} else if (args.some(a => a.startsWith('--top'))) {
  const limitArg = args.find(a => a.startsWith('--top='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20
  showTopPriority(limit)
} else {
  const options = {
    recalculateAll: args.includes('--all'),
    limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10),
    minEpss: parseFloat(args.find(a => a.startsWith('--min-epss='))?.split('=')[1] || '0'),
  }
  prioritizeVulnerabilities(options)
}
