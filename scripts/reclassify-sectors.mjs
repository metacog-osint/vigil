// Reclassify Existing Incidents
// Updates sector classification for all incidents using improved classifier
// Run: node scripts/reclassify-sectors.mjs

import { createClient } from '@supabase/supabase-js'
import { classifySector, SECTORS } from './lib/sector-classifier.mjs'

// Load env
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

async function reclassifyIncidents() {
  console.log('Starting incident sector reclassification...')
  console.log('=' .repeat(50))

  const BATCH_SIZE = 500
  let offset = 0
  let updated = 0
  let unchanged = 0
  let improved = 0 // Went from Other/Unknown to specific
  let total = 0

  const sectorStats = {}

  while (true) {
    // Fetch batch of incidents
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, victim_name, victim_sector, victim_website, raw_data')
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error('Error fetching incidents:', error)
      break
    }

    if (!incidents || incidents.length === 0) {
      break
    }

    total += incidents.length

    const updates = []

    for (const incident of incidents) {
      const oldSector = incident.victim_sector || 'Unknown'

      const newSector = classifySector({
        victimName: incident.victim_name,
        website: incident.victim_website || incident.raw_data?.website,
        description: incident.raw_data?.description,
        apiSector: incident.raw_data?.activity || incident.raw_data?.sector,
        activity: incident.raw_data?.activity,
      })

      // Track statistics
      sectorStats[newSector] = (sectorStats[newSector] || 0) + 1

      // Check if this is an improvement
      const wasGeneric = ['Other', 'Unknown', 'Not Found', null, ''].includes(oldSector)
      const isSpecific = !['Other', 'Unknown', SECTORS.OTHER, SECTORS.UNKNOWN].includes(newSector)

      if (newSector !== oldSector) {
        updates.push({
          id: incident.id,
          victim_sector: newSector,
        })

        if (wasGeneric && isSpecific) {
          improved++
        }
        updated++
      } else {
        unchanged++
      }
    }

    // Batch update
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from('incidents')
          .update({ victim_sector: update.victim_sector })
          .eq('id', update.id)
      }
    }

    console.log(`Processed ${total} incidents (${updated} updated, ${improved} improved from Other/Unknown)`)
    offset += BATCH_SIZE
  }

  // Print summary
  console.log('\n' + '='.repeat(50))
  console.log('Reclassification Complete')
  console.log('='.repeat(50))
  console.log(`Total incidents: ${total}`)
  console.log(`Updated: ${updated}`)
  console.log(`Improved (from Other/Unknown): ${improved}`)
  console.log(`Unchanged: ${unchanged}`)

  console.log('\nSector Distribution:')
  const sortedSectors = Object.entries(sectorStats)
    .sort((a, b) => b[1] - a[1])

  for (const [sector, count] of sortedSectors) {
    const pct = ((count / total) * 100).toFixed(1)
    console.log(`  ${sector.padEnd(25)} ${count.toString().padStart(6)} (${pct}%)`)
  }

  // Calculate improvement
  const otherUnknown = (sectorStats['Other'] || 0) + (sectorStats['Unknown'] || 0) + (sectorStats['Not Found'] || 0)
  const specific = total - otherUnknown
  console.log(`\nClassification Rate: ${((specific / total) * 100).toFixed(1)}% specific (${specific}/${total})`)
}

reclassifyIncidents().catch(console.error)
