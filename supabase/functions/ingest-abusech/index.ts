// Supabase Edge Function: Ingest Abuse.ch Data
// Fetches malware samples and IOCs from ThreatFox and MalwareBazaar
// Schedule: Every hour via cron

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Abuse.ch APIs
const THREATFOX_URL = 'https://threatfox-api.abuse.ch/api/v1/'
const BAZAAR_URL = 'https://mb-api.abuse.ch/api/v1/'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ThreatFoxIOC {
  id: string
  ioc: string
  ioc_type: string
  threat_type: string
  malware: string
  malware_alias?: string
  confidence_level: number
  first_seen: string
  last_seen?: string
  tags?: string[]
  reference?: string
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
      source: 'abuse_ch',
      status: 'running',
    })
    .select()
    .single()

  const syncId = syncLog?.id

  try {
    console.log('Fetching Abuse.ch data...')

    let recordsProcessed = 0
    let recordsAdded = 0

    // Fetch recent IOCs from ThreatFox (last 7 days)
    const threatFoxResponse = await fetch(THREATFOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'get_iocs', days: 7 }),
    })

    if (threatFoxResponse.ok) {
      const tfData = await threatFoxResponse.json()

      if (tfData.query_status === 'ok' && tfData.data) {
        console.log(`ThreatFox returned ${tfData.data.length} IOCs`)

        for (const ioc of tfData.data.slice(0, 500)) { // Limit to 500 per run
          recordsProcessed++

          // Map ThreatFox IOC type to our schema
          let iocType = 'unknown'
          if (ioc.ioc_type.includes('hash')) {
            if (ioc.ioc_type.includes('sha256')) iocType = 'hash_sha256'
            else if (ioc.ioc_type.includes('sha1')) iocType = 'hash_sha1'
            else if (ioc.ioc_type.includes('md5')) iocType = 'hash_md5'
          } else if (ioc.ioc_type.includes('ip')) {
            iocType = 'ip'
          } else if (ioc.ioc_type.includes('domain')) {
            iocType = 'domain'
          } else if (ioc.ioc_type.includes('url')) {
            iocType = 'url'
          }

          // Map confidence
          let confidence = 'medium'
          if (ioc.confidence_level >= 80) confidence = 'high'
          else if (ioc.confidence_level < 50) confidence = 'low'

          const { error } = await supabase
            .from('iocs')
            .upsert({
              type: iocType,
              value: ioc.ioc,
              malware_family: ioc.malware,
              confidence: confidence,
              first_seen: ioc.first_seen,
              last_seen: ioc.last_seen || ioc.first_seen,
              source: 'threatfox',
              source_url: `https://threatfox.abuse.ch/ioc/${ioc.id}`,
              tags: ioc.tags || [],
              metadata: {
                threatfox_id: ioc.id,
                threat_type: ioc.threat_type,
                malware_alias: ioc.malware_alias,
                reference: ioc.reference,
              },
            }, {
              onConflict: 'type,value',
              ignoreDuplicates: true,
            })

          if (!error) recordsAdded++
        }
      }
    }

    // Fetch recent malware samples from MalwareBazaar
    const bazaarResponse = await fetch(BAZAAR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=get_recent&selector=100',
    })

    if (bazaarResponse.ok) {
      const bzData = await bazaarResponse.json()

      if (bzData.query_status === 'ok' && bzData.data) {
        console.log(`MalwareBazaar returned ${bzData.data.length} samples`)

        for (const sample of bzData.data) {
          recordsProcessed++

          const { error } = await supabase
            .from('malware')
            .upsert({
              sha256: sample.sha256_hash,
              sha1: sample.sha1_hash,
              md5: sample.md5_hash,
              file_name: sample.file_name,
              file_type: sample.file_type,
              file_size: sample.file_size,
              malware_family: sample.signature,
              signature: sample.signature,
              first_seen: sample.first_seen,
              source: 'malwarebazaar',
              source_url: `https://bazaar.abuse.ch/sample/${sample.sha256_hash}`,
              tags: sample.tags || [],
              metadata: {
                reporter: sample.reporter,
                delivery_method: sample.delivery_method,
                intelligence: sample.intelligence,
              },
            }, {
              onConflict: 'sha256',
              ignoreDuplicates: true,
            })

          if (!error) recordsAdded++

          // Also add hashes as IOCs
          for (const [hashType, hashValue] of [
            ['hash_sha256', sample.sha256_hash],
            ['hash_md5', sample.md5_hash],
          ]) {
            if (hashValue) {
              await supabase
                .from('iocs')
                .upsert({
                  type: hashType,
                  value: hashValue,
                  malware_family: sample.signature,
                  confidence: 'high',
                  first_seen: sample.first_seen,
                  source: 'malwarebazaar',
                  tags: sample.tags || [],
                }, {
                  onConflict: 'type,value',
                  ignoreDuplicates: true,
                })
            }
          }
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
      })
      .eq('id', syncId)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${recordsProcessed} records, added ${recordsAdded}`,
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
