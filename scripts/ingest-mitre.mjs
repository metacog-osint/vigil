#!/usr/bin/env node
/**
 * MITRE ATT&CK Enterprise Matrix Ingestion
 *
 * Fetches the ATT&CK Enterprise matrix from MITRE's GitHub repository
 * and stores techniques in the database.
 *
 * Source: https://github.com/mitre/cti
 * Format: STIX 2.1 JSON
 *
 * Run: npm run ingest:mitre
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const ATTACK_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json'

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
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Extract technique ID from external references
function extractTechniqueId(refs) {
  if (!refs) return null
  const mitreRef = refs.find(r => r.source_name === 'mitre-attack')
  return mitreRef?.external_id || null
}

// Map STIX tactics to readable names
const TACTIC_NAMES = {
  'initial-access': 'Initial Access',
  'execution': 'Execution',
  'persistence': 'Persistence',
  'privilege-escalation': 'Privilege Escalation',
  'defense-evasion': 'Defense Evasion',
  'credential-access': 'Credential Access',
  'discovery': 'Discovery',
  'lateral-movement': 'Lateral Movement',
  'collection': 'Collection',
  'command-and-control': 'Command and Control',
  'exfiltration': 'Exfiltration',
  'impact': 'Impact',
  'reconnaissance': 'Reconnaissance',
  'resource-development': 'Resource Development',
}

async function fetchAttackMatrix() {
  console.log('Fetching MITRE ATT&CK Enterprise matrix...')

  const response = await fetch(ATTACK_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch ATT&CK data: ${response.statusText}`)
  }

  const data = await response.json()
  console.log(`Fetched ${data.objects?.length || 0} STIX objects`)

  return data
}

function parseAttackMatrix(stixBundle) {
  const techniques = []
  const relationships = []
  const mitigations = []

  for (const obj of stixBundle.objects) {
    // Parse attack-patterns (techniques)
    if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
      const techniqueId = extractTechniqueId(obj.external_references)
      if (!techniqueId) continue

      // Extract tactics from kill chain phases
      const tactics = obj.kill_chain_phases
        ?.filter(p => p.kill_chain_name === 'mitre-attack')
        .map(p => TACTIC_NAMES[p.phase_name] || p.phase_name) || []

      techniques.push({
        id: techniqueId,
        stix_id: obj.id,
        name: obj.name,
        description: obj.description || null,
        tactics: tactics,
        platforms: obj.x_mitre_platforms || [],
        detection: obj.x_mitre_detection || null,
        is_subtechnique: obj.x_mitre_is_subtechnique || false,
        data_sources: obj.x_mitre_data_sources || [],
        url: `https://attack.mitre.org/techniques/${techniqueId.replace('.', '/')}/`,
      })
    }

    // Parse course-of-action (mitigations)
    if (obj.type === 'course-of-action' && !obj.revoked && !obj.x_mitre_deprecated) {
      const mitigationId = extractTechniqueId(obj.external_references)
      if (!mitigationId) continue

      mitigations.push({
        id: mitigationId,
        stix_id: obj.id,
        name: obj.name,
        description: obj.description || null,
      })
    }

    // Parse relationships
    if (obj.type === 'relationship' && obj.relationship_type === 'mitigates') {
      relationships.push({
        source_ref: obj.source_ref,
        target_ref: obj.target_ref,
      })
    }
  }

  // Build mitigation lookup
  const mitigationMap = new Map(mitigations.map(m => [m.stix_id, m.name]))

  // Create technique -> mitigations mapping
  const techniqueMitigations = new Map()
  for (const rel of relationships) {
    const mitName = mitigationMap.get(rel.source_ref)
    if (mitName) {
      const existing = techniqueMitigations.get(rel.target_ref) || []
      existing.push(mitName)
      techniqueMitigations.set(rel.target_ref, existing)
    }
  }

  // Add mitigations to techniques
  for (const tech of techniques) {
    tech.mitigations = techniqueMitigations.get(tech.stix_id) || []
    delete tech.stix_id // Remove internal reference
  }

  return { techniques, mitigations }
}

async function upsertTechniques(techniques) {
  console.log(`Upserting ${techniques.length} techniques...`)

  let added = 0
  let updated = 0
  let errors = 0

  // Process in batches
  const BATCH_SIZE = 50
  for (let i = 0; i < techniques.length; i += BATCH_SIZE) {
    const batch = techniques.slice(i, i + BATCH_SIZE)

    const { data, error } = await supabase
      .from('techniques')
      .upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`Batch error:`, error.message)
      errors += batch.length
    } else {
      added += batch.length
    }

    // Rate limiting
    if (i + BATCH_SIZE < techniques.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return { added, updated, errors }
}

async function logSync(source, status, recordsProcessed, recordsAdded, errorMessage = null) {
  try {
    await supabase.from('sync_log').insert({
      source,
      status,
      records_processed: recordsProcessed,
      records_added: recordsAdded,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Failed to log sync:', err.message)
  }
}

async function main() {
  console.log('=== MITRE ATT&CK Ingestion ===')
  console.log(`Started: ${new Date().toISOString()}`)

  try {
    // Fetch and parse
    const stixBundle = await fetchAttackMatrix()
    const { techniques } = parseAttackMatrix(stixBundle)

    console.log(`Parsed ${techniques.length} techniques`)

    // Show sample
    const sample = techniques[0]
    console.log('\nSample technique:')
    console.log(`  ID: ${sample.id}`)
    console.log(`  Name: ${sample.name}`)
    console.log(`  Tactics: ${sample.tactics.join(', ')}`)
    console.log(`  Platforms: ${sample.platforms.join(', ')}`)

    // Stats
    const subtechniques = techniques.filter(t => t.is_subtechnique)
    const parentTechniques = techniques.filter(t => !t.is_subtechnique)
    console.log(`\nBreakdown:`)
    console.log(`  Parent techniques: ${parentTechniques.length}`)
    console.log(`  Sub-techniques: ${subtechniques.length}`)

    // Tactic distribution
    const tacticCounts = {}
    for (const tech of techniques) {
      for (const tactic of tech.tactics) {
        tacticCounts[tactic] = (tacticCounts[tactic] || 0) + 1
      }
    }
    console.log(`\nTechniques per tactic:`)
    for (const [tactic, count] of Object.entries(tacticCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${tactic}: ${count}`)
    }

    // Upsert to database
    const results = await upsertTechniques(techniques)

    console.log('\n=== Results ===')
    console.log(`Techniques processed: ${techniques.length}`)
    console.log(`Techniques added/updated: ${results.added}`)
    console.log(`Errors: ${results.errors}`)

    // Log sync
    await logSync(
      'mitre_attack',
      results.errors === 0 ? 'success' : 'partial',
      techniques.length,
      results.added,
      results.errors > 0 ? `${results.errors} upsert errors` : null
    )

    console.log(`\nCompleted: ${new Date().toISOString()}`)

  } catch (error) {
    console.error('Fatal error:', error)
    await logSync('mitre_attack', 'error', 0, 0, error.message)
    process.exit(1)
  }
}

main()
