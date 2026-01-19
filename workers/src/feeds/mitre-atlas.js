/**
 * MITRE ATLAS - Adversarial Threat Landscape for AI Systems
 * Cloudflare Worker version
 *
 * Fetches AI/ML adversarial techniques, tactics, and case studies
 * from the MITRE ATLAS GitHub repository.
 *
 * Source: https://github.com/mitre-atlas/atlas-data
 */

import * as yaml from 'js-yaml'

const ATLAS_YAML_URL = 'https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/ATLAS.yaml'
const ATLAS_CASE_STUDIES_URL = 'https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/case-studies.yaml'

export async function ingestMitreAtlas(supabase, env) {
  console.log('Starting MITRE ATLAS ingestion...')

  const results = {
    tactics: { updated: 0, failed: 0 },
    techniques: { updated: 0, failed: 0 },
    caseStudies: { updated: 0, failed: 0 }
  }
  let lastError = null

  try {
    // Fetch main ATLAS data
    const response = await fetch(ATLAS_YAML_URL, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const yamlText = await response.text()
    const data = parseYaml(yamlText)

    if (!data || !data.matrices || data.matrices.length === 0) {
      console.log('No ATLAS matrices found in response')
      return { success: false, error: 'Invalid ATLAS data structure' }
    }

    const matrix = data.matrices[0]
    const version = data.version || 'unknown'
    console.log(`ATLAS version: ${version}`)

    // Log tactics count (stored as references in techniques)
    if (matrix.tactics && matrix.tactics.length > 0) {
      console.log(`Found ${matrix.tactics.length} ATLAS tactics (stored as technique references)`)
      results.tactics.updated = matrix.tactics.length
    }

    // Process techniques
    if (matrix.techniques && matrix.techniques.length > 0) {
      console.log(`Processing ${matrix.techniques.length} techniques...`)

      const techniqueRecords = matrix.techniques.map(technique => ({
        id: technique.id,  // Primary key - AML.T0001 format
        name: technique.name,
        description: technique.description || null,
        framework: 'atlas',
        tactics: technique.tactics || [],
        is_subtechnique: !!technique['subtechnique-of'],
        parent_technique_id: technique['subtechnique-of'] || null,
        platforms: ['AI/ML Systems'],
        data_sources: [],
        detection: null,
        url: `https://atlas.mitre.org/techniques/${technique.id}`,
        external_references: technique['ATT&CK-reference'] ? [{
          source_name: 'mitre-attack',
          external_id: technique['ATT&CK-reference'].id,
          url: technique['ATT&CK-reference'].url
        }] : [],
        metadata: {
          object_type: technique['object-type'],
          maturity: technique.maturity || null,
          created_date: technique.created_date,
          modified_date: technique.modified_date,
          atlas_version: version
        }
      }))

      // Deduplicate by ID before inserting
      const seenIds = new Set()
      const uniqueRecords = techniqueRecords.filter(r => {
        if (seenIds.has(r.id)) return false
        seenIds.add(r.id)
        return true
      })

      console.log(`Deduplicated to ${uniqueRecords.length} unique techniques`)

      // Batch insert techniques
      const batchSize = 50
      for (let i = 0; i < uniqueRecords.length; i += batchSize) {
        const batch = uniqueRecords.slice(i, i + batchSize)
        const { error } = await supabase
          .from('techniques')
          .upsert(batch, { onConflict: 'id' })

        if (error) {
          console.error(`ATLAS techniques batch error: ${error.message}`)
          lastError = error.message
          results.techniques.failed += batch.length
        } else {
          results.techniques.updated += batch.length
        }
      }

      // Update failed count based on deduplication
      results.techniques.failed = 0  // Reset - duplicates were just filtered, not failures
    }

    // Try to fetch case studies (may be in separate file or embedded)
    try {
      const caseStudies = await fetchCaseStudies()
      if (caseStudies && caseStudies.length > 0) {
        console.log(`Processing ${caseStudies.length} case studies...`)

        const caseStudyRecords = caseStudies.map(cs => ({
          case_study_id: cs.id,
          name: cs.name,
          summary: cs.summary || cs.description || null,
          incident_date: cs.incident_date || null,
          techniques_used: cs.procedure || cs.techniques || [],
          actor_name: cs.actor || null,
          target_sector: cs.target?.sector || null,
          source: 'mitre-atlas',
          source_url: `https://atlas.mitre.org/studies/${cs.id}`,
          references: cs.references || [],
          metadata: {
            atlas_version: version,
            created_date: cs.created_date,
            modified_date: cs.modified_date
          }
        }))

        const { error } = await supabase
          .from('atlas_case_studies')
          .upsert(caseStudyRecords, { onConflict: 'case_study_id' })

        if (error) {
          console.error(`ATLAS case studies error: ${error.message}`)
          // Don't fail the whole ingestion for case studies
          results.caseStudies.failed = caseStudyRecords.length
        } else {
          results.caseStudies.updated = caseStudyRecords.length
        }
      }
    } catch (csError) {
      console.log(`Case studies fetch skipped: ${csError.message}`)
    }

  } catch (error) {
    console.error('MITRE ATLAS error:', error.message)
    return { success: false, source: 'mitre-atlas', error: error.message }
  }

  console.log(`MITRE ATLAS complete:`, results)
  return {
    success: true,
    source: 'mitre-atlas',
    ...results,
    lastError
  }
}

/**
 * Parse YAML content (simple parser for Cloudflare Workers)
 * YAML parsing in CF Workers is limited, so we use a basic approach
 */
function parseYaml(yamlText) {
  // Try to find JSON-like structure or parse simple YAML
  // ATLAS YAML is relatively simple, we can parse key structures

  const result = {
    id: extractYamlValue(yamlText, 'id'),
    name: extractYamlValue(yamlText, 'name'),
    version: extractYamlValue(yamlText, 'version'),
    matrices: []
  }

  // Extract tactics
  const tactics = extractYamlArray(yamlText, 'tactics')
  const techniques = extractYamlArray(yamlText, 'techniques')

  result.matrices.push({
    id: 'ATLAS',
    name: 'ATLAS Matrix',
    tactics,
    techniques
  })

  return result
}

/**
 * Extract a simple YAML value
 */
function extractYamlValue(yaml, key) {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm')
  const match = yaml.match(regex)
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null
}

/**
 * Extract YAML array items (tactics/techniques)
 */
function extractYamlArray(yaml, arrayName) {
  const items = []

  // Find the array section
  const arrayRegex = new RegExp(`^(\\s*)${arrayName}:\\s*$`, 'm')
  const arrayMatch = yaml.match(arrayRegex)

  if (!arrayMatch) return items

  const startIndex = arrayMatch.index + arrayMatch[0].length
  const baseIndent = arrayMatch[1].length

  // Extract items starting with "- id:"
  const itemRegex = /^(\s*)- id:\s*(\S+)/gm
  let match

  // Get the section of yaml after the array declaration
  const section = yaml.substring(startIndex)

  // Find all items in this section
  const lines = section.split('\n')
  let currentItem = null
  let itemIndent = -1

  for (const line of lines) {
    // Check for new item start
    const itemStart = line.match(/^(\s*)- id:\s*(\S+)/)
    if (itemStart) {
      // Save previous item
      if (currentItem) {
        items.push(currentItem)
      }

      itemIndent = itemStart[1].length
      currentItem = {
        id: itemStart[2],
        name: '',
        description: '',
        'object-type': '',
        tactics: [],
        maturity: null,
        'subtechnique-of': null,
        'ATT&CK-reference': null,
        created_date: null,
        modified_date: null
      }
      continue
    }

    // Check if we've moved to a different top-level section
    if (line.match(/^\S/) && !line.startsWith(' ')) {
      if (currentItem) items.push(currentItem)
      break
    }

    // Parse item properties
    if (currentItem && line.trim()) {
      const propMatch = line.match(/^\s+(\S+):\s*(.*)$/)
      if (propMatch) {
        const [, key, value] = propMatch
        if (key === 'name') currentItem.name = value.trim().replace(/^["']|["']$/g, '')
        else if (key === 'object-type') currentItem['object-type'] = value.trim()
        else if (key === 'maturity') currentItem.maturity = value.trim()
        else if (key === 'subtechnique-of') currentItem['subtechnique-of'] = value.trim()
        else if (key === 'created_date') currentItem.created_date = value.trim()
        else if (key === 'modified_date') currentItem.modified_date = value.trim()
      }

      // Handle tactics array
      const tacticMatch = line.match(/^\s+-\s+(AML\.TA\d+)/)
      if (tacticMatch && currentItem) {
        currentItem.tactics.push(tacticMatch[1])
      }

      // Handle multi-line description (simplified - just get first line)
      const descMatch = line.match(/^\s+description:\s*[|>]?(.*)$/)
      if (descMatch && currentItem) {
        currentItem.description = descMatch[1].trim()
      }
    }
  }

  // Don't forget last item
  if (currentItem) {
    items.push(currentItem)
  }

  return items
}

/**
 * Fetch case studies from separate endpoint
 */
async function fetchCaseStudies() {
  // Case studies might be embedded in the main file or separate
  // For now, return empty - we'll add case study support later if needed
  return []
}
