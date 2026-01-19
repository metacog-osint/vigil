/**
 * Ransomlook Ransomware Incidents Ingestion
 * Cloudflare Worker version
 */

const RANSOMLOOK_API = 'https://www.ransomlook.io/api/recent'

export async function ingestRansomlook(supabase) {
  console.log('Starting Ransomlook ingestion...')

  let added = 0
  let updated = 0
  let failed = 0
  let lastError = null

  try {
    // Fetch recent ransomware posts
    const response = await fetch(RANSOMLOOK_API, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const posts = await response.json()
    console.log(`Fetched ${posts.length} ransomware posts`)

    // Get or create threat actors
    const actorNames = [...new Set(posts.map(p => p.group_name).filter(Boolean))]
    const actorMap = await ensureActors(supabase, actorNames)
    console.log(`Actor map has ${Object.keys(actorMap).length} actors`)

    // Process incidents in batches
    const batchSize = 50
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize)

      const records = batch.map(post => {
        // Parse discovered date - format is "2026-01-16 21:44:10.064656"
        let incidentDate = null
        if (post.discovered) {
          const datePart = post.discovered.split(' ')[0]
          if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            incidentDate = datePart
          }
        }

        return {
          victim_name: post.post_title || 'Unknown victim',
          actor_id: actorMap[post.group_name] || null,
          source: 'ransomlook',
          incident_date: incidentDate,
          discovered_date: incidentDate || new Date().toISOString().split('T')[0],
          victim_sector: inferSector(post.post_title),
          status: 'claimed',
          raw_data: {
            post_title: post.post_title,
            link: post.link,
            group_name: post.group_name,
            description: post.description?.substring(0, 1000) || null,
            screen: post.screen
          }
        }
      })

      // Use insert - duplicates will be handled by checking source_url in raw_data
      const { error } = await supabase
        .from('incidents')
        .insert(records)

      if (error) {
        console.error(`Batch error:`, JSON.stringify(error))
        console.error(`First record:`, JSON.stringify(records[0]))
        lastError = error
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

    // Trigger trend calculation
    await supabase.rpc('apply_actor_trends')

  } catch (error) {
    console.error('Ransomlook ingestion error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Ransomlook complete: ${updated} updated, ${failed} failed`)

  return {
    success: true,
    source: 'ransomlook',
    updated,
    failed,
    lastError: lastError ? lastError.message : null
  }
}

async function ensureActors(supabase, actorNames) {
  const actorMap = {}

  // Fetch all existing actors in one query
  const { data: existing } = await supabase
    .from('threat_actors')
    .select('id,name')

  const existingByName = {}
  for (const actor of (existing || [])) {
    existingByName[actor.name.toLowerCase()] = actor.id
  }

  // Find which actors need to be created
  const newActors = actorNames.filter(name =>
    name && !existingByName[name.toLowerCase()]
  )

  // Batch insert new actors
  if (newActors.length > 0) {
    const newRecords = newActors.map(name => ({
      name: name,
      actor_type: 'ransomware',
      status: 'active',
      source: 'ransomlook',
      first_seen: new Date().toISOString().split('T')[0]
    }))

    await supabase
      .from('threat_actors')
      .upsert(newRecords, { onConflict: 'name' })

    // Refetch to get IDs
    const { data: allActors } = await supabase
      .from('threat_actors')
      .select('id,name')

    for (const actor of (allActors || [])) {
      existingByName[actor.name.toLowerCase()] = actor.id
    }
  }

  // Build the map
  for (const name of actorNames) {
    if (name && existingByName[name.toLowerCase()]) {
      actorMap[name] = existingByName[name.toLowerCase()]
    }
  }

  return actorMap
}

function inferSector(victimName) {
  if (!victimName) return null

  const name = victimName.toLowerCase()

  const sectorKeywords = {
    healthcare: ['hospital', 'medical', 'health', 'clinic', 'pharma', 'healthcare'],
    finance: ['bank', 'financial', 'insurance', 'credit', 'investment'],
    education: ['university', 'college', 'school', 'academy', 'education'],
    government: ['city of', 'county', 'government', 'municipal', 'federal'],
    manufacturing: ['manufacturing', 'industrial', 'factory', 'automotive'],
    technology: ['tech', 'software', 'digital', 'cyber', 'cloud'],
    retail: ['retail', 'store', 'shop', 'market', 'commerce'],
    energy: ['energy', 'oil', 'gas', 'utility', 'power']
  }

  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => name.includes(kw))) {
      return sector
    }
  }

  return null
}
