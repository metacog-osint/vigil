/**
 * ransomware.live group profiles
 *
 * /v2/groups returns, per ransomware group: ATT&CK tactics/techniques, categorised
 * tooling and leak-site addresses. It answers "which groups use this technique?",
 * which Vigil's own feeds never populated.
 *
 * Only facts are forwarded (technique ids and the source's per-technique note, tool
 * names, onion addresses, the alternate name); the source's written group descriptions
 * are deliberately not copied. Rows land with source = 'ransomware.live'.
 *
 * upsert_group_profiles (migration 087) attaches profiles to actors Vigil already
 * tracks and counts unknown groups rather than creating them, so this reference feed
 * cannot inflate the actor list.
 */

const GROUPS_API = 'https://api.ransomware.live/v2/groups'
const BATCH_SIZE = 25

export async function ingestRansomwareLive(supabase) {
  console.log('Starting ransomware.live group profile ingestion...')

  const totals = { matched: 0, unknown_groups: 0, techniques: 0, techniques_skipped: 0, tools: 0, sites: 0 }

  try {
    const response = await fetch(GROUPS_API, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0', Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const groups = await response.json()
    if (!Array.isArray(groups)) {
      throw new Error('Unexpected response: expected an array of groups')
    }
    console.log(`Fetched ${groups.length} group profiles`)

    const payload = groups.map(toProfile).filter((g) => g.name)

    // Batched: each group carries dozens of techniques and tools, and the whole
    // payload in one statement runs past the API's 8s limit.
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const { data, error } = await supabase.rpc('upsert_group_profiles', {
        p_groups: payload.slice(i, i + BATCH_SIZE),
      })
      if (error) throw new Error(`upsert_group_profiles failed: ${error.message}`)
      for (const [key, value] of Object.entries(data || {})) {
        totals[key] = (totals[key] || 0) + value
      }
    }
  } catch (error) {
    console.error('ransomware.live ingestion error:', error.message)
    return { success: false, source: 'ransomware.live', error: error.message }
  }

  console.log(
    `ransomware.live complete: ${totals.matched} groups matched, ${totals.techniques} techniques, ` +
      `${totals.tools} tools, ${totals.sites} sites, ${totals.unknown_groups} groups not tracked`
  )

  return { success: true, source: 'ransomware.live', ...totals }
}

function toProfile(group) {
  return {
    name: group.name,
    altname: group.altname,
    ttps: Array.isArray(group.ttps) ? group.ttps : [],
    tools: Array.isArray(group.tools) ? group.tools : [],
    locations: (Array.isArray(group.locations) ? group.locations : []).map((l) => ({
      fqdn: l.fqdn,
      enabled: l.enabled,
      available: l.available,
    })),
  }
}
