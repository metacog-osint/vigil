/**
 * MISP Galaxy Threat Actors Ingestion
 * Cloudflare Worker version
 */

const MISP_GALAXY_URL = 'https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json'

export async function ingestMISPGalaxy(supabase) {
  console.log('Starting MISP Galaxy ingestion...')

  let updated = 0
  let failed = 0

  try {
    const response = await fetch(MISP_GALAXY_URL, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const actors = data.values || []

    console.log(`Fetched ${actors.length} threat actors from MISP Galaxy`)

    const batchSize = 50
    for (let i = 0; i < actors.length; i += batchSize) {
      const batch = actors.slice(i, i + batchSize)

      const records = batch.map(actor => {
        // Handle country - can be string or array
        let targetCountries = []
        if (actor.meta?.cfr_suspected_victims) {
          targetCountries = actor.meta.cfr_suspected_victims
        } else if (actor.meta?.country) {
          targetCountries = Array.isArray(actor.meta.country) ? actor.meta.country : [actor.meta.country]
        }

        return {
          name: actor.value,
          aliases: actor.meta?.synonyms || [],
          actor_type: mapActorType(actor.meta),
          status: 'active',
          source: 'misp-galaxy',
          description: actor.description || null,
          target_sectors: actor.meta?.['cfr-target-category'] || actor.meta?.cfr_target_category || [],
          target_countries: targetCountries,
          metadata: {
            uuid: actor.uuid,
            refs: actor.meta?.refs || [],
            cfr_suspected_state_sponsor: actor.meta?.['cfr-suspected-state-sponsor'] || actor.meta?.cfr_suspected_state_sponsor,
            cfr_type_of_incident: actor.meta?.['cfr-type-of-incident'] || actor.meta?.cfr_type_of_incident,
            attribution_confidence: actor.meta?.['attribution-confidence'] || actor.meta?.attribution_confidence,
            origin_country: actor.meta?.country,
            tools: actor.meta?.tools || []
          }
        }
      })

      const { error } = await supabase
        .from('threat_actors')
        .upsert(records, { onConflict: 'name' })

      if (error) {
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('MISP Galaxy error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`MISP Galaxy complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'misp-galaxy', updated, failed }
}

function mapActorType(meta) {
  if (!meta) return 'unknown'
  const sponsor = meta['cfr-suspected-state-sponsor'] || meta.cfr_suspected_state_sponsor
  const incidentType = meta['cfr-type-of-incident'] || meta.cfr_type_of_incident
  if (sponsor) return 'nation-state'
  if (incidentType === 'Espionage') return 'apt'
  if (incidentType === 'Criminal') return 'criminal'
  return 'unknown'
}
