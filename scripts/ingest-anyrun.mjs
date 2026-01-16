// ANY.RUN Public Sandbox Reports Ingestion
// Fetches public malware analysis reports from ANY.RUN
// Run: node scripts/ingest-anyrun.mjs
//
// ANY.RUN provides interactive malware sandbox analysis
// Public reports are available via API with free tier
// API docs: https://any.run/api-documentation/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, anyrunApiKey } from './env.mjs'

const ANYRUN_API_BASE = 'https://api.any.run/v1'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!anyrunApiKey) {
  console.error('Missing ANYRUN_API_KEY. Get a key at https://any.run/api-documentation/')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `API-Key ${anyrunApiKey}`,
        'Accept': 'application/json',
        ...options.headers
      }
    }

    const req = https.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          } else {
            resolve(JSON.parse(data))
          }
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.end()
  })
}

// Get public submissions history
async function getPublicHistory(skip = 0, limit = 25) {
  const url = `${ANYRUN_API_BASE}/analysis/?skip=${skip}&limit=${limit}&isPublic=true`
  return await fetch(url)
}

// Get task details by UUID
async function getTaskDetails(taskUuid) {
  const url = `${ANYRUN_API_BASE}/analysis/${taskUuid}`
  return await fetch(url)
}

// Get IOCs from a task
async function getTaskIOCs(taskUuid) {
  const url = `${ANYRUN_API_BASE}/analysis/${taskUuid}/ioc`
  try {
    return await fetch(url)
  } catch (e) {
    return { ioc: [] }
  }
}

// Search for public analyses by hash, URL, or filename
async function searchAnalyses(query, type = 'hash') {
  const params = new URLSearchParams({
    isPublic: 'true',
    [type]: query
  })
  const url = `${ANYRUN_API_BASE}/analysis/?${params.toString()}`
  return await fetch(url)
}

