#!/usr/bin/env node
/**
 * MISP Galaxy Threat Actor Ingestion
 *
 * Fetches threat actors from MISP Galaxy GitHub repository.
 * Source: https://github.com/MISP/misp-galaxy
 *
 * Galaxies ingested:
 * - threat-actor: APT groups and cybercrime actors
 * - ransomware: Ransomware families and operators
 * - malpedia: Additional malware/actor data
 *
 * Run: npm run ingest:misp-galaxy
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const GALAXY_BASE = 'https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters'

const GALAXY_FILES = [
  'threat-actor.json',
  'ransomware.json',
]

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

// Determine actor type from MISP metadata
function determineActorType(entry, galaxyType) {
  const meta = entry.meta || {}
  const desc = (entry.description || '').toLowerCase()
  const name = (entry.value || '').toLowerCase()

  // Check galaxy type first
  if (galaxyType === 'ransomware') return 'ransomware'

  // Check meta fields - ensure it's an array
  const cfr = Array.isArray(meta['cfr-type-of-incident']) ? meta['cfr-type-of-incident'] : []
  if (cfr.some(t => t && t.includes('Ransomware'))) return 'ransomware'
  if (cfr.some(t => t && t.includes('Espionage'))) return 'apt'

  // Check description
  if (desc.includes('ransomware')) return 'ransomware'
  if (desc.includes('apt') || desc.includes('state-sponsored') || desc.includes('espionage')) return 'apt'
  if (desc.includes('hacktivist') || desc.includes('activist')) return 'hacktivism'
  if (desc.includes('financially motivated') || desc.includes('cybercrime')) return 'cybercrime'
  if (desc.includes('initial access broker')) return 'initial_access_broker'

  // Check name patterns
  if (name.startsWith('apt')) return 'apt'
  if (name.includes('ransom')) return 'ransomware'

  // Default based on galaxy
  return galaxyType === 'threat-actor' ? 'apt' : 'cybercrime'
}

// Extract country from MISP metadata
function extractCountry(entry) {
  const meta = entry.meta || {}

  // Direct country field
  if (meta.country) {
    const country = Array.isArray(meta.country) ? meta.country[0] : meta.country
    return country
  }

  // CFR suspected-state-sponsor
  const sponsor = meta['cfr-suspected-state-sponsor']
  if (sponsor) {
    return Array.isArray(sponsor) ? sponsor[0] : sponsor
  }

  // Attribution country
  if (meta['attribution-confidence'] && meta.country) {
    return meta.country
  }

  return null
}

// Extract target sectors
function extractSectors(entry) {
  const meta = entry.meta || {}
  const sectors = []

  // CFR target categories
  const targets = meta['cfr-target-category'] || []
  for (const target of targets) {
    const normalized = target.toLowerCase()
    if (normalized.includes('government')) sectors.push('government')
    if (normalized.includes('financial')) sectors.push('finance')
    if (normalized.includes('military')) sectors.push('defense')
    if (normalized.includes('energy')) sectors.push('energy')
    if (normalized.includes('health')) sectors.push('healthcare')
    if (normalized.includes('education')) sectors.push('education')
    if (normalized.includes('telecom')) sectors.push('telecommunications')
    if (normalized.includes('technology')) sectors.push('technology')
    if (normalized.includes('media')) sectors.push('media')
  }

  return [...new Set(sectors)]
}

async function fetchGalaxy(filename) {
  const url = `${GALAXY_BASE}/${filename}`
  console.log(`Fetching ${filename}...`)

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${response.status}`)
  }

  return response.json()
}

async function processGalaxy(galaxy, galaxyType) {
  const entries = galaxy.values || []
  console.log(`Processing ${entries.length} entries from ${galaxyType}...`)

  let added = 0
  let skipped = 0
  let errors = 0

  for (const entry of entries) {
    const name = entry.value
    if (!name || name.length < 2) {
      skipped++
      continue
    }

    const meta = entry.meta || {}
    const synonyms = meta.synonyms || []

    const record = {
      name: name,
      aliases: synonyms.filter(s => s !== name).slice(0, 20),
      actor_type: determineActorType(entry, galaxyType),
      description: (entry.description || '').substring(0, 2000),
      target_sectors: extractSectors(entry),
      source: 'misp_galaxy',
      source_url: meta.refs?.[0] || `https://github.com/MISP/misp-galaxy`,
      metadata: {
        misp_uuid: entry.uuid,
        origin_country: extractCountry(entry),
        cfr_type: meta['cfr-type-of-incident'],
        refs: meta.refs?.slice(0, 5),
      },
      status: 'active',
    }

    const { error } = await supabase
      .from('threat_actors')
      .upsert(record, { onConflict: 'name', ignoreDuplicates: false })

    if (error) {
      if (error.code !== '23505') { // Not a duplicate key error
        errors++
      } else {
        skipped++ // Already exists with different data
      }
    } else {
      added++
    }
  }

  return { added, skipped, errors, total: entries.length }
}

async function main() {
  console.log('=== MISP Galaxy Ingestion ===')
  console.log(`Started: ${new Date().toISOString()}`)

  const results = {
    totalProcessed: 0,
    totalAdded: 0,
    totalErrors: 0,
  }

  try {
    for (const filename of GALAXY_FILES) {
      const galaxyType = filename.replace('.json', '')

      try {
        const galaxy = await fetchGalaxy(filename)
        const galaxyResults = await processGalaxy(galaxy, galaxyType)

        console.log(`  ${galaxyType}: ${galaxyResults.added} added, ${galaxyResults.skipped} skipped, ${galaxyResults.errors} errors`)

        results.totalProcessed += galaxyResults.total
        results.totalAdded += galaxyResults.added
        results.totalErrors += galaxyResults.errors
      } catch (err) {
        console.error(`  Error processing ${filename}:`, err.message)
        results.totalErrors++
      }
    }

    // Log sync
    await supabase.from('sync_log').insert({
      source: 'misp_galaxy',
      status: results.totalErrors === 0 ? 'success' : 'partial',
      records_processed: results.totalProcessed,
      records_added: results.totalAdded,
      error_message: results.totalErrors > 0 ? `${results.totalErrors} errors` : null,
      completed_at: new Date().toISOString(),
    })

    console.log('\n=== Summary ===')
    console.log(`Total entries processed: ${results.totalProcessed}`)
    console.log(`Actors added/updated: ${results.totalAdded}`)
    console.log(`Errors: ${results.totalErrors}`)
    console.log(`\nCompleted: ${new Date().toISOString()}`)

  } catch (error) {
    console.error('Fatal error:', error.message)
    await supabase.from('sync_log').insert({
      source: 'misp_galaxy',
      status: 'error',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    })
    process.exit(1)
  }
}

main()
