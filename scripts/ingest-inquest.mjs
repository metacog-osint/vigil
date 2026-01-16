// InQuest Labs Document Threat Intelligence Ingestion
// Fetches malicious document analysis from InQuest Labs
// Run: node scripts/ingest-inquest.mjs
//
// InQuest specializes in document-based threats (Office, PDF, etc.)
// Free API available: https://labs.inquest.net/

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey, inquestApiKey } from './env.mjs'

const INQUEST_API_BASE = 'https://labs.inquest.net/api'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

// InQuest Labs has a free tier that works without API key for basic queries
const hasApiKey = !!inquestApiKey

const supabase = createClient(supabaseUrl, supabaseKey)

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const headers = {
      'Accept': 'application/json',
      ...options.headers
    }

    if (hasApiKey) {
      headers['Authorization'] = `Basic ${inquestApiKey}`
    }

    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers
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

// Get DFI (Deep File Inspection) results
async function getDFIList(filter = 'malicious', limit = 100) {
  const url = `${INQUEST_API_BASE}/dfi/list?filter=${filter}&limit=${limit}`
  return await fetch(url)
}

// Get DFI details by SHA256
async function getDFIDetails(sha256) {
  const url = `${INQUEST_API_BASE}/dfi/details?sha256=${sha256}`
  return await fetch(url)
}

// Search DFI by hash
async function searchDFI(hash) {
  const url = `${INQUEST_API_BASE}/dfi/search/hash/${hash}`
  return await fetch(url)
}

// Get IOC feed
async function getIOCFeed(type = 'domain', limit = 100) {
  const url = `${INQUEST_API_BASE}/iocdb/list?type=${type}&limit=${limit}`
  return await fetch(url)
}

// Search IOC database
async function searchIOC(keyword) {
  const url = `${INQUEST_API_BASE}/iocdb/search?keyword=${encodeURIComponent(keyword)}`
  return await fetch(url)
}

// Get reputation for indicator
async function getReputation(indicator) {
  const url = `${INQUEST_API_BASE}/repdb/search?keyword=${encodeURIComponent(indicator)}`
  return await fetch(url)
}

