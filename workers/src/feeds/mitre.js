/**
 * MITRE ATT&CK Framework Ingestion
 * Cloudflare Worker version
 *
 * Ingests threat actor groups and named campaigns from MITRE ATT&CK
 */

const MITRE_ENTERPRISE_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json'

export async function ingestMITRE(supabase) {
  console.log('Starting MITRE ATT&CK ingestion...')

  let techniquesUpdated = 0
  let groupsUpdated = 0
  let campaignsUpdated = 0
  let failed = 0

  try {
    const response = await fetch(MITRE_ENTERPRISE_URL, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    const objects = data.objects || []

    // Filter techniques
    const techniques = objects.filter(obj =>
      obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated
    )

    // Filter groups (threat actors)
    const groups = objects.filter(obj =>
      obj.type === 'intrusion-set' && !obj.revoked
    )

    // Filter campaigns (named cyber operations like SolarWinds, Hafnium)
    const campaigns = objects.filter(obj =>
      obj.type === 'campaign' && !obj.revoked
    )

    // Get relationships to link campaigns to actors
    const relationships = objects.filter(obj =>
      obj.type === 'relationship' && obj.relationship_type === 'attributed-to'
    )

    console.log(`Fetched ${techniques.length} techniques, ${groups.length} groups, ${campaigns.length} campaigns from MITRE`)

    // Skip techniques (no mitre_techniques table)
    // We store technique IDs in threat_actors.ttps array instead
    console.log(`Found ${techniques.length} techniques (stored via actor TTPs)`)

    const batchSize = 100

    // Ingest groups as threat actors
    const groupRecords = groups.map(group => {
      const externalRef = group.external_references?.find(r => r.source_name === 'mitre-attack')
      return {
        name: group.name,
        aliases: group.aliases || [],
        actor_type: 'apt',
        status: 'active',
        source: 'mitre-attack',
        description: group.description || null,
        first_seen: group.first_seen ? group.first_seen.split('T')[0] : null,
        last_seen: group.last_seen ? group.last_seen.split('T')[0] : null,
        metadata: {
          stix_id: group.id,
          mitre_id: externalRef?.external_id,
          mitre_url: externalRef?.url
        }
      }
    })

    for (let i = 0; i < groupRecords.length; i += batchSize) {
      const batch = groupRecords.slice(i, i + batchSize)

      const { error } = await supabase
        .from('threat_actors')
        .upsert(batch, { onConflict: 'name' })

      if (error) {
        failed += batch.length
      } else {
        groupsUpdated += batch.length
      }
    }

    // Build a map of STIX IDs to group names for campaign attribution
    const stixToGroup = {}
    for (const group of groups) {
      stixToGroup[group.id] = group.name
    }

    // Map campaign relationships to find attributed actors
    const campaignToActors = {}
    for (const rel of relationships) {
      if (rel.source_ref?.startsWith('campaign--') && rel.target_ref?.startsWith('intrusion-set--')) {
        const actorName = stixToGroup[rel.target_ref]
        if (actorName) {
          if (!campaignToActors[rel.source_ref]) {
            campaignToActors[rel.source_ref] = []
          }
          campaignToActors[rel.source_ref].push(actorName)
        }
      }
    }

    // Ingest campaigns
    const campaignRecords = campaigns.map(campaign => {
      const externalRef = campaign.external_references?.find(r => r.source_name === 'mitre-attack')
      const attributedActors = campaignToActors[campaign.id] || []

      return {
        campaign_id: externalRef?.external_id || campaign.id,
        name: campaign.name,
        description: campaign.description || null,
        first_seen: campaign.first_seen ? campaign.first_seen.split('T')[0] : null,
        last_seen: campaign.last_seen ? campaign.last_seen.split('T')[0] : null,
        attributed_actors: attributedActors,
        source: 'mitre-attack',
        source_url: externalRef?.url || null,
        metadata: {
          stix_id: campaign.id,
          mitre_id: externalRef?.external_id,
          aliases: campaign.aliases || [],
          objective: campaign.objective || null
        }
      }
    })

    console.log(`Processing ${campaignRecords.length} campaigns`)

    // Try to insert campaigns (table may not exist)
    for (let i = 0; i < campaignRecords.length; i += batchSize) {
      const batch = campaignRecords.slice(i, i + batchSize)

      const { error } = await supabase
        .from('campaigns')
        .upsert(batch, { onConflict: 'campaign_id' })

      if (error) {
        // If table doesn't exist, log and continue
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('Note: campaigns table does not exist, skipping campaign ingestion')
          break
        }
        console.error(`Campaign batch error: ${error.message}`)
        failed += batch.length
      } else {
        campaignsUpdated += batch.length
      }
    }

  } catch (error) {
    console.error('MITRE error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`MITRE complete: ${techniquesUpdated} techniques, ${groupsUpdated} groups, ${campaignsUpdated} campaigns, ${failed} failed`)
  return { success: true, source: 'mitre', techniquesUpdated, groupsUpdated, campaignsUpdated, failed }
}
