/**
 * Vigil Threat Intelligence - Cloudflare Worker
 *
 * Handles scheduled data ingestion via Cron Triggers.
 * Replaces GitHub Actions for $0 operating cost.
 */

// IOC Feeds
import { ingestThreatFox } from './feeds/threatfox.js'
import { ingestURLhaus } from './feeds/urlhaus.js'
import { ingestFeodo } from './feeds/feodo.js'
import { ingestMalwareBazaar } from './feeds/malwarebazaar.js'
import { ingestPulsedive } from './feeds/pulsedive.js'
import { ingestTorExits } from './feeds/tor-exits.js'

// Vulnerability Feeds
import { ingestCISAKEV } from './feeds/cisa-kev.js'
import { ingestVulnCheck } from './feeds/vulncheck.js'
import { ingestNVD } from './feeds/nvd.js'
import { ingestEPSS } from './feeds/epss.js'
import { ingestCISAICS } from './feeds/cisa-ics.js'

// Ransomware & Incidents
import { ingestRansomlook } from './feeds/ransomlook.js'
import { ingestRansomwhere } from './feeds/ransomwhere.js'
import { ingestRansomwareLive } from './feeds/ransomware-live.js'
import { ingestOFAC } from './feeds/ofac-sdn.js'

// Threat Actor Databases
import { ingestMalpedia } from './feeds/malpedia.js'
import { ingestMISPGalaxy } from './feeds/misp-galaxy.js'
import { ingestMITRE } from './feeds/mitre.js'
import { ingestMitreAtlas } from './feeds/mitre-atlas.js'

// Network/Routing Intelligence
import { ingestBGPStream } from './feeds/bgpstream.js'

// Enrichment
import { enrichCensys } from './feeds/censys.js'

// Malware Intelligence
import { ingestAnyRun } from './feeds/anyrun.js'

// Supabase Client
import { createSupabaseClient } from './lib/supabase.js'

