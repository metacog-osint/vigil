/**
 * Malpedia Threat Actors & Malware Ingestion
 * Cloudflare Worker version
 */

const MALPEDIA_ACTORS_URL = 'https://malpedia.caad.fkie.fraunhofer.de/api/list/actors'
const MALPEDIA_FAMILIES_URL = 'https://malpedia.caad.fkie.fraunhofer.de/api/list/families'

export async function ingestMalpedia(supabase) {
  console.log('Starting Malpedia ingestion...')

  let actorsUpdated = 0
  let malwareUpdated = 0
  let failed = 0

  try {
    // Fetch threat actors
    const actorsResponse = await fetch(MALPEDIA_ACTORS_URL, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (actorsResponse.ok) {
      const actorsData = await actorsResponse.json()
      const actorNames = Object.keys(actorsData)

      console.log(`Fetched ${actorNames.length} actors from Malpedia`)

      const actorRecords = actorNames.map(name => {
        const actor = actorsData[name]
        // Handle country - can be string or array
        let targetCountries = []
        if (actor.meta?.country) {
          targetCountries = Array.isArray(actor.meta.country) ? actor.meta.country : [actor.meta.country]
        }

        return {
          name: actor.value || name,
          aliases: actor.synonyms || [],
          actor_type: actor.meta?.type || 'unknown',
          status: 'active',
          source: 'malpedia',
          description: actor.description || null,
          target_countries: targetCountries,
          metadata: {
            malpedia_name: name,
            refs: actor.meta?.refs || [],
            cfr_target_category: actor.meta?.cfr_target_category || [],
            cfr_suspected_state_sponsor: actor.meta?.cfr_suspected_state_sponsor
          }
        }
      })

      const batchSize = 50
      for (let i = 0; i < actorRecords.length; i += batchSize) {
        const batch = actorRecords.slice(i, i + batchSize)

        const { error } = await supabase
          .from('threat_actors')
          .upsert(batch, { onConflict: 'name' })

        if (error) {
          failed += batch.length
        } else {
          actorsUpdated += batch.length
        }
      }
    }

    // Note: Malware families would require a separate table
    // For now, we just ingest actors
    console.log('Skipping malware families (no malware_families table)')

  } catch (error) {
    console.error('Malpedia error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Malpedia complete: ${actorsUpdated} actors, ${malwareUpdated} malware, ${failed} failed`)
  return { success: true, source: 'malpedia', actorsUpdated, malwareUpdated, failed }
}
