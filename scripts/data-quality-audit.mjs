#!/usr/bin/env node
/**
 * Data Quality Audit Script
 * Analyzes database for data quality issues and generates a report
 *
 * Usage: npm run data-quality
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { supabaseUrl, supabaseKey } from './env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Report sections
const report = {
  timestamp: new Date().toISOString(),
  summary: {},
  issues: [],
  recommendations: []
}

async function countTable(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  return error ? 0 : count
}

async function auditIncidents() {
  console.log('Auditing incidents...')

  const totalCount = await countTable('incidents')
  report.summary.totalIncidents = totalCount

  // Incidents with missing sectors
  const { data: missingSector, error: e1 } = await supabase
    .from('incidents')
    .select('id, victim_name, discovered_date')
    .or('victim_sector.is.null,victim_sector.eq.')
    .limit(10)

  const { count: missingSectorCount } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .or('victim_sector.is.null,victim_sector.eq.')

  if (missingSectorCount > 0) {
    report.issues.push({
      severity: 'medium',
      category: 'incidents',
      issue: 'Incidents with missing sector',
      count: missingSectorCount,
      percentage: ((missingSectorCount / totalCount) * 100).toFixed(2) + '%',
      samples: missingSector?.slice(0, 5).map(i => `${i.victim_name} (${i.discovered_date})`)
    })
  }

  // Incidents with missing actor association
  const { count: missingActorCount } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .is('actor_id', null)

  if (missingActorCount > 0) {
    report.issues.push({
      severity: 'low',
      category: 'incidents',
      issue: 'Incidents without actor association',
      count: missingActorCount,
      percentage: ((missingActorCount / totalCount) * 100).toFixed(2) + '%'
    })
  }

  // Incidents with missing victim name
  const { count: missingNameCount } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .or('victim_name.is.null,victim_name.eq.')

  if (missingNameCount > 0) {
    report.issues.push({
      severity: 'high',
      category: 'incidents',
      issue: 'Incidents with missing victim name',
      count: missingNameCount
    })
  }

  // Old incidents (before 2020)
  const { count: oldIncidentCount } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .lt('discovered_date', '2020-01-01')

  if (oldIncidentCount > 0) {
    report.summary.incidentsBeforeYear2020 = oldIncidentCount
  }

  return { missingSectorCount, missingActorCount }
}

async function auditActors() {
  console.log('Auditing threat actors...')

  const totalCount = await countTable('threat_actors')
  report.summary.totalActors = totalCount

  // Actors with no incidents
  const { data: actorsWithIncidents } = await supabase
    .from('incidents')
    .select('actor_id')
    .not('actor_id', 'is', null)

  const actorIdsWithIncidents = new Set(actorsWithIncidents?.map(i => i.actor_id) || [])

  const { data: allActors } = await supabase
    .from('threat_actors')
    .select('id, name, last_seen')

  const orphanedActors = allActors?.filter(a => !actorIdsWithIncidents.has(a.id)) || []

  if (orphanedActors.length > 0) {
    report.issues.push({
      severity: 'low',
      category: 'actors',
      issue: 'Actors with zero incidents',
      count: orphanedActors.length,
      percentage: ((orphanedActors.length / totalCount) * 100).toFixed(2) + '%',
      note: 'These may be legitimate (APTs, hacktivists) or orphaned records',
      samples: orphanedActors.slice(0, 5).map(a => a.name)
    })
  }

  // Stale actors (not seen in 90+ days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { count: staleActorCount } = await supabase
    .from('threat_actors')
    .select('*', { count: 'exact', head: true })
    .lt('last_seen', ninetyDaysAgo.toISOString().split('T')[0])

  if (staleActorCount > 0) {
    report.summary.staleActors90Days = staleActorCount
  }

  // Actors with missing names
  const { count: missingNameCount } = await supabase
    .from('threat_actors')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,name.eq.')

  if (missingNameCount > 0) {
    report.issues.push({
      severity: 'critical',
      category: 'actors',
      issue: 'Actors with missing name',
      count: missingNameCount
    })
  }

  // Actors by trend status
  const { count: escalatingCount } = await supabase
    .from('threat_actors')
    .select('*', { count: 'exact', head: true })
    .eq('trend_status', 'ESCALATING')

  const { count: decliningCount } = await supabase
    .from('threat_actors')
    .select('*', { count: 'exact', head: true })
    .eq('trend_status', 'DECLINING')

  report.summary.escalatingActors = escalatingCount || 0
  report.summary.decliningActors = decliningCount || 0

  return { orphanedCount: orphanedActors.length }
}

async function auditIOCs() {
  console.log('Auditing IOCs...')

  const totalCount = await countTable('iocs')
  report.summary.totalIOCs = totalCount

  // IOCs by type
  const { data: typeBreakdown } = await supabase
    .from('iocs')
    .select('type')

  const typeCounts = {}
  for (const row of typeBreakdown || []) {
    typeCounts[row.type || 'unknown'] = (typeCounts[row.type || 'unknown'] || 0) + 1
  }
  report.summary.iocsByType = typeCounts

  // Check for potential duplicates (same value, different sources)
  // Do a simple check by sampling IOC values
  {
    const { data: iocValues } = await supabase
      .from('iocs')
      .select('value')
      .limit(10000)

    if (iocValues) {
      const valueCounts = {}
      for (const row of iocValues) {
        valueCounts[row.value] = (valueCounts[row.value] || 0) + 1
      }
      const duplicates = Object.entries(valueCounts).filter(([, count]) => count > 1)
      if (duplicates.length > 0) {
        report.issues.push({
          severity: 'low',
          category: 'iocs',
          issue: 'Potential duplicate IOC values',
          count: duplicates.length,
          note: 'Same IOC value from multiple sources (may be intentional)',
          samples: duplicates.slice(0, 5).map(([value, count]) => `${value} (${count}x)`)
        })
      }
    }
  }

  // IOCs with missing type
  const { count: missingTypeCount } = await supabase
    .from('iocs')
    .select('*', { count: 'exact', head: true })
    .or('type.is.null,type.eq.')

  if (missingTypeCount > 0) {
    report.issues.push({
      severity: 'medium',
      category: 'iocs',
      issue: 'IOCs with missing type',
      count: missingTypeCount
    })
  }

  return {}
}

async function auditVulnerabilities() {
  console.log('Auditing vulnerabilities...')

  const totalCount = await countTable('vulnerabilities')
  report.summary.totalVulnerabilities = totalCount

  // KEV count
  const { count: kevCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .not('kev_date', 'is', null)

  report.summary.kevVulnerabilities = kevCount || 0

  // Vulnerabilities with missing CVSS
  const { count: missingCvssCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .is('cvss_score', null)

  if (missingCvssCount > 0) {
    report.issues.push({
      severity: 'low',
      category: 'vulnerabilities',
      issue: 'Vulnerabilities with missing CVSS score',
      count: missingCvssCount,
      percentage: ((missingCvssCount / totalCount) * 100).toFixed(2) + '%'
    })
  }

  // Critical vulnerabilities count
  const { count: criticalCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .gte('cvss_score', 9.0)

  report.summary.criticalVulnerabilities = criticalCount || 0

  return {}
}

async function auditDataFreshness() {
  console.log('Auditing data freshness...')

  // Check sync_log for recent syncs
  const { data: recentSyncs } = await supabase
    .from('sync_log')
    .select('source, synced_at, records_processed, status')
    .order('synced_at', { ascending: false })
    .limit(20)

  if (recentSyncs && recentSyncs.length > 0) {
    const sourceLastSync = {}
    for (const sync of recentSyncs) {
      if (!sourceLastSync[sync.source]) {
        sourceLastSync[sync.source] = sync
      }
    }
    report.summary.lastSyncBySource = Object.entries(sourceLastSync).map(([source, sync]) => ({
      source,
      lastSync: sync.synced_at,
      status: sync.status,
      records: sync.records_processed
    }))

    // Check for stale sources (not synced in 24+ hours)
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const staleSources = Object.entries(sourceLastSync)
      .filter(([, sync]) => new Date(sync.synced_at) < oneDayAgo)
      .map(([source]) => source)

    if (staleSources.length > 0) {
      report.issues.push({
        severity: 'medium',
        category: 'freshness',
        issue: 'Data sources not synced in 24+ hours',
        count: staleSources.length,
        samples: staleSources
      })
    }
  }

  return {}
}

function generateMarkdownReport() {
  const lines = []

  lines.push('# Data Quality Audit Report')
  lines.push('')
  lines.push(`**Generated:** ${report.timestamp}`)
  lines.push('')

  // Summary
  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Total Incidents | ${report.summary.totalIncidents?.toLocaleString() || 'N/A'} |`)
  lines.push(`| Total Actors | ${report.summary.totalActors?.toLocaleString() || 'N/A'} |`)
  lines.push(`| Total IOCs | ${report.summary.totalIOCs?.toLocaleString() || 'N/A'} |`)
  lines.push(`| Total Vulnerabilities | ${report.summary.totalVulnerabilities?.toLocaleString() || 'N/A'} |`)
  lines.push(`| KEV Vulnerabilities | ${report.summary.kevVulnerabilities?.toLocaleString() || 'N/A'} |`)
  lines.push(`| Critical Vulnerabilities | ${report.summary.criticalVulnerabilities?.toLocaleString() || 'N/A'} |`)
  lines.push(`| Escalating Actors | ${report.summary.escalatingActors?.toLocaleString() || 'N/A'} |`)
  lines.push(`| Declining Actors | ${report.summary.decliningActors?.toLocaleString() || 'N/A'} |`)
  lines.push('')

  // IOCs by type
  if (report.summary.iocsByType) {
    lines.push('### IOCs by Type')
    lines.push('')
    lines.push('| Type | Count |')
    lines.push('|------|-------|')
    for (const [type, count] of Object.entries(report.summary.iocsByType).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${type} | ${count.toLocaleString()} |`)
    }
    lines.push('')
  }

  // Data Freshness
  if (report.summary.lastSyncBySource?.length > 0) {
    lines.push('### Data Source Freshness')
    lines.push('')
    lines.push('| Source | Last Sync | Status | Records |')
    lines.push('|--------|-----------|--------|---------|')
    for (const sync of report.summary.lastSyncBySource) {
      const lastSync = new Date(sync.lastSync)
      const hoursAgo = Math.round((Date.now() - lastSync.getTime()) / (1000 * 60 * 60))
      lines.push(`| ${sync.source} | ${hoursAgo}h ago | ${sync.status} | ${sync.records?.toLocaleString() || '-'} |`)
    }
    lines.push('')
  }

  // Issues
  lines.push('## Issues Found')
  lines.push('')

  if (report.issues.length === 0) {
    lines.push('No significant issues found.')
  } else {
    // Group by severity
    const critical = report.issues.filter(i => i.severity === 'critical')
    const high = report.issues.filter(i => i.severity === 'high')
    const medium = report.issues.filter(i => i.severity === 'medium')
    const low = report.issues.filter(i => i.severity === 'low')

    const formatIssue = (issue) => {
      const lines = []
      lines.push(`### ${issue.issue}`)
      lines.push('')
      lines.push(`- **Category:** ${issue.category}`)
      lines.push(`- **Count:** ${issue.count?.toLocaleString()}`)
      if (issue.percentage) lines.push(`- **Percentage:** ${issue.percentage}`)
      if (issue.note) lines.push(`- **Note:** ${issue.note}`)
      if (issue.samples?.length > 0) {
        lines.push(`- **Samples:**`)
        for (const sample of issue.samples) {
          lines.push(`  - ${sample}`)
        }
      }
      lines.push('')
      return lines
    }

    if (critical.length > 0) {
      lines.push('### Critical')
      lines.push('')
      for (const issue of critical) {
        lines.push(...formatIssue(issue))
      }
    }

    if (high.length > 0) {
      lines.push('### High')
      lines.push('')
      for (const issue of high) {
        lines.push(...formatIssue(issue))
      }
    }

    if (medium.length > 0) {
      lines.push('### Medium')
      lines.push('')
      for (const issue of medium) {
        lines.push(...formatIssue(issue))
      }
    }

    if (low.length > 0) {
      lines.push('### Low')
      lines.push('')
      for (const issue of low) {
        lines.push(...formatIssue(issue))
      }
    }
  }

  // Recommendations
  lines.push('## Recommendations')
  lines.push('')

  if (report.issues.some(i => i.issue.includes('missing sector'))) {
    lines.push('1. **Re-run sector classification** - `npm run reclassify-sectors` to classify incidents with missing sectors')
  }
  if (report.issues.some(i => i.issue.includes('duplicate'))) {
    lines.push('2. **Review duplicate IOCs** - Consider deduplication or adding source tracking')
  }
  if (report.issues.some(i => i.issue.includes('not synced'))) {
    lines.push('3. **Check data ingestion** - Verify GitHub Actions workflows are running')
  }
  if (report.summary.staleActors90Days > 50) {
    lines.push('4. **Archive stale actors** - Consider marking inactive actors as archived')
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Generated by `npm run data-quality`*')

  return lines.join('\n')
}

async function main() {
  console.log('Starting data quality audit...')
  console.log('')

  try {
    await auditIncidents()
    await auditActors()
    await auditIOCs()
    await auditVulnerabilities()
    await auditDataFreshness()

    const markdown = generateMarkdownReport()
    const outputPath = join(__dirname, '..', 'DATA_QUALITY_REPORT.md')
    writeFileSync(outputPath, markdown)

    console.log('')
    console.log('=' .repeat(50))
    console.log('AUDIT COMPLETE')
    console.log('=' .repeat(50))
    console.log('')
    console.log(`Total issues found: ${report.issues.length}`)
    console.log(`  - Critical: ${report.issues.filter(i => i.severity === 'critical').length}`)
    console.log(`  - High: ${report.issues.filter(i => i.severity === 'high').length}`)
    console.log(`  - Medium: ${report.issues.filter(i => i.severity === 'medium').length}`)
    console.log(`  - Low: ${report.issues.filter(i => i.severity === 'low').length}`)
    console.log('')
    console.log(`Report saved to: DATA_QUALITY_REPORT.md`)

  } catch (error) {
    console.error('Audit failed:', error)
    process.exit(1)
  }
}

main()
