// Triage (Hatching) Malware Sandbox Ingestion
// Fetches automated malware analysis reports from Triage
// Run: node scripts/ingest-triage.mjs
//
// Triage provides fast automated malware triage and analysis
// Public API available: https://tria.ge/docs/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, triageApiKey } from './env.mjs'

const TRIAGE_API_BASE = 'https://api.tria.ge/v0'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

if (!triageApiKey) {
  console.error('Missing TRIAGE_API_KEY. Get a key at https://tria.ge/account')
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
        'Authorization': `Bearer ${triageApiKey}`,
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

// Search public samples
async function searchSamples(query, offset = 0, limit = 50) {
  const params = new URLSearchParams({
    query,
    offset: offset.toString(),
    limit: limit.toString()
  })
  const url = `${TRIAGE_API_BASE}/search?${params.toString()}`
  return await fetch(url)
}

// Get sample overview
async function getSampleOverview(sampleId) {
  const url = `${TRIAGE_API_BASE}/samples/${sampleId}/overview.json`
  return await fetch(url)
}

// Get sample static analysis
async function getSampleStatic(sampleId) {
  const url = `${TRIAGE_API_BASE}/samples/${sampleId}/reports/static`
  try {
    return await fetch(url)
  } catch (e) {
    return null
  }
}

// Get recent public samples
async function getRecentSamples(limit = 50) {
  // Search for recent malicious samples
  return await searchSamples('family:* OR tag:malware', 0, limit)
}

async function ingestTriage() {
  console.log('Starting Triage ingestion...')
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0
  let iocCount = 0

  // Search for various malware families
  const searches = [
    { name: 'Recent malware', query: 'tag:malware' },
    { name: 'Ransomware', query: 'family:lockbit OR family:blackcat OR family:clop OR family:conti' },
    { name: 'Infostealers', query: 'family:redline OR family:raccoon OR family:vidar OR family:lumma' },
    { name: 'RATs', query: 'family:asyncrat OR family:remcos OR family:njrat OR family:quasar' },
    { name: 'Loaders', query: 'family:emotet OR family:qakbot OR family:icedid OR family:bumblebee' }
  ]

  for (const search of searches) {
    console.log(`Searching: ${search.name}...`)

    try {
      const response = await searchSamples(search.query, 0, 50)
      const samples = response.data || []

      console.log(`  Found ${samples.length} samples`)

      for (const sample of samples) {
        processed++

        try {
          // Get detailed overview
          let overview = null
          try {
            overview = await getSampleOverview(sample.id)
            await new Promise(resolve => setTimeout(resolve, 200))
          } catch (e) {
            // Continue without overview if it fails
          }

          // Create sandbox report record
          const reportRecord = {
            external_id: sample.id,
            source: 'triage',
            sample_name: sample.filename || sample.target || 'Unknown',
            sample_hash: sample.sha256 || sample.sha1 || sample.md5 || null,
            sample_type: sample.kind || null,
            verdict: mapScore(overview?.analysis?.score || sample.score),
            threat_name: extractFamily(sample, overview),
            score: overview?.analysis?.score || sample.score || null,
            analysis_url: `https://tria.ge/${sample.id}`,
            submitted_at: sample.submitted ? new Date(sample.submitted).toISOString() : null,
            completed_at: sample.completed ? new Date(sample.completed).toISOString() : null,
            metadata: {
              kind: sample.kind,
              size: sample.size,
              tags: overview?.analysis?.tags || sample.tags || [],
              family: overview?.analysis?.family || sample.family || [],
              signatures: overview?.signatures || [],
              targets: overview?.targets || []
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
            if (!reportError.message.includes('does not exist')) {
              failed++
              if (failed <= 5) {
                console.error(`    Error upserting report ${sample.id}:`, reportError.message)
              }
            }
          } else {
            updated++
          }

          // Extract and store IOCs
          // File hashes
          const hashes = ['sha256', 'sha1', 'md5']
          for (const hashType of hashes) {
            if (sample[hashType]) {
              iocCount++
              await storeIOC({
                value: sample[hashType],
                type: 'hash',
                source: 'triage',
                source_ref: sample.id,
                confidence: (overview?.analysis?.score || 5) >= 7 ? 90 : 60,
                severity: mapScore(overview?.analysis?.score || sample.score),
                tags: [
                  extractFamily(sample, overview),
                  search.name.toLowerCase().replace(/\s+/g, '-'),
                  hashType
                ].filter(Boolean),
                metadata: {
                  hash_type: hashType,
                  sample_name: sample.filename,
                  analysis_url: `https://tria.ge/${sample.id}`,
                  family: overview?.analysis?.family || sample.family
                }
              })
            }
          }

          // Extract network IOCs from overview
          if (overview?.targets) {
            for (const target of overview.targets.slice(0, 10)) {
              if (target.iocs) {
                // IPs
                for (const ip of (target.iocs.ips || []).slice(0, 10)) {
                  iocCount++
                  await storeIOC({
                    value: ip,
                    type: 'ip',
                    source: 'triage',
                    source_ref: sample.id,
                    confidence: 75,
                    severity: mapScore(overview.analysis?.score),
                    tags: [extractFamily(sample, overview), 'c2'].filter(Boolean),
                    metadata: {
                      analysis_url: `https://tria.ge/${sample.id}`
                    }
                  })
                }

                // Domains
                for (const domain of (target.iocs.domains || []).slice(0, 10)) {
                  iocCount++
                  await storeIOC({
                    value: domain,
                    type: 'domain',
                    source: 'triage',
                    source_ref: sample.id,
                    confidence: 75,
                    severity: mapScore(overview.analysis?.score),
                    tags: [extractFamily(sample, overview), 'c2'].filter(Boolean),
                    metadata: {
                      analysis_url: `https://tria.ge/${sample.id}`
                    }
                  })
                }

                // URLs
                for (const url of (target.iocs.urls || []).slice(0, 10)) {
                  iocCount++
                  await storeIOC({
                    value: url,
                    type: 'url',
                    source: 'triage',
                    source_ref: sample.id,
                    confidence: 75,
                    severity: mapScore(overview.analysis?.score),
                    tags: [extractFamily(sample, overview), 'c2'].filter(Boolean),
                    metadata: {
                      analysis_url: `https://tria.ge/${sample.id}`
                    }
                  })
                }
              }
            }
          }

        } catch (e) {
          failed++
          if (failed <= 5) {
            console.error(`    Error processing sample ${sample.id}:`, e.message)
          }
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (e) {
      console.error(`  Error searching ${search.name}:`, e.message)
      if (e.message.includes('429')) {
        console.log('  Rate limited, waiting...')
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }
  }

  console.log('')
  console.log('Triage Ingestion Complete:')
  console.log(`  Samples processed: ${processed}`)
  console.log(`  Reports added/updated: ${updated}`)
  console.log(`  IOCs extracted: ${iocCount}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'triage',
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

function mapScore(score) {
  if (!score) return 'medium'
  if (score >= 9) return 'critical'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

function extractFamily(sample, overview) {
  // Try to get malware family
  if (overview?.analysis?.family && overview.analysis.family.length > 0) {
    return overview.analysis.family[0]
  }
  if (sample.family && sample.family.length > 0) {
    return Array.isArray(sample.family) ? sample.family[0] : sample.family
  }
  return null
}

// Main execution
ingestTriage().catch(console.error)
