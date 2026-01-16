// Ransomwatch Data Ingestion
// Source: https://github.com/joshhighet/ransomwatch
// Ingests ransomware gang posts/victim claims
// Run: node scripts/ingest-ransomwatch.mjs

import { createClient } from '@supabase/supabase-js'
import { fetchJSON } from './lib/http.mjs'
import { classifySector } from './lib/sector-classifier.mjs'

// Load env from parent directory
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  // Try to load from .env file
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

const POSTS_URL = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json'
const GROUPS_URL = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/groups.json'

// Using shared sector classifier - see ./lib/sector-classifier.mjs

function parseDate(dateStr) {
  if (!dateStr) return null
  try {
    // Format: "YYYY-MM-DD HH:MM:SS.ffffff"
    const cleaned = dateStr.replace(' ', 'T').split('.')[0]
    const date = new Date(cleaned)
    if (isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

// Using shared HTTP module - see ./lib/http.mjs

async function ingestRansomwatch() {
  console.log('Fetching Ransomwatch data...')

  // Fetch groups and posts
  const [groups, posts] = await Promise.all([
    fetchJSON(GROUPS_URL),
    fetchJSON(POSTS_URL),
  ])

  console.log(`Found ${groups.length} groups and ${posts.length} posts`)

  // First, ensure all threat actors exist
  console.log('\nIngesting threat actors...')
  const actorMap = new Map()
  let actorsAdded = 0
  let actorsUpdated = 0

  for (const group of groups) {
    const actorData = {
      name: group.name,
      actor_type: 'ransomware',
      status: 'active',
      source: 'ransomwatch',
      source_url: group.url || null,
      metadata: {
        ransomwatch_name: group.name,
        parser: group.parser || null,
        profile: group.profile || [],
      }
    }

    // Upsert actor
    const { data, error } = await supabase
      .from('threat_actors')
      .upsert(actorData, { onConflict: 'name' })
      .select()
      .single()

    if (error) {
      // Try to get existing
      const { data: existing } = await supabase
        .from('threat_actors')
        .select('id')
        .eq('name', group.name)
        .single()

      if (existing) {
        actorMap.set(group.name, existing.id)
        actorsUpdated++
      }
    } else if (data) {
      actorMap.set(group.name, data.id)
      actorsAdded++
    }
  }

  console.log(`Actors: ${actorsAdded} added, ${actorsUpdated} existing`)

  // Now ingest incidents (posts)
  console.log('\nIngesting incidents...')
  let incidentsAdded = 0
  let incidentsSkipped = 0
  let incidentsFailed = 0

  // Process in batches
  const batchSize = 100
  const recentPosts = posts
    .map(p => ({
      ...p,
      parsedDate: parseDate(p.discovered)
    }))
    .filter(p => p.parsedDate)
    .sort((a, b) => new Date(b.parsedDate) - new Date(a.parsedDate))

  console.log(`Processing ${recentPosts.length} posts with valid dates...`)

  for (let i = 0; i < recentPosts.length; i += batchSize) {
    const batch = recentPosts.slice(i, i + batchSize)

    for (const post of batch) {
      const actorId = actorMap.get(post.group_name)

      if (!actorId) {
        incidentsSkipped++
        continue
      }

      const incidentData = {
        actor_id: actorId,
        victim_name: post.post_title || 'Unknown',
        victim_sector: classifySector({ victimName: post.post_title }),
        discovered_date: post.parsedDate,
        status: 'claimed',
        source: 'ransomwatch',
        source_url: post.post_url || null,
        raw_data: {
          group_name: post.group_name,
          post_title: post.post_title,
          discovered: post.discovered,
          description: post.description || null,
        }
      }

      // Check if this incident already exists (by actor + victim + date)
      const { data: existing } = await supabase
        .from('incidents')
        .select('id')
        .eq('actor_id', actorId)
        .eq('victim_name', incidentData.victim_name)
        .eq('discovered_date', incidentData.discovered_date)
        .single()

      if (existing) {
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
    }

    // Progress update
    if (i % 500 === 0 && i > 0) {
      console.log(`  Processed ${i}/${recentPosts.length} posts...`)
    }
  }

  // Update actor last_seen dates based on their latest incidents
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
    source: 'ransomwatch',
    status: 'success',
    records_processed: recentPosts.length,
    records_added: incidentsAdded,
    records_updated: incidentsSkipped,
    completed_at: new Date().toISOString(),
  })

  console.log('\n' + '='.repeat(50))
  console.log('Ransomwatch Ingestion Complete')
  console.log('='.repeat(50))
  console.log(`Groups processed: ${groups.length}`)
  console.log(`Posts processed: ${recentPosts.length}`)
  console.log(`Incidents added: ${incidentsAdded}`)
  console.log(`Incidents skipped (duplicate): ${incidentsSkipped}`)
  console.log(`Incidents failed: ${incidentsFailed}`)

  // Show time range
  if (recentPosts.length > 0) {
    const newest = recentPosts[0]
    const oldest = recentPosts[recentPosts.length - 1]
    console.log(`\nDate range: ${oldest.parsedDate} to ${newest.parsedDate}`)
  }
}

ingestRansomwatch().catch(console.error)
