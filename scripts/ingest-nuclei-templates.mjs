// Nuclei Templates Ingestion
// Source: https://github.com/projectdiscovery/nuclei-templates
// Imports vulnerability detection templates with CVE mappings
// Run: node scripts/ingest-nuclei-templates.mjs

import { createClient } from '@supabase/supabase-js'
import { fetchJSON, sleep } from './lib/http.mjs'
import { supabaseUrl, supabaseKey } from './env.mjs'

// GitHub API for nuclei-templates repository
const GITHUB_API = 'https://api.github.com'
const REPO_OWNER = 'projectdiscovery'
const REPO_NAME = 'nuclei-templates'

// Template categories with CVE references
const TEMPLATE_PATHS = [
  'cves',           // CVE-specific templates
  'vulnerabilities', // General vulnerability templates
  'exposures',      // Exposure detection
  'misconfiguration', // Misconfigurations
]

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Optional GitHub token for higher rate limits
const githubToken = process.env.GITHUB_TOKEN

function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Vigil-ThreatIntel/1.0',
  }
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`
  }
  return headers
}

async function fetchGitHubAPI(endpoint) {
  const url = `${GITHUB_API}${endpoint}`
  const response = await fetch(url, { headers: getHeaders() })

  if (!response.ok) {
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining')
      if (remaining === '0') {
        const resetTime = response.headers.get('X-RateLimit-Reset')
        throw new Error(`Rate limited. Resets at ${new Date(resetTime * 1000).toISOString()}`)
      }
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  return response.json()
}

async function fetchTemplateContent(path) {
  // Use raw content URL for template files
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${path}`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) return null
    return response.text()
  } catch {
    return null
  }
}

function parseTemplateYAML(content) {
  // Simple YAML parsing for nuclei template metadata
  // Templates have id, info.name, info.severity, info.description, info.reference
  const template = {}

  // Extract id
  const idMatch = content.match(/^id:\s*(.+)$/m)
  if (idMatch) template.id = idMatch[1].trim()

  // Extract info block values
  const nameMatch = content.match(/name:\s*(.+)$/m)
  if (nameMatch) template.name = nameMatch[1].trim()

  const severityMatch = content.match(/severity:\s*(.+)$/m)
  if (severityMatch) template.severity = severityMatch[1].trim().toLowerCase()

  const descMatch = content.match(/description:\s*[|>]?\s*\n?([\s\S]*?)(?=\n\s*\w+:|$)/m)
  if (descMatch) {
    template.description = descMatch[1].trim().split('\n')[0].trim()
  }

  // Extract CVE references
  const cveMatches = content.match(/CVE-\d{4}-\d{4,}/gi) || []
  template.cves = [...new Set(cveMatches.map(c => c.toUpperCase()))]

  // Extract references
  const refSection = content.match(/reference:\s*\n((?:\s*-\s*.+\n?)+)/m)
  if (refSection) {
    template.references = refSection[1]
      .split('\n')
      .map(line => line.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
  }

  // Extract tags
  const tagsMatch = content.match(/tags:\s*(.+)$/m)
  if (tagsMatch) {
    template.tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean)
  }

  // Extract classification
  const cvssMatch = content.match(/cvss-score:\s*([\d.]+)/m)
  if (cvssMatch) template.cvss_score = parseFloat(cvssMatch[1])

  const cweMatch = content.match(/cwe-id:\s*CWE-(\d+)/mi)
  if (cweMatch) template.cwe_id = parseInt(cweMatch[1], 10)

  return template
}

async function listTemplatesInDirectory(path) {
  try {
    const contents = await fetchGitHubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`)
    return contents.filter(item => item.type === 'file' && item.name.endsWith('.yaml'))
  } catch (error) {
    console.error(`  Error listing ${path}: ${error.message}`)
    return []
  }
}

async function listYearDirectories(basePath) {
  try {
    const contents = await fetchGitHubAPI(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${basePath}`)
    return contents.filter(item => item.type === 'dir' && /^\d{4}$/.test(item.name))
  } catch {
    return []
  }
}

async function processTemplate(filePath) {
  const content = await fetchTemplateContent(filePath)
  if (!content) return null

  const template = parseTemplateYAML(content)
  if (!template.id) return null

  return {
    template_id: template.id,
    name: template.name,
    severity: template.severity,
    description: template.description,
    cves: template.cves || [],
    references: template.references || [],
    tags: template.tags || [],
    cvss_score: template.cvss_score,
    cwe_id: template.cwe_id,
    file_path: filePath,
    source: 'nuclei_templates',
  }
}

