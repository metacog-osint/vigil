// RansomLook Data Ingestion
// Source: https://www.ransomlook.io/
// Ingests ransomware gang posts/victim claims
// Run: node scripts/ingest-ransomlook.mjs

import { createClient } from '@supabase/supabase-js'
import { fetchJSON } from './lib/http.mjs'
import { classifySector } from './lib/sector-classifier.mjs'

// Load env from parent directory
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const fs = await import('fs')
  const path = await import('path')
  const envPath = path.join(process.cwd(), '.env')

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const API_BASE = 'https://www.ransomlook.io/api'

function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

// Using shared HTTP module - see ./lib/http.mjs

async function ingestRansomLook() {
  console.log('Fetching RansomLook data...')
  console.log('Source: https://www.ransomlook.io/\n')

  // Fetch groups first
  console.log('Fetching groups...')
  let groups = []
  try {
    groups = await fetchJSON(`${API_BASE}/groups`)
    console.log(`Found ${groups.length} groups`)
  } catch (error) {
    console.error('Failed to fetch groups:', error.message)
  }

  // Fetch recent posts (last 30 days worth)
  console.log('Fetching recent posts (last 30 days)...')
  let posts = []
  try {
    posts = await fetchJSON(`${API_BASE}/last/30`)
    console.log(`Found ${posts.length} posts from last 30 days`)
  } catch (error) {
    console.error('Failed to fetch recent posts:', error.message)
    // Try alternative endpoint
    try {
      posts = await fetchJSON(`${API_BASE}/recent/500`)
      console.log(`Found ${posts.length} posts (recent 500)`)
    } catch (e) {
      console.error('Failed to fetch posts:', e.message)
      return
    }
  }

  // Build actor map from existing + new groups
  console.log('\nProcessing threat actors...')
  const actorMap = new Map()
  let actorsAdded = 0
  let actorsUpdated = 0

  // Get existing actors
  const { data: existingActors } = await supabase
    .from('threat_actors')
    .select('id, name')

  for (const actor of existingActors || []) {
    actorMap.set(actor.name.toLowerCase(), actor.id)
  }

  // Process groups from RansomLook
  for (const group of groups) {
    const groupName = group.name || group
    if (typeof groupName !== 'string') continue

    const lowerName = groupName.toLowerCase()

    if (!actorMap.has(lowerName)) {
      const actorData = {
        name: groupName,
        actor_type: 'ransomware',
        status: 'active',
        source: 'ransomlook',
        metadata: {
          ransomlook_name: groupName,
          locations: group.locations || [],
          profile: group.profile || [],
        }
      }

      const { data, error } = await supabase
        .from('threat_actors')
        .insert(actorData)
        .select()
        .single()

      if (data) {
        actorMap.set(lowerName, data.id)
        actorsAdded++
      } else if (error) {
        // Actor might exist with different casing
        const { data: existing } = await supabase
          .from('threat_actors')
          .select('id')
          .ilike('name', groupName)
          .single()

        if (existing) {
          actorMap.set(lowerName, existing.id)
          actorsUpdated++
        }
      }
    } else {
      actorsUpdated++
    }
  }

  console.log(`Actors: ${actorsAdded} added, ${actorsUpdated} existing`)

  // Process posts/incidents
  console.log('\nIngesting incidents...')
  let incidentsAdded = 0
  let incidentsSkipped = 0
  let incidentsFailed = 0

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]

    // RansomLook structure: { group_name, post_title, discovered, ... }
    const groupName = post.group_name || ''
    const victimName = post.post_title || 'Unknown'
    const discoveredDate = parseDate(post.discovered)

    if (!discoveredDate) {
      incidentsSkipped++
      continue
    }

    // Find actor ID
    let actorId = actorMap.get(groupName.toLowerCase())

    // If actor doesn't exist, create it
    if (!actorId) {
      const { data: newActor } = await supabase
        .from('threat_actors')
        .insert({
          name: groupName,
          actor_type: 'ransomware',
          status: 'active',
          source: 'ransomlook',
        })
        .select()
        .single()

      if (newActor) {
        actorId = newActor.id
        actorMap.set(groupName.toLowerCase(), actorId)
        actorsAdded++
      } else {
        incidentsFailed++
        continue
      }
    }

    const incidentData = {
      actor_id: actorId,
      victim_name: victimName,
      victim_sector: classifySector({
        victimName: victimName,
        website: post.website || null,
        description: post.description || null,
      }),
      victim_country: post.country || null,
      victim_website: post.website || null,
      discovered_date: discoveredDate,
      status: 'claimed',
      source: 'ransomlook',
      source_url: post.post_url || null,
      raw_data: {
        group_name: groupName,
        post_title: victimName,
        discovered: post.discovered,
        description: post.description || null,
        website: post.website || null,
      }
    }

    // Check for existing (dedup across sources by actor + victim + date)
    const { data: existing } = await supabase
      .from('incidents')
      .select('id, source')
      .eq('actor_id', actorId)
      .eq('victim_name', victimName)
      .eq('discovered_date', discoveredDate)
      .single()

    if (existing) {
      // If exists but from different source, update to note multiple sources
      if (existing.source !== 'ransomlook' && !existing.source?.includes('ransomlook')) {
        await supabase
          .from('incidents')
          .update({
            source: `${existing.source}, ransomlook`,
            raw_data: {
              ...incidentData.raw_data,
              corroborated: true,
            }
          })
          .eq('id', existing.id)
      }
      incidentsSkipped++
      continue
    }

    const { error } = await supabase
      .from('incidents')
      .insert(incidentData)

    if (error) {
      incidentsFailed++
    } else {
      incidentsAdded++
    }

    // Progress update
    if (i % 100 === 0 && i > 0) {
      console.log(`  Processed ${i}/${posts.length} posts...`)
    }
  }

  // Update actor last_seen dates
  console.log('\nUpdating actor last_seen dates...')
  for (const [actorName, actorId] of actorMap) {
    const { data: latestIncident } = await supabase
      .from('incidents')
      .select('discovered_date')
      .eq('actor_id', actorId)
      .order('discovered_date', { ascending: false })
      .limit(1)
      .single()

    if (latestIncident) {
      await supabase
        .from('threat_actors')
        .update({ last_seen: latestIncident.discovered_date })
        .eq('id', actorId)
    }
  }

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'ransomlook',
    status: 'success',
    records_processed: posts.length,
    records_added: incidentsAdded,
    records_updated: incidentsSkipped,
    completed_at: new Date().toISOString(),
  })

  console.log('\n' + '='.repeat(50))
  console.log('RansomLook Ingestion Complete')
  console.log('='.repeat(50))
  console.log(`Groups processed: ${groups.length}`)
  console.log(`Posts processed: ${posts.length}`)
  console.log(`Incidents added: ${incidentsAdded}`)
  console.log(`Incidents skipped (duplicate): ${incidentsSkipped}`)
  console.log(`Incidents failed: ${incidentsFailed}`)
}

ingestRansomLook().catch(console.error)
