/**
 * Censys IP Enrichment
 * Cloudflare Worker version
 *
 * Enriches existing IOC IPs with Censys host data.
 * Free tier: Individual IP lookups only, no search.
 */

const CENSYS_API = 'https://api.platform.censys.io/v3/global'

/**
 * IPs looked up per run. Each one is a fetch() the budget cannot see plus an
 * update it can, so this sets the job's cost: one select and up to BATCH updates
 * on the budget, BATCH more calls inside the reserve. The registry's `cost` for
 * censys must stay at BATCH + 1.
 *
 * The old query selected every IOC in the table (about 600,000 rows, one
 * subrequest per thousand) and then filtered on `type`, which it had not
 * selected. It ran out of budget on every tick from September on, and because it
 * had never succeeded it sorted first at priority 4 every time - so every
 * priority 4 and 5 feed behind it got no budget at all.
 */
export const CENSYS_BATCH = 5

// Newest first, on the (type, created_at) index: 4ms against 21s ordering by
// last_seen, which has no index to stop early on.
const CANDIDATES_QUERY =
  'type=eq.ip&metadata->censys_enriched=is.null&order=created_at.desc'

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
    const { data: candidates, error } = await supabase
      .from('iocs')
      .select('id,value,metadata', CANDIDATES_QUERY, { maxRows: CENSYS_BATCH })

    if (error) {
      return { success: false, error: `could not read IPs to enrich: ${error.message}` }
    }

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

        // A bad key fails every lookup the same way; say so once, plainly.
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: `Censys refused the API key (HTTP ${response.status})` }
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
  return { success: true, source: 'censys', enriched, updated: enriched, failed }
}