async function ingestNucleiTemplates(options = {}) {
  console.log('=== Nuclei Templates Ingestion ===')
  console.log('Source: https://github.com/projectdiscovery/nuclei-templates')
  console.log('')

  const { maxTemplates = 1000, categories = ['cves'] } = options

  let totalProcessed = 0
  let totalCVEsLinked = 0
  let templatesInserted = 0
  const cveTemplateMap = new Map()

  for (const category of categories) {
    console.log(`\nProcessing category: ${category}`)

    let templateFiles = []

    if (category === 'cves') {
      // CVEs are organized by year subdirectories
      const yearDirs = await listYearDirectories(category)
      console.log(`  Found ${yearDirs.length} year directories`)

      for (const yearDir of yearDirs.slice(-5)) { // Last 5 years
        const files = await listTemplatesInDirectory(`${category}/${yearDir.name}`)
        templateFiles.push(...files.map(f => `${category}/${yearDir.name}/${f.name}`))

        if (templateFiles.length >= maxTemplates) break
        await sleep(100) // Rate limiting
      }
    } else {
      // Other categories have templates directly
      const files = await listTemplatesInDirectory(category)
      templateFiles = files.map(f => `${category}/${f.name}`).slice(0, maxTemplates)
    }

    console.log(`  Found ${templateFiles.length} templates`)

    // Process templates in batches
    const batchSize = 20
    for (let i = 0; i < Math.min(templateFiles.length, maxTemplates - totalProcessed); i += batchSize) {
      const batch = templateFiles.slice(i, i + batchSize)

      const templates = await Promise.all(
        batch.map(async (filePath) => {
          await sleep(50) // Rate limiting
          return processTemplate(filePath)
        })
      )

      const validTemplates = templates.filter(Boolean)

      for (const template of validTemplates) {
        totalProcessed++

        // Track CVE to template mappings
        for (const cve of template.cves) {
          if (!cveTemplateMap.has(cve)) {
            cveTemplateMap.set(cve, [])
          }
          cveTemplateMap.get(cve).push({
            template_id: template.template_id,
            name: template.name,
            severity: template.severity,
          })
          totalCVEsLinked++
        }
      }

      // Progress update
      if ((i + batchSize) % 100 === 0 || i + batchSize >= templateFiles.length) {
        console.log(`  Processed ${Math.min(i + batchSize, templateFiles.length)}/${templateFiles.length} templates`)
      }
    }
  }

  // Update vulnerabilities with nuclei template info
  console.log('\nLinking templates to vulnerabilities...')

  const cveIds = Array.from(cveTemplateMap.keys())
  let vulnsUpdated = 0

  for (let i = 0; i < cveIds.length; i += 50) {
    const batch = cveIds.slice(i, i + 50)

    for (const cveId of batch) {
      const templates = cveTemplateMap.get(cveId)

      const { error } = await supabase
        .from('vulnerabilities')
        .update({
          has_nuclei_template: true,
          nuclei_templates: templates,
          updated_at: new Date().toISOString(),
        })
        .eq('cve_id', cveId)

      if (!error) vulnsUpdated++
    }

    await sleep(100)
  }

  console.log('\n=== Summary ===')
  console.log(`Templates processed: ${totalProcessed}`)
  console.log(`CVE references found: ${totalCVEsLinked}`)
  console.log(`Unique CVEs: ${cveTemplateMap.size}`)
  console.log(`Vulnerabilities updated: ${vulnsUpdated}`)

  // Log to sync_log
  await supabase.from('sync_log').insert({
    source: 'nuclei_templates',
    status: 'completed',
    records_processed: totalProcessed,
    records_inserted: vulnsUpdated,
    metadata: {
      categories,
      unique_cves: cveTemplateMap.size,
      cve_references: totalCVEsLinked,
    },
  })

  return {
    processed: totalProcessed,
    cves: cveTemplateMap.size,
    vulnsUpdated,
  }
}

// Main
const args = process.argv.slice(2)
const maxTemplates = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '500', 10)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Nuclei Templates Ingestion')
  console.log('')
  console.log('Usage: node scripts/ingest-nuclei-templates.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --max=N     Maximum templates to process (default: 500)')
  console.log('  --all       Process all categories')
  console.log('')
  console.log('Set GITHUB_TOKEN env var for higher API rate limits')
} else if (args.includes('--all')) {
  ingestNucleiTemplates({
    maxTemplates,
    categories: TEMPLATE_PATHS
  })
} else {
  ingestNucleiTemplates({
    maxTemplates,
    categories: ['cves']
  })
}
