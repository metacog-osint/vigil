#!/usr/bin/env node
/**
 * Malpedia Data Ingestion
 *
 * Fetches threat actors and malware families from Malpedia.
 * Source: https://malpedia.caad.fkie.fraunhofer.de/
 *
 * Data includes:
 * - Threat actors with aliases and descriptions
 * - Malware families with actor associations
 * - Actor-malware relationships
 *
 * Run: npm run ingest:malpedia
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const MALPEDIA_API = 'https://malpedia.caad.fkie.fraunhofer.de/api'

// Load env
let supabaseUrl = process.env.VITE_SUPABASE_URL
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=').trim()
      if (key?.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value
      if (key?.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Map Malpedia actor types to our taxonomy
function mapActorType(malpediaType, description = '') {
  const desc = description.toLowerCase()

  if (desc.includes('ransomware')) return 'ransomware'
  if (desc.includes('apt') || desc.includes('state-sponsored') || desc.includes('espionage')) return 'apt'
  if (desc.includes('hacktivist') || desc.includes('activist')) return 'hacktivism'
  if (desc.includes('financial') || desc.includes('banking') || desc.includes('fraud')) return 'cybercrime'
  if (desc.includes('initial access') || desc.includes('access broker')) return 'initial_access_broker'
  if (desc.includes('extortion') && !desc.includes('ransomware')) return 'data_extortion'

  // Default based on naming conventions
  if (malpediaType === 'apt') return 'apt'

  return 'cybercrime' // Default for Malpedia actors
}

// Extract country from description
function extractCountry(description = '') {
  const patterns = [
    { regex: /\b(Russia|Russian)\b/i, country: 'Russia' },
    { regex: /\b(China|Chinese|PRC)\b/i, country: 'China' },
    { regex: /\b(Iran|Iranian)\b/i, country: 'Iran' },
    { regex: /\b(North Korea|DPRK|Korean)\b/i, country: 'North Korea' },
    { regex: /\b(Vietnam|Vietnamese)\b/i, country: 'Vietnam' },
    { regex: /\b(India|Indian)\b/i, country: 'India' },
    { regex: /\b(Pakistan|Pakistani)\b/i, country: 'Pakistan' },
    { regex: /\b(Israel|Israeli)\b/i, country: 'Israel' },
    { regex: /\b(Ukraine|Ukrainian)\b/i, country: 'Ukraine' },
    { regex: /\b(Belarus|Belarusian)\b/i, country: 'Belarus' },
  ]

  for (const { regex, country } of patterns) {
    if (regex.test(description)) return country
  }
  return null
}

async function fetchActors() {
  console.log('Fetching actors from Malpedia...')

  const response = await fetch(`${MALPEDIA_API}/get/actors`, {
    headers: { 'Accept': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Malpedia API error: ${response.status}`)
  }

  return response.json()
}

async function fetchFamilies() {
  console.log('Fetching malware families from Malpedia...')

  const response = await fetch(`${MALPEDIA_API}/get/families`, {
    headers: { 'Accept': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Malpedia API error: ${response.status}`)
  }

  return response.json()
}

async function upsertActors(actors) {
  console.log(`\nProcessing ${Object.keys(actors).length} actors...`)

  let added = 0
  let errors = 0

  for (const [actorId, actorData] of Object.entries(actors)) {
    // Extract actor info
    const name = actorData.value || actorId
    const description = actorData.description || ''
    const aliases = actorData.synonyms || []

    // Skip if no meaningful data
    if (!name || name.length < 2) continue

    const record = {
      name: name,
      aliases: aliases.filter(a => a !== name),
      actor_type: mapActorType(actorData.meta?.type, description),
      description: description.substring(0, 2000), // Truncate long descriptions
      source: 'malpedia',
      source_url: `https://malpedia.caad.fkie.fraunhofer.de/actor/${actorId}`,
      metadata: {
        malpedia_id: actorId,
        origin_country: extractCountry(description),
        refs: actorData.meta?.refs?.slice(0, 10) || [],
      },
      status: 'active',
    }

    const { error } = await supabase
      .from('threat_actors')
      .upsert(record, { onConflict: 'name', ignoreDuplicates: false })

    if (error) {
      // Try with modified name if conflict
      if (error.code === '23505') {
        record.name = `${name} (Malpedia)`
        const { error: retryError } = await supabase
          .from('threat_actors')
          .upsert(record, { onConflict: 'name', ignoreDuplicates: false })
        if (!retryError) {
          added++
          continue
        }
      }
      errors++
    } else {
      added++
    }
  }

  console.log(`  Added/updated: ${added}, Errors: ${errors}`)
  return { added, errors }
}

async function processFamilies(families) {
  console.log(`\nProcessing ${Object.keys(families).length} malware families...`)

  // Build actor -> malware mapping for later use
  const actorMalware = new Map()

  for (const [familyId, familyData] of Object.entries(families)) {
    const actors = familyData.attribution || []
    for (const actor of actors) {
      const existing = actorMalware.get(actor) || []
      existing.push(familyId)
      actorMalware.set(actor, existing)
    }
  }

  console.log(`  Found ${actorMalware.size} actors with malware attributions`)

  // Update actors with their malware families
  let updated = 0
  for (const [actorName, malwareFamilies] of actorMalware) {
    // First get existing metadata
    const { data: existing } = await supabase
      .from('threat_actors')
      .select('metadata')
      .eq('name', actorName)
      .maybeSingle()

    if (existing) {
      const newMetadata = {
        ...(existing.metadata || {}),
        malware_families: malwareFamilies.slice(0, 20)
      }

      const { error } = await supabase
        .from('threat_actors')
        .update({ metadata: newMetadata })
        .eq('name', actorName)

      if (!error) updated++
    }
  }

  console.log(`  Updated ${updated} actors with malware attributions`)
  return { familiesProcessed: Object.keys(families).length, actorsUpdated: updated }
}

async function main() {
  console.log('=== Malpedia Ingestion ===')
  console.log(`Started: ${new Date().toISOString()}`)

  try {
    // Fetch data
    const actors = await fetchActors()
    console.log(`Fetched ${Object.keys(actors).length} actors`)

    const families = await fetchFamilies()
    console.log(`Fetched ${Object.keys(families).length} malware families`)

    // Process actors
    const actorResults = await upsertActors(actors)

    // Process families (updates actor metadata)
    const familyResults = await processFamilies(families)

    // Log sync
    await supabase.from('sync_log').insert({
      source: 'malpedia',
      status: actorResults.errors === 0 ? 'success' : 'partial',
      records_processed: Object.keys(actors).length + Object.keys(families).length,
      records_added: actorResults.added,
      completed_at: new Date().toISOString(),
    })

    console.log('\n=== Summary ===')
    console.log(`Actors added/updated: ${actorResults.added}`)
    console.log(`Malware families processed: ${familyResults.familiesProcessed}`)
    console.log(`Actors with malware attributions: ${familyResults.actorsUpdated}`)
    console.log(`\nCompleted: ${new Date().toISOString()}`)

  } catch (error) {
    console.error('Fatal error:', error.message)
    await supabase.from('sync_log').insert({
      source: 'malpedia',
      status: 'error',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    })
    process.exit(1)
  }
}

main()
