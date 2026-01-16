// GitHub Security Advisory Database (GHSA) Ingestion
// Fetches security advisories from GitHub's Advisory Database
// Run: node scripts/ingest-ghsa.mjs [ecosystem]
//
// GHSA provides supply chain vulnerability data for:
// npm, pip, maven, go, rust, nuget, rubygems, composer, pub, erlang, swift

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

const GITHUB_API = 'https://api.github.com/advisories'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN // Optional, for higher rate limits

// Supported ecosystems
const ECOSYSTEMS = ['npm', 'pip', 'maven', 'go', 'rust', 'nuget', 'rubygems', 'composer']

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Vigil-CTI/1.0',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...headers
      }
    }

    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
    }

    https.get(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          // Return headers for pagination
          resolve({
            data: parsed,
            headers: res.headers,
            status: res.statusCode
          })
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`))
        }
      })
    }).on('error', reject)
  })
}

// Extract next page URL from Link header
function getNextPage(linkHeader) {
  if (!linkHeader) return null

  const links = linkHeader.split(',')
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return match[1]
  }
  return null
}

// Fetch advisories with pagination
async function fetchAdvisories(ecosystem = null, maxPages = 10) {
  let url = `${GITHUB_API}?per_page=100`
  if (ecosystem) {
    url += `&ecosystem=${ecosystem}`
  }

  const allAdvisories = []
  let page = 1

  while (url && page <= maxPages) {
    console.log(`  Fetching page ${page}...`)

    const response = await fetch(url)

    if (response.status === 403) {
      console.error('  Rate limited! Consider setting GITHUB_TOKEN for higher limits.')
      break
    }

    if (response.status !== 200) {
      console.error(`  API error: ${response.status}`)
      break
    }

    if (Array.isArray(response.data)) {
      allAdvisories.push(...response.data)
    }

    url = getNextPage(response.headers.link)
    page++

    // Rate limiting
    if (url) {
      await new Promise(resolve => setTimeout(resolve, GITHUB_TOKEN ? 100 : 1000))
    }
  }

  return allAdvisories
}

// Transform GitHub advisory to our schema
function transformAdvisory(advisory) {
  // Get the first vulnerability (most advisories have one)
  const vuln = advisory.vulnerabilities?.[0] || {}
  const pkg = vuln.package || {}

  return {
    ghsa_id: advisory.ghsa_id,
    cve_id: advisory.cve_id,
    summary: advisory.summary,
    description: advisory.description,
    severity: advisory.severity?.toLowerCase(),
    cvss_score: advisory.cvss?.score,
    cvss_vector: advisory.cvss?.vector_string,

    ecosystem: pkg.ecosystem?.toLowerCase(),
    package_name: pkg.name,
    vulnerable_versions: vuln.vulnerable_version_range,
    patched_versions: vuln.patched_versions?.join(', '),

    published_at: advisory.published_at,
    updated_at: advisory.updated_at,
    withdrawn_at: advisory.withdrawn_at,

    references: advisory.references?.map(r => ({
      type: r.type,
      url: r.url
    })) || [],

    credits: advisory.credits?.map(c => ({
      type: c.type,
      user: c.user?.login
    })) || [],

    source: 'github_ghsa',
    source_url: advisory.html_url,
    raw_data: advisory
  }
}

async function ingestGHSA(targetEcosystem = null) {
  const ecosystems = targetEcosystem ? [targetEcosystem] : ECOSYSTEMS

  console.log('Starting GitHub Security Advisory ingestion...')
  console.log(`Ecosystems: ${ecosystems.join(', ')}`)
  console.log('')

  let totalAdded = 0
  let totalUpdated = 0
  let totalFailed = 0
  let totalLinked = 0

  for (const ecosystem of ecosystems) {
    console.log(`\nProcessing ${ecosystem}...`)

    try {
      const advisories = await fetchAdvisories(ecosystem, 5) // Limit pages per ecosystem
      console.log(`  Found ${advisories.length} advisories`)

      let added = 0
      let updated = 0
      let failed = 0

      for (const advisory of advisories) {
        try {
          const record = transformAdvisory(advisory)

          // Check if exists
          const { data: existing } = await supabase
            .from('advisories')
            .select('id')
            .eq('ghsa_id', record.ghsa_id)
            .single()

          if (existing) {
            // Update existing
            const { error } = await supabase
              .from('advisories')
              .update(record)
              .eq('ghsa_id', record.ghsa_id)

            if (error) {
              failed++
              if (failed < 3) console.error(`    Error updating ${record.ghsa_id}:`, error.message)
            } else {
              updated++
            }
          } else {
            // Insert new
            const { data: inserted, error } = await supabase
              .from('advisories')
              .insert(record)
              .select('id')
              .single()

            if (error) {
              failed++
              if (failed < 3) console.error(`    Error inserting ${record.ghsa_id}:`, error.message)
            } else {
              added++

              // Link to CVE if exists
              if (record.cve_id && inserted) {
                const { error: linkError } = await supabase
                  .from('cve_advisories')
                  .insert({
                    cve_id: record.cve_id,
                    advisory_id: inserted.id
                  })
                  .select()

                if (!linkError) {
                  totalLinked++
                }
                // Ignore link errors (CVE may not exist in our DB)
              }
            }
          }
        } catch (e) {
          failed++
        }
      }

      console.log(`  Added: ${added}, Updated: ${updated}, Failed: ${failed}`)

      totalAdded += added
      totalUpdated += updated
      totalFailed += failed

    } catch (e) {
      console.error(`  Error processing ${ecosystem}:`, e.message)
    }

    // Pause between ecosystems
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('')
  console.log('GHSA Ingestion Complete:')
  console.log(`  Total Added: ${totalAdded}`)
  console.log(`  Total Updated: ${totalUpdated}`)
  console.log(`  Total Failed: ${totalFailed}`)
  console.log(`  CVE Links Created: ${totalLinked}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'github_ghsa',
    status: totalFailed > totalAdded ? 'error' : 'success',
    completed_at: new Date().toISOString(),
    records_processed: totalAdded + totalUpdated + totalFailed,
    records_added: totalAdded,
    records_updated: totalUpdated,
    metadata: {
      ecosystems: ecosystems,
      failed: totalFailed,
      cve_links: totalLinked
    }
  })

  return { added: totalAdded, updated: totalUpdated, failed: totalFailed, linked: totalLinked }
}

// Main execution
const targetEcosystem = process.argv[2]

if (targetEcosystem && !ECOSYSTEMS.includes(targetEcosystem)) {
  console.error(`Unknown ecosystem: ${targetEcosystem}`)
  console.error(`Available: ${ECOSYSTEMS.join(', ')}`)
  process.exit(1)
}

ingestGHSA(targetEcosystem).catch(console.error)