async function ingestAnyRun() {
  console.log('Starting ANY.RUN ingestion...')
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0
  let iocCount = 0

  // Fetch recent public analyses
  const maxPages = 10
  const perPage = 25

  for (let page = 0; page < maxPages; page++) {
    const skip = page * perPage

    try {
      console.log(`Fetching page ${page + 1}/${maxPages}...`)

      const response = await getPublicHistory(skip, perPage)
      const tasks = response.data?.tasks || response.tasks || []

      if (tasks.length === 0) {
        console.log('  No more tasks found')
        break
      }

      console.log(`  Found ${tasks.length} public analyses`)

      for (const task of tasks) {
        processed++

        try {
          // Create sandbox report record
          const reportRecord = {
            external_id: task.uuid,
            source: 'anyrun',
            sample_name: task.name || task.mainObject?.filename || 'Unknown',
            sample_hash: task.mainObject?.hashes?.sha256 || task.mainObject?.hashes?.md5 || null,
            sample_type: task.mainObject?.type || null,
            verdict: mapVerdict(task.verdict),
            threat_name: extractThreatName(task),
            score: task.scores?.verdict?.score || null,
            analysis_url: `https://app.any.run/tasks/${task.uuid}`,
            submitted_at: task.date ? new Date(task.date).toISOString() : null,
            metadata: {
              os: task.os || null,
              browser: task.browser || null,
              tags: task.tags || [],
              mitre: task.mitre || [],
              processes_count: task.mainObject?.process?.length || 0,
              network_connections: task.mainObject?.netConnections?.length || 0,
              threats_detected: task.threats || []
            },
            updated_at: new Date().toISOString()
          }

          // Upsert sandbox report
          const { error: reportError } = await supabase
            .from('sandbox_reports')
            .upsert(reportRecord, {
              onConflict: 'external_id,source',
              ignoreDuplicates: false
            })

          if (reportError) {
            // Table might not exist
            if (reportError.message.includes('does not exist')) {
              console.log('  Note: sandbox_reports table does not exist, storing IOCs only')
            } else {
              failed++
              if (failed <= 5) {
                console.error(`    Error upserting report ${task.uuid}:`, reportError.message)
              }
            }
          } else {
            updated++
          }

          // Extract and store IOCs from the task
          if (task.mainObject) {
            // Extract file hashes as IOCs
            const hashes = task.mainObject.hashes || {}

            for (const [hashType, hashValue] of Object.entries(hashes)) {
              if (hashValue) {
                iocCount++
                await storeIOC({
                  value: hashValue,
                  type: 'hash',
                  source: 'anyrun',
                  source_ref: task.uuid,
                  confidence: task.verdict === 'malicious' ? 90 : 60,
                  severity: mapVerdict(task.verdict),
                  tags: [extractThreatName(task), hashType].filter(Boolean),
                  metadata: {
                    hash_type: hashType,
                    sample_name: task.name,
                    analysis_url: `https://app.any.run/tasks/${task.uuid}`
                  }
                })
              }
            }

            // Extract network IOCs (IPs and domains)
            const netConnections = task.mainObject.netConnections || []
            for (const conn of netConnections.slice(0, 20)) {
              if (conn.ip) {
                iocCount++
                await storeIOC({
                  value: conn.ip,
                  type: 'ip',
                  source: 'anyrun',
                  source_ref: task.uuid,
                  confidence: task.verdict === 'malicious' ? 80 : 50,
                  severity: mapVerdict(task.verdict),
                  tags: [extractThreatName(task), 'c2'].filter(Boolean),
                  metadata: {
                    port: conn.port,
                    protocol: conn.protocol,
                    analysis_url: `https://app.any.run/tasks/${task.uuid}`
                  }
                })
              }
              if (conn.domain) {
                iocCount++
                await storeIOC({
                  value: conn.domain,
                  type: 'domain',
                  source: 'anyrun',
                  source_ref: task.uuid,
                  confidence: task.verdict === 'malicious' ? 80 : 50,
                  severity: mapVerdict(task.verdict),
                  tags: [extractThreatName(task), 'c2'].filter(Boolean),
                  metadata: {
                    analysis_url: `https://app.any.run/tasks/${task.uuid}`
                  }
                })
              }
            }
          }

        } catch (e) {
          failed++
          if (failed <= 5) {
            console.error(`    Error processing task ${task.uuid}:`, e.message)
          }
        }
      }

      // Rate limiting - ANY.RUN has strict limits on free tier
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (e) {
      console.error(`  Error fetching page ${page + 1}:`, e.message)
      // If we hit rate limit, stop
      if (e.message.includes('429') || e.message.includes('rate')) {
        console.log('  Rate limited, stopping...')
        break
      }
    }
  }

  console.log('')
  console.log('ANY.RUN Ingestion Complete:')
  console.log(`  Analyses processed: ${processed}`)
  console.log(`  Reports added/updated: ${updated}`)
  console.log(`  IOCs extracted: ${iocCount}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'anyrun',
    status: failed > updated ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: processed,
    records_added: added,
    records_updated: updated,
    metadata: { failed, ioc_count: iocCount }
  })

  return { processed, added, updated, failed, iocCount }
}

async function storeIOC(ioc) {
  const record = {
    value: ioc.value,
    type: ioc.type,
    source: ioc.source,
    source_ref: ioc.source_ref,
    confidence: ioc.confidence,
    severity: ioc.severity,
    tags: ioc.tags,
    metadata: ioc.metadata,
    last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('iocs')
    .upsert(record, {
      onConflict: 'value,type',
      ignoreDuplicates: false
    })

  return !error
}

function mapVerdict(verdict) {
  const verdictMap = {
    'malicious': 'critical',
    'suspicious': 'high',
    'no-threats': 'low',
    'unknown': 'medium'
  }
  return verdictMap[verdict?.toLowerCase()] || 'medium'
}

function extractThreatName(task) {
  // Try to extract malware family/threat name
  if (task.threats && task.threats.length > 0) {
    return task.threats[0].threatName || task.threats[0].name
  }
  if (task.tags && task.tags.length > 0) {
    return task.tags[0]
  }
  return null
}

// Main execution
ingestAnyRun().catch(console.error)
