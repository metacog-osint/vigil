#!/usr/bin/env node
/**
 * Actor Trend Snapshot Script
 *
 * Captures daily snapshots of actor metrics for trajectory visualization.
 * Should run daily after all ingestion jobs complete.
 *
 * Run: npm run snapshot:actors
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

async function snapshotActorTrends() {
  console.log('=== Actor Trend Snapshot ===')
  console.log(`Date: ${new Date().toISOString()}`)
  console.log()

  // Get active actors (seen in last 30 days or escalating)
  const { data: actors, error: actorError } = await supabase
    .from('threat_actors')
    .select('id, name, trend_status, incidents_7d, incidents_prev_7d, incident_velocity, last_seen')
    .or(`last_seen.gte.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()},trend_status.eq.ESCALATING`)
    .order('incidents_7d', { ascending: false, nullsFirst: false })

  if (actorError) {
    console.error('Error fetching actors:', actorError.message)
    process.exit(1)
  }

  console.log(`Found ${actors.length} active actors to snapshot`)

  // Calculate 30-day incident counts for each actor
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const snapshots = []
  for (let i = 0; i < actors.length; i++) {
    const actor = actors[i]

    // Get 30-day incident count
    const { count } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', actor.id)
      .gte('discovered_date', thirtyDaysAgo)

    snapshots.push({
      actor_id: actor.id,
      recorded_date: today,
      trend_status: actor.trend_status,
      incidents_7d: actor.incidents_7d || 0,
      incidents_30d: count || 0,
      incident_velocity: actor.incident_velocity || 0,
      rank_position: i + 1,
    })
  }

  // Upsert snapshots
  console.log(`Upserting ${snapshots.length} snapshots...`)

  const { error: upsertError } = await supabase
    .from('actor_trend_history')
    .upsert(snapshots, {
      onConflict: 'actor_id,recorded_date',
      ignoreDuplicates: false,
    })

  if (upsertError) {
    console.error('Error upserting snapshots:', upsertError.message)
    process.exit(1)
  }

  // Summary
  const escalating = snapshots.filter(s => s.trend_status === 'ESCALATING').length
  const stable = snapshots.filter(s => s.trend_status === 'STABLE').length
  const declining = snapshots.filter(s => s.trend_status === 'DECLINING').length

  console.log()
  console.log('=== Snapshot Complete ===')
  console.log(`Total actors: ${snapshots.length}`)
  console.log(`  Escalating: ${escalating}`)
  console.log(`  Stable: ${stable}`)
  console.log(`  Declining: ${declining}`)
  console.log()

  // Show top 5
  console.log('Top 5 actors by 7-day activity:')
  for (const snap of snapshots.slice(0, 5)) {
    const actor = actors.find(a => a.id === snap.actor_id)
    console.log(`  ${snap.rank_position}. ${actor?.name || 'Unknown'}: ${snap.incidents_7d} incidents`)
  }

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'actor_snapshot',
    status: 'success',
    records_processed: snapshots.length,
    records_added: snapshots.length,
    completed_at: new Date().toISOString(),
  })
}

// Run
snapshotActorTrends()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Snapshot failed:', err)
    process.exit(1)
  })
