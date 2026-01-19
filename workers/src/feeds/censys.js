/**
 * Censys IP Enrichment
 * Cloudflare Worker version
 *
 * Enriches existing IOC IPs with Censys host data.
 * Free tier: Individual IP lookups only, no search.
 */

const CENSYS_API = 'https://api.platform.censys.io/v3/global'

export async function enrichCensys(supabase, env) {
  console.log('Starting Censys enrichment...')

  const apiKey = env.CENSYS_API_KEY
  if (!apiKey) {
    console.log('No CENSYS_API_KEY configured, skipping')
    return { success: true, source: 'censys', skipped: true }
  }

  let enriched = 0
  let failed = 0

  try {
    // Get IPs that haven't been enriched yet
    const { data: allIocs } = await supabase
      .from('iocs')
      .select('id,value,metadata,source')

    // Filter to IPs without censys enrichment (limit 50 for free tier)
    const candidates = (allIocs || [])
      .filter(ioc =>
        ioc.type === 'ip' &&
        !ioc.metadata?.censys_enriched
      )
      .slice(0, 50)

    console.log(`Found ${candidates.length} IPs to enrich`)

    for (const ioc of candidates) {
      try {
        // Rate limiting - free tier has 1 concurrent action limit
        await new Promise(r => setTimeout(r, 1000))

        const response = await fetch(`${CENSYS_API}/asset/host/${ioc.value}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'Vigil-ThreatIntel/1.0'
          }
        })

        if (response.status === 404) {
          // IP not in Censys, mark as checked
          await supabase
            .from('iocs')
            .update({
              metadata: { ...ioc.metadata, censys_enriched: true, censys_no_data: true }
            })
            .eq('id', ioc.id)
          continue
        }

        if (response.status === 429) {
          console.log('Rate limited, stopping enrichment')
          break
        }

        if (!response.ok) {
          failed++
          continue
        }

        const data = await response.json()
        const host = data.result || data

        const enrichedMetadata = {
          ...ioc.metadata,
          censys_enriched: true,
          censys_updated: new Date().toISOString(),
          autonomous_system: host.autonomous_system || null,
          location: host.location || null,
          operating_system: host.operating_system || null,
          services: (host.services || []).slice(0, 10).map(s => ({
            port: s.port,
            service_name: s.service_name,
            software: s.software?.map(sw => sw.product)?.slice(0, 5) || []
          })),
          last_updated_at: host.last_updated_at || null
        }

        await supabase
          .from('iocs')
          .update({ metadata: enrichedMetadata })
          .eq('id', ioc.id)

        enriched++

      } catch (e) {
        failed++
      }
    }

  } catch (error) {
    console.error('Censys error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`Censys complete: ${enriched} enriched, ${failed} failed`)
  return { success: true, source: 'censys', enriched, failed }
}
