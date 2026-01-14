// Ransomware.live Data Ingestion
// Source: https://www.ransomware.live/
// Ingests ransomware gang posts/victim claims
// Run: node scripts/ingest-ransomware-live.mjs
// Run with --full flag to fetch ALL historical data: node scripts/ingest-ransomware-live.mjs --full

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { classifySector } from './lib/sector-classifier.mjs'

// Check for --full flag
const FULL_HISTORICAL = process.argv.includes('--full')

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

const API_BASE = 'https://api.ransomware.live/v2'

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Vigil-CTI-Dashboard/1.0',
        'Accept': 'application/json',
      },
      timeout: 60000, // Increased timeout for larger responses
    }

    const req = https.get(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout for ${url}`))
    })
  })
}

// Generate list of year/month pairs from start date to now
function getMonthsToFetch(startYear = 2020) {
  const months = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  for (let year = startYear; year <= currentYear; year++) {
    const endMonth = year === currentYear ? currentMonth : 12
    for (let month = 1; month <= endMonth; month++) {
      months.push({ year, month: month.toString().padStart(2, '0') })
    }
  }
  return months
}

async function ingestRansomwareLive() {
  console.log('Fetching Ransomware.live data...')
  console.log('Source: https://www.ransomware.live/')
  console.log(`Mode: ${FULL_HISTORICAL ? 'FULL HISTORICAL (2020-present)' : 'Recent victims only'}\n`)

  // Fetch groups
  console.log('Fetching groups...')
  let groups = []
  try {
    groups = await fetchJSON(`${API_BASE}/groups`)
    console.log(`Found ${groups.length} groups`)
  } catch (error) {
    console.error('Failed to fetch groups:', error.message)
  }

  // Build actor map first
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

  // Process groups
  for (const group of groups) {
    const groupName = group.name || group
    if (typeof groupName !== 'string') continue

    const lowerName = groupName.toLowerCase()

    if (!actorMap.has(lowerName)) {
      const actorData = {
        name: groupName,
        actor_type: 'ransomware',
        status: 'active',
        source: 'ransomware.live',
        description: group.description || null,
        metadata: {
          ransomware_live_name: groupName,
          url: group.url || null,
          profiles: group.profiles || [],
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

  // Fetch victims - either recent or full historical
  let allVictims = []

  if (FULL_HISTORICAL) {
    // Fetch month by month to get full history
    const months = getMonthsToFetch(2020)
    console.log(`\nFetching historical data for ${months.length} months (2020-present)...`)
    console.log('This will take a few minutes. Adding 1s delay between requests to avoid rate limits.\n')

    for (const { year, month } of months) {
      try {
        const url = `${API_BASE}/victims/${year}/${month}`
        const victims = await fetchJSON(url)
        if (Array.isArray(victims) && victims.length > 0) {
          allVictims.push(...victims)
          console.log(`  ${year}-${month}: ${victims.length} victims`)
        } else {
          console.log(`  ${year}-${month}: 0 victims`)
        }
        await sleep(1000) // 1 second delay between requests
      } catch (error) {
        console.error(`  ${year}-${month}: Failed - ${error.message}`)
        await sleep(2000) // Longer delay on error
      }
    }
    console.log(`\nTotal historical victims fetched: ${allVictims.length}`)
  } else {
    // Just fetch recent victims (default behavior)
    console.log('\nFetching recent victims...')
    try {
      allVictims = await fetchJSON(`${API_BASE}/recentvictims`)
      console.log(`Found ${allVictims.length} recent victims`)
    } catch (error) {
      console.error('Failed to fetch recent victims:', error.message)
      try {
        allVictims = await fetchJSON(`${API_BASE}/recentcyberattacks`)
        console.log(`Found ${allVictims.length} recent cyberattacks (fallback)`)
      } catch (e) {
        console.error('Failed to fetch cyberattacks:', e.message)
        return
      }
    }
  }

  // Process victims/incidents
  console.log('\nIngesting incidents...')
  let incidentsAdded = 0
  let incidentsSkipped = 0
  let incidentsFailed = 0

  for (let i = 0; i < allVictims.length; i++) {
    const victim = allVictims[i]

    // Ransomware.live structure varies, try multiple field names
    const groupName = victim.group_name || victim.group || ''
    const victimName = victim.victim || victim.post_title || victim.name || 'Unknown'
    const discoveredDate = parseDate(victim.discovered || victim.published || victim.date)

    if (!discoveredDate) {
      incidentsSkipped++
      continue
    }

    // Find or create actor
    let actorId = actorMap.get(groupName.toLowerCase())

    if (!actorId && groupName) {
      const { data: newActor } = await supabase
        .from('threat_actors')
        .insert({
          name: groupName,
          actor_type: 'ransomware',
          status: 'active',
          source: 'ransomware.live',
        })
        .select()
        .single()

      if (newActor) {
        actorId = newActor.id
        actorMap.set(groupName.toLowerCase(), actorId)
        actorsAdded++
      }
    }

    if (!actorId) {
      incidentsFailed++
      continue
    }

    // Use API-provided sector if available, otherwise classify
    const apiSector = victim.activity || victim.sector || victim.industry
    const normalizedSector = classifySector({
      victimName: victimName,
      website: victim.website || victim.url || null,
      apiSector: apiSector,
      activity: victim.activity,
    })

    const incidentData = {
      actor_id: actorId,
      victim_name: victimName,
      victim_sector: normalizedSector,
      victim_country: victim.country || null,
      victim_website: victim.website || victim.url || null,
      discovered_date: discoveredDate,
      status: 'claimed',
      source: 'ransomware.live',
      source_url: victim.post_url || null,
      raw_data: {
        group_name: groupName,
        victim: victimName,
        discovered: victim.discovered,
        activity: victim.activity,
        country: victim.country,
        website: victim.website,
      }
    }

    // Check for existing (dedup)
    const { data: existing } = await supabase
      .from('incidents')
      .select('id, source')
      .eq('actor_id', actorId)
      .eq('victim_name', victimName)
      .eq('discovered_date', discoveredDate)
      .single()

    if (existing) {
      // Mark as corroborated if from different source
      if (existing.source !== 'ransomware.live' && !existing.source?.includes('ransomware.live')) {
        await supabase
          .from('incidents')
          .update({
            source: `${existing.source}, ransomware.live`,
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

    // Progress every 500 records
    if (i % 500 === 0 && i > 0) {
      console.log(`  Processed ${i}/${allVictims.length} victims... (${incidentsAdded} added, ${incidentsSkipped} skipped)`)
    }
  }

  // Update actor last_seen dates
  console.log('\nUpdating actor last_seen dates...')
  for (const [, actorId] of actorMap) {
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
    source: 'ransomware.live',
    status: 'success',
    records_processed: allVictims.length,
    records_added: incidentsAdded,
    records_updated: incidentsSkipped,
    completed_at: new Date().toISOString(),
    metadata: { mode: FULL_HISTORICAL ? 'full_historical' : 'recent_only' }
  })

  console.log('\n' + '='.repeat(50))
  console.log('Ransomware.live Ingestion Complete')
  console.log('='.repeat(50))
  console.log(`Mode: ${FULL_HISTORICAL ? 'Full Historical' : 'Recent Only'}`)
  console.log(`Groups processed: ${groups.length}`)
  console.log(`Victims processed: ${allVictims.length}`)
  console.log(`Incidents added: ${incidentsAdded}`)
  console.log(`Incidents skipped (duplicate): ${incidentsSkipped}`)
  console.log(`Incidents failed: ${incidentsFailed}`)
}

ingestRansomwareLive().catch(console.error)
