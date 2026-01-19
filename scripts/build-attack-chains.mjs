#!/usr/bin/env node
/**
 * Build attack chains from correlated data
 *
 * Creates attack chain records by combining:
 * - Actor information from threat_actors
 * - Techniques from actor_techniques junction
 * - Vulnerabilities from actor_vulnerabilities
 * - Malware families from malware_families
 * - Target sectors/countries from cyber_events
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function buildAttackChains() {
  console.log('=== Building Attack Chains ===\n')

  // Step 1: Get actors with related data
  console.log('Step 1: Loading actors with correlation data...')

  const { data: actors, error: actorError } = await supabase
    .from('threat_actors')
    .select(`
      id,
      name,
      actor_type,
      target_sectors,
      target_countries,
      ttps,
      aliases,
      metadata
    `)
    .limit(500)

  if (actorError) {
    console.error('Error fetching actors:', actorError.message)
    return
  }

  console.log(`  Loaded ${actors?.length || 0} threat actors`)

  // Step 2: Get actor-vulnerability relationships
  console.log('\nStep 2: Loading actor-vulnerability correlations...')
  const { data: actorVulns, error: vulnError } = await supabase
    .from('actor_vulnerabilities')
    .select('actor_id, cve_id, source')

  if (vulnError) {
    console.log('  Error:', vulnError.message)
  }

  // Group CVEs by actor
  const actorCVEs = new Map()
  for (const av of (actorVulns || [])) {
    if (!actorCVEs.has(av.actor_id)) {
      actorCVEs.set(av.actor_id, [])
    }
    actorCVEs.get(av.actor_id).push(av.cve_id)
  }
  console.log(`  Found ${actorVulns?.length || 0} actor-CVE relationships`)

  // Step 3: Get actor techniques from actor_techniques junction
  console.log('\nStep 3: Loading actor-technique correlations...')
  const { data: actorTechs, error: techError } = await supabase
    .from('actor_techniques')
    .select('actor_id, technique_id, techniques!inner(mitre_id, name)')

  if (techError) {
    console.log('  Note:', techError.message)
  }

  // Group techniques by actor
  const actorTechniques = new Map()
  for (const at of (actorTechs || [])) {
    if (!actorTechniques.has(at.actor_id)) {
      actorTechniques.set(at.actor_id, [])
    }
    actorTechniques.get(at.actor_id).push(at.techniques?.mitre_id)
  }
  console.log(`  Found ${actorTechs?.length || 0} actor-technique relationships`)

  // Step 4: Get malware family associations
  console.log('\nStep 4: Loading malware family associations...')
  const { data: malwareFamilies, error: mfError } = await supabase
    .from('malware_families')
    .select('name, associated_actors')
    .not('associated_actors', 'eq', '{}')

  // Build actor -> malware lookup
  const actorMalware = new Map()
  for (const mf of (malwareFamilies || [])) {
    for (const actorName of (mf.associated_actors || [])) {
      if (!actorMalware.has(actorName.toLowerCase())) {
        actorMalware.set(actorName.toLowerCase(), [])
      }
      actorMalware.get(actorName.toLowerCase()).push(mf.name)
    }
  }
  console.log(`  Found ${malwareFamilies?.length || 0} malware families with actor associations`)

  // Step 5: Get targeting data from cyber_events
  console.log('\nStep 5: Aggregating targeting data from cyber_events...')
  const { data: targetingData, error: targetError } = await supabase
    .from('actor_activity_summary')
    .select('*')

  const actorTargeting = new Map()
  for (const at of (targetingData || [])) {
    actorTargeting.set(at.actor_name?.toLowerCase(), {
      sectors: at.industries_targeted,
      countries: at.countries_targeted,
      motives: at.motives || []
    })
  }
  console.log(`  Aggregated targeting for ${actorTargeting.size} actors`)

  // Step 6: Build attack chains
  console.log('\nStep 6: Building attack chain records...')

  const chains = []
  let chainsWithData = 0

  for (const actor of (actors || [])) {
    const cves = actorCVEs.get(actor.id) || []
    const techniques = actorTechniques.get(actor.id) || (actor.ttps || [])
    const malware = actorMalware.get(actor.name?.toLowerCase()) || []
    const targeting = actorTargeting.get(actor.name?.toLowerCase()) || {}

    // Only create chains for actors with meaningful correlation data
    const hasData = cves.length > 0 || techniques.length > 0 || malware.length > 0

    if (hasData) {
      chainsWithData++

      chains.push({
        name: `${actor.name} Attack Pattern`,
        description: buildChainDescription(actor, cves, techniques, malware),
        actor_id: actor.id,
        actor_name: actor.name,
        techniques: techniques.slice(0, 20), // Limit array size
        vulnerabilities: cves.slice(0, 20),
        malware_families: malware.slice(0, 10),
        target_sectors: actor.target_sectors || [],
        target_countries: actor.target_countries || [],
        source: 'correlation-engine',
        confidence: calculateConfidence(cves.length, techniques.length, malware.length),
        tags: buildTags(actor, cves, techniques),
        first_seen: null, // Would need temporal data
        last_seen: null
      })
    }
  }

  console.log(`  Built ${chains.length} attack chains (${chainsWithData} actors had correlation data)`)

  if (chains.length === 0) {
    console.log('\nNo attack chains to create. Correlations need more data.')
    return
  }

  // Step 7: Upsert attack chains
  console.log('\nStep 7: Saving attack chains...')

  const batchSize = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < chains.length; i += batchSize) {
    const batch = chains.slice(i, i + batchSize)
    const { error } = await supabase
      .from('attack_chains')
      .upsert(batch, {
        onConflict: 'actor_id',
        ignoreDuplicates: false
      })

    if (error) {
      console.log(`  Batch error: ${error.message}`)
      // Try individual inserts
      for (const chain of batch) {
        const { error: singleError } = await supabase
          .from('attack_chains')
          .upsert(chain, { ignoreDuplicates: true })

        if (!singleError) inserted++
        else errors++
      }
    } else {
      inserted += batch.length
    }
  }

  console.log(`  Inserted/Updated: ${inserted}, Errors: ${errors}`)

  // Summary
  const { count } = await supabase
    .from('attack_chains')
    .select('*', { count: 'exact', head: true })

  console.log(`\n=== Summary ===`)
  console.log(`Total attack chains: ${count}`)

  // Show sample chains
  const { data: samples } = await supabase
    .from('attack_chains')
    .select('actor_name, techniques, vulnerabilities, malware_families, confidence')
    .not('vulnerabilities', 'eq', '{}')
    .limit(5)

  console.log('\nSample attack chains with CVEs:')
  for (const s of (samples || [])) {
    console.log(`  ${s.actor_name}:`)
    console.log(`    Techniques: ${s.techniques?.length || 0}`)
    console.log(`    CVEs: ${s.vulnerabilities?.join(', ') || 'none'}`)
    console.log(`    Malware: ${s.malware_families?.join(', ') || 'none'}`)
    console.log(`    Confidence: ${s.confidence}`)
  }
}

function buildChainDescription(actor, cves, techniques, malware) {
  const parts = [`Attack pattern for ${actor.name}`]

  if (actor.actor_type) {
    parts.push(`(${actor.actor_type})`)
  }

  if (techniques.length > 0) {
    parts.push(`Uses ${techniques.length} known MITRE ATT&CK techniques`)
  }

  if (cves.length > 0) {
    parts.push(`exploits ${cves.length} CVEs including ${cves.slice(0, 3).join(', ')}`)
  }

  if (malware.length > 0) {
    parts.push(`deploys ${malware.join(', ')} malware`)
  }

  return parts.join('. ') + '.'
}

function calculateConfidence(cveCount, techCount, malwareCount) {
  const score = cveCount * 2 + techCount + malwareCount
  if (score >= 10) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

function buildTags(actor, cves, techniques) {
  const tags = []

  if (cves.length > 0) tags.push('exploits-cves')
  if (techniques.length > 0) tags.push('mitre-mapped')
  if (actor.actor_type) tags.push(`type:${actor.actor_type.toLowerCase().replace(/\s+/g, '-')}`)
  if (actor.target_sectors?.includes('healthcare')) tags.push('targets-healthcare')
  if (actor.target_sectors?.includes('finance')) tags.push('targets-finance')
  if (actor.target_sectors?.includes('government')) tags.push('targets-government')

  return tags.slice(0, 10)
}

buildAttackChains().catch(console.error)
