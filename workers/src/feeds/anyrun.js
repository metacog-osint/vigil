/**
 * ANY.RUN Malware Trends Ingestion
 * Cloudflare Worker version
 *
 * Scrapes public malware trend data from ANY.RUN's trends page.
 * Note: This uses publicly available data - no API key required.
 * For full IOC access, a paid API subscription is needed.
 *
 * A run that cannot read or parse the page writes nothing and reports a failure, so
 * sync_log and feed health show it.
 */

import { createInsertTally } from '../lib/inserts.js'

const ANYRUN_TRENDS_URL = 'https://any.run/malware-trends/'

// Malware families we want to track - high-priority threats
const PRIORITY_MALWARE = [
  'asyncrat', 'remcos', 'agenttesla', 'formbook', 'lokibot',
  'redline', 'lumma', 'xworm', 'njrat', 'quasar',
  'raccoon', 'vidar', 'amadey', 'smokeloader', 'emotet',
  'qakbot', 'icedid', 'pikabot', 'darkgate', 'stealc'
]

export async function ingestAnyRun(supabase, env) {
  console.log('Starting ANY.RUN malware trends ingestion...')

  let updated = 0
  const inserts = createInsertTally()
  let failed = 0
  let lastError = null

  try {
    // Fetch the trends page
    const response = await fetch(ANYRUN_TRENDS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Extract malware data from the page
    // ANY.RUN trends page contains JSON-LD structured data and table rows
    const malwareData = extractMalwareData(html)

    console.log(`Extracted ${malwareData.length} malware families from ANY.RUN trends`)

    if (malwareData.length === 0) {
      console.log('ANY.RUN: no malware families found on the trends page; nothing written')
      return { success: false, source: 'anyrun-trends', error: 'no malware families found on the trends page' }
    }

    // Filter to priority malware and create records
    const records = malwareData
      .filter(m => m.name && m.type)
      .slice(0, 50)
      .map(malware => ({
        name: malware.name,
        type: mapMalwareType(malware.type),
        source: 'anyrun-trends',
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true,
        aliases: [malware.name.toLowerCase()],
        description: `${malware.name} - ${malware.type}. Activity: ${malware.tasks || 'unknown'} samples analyzed.`,
        sample_count: malware.tasks || 0,
        weekly_activity: malware.weeklyTasks || 0,
        source_url: `https://any.run/malware-trends/${malware.name.toLowerCase()}/`,
        metadata: {
          anyrun_type: malware.type,
          weekly_trend: malware.trend || null,
          rank: malware.rank || null
        }
      }))

    // Upsert to malware_families table
    if (records.length > 0) {
      const { error, inserted } = await supabase
        .from('malware_families')
        .upsert(records, { onConflict: 'name', countInserted: true })

      if (error) {
        console.error(`ANY.RUN batch error: ${error.message}`)
        lastError = error.message
        failed += records.length
      } else {
        updated += records.length - inserts.record(inserted)
      }
    }

  } catch (error) {
    console.error('ANY.RUN error:', error.message)
    return { success: false, source: 'anyrun-trends', error: error.message }
  }

  console.log(`ANY.RUN complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'anyrun-trends', added: inserts.added, updated, failed, lastError }
}

/**
 * Extract malware data from HTML
 * Looks for structured data and common patterns
 */
function extractMalwareData(html) {
  const malwareList = []

  // Try to extract from JSON-LD schema
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const jsonStr = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '')
        const data = JSON.parse(jsonStr)
        if (data.itemListElement) {
          for (const item of data.itemListElement) {
            if (item.name) {
              malwareList.push({
                name: item.name,
                type: 'malware',
                rank: item.position
              })
            }
          }
        }
      } catch (e) {
        // JSON parse error, continue
      }
    }
  }

  // Also try to extract from data attributes or table rows
  // Pattern: malware family names typically appear in specific elements
  const familyPattern = /data-family="([^"]+)"/g
  let match
  while ((match = familyPattern.exec(html)) !== null) {
    const name = match[1]
    if (name && !malwareList.find(m => m.name.toLowerCase() === name.toLowerCase())) {
      malwareList.push({ name, type: 'malware' })
    }
  }

  // Extract from common malware name patterns in the HTML
  const knownFamilies = [
    'AgentTesla', 'AsyncRAT', 'Remcos', 'FormBook', 'LokiBot',
    'RedLine', 'Lumma', 'XWorm', 'NjRAT', 'Quasar',
    'Raccoon', 'Vidar', 'Amadey', 'SmokeLoader', 'Emotet',
    'QakBot', 'IcedID', 'PikaBot', 'DarkGate', 'Stealc',
    'SnakeKeylogger', 'GuLoader', 'Cobalt Strike', 'Sliver'
  ]

  for (const family of knownFamilies) {
    // Check if family appears in the HTML (case-insensitive)
    const regex = new RegExp(`\\b${family}\\b`, 'i')
    if (regex.test(html) && !malwareList.find(m => m.name.toLowerCase() === family.toLowerCase())) {
      malwareList.push({
        name: family,
        type: inferMalwareType(family)
      })
    }
  }

  return malwareList
}

/**
 * Infer malware type from name
 */
function inferMalwareType(name) {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('rat') || ['asyncrat', 'njrat', 'remcos', 'quasar', 'xworm'].includes(lowerName)) {
    return 'rat'
  }
  if (['redline', 'lumma', 'raccoon', 'vidar', 'stealc', 'agenttesla', 'formbook', 'lokibot', 'snakekeylogger'].includes(lowerName)) {
    return 'stealer'
  }
  if (['smokeloader', 'guloader', 'pikabot', 'amadey'].includes(lowerName)) {
    return 'loader'
  }
  if (['emotet', 'qakbot', 'icedid', 'darkgate'].includes(lowerName)) {
    return 'botnet'
  }
  if (['cobalt strike', 'sliver'].includes(lowerName)) {
    return 'framework'
  }

  return 'malware'
}

/**
 * Map ANY.RUN type to our schema
 */
function mapMalwareType(type) {
  const typeMap = {
    'RAT': 'rat',
    'Stealer': 'stealer',
    'Loader': 'loader',
    'Trojan': 'trojan',
    'Ransomware': 'ransomware',
    'Botnet': 'botnet',
    'Backdoor': 'backdoor',
    'Worm': 'worm',
    'Miner': 'cryptominer',
    'Adware': 'adware',
    'Spyware': 'spyware'
  }
  return typeMap[type] || type?.toLowerCase() || 'malware'
}
