/**
 * Ransomlook Ransomware Incidents Ingestion
 * Cloudflare Worker version
 */

const RANSOMLOOK_API = 'https://www.ransomlook.io/api/recent'

export async function ingestRansomlook(supabase) {
  console.log('Starting Ransomlook ingestion...')

  let added = 0
  let skipped = 0
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

    // Build candidate records, dropping repeats within this response
    const seen = new Set()
    const records = []
    for (const post of posts) {
      const record = toIncident(post, actorMap)
      const key = incidentKey(record)
      if (seen.has(key)) continue
      seen.add(key)
      records.push(record)
    }

    // Skip incidents already stored (from any source), matched on actor + victim + date.
    // The feed returns the same recent posts every hour, so without this check
    // each run re-inserted them.
    const existingKeys = await fetchExistingKeys(supabase, records)
    const newRecords = records.filter((r) => !existingKeys.has(incidentKey(r)))
    skipped = records.length - newRecords.length

    const batchSize = 250  // see cisa-kev.js on batch size and subrequests
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize)
      const { error } = await supabase.from('incidents').insert(batch)

      if (error) {
        console.error(`Batch error:`, JSON.stringify(error))
        console.error(`First record:`, JSON.stringify(batch[0]))
        lastError = error
        failed += batch.length
      } else {
        added += batch.length
      }
    }

    // Trends and data-quality checks run once per hourly job (see index.js)

  } catch (error) {
    console.error('Ransomlook ingestion error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Ransomlook complete: ${added} added, ${skipped} already stored, ${failed} failed`)

  return {
    success: true,
    source: 'ransomlook',
    added,
    skipped,
    failed,
    lastError: lastError ? lastError.message : null
  }
}

function toIncident(post, actorMap) {
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
}

function incidentKey(record) {
  return `${record.actor_id || ''}|${record.victim_name.toLowerCase()}|${record.discovered_date}`
}

// Quote values for a PostgREST in.() filter
function inList(values) {
  const quoted = values.map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
  return encodeURIComponent(`(${quoted.join(',')})`)
}

async function fetchExistingKeys(supabase, records) {
  const keys = new Set()
  if (records.length === 0) return keys

  const minDate = records.map((r) => r.discovered_date).sort()[0]
  const names = [...new Set(records.map((r) => r.victim_name))]

  // Chunk names to keep URLs a reasonable length
  for (let i = 0; i < names.length; i += 40) {
    const chunk = names.slice(i, i + 40)
    const { data, error } = await supabase
      .from('incidents')
      .select('actor_id,victim_name,discovered_date', `victim_name=in.${inList(chunk)}&discovered_date=gte.${minDate}`)
    if (error) throw new Error(`Dedup lookup failed: ${error.message}`)
    for (const row of data) keys.add(incidentKey(row))
  }

  return keys
}

async function ensureActors(supabase, actorNames) {
  // upsert_actors (migration 079) resolves each group name to its canonical actor:
  // same normalised name, or a spelling merged away earlier (e.g. 'thegentlemen' ->
  // 'The Gentlemen'). Unknown groups are created. Returns [{name, id}].
  const actorMap = {}
  const names = actorNames.filter(Boolean)

  for (let i = 0; i < names.length; i += 50) {
    const records = names.slice(i, i + 50).map((name) => ({
      name,
      actor_type: 'ransomware',
      status: 'active',
      source: 'ransomlook',
      first_seen: new Date().toISOString().split('T')[0],
    }))
    const { data, error } = await supabase.rpc('upsert_actors', { p_actors: records })
    if (error) throw new Error(`upsert_actors failed: ${error.message}`)
    for (const row of data || []) {
      if (row.id) actorMap[row.name] = row.id
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
