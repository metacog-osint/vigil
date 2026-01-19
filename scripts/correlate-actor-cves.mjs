#!/usr/bin/env node
/**
 * Extract actor-CVE relationships from cyber_events
 *
 * This script mines cyber_events descriptions for CVE mentions
 * and creates actor_vulnerabilities records linking actors to CVEs
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

// CVE regex pattern
const CVE_PATTERN = /CVE-\d{4}-\d{4,7}/gi

async function correlateActorCVEs() {
  console.log('=== Actor-CVE Correlation ===\n')

  // Step 1: Get cyber_events with descriptions
  console.log('Step 1: Loading cyber events with descriptions...')
  const { data: events, error: eventsError } = await supabase
    .from('cyber_events')
    .select('id, actor_name, actor_type, description, event_date, target_industry')
    .not('description', 'is', null)
    .not('actor_name', 'eq', 'Undetermined')
    .order('event_date', { ascending: false })
    .limit(10000)

  if (eventsError) {
    console.error('Error fetching events:', eventsError.message)
    return
  }

  console.log(`  Found ${events?.length || 0} events with descriptions\n`)

  // Step 2: Extract CVEs from descriptions
  console.log('Step 2: Extracting CVE mentions...')

  const actorCVEs = new Map() // actor_name -> Set of CVE IDs
  let totalCVEs = 0

  for (const event of (events || [])) {
    const cves = event.description.match(CVE_PATTERN)
    if (cves && cves.length > 0) {
      const uniqueCVEs = [...new Set(cves.map(c => c.toUpperCase()))]
      totalCVEs += uniqueCVEs.length

      if (!actorCVEs.has(event.actor_name)) {
        actorCVEs.set(event.actor_name, new Map())
      }

      for (const cve of uniqueCVEs) {
        const actorCVEMap = actorCVEs.get(event.actor_name)
        if (!actorCVEMap.has(cve)) {
          actorCVEMap.set(cve, {
            first_observed: event.event_date,
            last_observed: event.event_date,
            industries: new Set(),
            source: 'umd-cyber-events'
          })
        }

        // Update with latest info
        const existing = actorCVEMap.get(cve)
        if (event.event_date < existing.first_observed) {
          existing.first_observed = event.event_date
        }
        if (event.event_date > existing.last_observed) {
          existing.last_observed = event.event_date
        }
        if (event.target_industry) {
          existing.industries.add(event.target_industry)
        }
      }
    }
  }

  console.log(`  Found ${totalCVEs} CVE mentions across ${actorCVEs.size} actors\n`)

  if (actorCVEs.size === 0) {
    console.log('No CVE mentions found in cyber_events descriptions.')
    return
  }

  // Display top actors by CVE count
  console.log('Top actors by CVE exploitation:')
  const sorted = [...actorCVEs.entries()]
    .map(([actor, cves]) => ({ actor, count: cves.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  for (const { actor, count } of sorted) {
    console.log(`  ${actor}: ${count} CVEs`)
  }

  // Step 3: Get existing CVEs from vulnerabilities table
  console.log('\nStep 3: Getting existing CVEs from vulnerabilities table...')
  const allCveIds = new Set()
  for (const cveMap of actorCVEs.values()) {
    for (const cveId of cveMap.keys()) {
      allCveIds.add(cveId)
    }
  }

  const { data: existingCVEs, error: cveError } = await supabase
    .from('vulnerabilities')
    .select('cve_id')
    .in('cve_id', [...allCveIds])

  if (cveError) {
    console.log('  Error fetching CVEs:', cveError.message)
  }

  const validCVEs = new Set((existingCVEs || []).map(v => v.cve_id))
  console.log(`  Found ${validCVEs.size} of ${allCveIds.size} CVEs in vulnerabilities table`)

  // Step 4: Resolve actor names to IDs
  console.log('\nStep 4: Resolving actor names to IDs...')
  const actorNames = [...actorCVEs.keys()]
  const { data: actors, error: actorError } = await supabase
    .from('threat_actors')
    .select('id, name')
    .in('name', actorNames)

  if (actorError) {
    console.log('  Could not resolve actor IDs:', actorError.message)
  }

  const actorIdMap = new Map()
  for (const actor of (actors || [])) {
    actorIdMap.set(actor.name, actor.id)
  }
  console.log(`  Resolved ${actorIdMap.size} of ${actorNames.length} actors to IDs`)

  // Step 5: Build correlation records (only for valid actor+CVE combinations)
  console.log('\nStep 5: Building correlation records...')

  const correlations = []
  let skippedNoActor = 0
  let skippedNoCVE = 0

  for (const [actorName, cveMap] of actorCVEs) {
    const actorId = actorIdMap.get(actorName)
    if (!actorId) {
      skippedNoActor += cveMap.size
      continue
    }

    for (const [cveId, data] of cveMap) {
      if (!validCVEs.has(cveId)) {
        skippedNoCVE++
        continue
      }

      correlations.push({
        actor_id: actorId,
        cve_id: cveId,
        confidence: 'medium',
        source: data.source,
        first_seen: data.first_observed,
        notes: data.industries.size > 0
          ? `Industries targeted: ${[...data.industries].join(', ')}`
          : null
      })
    }
  }

  console.log(`  Generated ${correlations.length} valid correlations`)
  console.log(`  Skipped ${skippedNoActor} (no actor ID), ${skippedNoCVE} (CVE not in DB)`)

  if (correlations.length === 0) {
    console.log('\nNo valid correlations to insert.')
    console.log('Tip: Ensure actors exist in threat_actors and CVEs exist in vulnerabilities.')
    return
  }

  // Step 6: Insert correlations
  console.log('\nStep 6: Inserting correlations...')

  const batchSize = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < correlations.length; i += batchSize) {
    const batch = correlations.slice(i, i + batchSize)
    const { error } = await supabase
      .from('actor_vulnerabilities')
      .upsert(batch, {
        onConflict: 'actor_id,cve_id',
        ignoreDuplicates: true
      })

    if (error) {
      // Try inserting by actor_name if actor_id is null
      for (const record of batch) {
        const { error: singleError } = await supabase
          .from('actor_vulnerabilities')
          .upsert(record, { ignoreDuplicates: true })

        if (!singleError) {
          inserted++
        } else {
          errors++
        }
      }
    } else {
      inserted += batch.length
    }
  }

  console.log(`  Inserted: ${inserted}, Errors: ${errors}`)

  // Final count and summary
  const { count } = await supabase
    .from('actor_vulnerabilities')
    .select('*', { count: 'exact', head: true })

  console.log(`\n=== Summary ===`)
  console.log(`Total actor_vulnerabilities records: ${count}`)

  // Show sample CVEs with actors
  const { data: samples } = await supabase
    .from('actor_vulnerabilities')
    .select(`
      cve_id,
      first_seen,
      threat_actors!actor_vulnerabilities_actor_id_fkey(name)
    `)
    .order('first_seen', { ascending: false })
    .limit(10)

  console.log('\nRecent actor-CVE associations:')
  for (const s of (samples || [])) {
    const actorName = s.threat_actors?.name || 'Unknown'
    console.log(`  ${actorName} -> ${s.cve_id} (${s.first_seen || 'N/A'})`)
  }
}

correlateActorCVEs().catch(console.error)