async function ingestInQuest() {
  console.log('Starting InQuest Labs ingestion...')
  console.log(`API Key: ${hasApiKey ? 'Present' : 'Not configured (using free tier)'}`)
  console.log('')

  let added = 0
  let updated = 0
  let failed = 0
  let processed = 0

  // 1. Ingest malicious documents from DFI
  console.log('Fetching malicious documents from DFI...')

  const dfiFilters = ['malicious', 'suspicious']

  for (const filter of dfiFilters) {
    try {
      console.log(`  Filter: ${filter}`)
      const response = await getDFIList(filter, 100)
      const documents = response.data || []

      console.log(`  Found ${documents.length} ${filter} documents`)

      for (const doc of documents) {
        processed++

        try {
          // Store as sandbox report
          const reportRecord = {
            external_id: doc.sha256,
            source: 'inquest',
            sample_name: doc.file_name || doc.filename || 'Unknown',
            sample_hash: doc.sha256,
            sample_type: doc.mime_type || doc.file_type || 'document',
            verdict: filter === 'malicious' ? 'critical' : 'high',
            threat_name: extractThreatName(doc),
            score: doc.inquest_score || null,
            analysis_url: `https://labs.inquest.net/dfi/sha256/${doc.sha256}`,
            submitted_at: doc.first_seen ? new Date(doc.first_seen).toISOString() : null,
            metadata: {
              classification: doc.classification,
              subcategory: doc.subcategory,
              mime_type: doc.mime_type,
              file_type: doc.file_type,
              size: doc.size,
              inquest_alerts: doc.inquest_alerts || [],
              vt_positives: doc.vt_positives,
              vt_weight: doc.vt_weight
            },
            updated_at: new Date().toISOString()
          }

          const { error: reportError } = await supabase
            .from('sandbox_reports')
            .upsert(reportRecord, {
              onConflict: 'external_id,source',
              ignoreDuplicates: false
            })

          if (reportError) {
            if (!reportError.message.includes('does not exist')) {
              failed++
            }
          } else {
            updated++
          }

          // Store file hash as IOC
          await storeIOC({
            value: doc.sha256,
            type: 'hash',
            source: 'inquest',
            confidence: filter === 'malicious' ? 90 : 70,
            severity: filter === 'malicious' ? 'critical' : 'high',
            tags: ['document', doc.file_type, extractThreatName(doc)].filter(Boolean),
            metadata: {
              hash_type: 'sha256',
              file_name: doc.file_name,
              mime_type: doc.mime_type,
              classification: doc.classification,
              analysis_url: `https://labs.inquest.net/dfi/sha256/${doc.sha256}`
            }
          })

          // Also store MD5 if available
          if (doc.md5) {
            await storeIOC({
              value: doc.md5,
              type: 'hash',
              source: 'inquest',
              confidence: filter === 'malicious' ? 90 : 70,
              severity: filter === 'malicious' ? 'critical' : 'high',
              tags: ['document', doc.file_type, extractThreatName(doc)].filter(Boolean),
              metadata: {
                hash_type: 'md5',
                sha256: doc.sha256
              }
            })
          }

        } catch (e) {
          failed++
          if (failed <= 5) {
            console.error(`    Error processing ${doc.sha256}:`, e.message)
          }
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (e) {
      console.error(`  Error fetching ${filter} documents:`, e.message)
    }
  }

  // 2. Ingest IOC database
  console.log('')
  console.log('Fetching IOC database...')

  const iocTypes = ['domain', 'ip', 'url', 'email']

  for (const type of iocTypes) {
    try {
      console.log(`  Type: ${type}`)
      const response = await getIOCFeed(type, 100)
      const iocs = response.data || []

      console.log(`  Found ${iocs.length} ${type} IOCs`)

      for (const ioc of iocs) {
        processed++

        try {
          await storeIOC({
            value: ioc.data || ioc.indicator,
            type: mapIOCType(type),
            source: 'inquest',
            confidence: 80,
            severity: 'high',
            first_seen: ioc.created_date ? new Date(ioc.created_date).toISOString() : null,
            tags: [ioc.reference_text, 'document-threat'].filter(Boolean),
            metadata: {
              reference: ioc.reference,
              reference_text: ioc.reference_text,
              artifact_type: type
            }
          })

          updated++

        } catch (e) {
          failed++
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (e) {
      console.error(`  Error fetching ${type} IOCs:`, e.message)
    }
  }

  // 3. Search for specific document-based malware
  console.log('')
  console.log('Searching for specific document threats...')

  const searches = ['emotet', 'qakbot', 'icedid', 'macro', 'powershell']

  for (const keyword of searches) {
    try {
      console.log(`  Searching: ${keyword}`)
      const response = await searchIOC(keyword)
      const results = response.data || []

      console.log(`  Found ${results.length} results`)

      for (const result of results.slice(0, 25)) {
        processed++

        try {
          const iocType = determineIOCType(result.artifact)

          if (iocType) {
            await storeIOC({
              value: result.artifact,
              type: iocType,
              source: 'inquest',
              confidence: 75,
              severity: 'high',
              tags: [keyword, result.artifact_type, 'document-threat'].filter(Boolean),
              metadata: {
                search_keyword: keyword,
                reference: result.reference,
                artifact_type: result.artifact_type
              }
            })

            updated++
          }

        } catch (e) {
          failed++
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500))

    } catch (e) {
      console.error(`  Error searching ${keyword}:`, e.message)
    }
  }

  console.log('')
  console.log('InQuest Labs Ingestion Complete:')
  console.log(`  Processed: ${processed}`)
  console.log(`  Added/Updated: ${updated}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'inquest',
    status: failed > updated ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: processed,
    records_added: added,
    records_updated: updated,
    metadata: { failed }
  })

  return { processed, added, updated, failed }
}

async function storeIOC(ioc) {
  const record = {
    value: ioc.value,
    type: ioc.type,
    source: ioc.source,
    confidence: ioc.confidence,
    severity: ioc.severity,
    first_seen: ioc.first_seen || null,
    last_seen: new Date().toISOString(),
    tags: ioc.tags || [],
    metadata: ioc.metadata || {},
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

function mapIOCType(inquestType) {
  const typeMap = {
    'domain': 'domain',
    'ip': 'ip',
    'url': 'url',
    'email': 'email',
    'hash': 'hash'
  }
  return typeMap[inquestType] || 'unknown'
}

function determineIOCType(artifact) {
  if (!artifact) return null

  // IP address pattern
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(artifact)) {
    return 'ip'
  }

  // URL pattern
  if (/^https?:\/\//i.test(artifact)) {
    return 'url'
  }

  // Email pattern
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(artifact)) {
    return 'email'
  }

  // Hash patterns
  if (/^[a-f0-9]{32}$/i.test(artifact)) return 'hash' // MD5
  if (/^[a-f0-9]{40}$/i.test(artifact)) return 'hash' // SHA1
  if (/^[a-f0-9]{64}$/i.test(artifact)) return 'hash' // SHA256

  // Domain pattern (basic)
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(artifact)) {
    return 'domain'
  }

  return null
}

function extractThreatName(doc) {
  if (doc.classification) return doc.classification
  if (doc.subcategory) return doc.subcategory
  if (doc.inquest_alerts && doc.inquest_alerts.length > 0) {
    return doc.inquest_alerts[0].category || doc.inquest_alerts[0].title
  }
  return null
}

// Main execution
ingestInQuest().catch(console.error)
