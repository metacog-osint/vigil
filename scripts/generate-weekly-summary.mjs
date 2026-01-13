#!/usr/bin/env node
/**
 * Weekly Summary Generation Script
 *
 * Aggregates weekly statistics and stores in weekly_summaries table.
 * Should run weekly (Sunday midnight UTC).
 *
 * Run: npm run generate:weekly-summary
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env from .env file if not already set
let supabaseUrl = process.env.VITE_SUPABASE_URL
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=').trim()
      if (key && value) {
        if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value
        if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value
      }
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Get start of week (Monday)
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get end of week (Sunday)
function getWeekEnd(weekStart) {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

async function generateWeeklySummary(weeksAgo = 1) {
  // Calculate target week (default: last completed week)
  const now = new Date()
  const targetWeekStart = getWeekStart(new Date(now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000))
  const targetWeekEnd = getWeekEnd(targetWeekStart)
  const prevWeekStart = new Date(targetWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const weekStartStr = targetWeekStart.toISOString().split('T')[0]
  const weekEndStr = targetWeekEnd.toISOString().split('T')[0]
  const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0]

  console.log('=== Weekly Summary Generation ===')
  console.log(`Target week: ${weekStartStr} to ${weekEndStr}`)
  console.log()

  // Check if summary already exists
  const { data: existing } = await supabase
    .from('weekly_summaries')
    .select('id')
    .eq('week_start', weekStartStr)
    .single()

  if (existing) {
    console.log('Summary already exists for this week. Updating...')
  }

  // Get incidents for target week
  const { data: incidents, error: incidentError } = await supabase
    .from('incidents')
    .select('id, actor_id, victim_sector, victim_country')
    .gte('discovered_date', weekStartStr)
    .lte('discovered_date', weekEndStr)

  if (incidentError) {
    console.error('Error fetching incidents:', incidentError.message)
    process.exit(1)
  }

  // Get previous week incidents for comparison
  const { count: prevIncidentCount } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .gte('discovered_date', prevWeekStartStr)
    .lt('discovered_date', weekStartStr)

  // Calculate sector distribution
  const sectorCounts = {}
  const countryCounts = {}
  const actorSet = new Set()

  for (const incident of incidents || []) {
    if (incident.victim_sector) {
      sectorCounts[incident.victim_sector] = (sectorCounts[incident.victim_sector] || 0) + 1
    }
    if (incident.victim_country) {
      countryCounts[incident.victim_country] = (countryCounts[incident.victim_country] || 0) + 1
    }
    if (incident.actor_id) {
      actorSet.add(incident.actor_id)
    }
  }

  // Get actor metrics
  const { data: escalatingActors } = await supabase
    .from('threat_actors')
    .select('id, name, incidents_7d')
    .eq('trend_status', 'ESCALATING')
    .order('incidents_7d', { ascending: false })
    .limit(10)

  // Get new actors this week
  const { count: newActorCount } = await supabase
    .from('threat_actors')
    .select('*', { count: 'exact', head: true })
    .gte('first_seen', weekStartStr)
    .lte('first_seen', weekEndStr)

  // Get KEVs added this week
  const { count: kevCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .gte('kev_date', weekStartStr)
    .lte('kev_date', weekEndStr)

  // Get critical vulns added
  const { count: criticalCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .gte('published_date', weekStartStr)
    .lte('published_date', weekEndStr)
    .gte('cvss_score', 9.0)

  // Calculate change percentages
  const incidentChangePct = prevIncidentCount > 0
    ? Math.round(((incidents.length - prevIncidentCount) / prevIncidentCount) * 100 * 10) / 10
    : null

  // Build summary object
  const summary = {
    week_start: weekStartStr,
    week_end: weekEndStr,
    incidents_total: incidents?.length || 0,
    incidents_by_sector: sectorCounts,
    incidents_by_country: countryCounts,
    actors_active: actorSet.size,
    actors_escalating: escalatingActors?.length || 0,
    actors_new: newActorCount || 0,
    top_actors: (escalatingActors || []).map(a => ({
      id: a.id,
      name: a.name,
      incidents_7d: a.incidents_7d,
    })),
    kevs_added: kevCount || 0,
    critical_vulns_added: criticalCount || 0,
    incident_change_pct: incidentChangePct,
  }

  // Upsert summary
  const { error: upsertError } = await supabase
    .from('weekly_summaries')
    .upsert(summary, {
      onConflict: 'week_start',
      ignoreDuplicates: false,
    })

  if (upsertError) {
    console.error('Error upserting summary:', upsertError.message)
    process.exit(1)
  }

  // Print summary
  console.log('=== Summary Generated ===')
  console.log(`Incidents: ${summary.incidents_total} (${incidentChangePct > 0 ? '+' : ''}${incidentChangePct || 0}% vs prev week)`)
  console.log(`Active actors: ${summary.actors_active}`)
  console.log(`Escalating actors: ${summary.actors_escalating}`)
  console.log(`New actors: ${summary.actors_new}`)
  console.log(`KEVs added: ${summary.kevs_added}`)
  console.log(`Critical vulns: ${summary.critical_vulns_added}`)
  console.log()
  console.log('Top sectors:')
  const sortedSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  for (const [sector, count] of sortedSectors) {
    console.log(`  ${sector}: ${count}`)
  }
  console.log()
  console.log('Top escalating actors:')
  for (const actor of (escalatingActors || []).slice(0, 5)) {
    console.log(`  ${actor.name}: ${actor.incidents_7d} incidents/7d`)
  }

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'weekly_summary',
    status: 'success',
    records_processed: 1,
    records_added: 1,
    completed_at: new Date().toISOString(),
  })

  return summary
}

// Optionally backfill historical weeks
async function backfillWeeks(numWeeks = 4) {
  console.log(`Backfilling ${numWeeks} weeks of summaries...\n`)

  for (let i = 1; i <= numWeeks; i++) {
    console.log(`\n--- Week ${i} of ${numWeeks} ---`)
    await generateWeeklySummary(i)
  }
}

// Run
const args = process.argv.slice(2)
const backfill = args.includes('--backfill')
const numWeeks = parseInt(args.find(a => a.startsWith('--weeks='))?.split('=')[1] || '4')

if (backfill) {
  backfillWeeks(numWeeks)
    .then(() => {
      console.log('\nBackfill complete!')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Backfill failed:', err)
      process.exit(1)
    })
} else {
  generateWeeklySummary()
    .then(() => {
      console.log('\nDone!')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Summary generation failed:', err)
      process.exit(1)
    })
}