export default {
  // Cron trigger handler
  async scheduled(event, env, ctx) {
    const cron = event.cron
    const supabase = createSupabaseClient(env)
    const startTime = Date.now()

    console.log(`[${new Date().toISOString()}] Cron triggered: ${cron}`)

    const results = {}

    try {
      switch (cron) {
        // =============================================
        // HOURLY - Critical alerts (ransomware, fresh IOCs)
        // =============================================
        case '15 * * * *':
          console.log('Running hourly critical ingestion...')
          results.ransomlook = await ingestRansomlook(supabase, env)
          results.threatfox = await ingestThreatFox(supabase, env)

          // Data-quality review: merge safe actor duplicates, queue alias matches for
          // review, link orphaned incidents, recompute trends
          // (run_data_quality_checks, migrations 077/080). Result lands in sync_log.
          {
            const { data, error } = await supabase.rpc('run_data_quality_checks')
            results.dataQuality = error ? { success: false, error: error.message } : { success: true, ...data }
          }

          // Actor status: a group whose infrastructure was seized is marked defunct
          // once it has been silent for 180 days, and marked active again the moment
          // it claims another victim (apply_actor_status, migration 096).
          {
            const { data, error } = await supabase.rpc('apply_actor_status')
            results.actorStatus = error ? { success: false, error: error.message } : { success: true, ...data }
          }

          // Locate new IP indicators against the local range table (migration 097).
          // No external call: the ranges live in the database.
          {
            const { data, error } = await supabase.rpc('resolve_ioc_geo', { p_limit: 20000 })
            results.iocGeo = error ? { success: false, error: error.message } : { success: true, ...data }
          }

          break

        // =============================================
        // EVERY 6 HOURS - Main IOC and vulnerability feeds
        // =============================================
        case '0 */6 * * *':
          console.log('Running 6-hourly main ingestion...')

          // IOC feeds
          results.urlhaus = await ingestURLhaus(supabase, env)
          results.feodo = await ingestFeodo(supabase, env)
          results.malwarebazaar = await ingestMalwareBazaar(supabase, env)
          results.pulsedive = await ingestPulsedive(supabase, env)

          // Vulnerability feeds
          results.cisaKev = await ingestCISAKEV(supabase, env)
          results.vulncheck = await ingestVulnCheck(supabase, env)
          results.nvd = await ingestNVD(supabase, env)

          break

        // =============================================
        // DAILY - Slow-changing sources and enrichment
        // =============================================
        case '0 3 * * *':
          console.log('Running daily ingestion...')

          // Actor databases
          results.malpedia = await ingestMalpedia(supabase, env)
          results.mispGalaxy = await ingestMISPGalaxy(supabase, env)

          // Scoring
          results.epss = await ingestEPSS(supabase, env)

          // IP lists
          results.torExits = await ingestTorExits(supabase, env)

          // ICS/OT Advisories
          results.cisaIcs = await ingestCISAICS(supabase, env)

          // Ransomware payments
          results.ransomwhere = await ingestRansomwhere(supabase, env)

          // Group profiles: ATT&CK techniques, tooling and leak sites
          results.ransomwareLive = await ingestRansomwareLive(supabase, env)

          // Sanctions: OFAC-designated digital currency addresses
          results.ofac = await ingestOFAC(supabase, env)

          // Enrichment
          results.censys = await enrichCensys(supabase, env)

          // Network/Routing Intelligence
          results.bgpstream = await ingestBGPStream(supabase, env)

          // Malware Intelligence
          results.anyrun = await ingestAnyRun(supabase, env)
          break

        // =============================================
        // WEEKLY - Reference data (Sunday 4am UTC)
        // =============================================
        case '0 4 * * SUN':
          console.log('Running weekly reference data ingestion...')
          results.mitre = await ingestMITRE(supabase, env)
          results.mitreAtlas = await ingestMitreAtlas(supabase, env)
          break

        default:
          console.log(`Unknown cron schedule: ${cron}`)
      }

      const duration = Date.now() - startTime
      console.log(`Ingestion completed in ${duration}ms`)
      console.log('Results:', JSON.stringify(results, null, 2))

      // Log to sync_log table
      await supabase.from('sync_log').insert({
        source: `cloudflare-worker`,
        status: 'success',
        completed_at: new Date().toISOString(),
        metadata: {
          cron,
          duration_ms: duration,
          results
        }
      })

    } catch (error) {
      console.error('Ingestion error:', error)

      await supabase.from('sync_log').insert({
        source: `cloudflare-worker`,
        status: 'error',
        completed_at: new Date().toISOString(),
        metadata: {
          cron,
          error: error.message
        }
      })
    }
  },

  // HTTP handler (for manual triggers and health checks)
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const supabase = createSupabaseClient(env)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    try {
      // Health check
      if (url.pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        })
      }

      // Everything below triggers ingestion with the service-role key, so it
      // requires the ADMIN_TOKEN secret (set with: npx wrangler secret put ADMIN_TOKEN)
      const authHeader = request.headers.get('Authorization') || ''
      if (!env.ADMIN_TOKEN || authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }

      // List available endpoints
      if (url.pathname === '/') {
        return jsonResponse({
          name: 'Vigil Ingestion Worker',
          endpoints: {
            health: '/health',
            ingest: {
              critical: '/ingest/critical',
              main: '/ingest/main',
              daily: '/ingest/daily',
              weekly: '/ingest/weekly',
              individual: [
                '/ingest/kev',
                '/ingest/cisa-ics',
                '/ingest/threatfox',
                '/ingest/ransomlook',
                '/ingest/ransomwhere',
                '/ingest/ransomware-live',
                '/ingest/ofac',
                '/ingest/urlhaus',
                '/ingest/feodo',
                '/ingest/vulncheck',
                '/ingest/pulsedive',
                '/ingest/malpedia',
                '/ingest/misp-galaxy',
                '/ingest/mitre',
                '/ingest/tor-exits',
                '/ingest/bgpstream',
                '/ingest/anyrun'
              ]
            }
          }
        })
      }

      // Batch triggers
      if (url.pathname === '/ingest/critical') {
        const results = {
          ransomlook: await ingestRansomlook(supabase, env),
          threatfox: await ingestThreatFox(supabase, env)
        }
        return jsonResponse(results)
      }

      if (url.pathname === '/ingest/main') {
        const results = {
          urlhaus: await ingestURLhaus(supabase, env),
          feodo: await ingestFeodo(supabase, env),
          malwarebazaar: await ingestMalwareBazaar(supabase, env),
          cisaKev: await ingestCISAKEV(supabase, env),
          vulncheck: await ingestVulnCheck(supabase, env)
        }
        return jsonResponse(results)
      }

      if (url.pathname === '/ingest/daily') {
        const results = {
          malpedia: await ingestMalpedia(supabase, env),
          mispGalaxy: await ingestMISPGalaxy(supabase, env),
          epss: await ingestEPSS(supabase, env),
          torExits: await ingestTorExits(supabase, env),
          ransomwareLive: await ingestRansomwareLive(supabase, env),
          ofac: await ingestOFAC(supabase, env)
        }
        return jsonResponse(results)
      }

      if (url.pathname === '/ingest/weekly') {
        const results = {
          mitre: await ingestMITRE(supabase, env)
        }
        return jsonResponse(results)
      }

      // Individual feed triggers
      const feedMap = {
        '/ingest/kev': () => ingestCISAKEV(supabase, env),
        '/ingest/cisa-ics': () => ingestCISAICS(supabase, env),
        '/ingest/threatfox': () => ingestThreatFox(supabase, env),
        '/ingest/ransomlook': () => ingestRansomlook(supabase, env),
        '/ingest/ransomwhere': () => ingestRansomwhere(supabase, env),
        '/ingest/ransomware-live': () => ingestRansomwareLive(supabase, env),
        '/ingest/ofac': () => ingestOFAC(supabase, env),
        '/ingest/urlhaus': () => ingestURLhaus(supabase, env),
        '/ingest/feodo': () => ingestFeodo(supabase, env),
        '/ingest/malwarebazaar': () => ingestMalwareBazaar(supabase, env),
        '/ingest/vulncheck': () => ingestVulnCheck(supabase, env),
        '/ingest/nvd': () => ingestNVD(supabase, env),
        '/ingest/epss': () => ingestEPSS(supabase, env),
        '/ingest/pulsedive': () => ingestPulsedive(supabase, env),
        '/ingest/malpedia': () => ingestMalpedia(supabase, env),
        '/ingest/misp-galaxy': () => ingestMISPGalaxy(supabase, env),
        '/ingest/mitre': () => ingestMITRE(supabase, env),
        '/ingest/mitre-atlas': () => ingestMitreAtlas(supabase, env),
        '/ingest/tor-exits': () => ingestTorExits(supabase, env),
        '/ingest/censys': () => enrichCensys(supabase, env),
        '/ingest/bgpstream': () => ingestBGPStream(supabase, env),
        '/ingest/anyrun': () => ingestAnyRun(supabase, env)
      }

      if (feedMap[url.pathname]) {
        const result = await feedMap[url.pathname]()
        return jsonResponse(result)
      }

      return jsonResponse({ error: 'Not found' }, 404)

    } catch (error) {
      console.error('Request error:', error)
      return jsonResponse({ error: error.message }, 500)
    }
  }
}
