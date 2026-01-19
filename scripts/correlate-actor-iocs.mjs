#!/usr/bin/env node
/**
 * Correlate actors with IOCs through malware families
 *
 * This script creates actor_iocs records by:
 * 1. Finding IOCs with malware_family assignments
 * 2. Looking up associated_actors from malware_families table
 * 3. Creating actor_iocs records linking them
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function correlateActorIOCs() {
  console.log('=== Actor-IOC Correlation ===\n')

  // Step 1: Get malware families with associated actors
  console.log('Step 1: Loading malware families with actor associations...')
  const { data: malwareFamilies, error: mfError } = await supabase
    .from('malware_families')
    .select('name, associated_actors')
    .not('associated_actors', 'eq', '{}')

  if (mfError) {
    console.error('Error fetching malware families:', mfError.message)
    return
  }

  console.log(`  Found ${malwareFamilies?.length || 0} malware families with actor associations\n`)

  if (!malwareFamilies || malwareFamilies.length === 0) {
    console.log('No malware families with actor associations found.')
    console.log('Trying alternative: direct IOC actor_id associations...\n')
    await correlateFromDirectIOCs()
    return
  }

  // Build malware -> actors lookup
  const malwareToActors = {}
  for (const mf of malwareFamilies) {
    if (mf.associated_actors && mf.associated_actors.length > 0) {
      malwareToActors[mf.name.toLowerCase()] = mf.associated_actors
    }
  }

  console.log('Malware -> Actor mappings:')
  for (const [malware, actors] of Object.entries(malwareToActors)) {
    console.log(`  ${malware}: ${actors.join(', ')}`)
  }

  // Step 2: Get IOCs with malware families that have actor associations
  console.log('\nStep 2: Finding IOCs with matching malware families...')

  const malwareNames = Object.keys(malwareToActors)
  const { data: iocs, error: iocError } = await supabase
    .from('iocs')
    .select('id, type, value, malware_family, source, first_seen, last_seen')
    .not('malware_family', 'is', null)
    .limit(5000)

  if (iocError) {
    console.error('Error fetching IOCs:', iocError.message)
    return
  }

  console.log(`  Found ${iocs?.length || 0} IOCs with malware families\n`)

  // Step 3: Create actor_iocs records
  console.log('Step 3: Creating actor-IOC correlations...')

  const correlations = []
  let matchCount = 0

  for (const ioc of (iocs || [])) {
    const malwareKey = ioc.malware_family?.toLowerCase()
    if (malwareKey && malwareToActors[malwareKey]) {
      const actors = malwareToActors[malwareKey]
      for (const actorName of actors) {
        correlations.push({
          actor_name: actorName,
          ioc_value: ioc.value,
          ioc_type: ioc.type,
          ioc_id: ioc.id,
          confidence: 'medium',
          source: `malware_family:${ioc.malware_family}`,
          first_seen: ioc.first_seen || new Date().toISOString(),
          last_seen: ioc.last_seen || new Date().toISOString(),
          notes: `Associated via ${ioc.malware_family} malware family`
        })
        matchCount++
      }
    }
  }

  console.log(`  Generated ${matchCount} potential correlations\n`)

  if (correlations.length > 0) {
    // Batch insert with conflict handling
    console.log('Inserting correlations (with deduplication)...')

    const batchSize = 100
    let inserted = 0
    let skipped = 0

    for (let i = 0; i < correlations.length; i += batchSize) {
      const batch = correlations.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('actor_iocs')
        .upsert(batch, {
          onConflict: 'actor_name,ioc_value',
          ignoreDuplicates: true
        })
        .select()

      if (error) {
        console.error(`  Batch ${Math.floor(i/batchSize) + 1} error:`, error.message)
        skipped += batch.length
      } else {
        inserted += batch.length
      }
    }

    console.log(`  Inserted: ${inserted}, Skipped (duplicates): ${skipped}`)
  }

  // Also correlate from direct IOC actor assignments
  await correlateFromDirectIOCs()

  // Final count
  const { count } = await supabase
    .from('actor_iocs')
    .select('*', { count: 'exact', head: true })

  console.log(`\n=== Summary ===`)
  console.log(`Total actor_iocs records: ${count}`)
}

async function correlateFromDirectIOCs() {
  console.log('\n--- Correlating from direct IOC->Actor assignments ---')

  // Get IOCs that have direct actor_id associations
  const { data: iocs, error } = await supabase
    .from('iocs')
    .select(`
      id, type, value, source, first_seen, last_seen, actor_id,
      threat_actors!iocs_actor_id_fkey(name)
    `)
    .not('actor_id', 'is', null)
    .limit(5000)

  if (error) {
    console.error('Error fetching IOCs with actors:', error.message)
    return
  }

  console.log(`  Found ${iocs?.length || 0} IOCs with direct actor assignments`)

  if (!iocs || iocs.length === 0) return

  const correlations = []
  for (const ioc of iocs) {
    const actorName = ioc.threat_actors?.name
    if (actorName) {
      correlations.push({
        actor_id: ioc.actor_id,
        actor_name: actorName,
        ioc_id: ioc.id,
        ioc_value: ioc.value,
        ioc_type: ioc.type,
        confidence: 'high',
        source: `direct:${ioc.source || 'unknown'}`,
        first_seen: ioc.first_seen || new Date().toISOString(),
        last_seen: ioc.last_seen || new Date().toISOString(),
        notes: 'Direct actor-IOC relationship from source data'
      })
    }
  }

  console.log(`  Generated ${correlations.length} correlations from direct assignments`)

  if (correlations.length > 0) {
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < correlations.length; i += batchSize) {
      const batch = correlations.slice(i, i + batchSize)
      const { error } = await supabase
        .from('actor_iocs')
        .upsert(batch, {
          onConflict: 'actor_name,ioc_value',
          ignoreDuplicates: true
        })

      if (!error) {
        inserted += batch.length
      }
    }

    console.log(`  Inserted: ${inserted} direct correlations`)
  }
}

correlateActorIOCs().catch(console.error)
