// Supabase Edge Function: Ingest CISA KEV Data
// Fetches Known Exploited Vulnerabilities from CISA
// Schedule: Every 6 hours via cron

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CISAVulnerability {
  cveID: string
  vendorProject: string
  product: string
  vulnerabilityName: string
  dateAdded: string
  shortDescription: string
  requiredAction: string
  dueDate: string
  knownRansomwareCampaignUse: string
  notes?: string
}

interface CISAKEVResponse {
  title: string
  catalogVersion: string
  dateReleased: string
  count: number
  vulnerabilities: CISAVulnerability[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Log sync start
  const { data: syncLog } = await supabase
    .from('sync_log')
    .insert({
      source: 'cisa_kev',
      status: 'running',
    })
    .select()
    .single()

  const syncId = syncLog?.id

  try {
    console.log('Fetching CISA KEV data...')

    const response = await fetch(CISA_KEV_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const data: CISAKEVResponse = await response.json()
    console.log(`Fetched ${data.count} vulnerabilities`)

    let recordsProcessed = 0
    let recordsAdded = 0
    let recordsUpdated = 0

    for (const vuln of data.vulnerabilities) {
      recordsProcessed++

      const { data: existing } = await supabase
        .from('vulnerabilities')
        .select('cve_id, kev_date')
        .eq('cve_id', vuln.cveID)
        .single()

      const vulnData = {
        cve_id: vuln.cveID,
        description: vuln.shortDescription,
        affected_vendors: [vuln.vendorProject],
        affected_products: [vuln.product],
        kev_date: vuln.dateAdded,
        kev_due_date: vuln.dueDate,
        exploited_in_wild: true,
        ransomware_campaign_use: vuln.knownRansomwareCampaignUse === 'Known',
        source: 'cisa_kev',
        metadata: {
          vulnerability_name: vuln.vulnerabilityName,
          required_action: vuln.requiredAction,
          notes: vuln.notes,
        },
      }

      if (existing) {
        // Update if KEV date changed (shouldn't happen often)
        if (existing.kev_date !== vuln.dateAdded) {
          const { error } = await supabase
            .from('vulnerabilities')
            .update(vulnData)
            .eq('cve_id', vuln.cveID)

          if (!error) recordsUpdated++
        }
      } else {
        // Insert new vulnerability
        const { error } = await supabase
          .from('vulnerabilities')
          .insert(vulnData)

        if (error) {
          // May already exist from another source, try update
          await supabase
            .from('vulnerabilities')
            .update({
              kev_date: vuln.dateAdded,
              kev_due_date: vuln.dueDate,
              exploited_in_wild: true,
              ransomware_campaign_use: vuln.knownRansomwareCampaignUse === 'Known',
            })
            .eq('cve_id', vuln.cveID)
          recordsUpdated++
        } else {
          recordsAdded++
        }
      }
    }

    // Update sync log
    await supabase
      .from('sync_log')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_processed: recordsProcessed,
        records_added: recordsAdded,
        records_updated: recordsUpdated,
        metadata: {
          catalog_version: data.catalogVersion,
          date_released: data.dateReleased,
        },
      })
      .eq('id', syncId)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${recordsProcessed} KEVs, added ${recordsAdded}, updated ${recordsUpdated}`,
        catalogVersion: data.catalogVersion,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Ingestion error:', error)

    await supabase
      .from('sync_log')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: error.message,
      })
      .eq('id', syncId)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
