// CISA Alerts Ingestion
// Fetches cybersecurity alerts from CISA RSS feed
// Run: node scripts/ingest-cisa-alerts.mjs

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { supabaseUrl, supabaseKey } from './env.mjs'

// CISA Alerts RSS feed
const CISA_ALERTS_URL = 'https://www.cisa.gov/uscert/ncas/alerts.xml'
const CISA_CURRENT_URL = 'https://www.cisa.gov/uscert/ncas/current-activity.xml'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// Simple XML parser for RSS items
function parseRSSFeed(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]

    const title = extractTag(itemXml, 'title')
    const link = extractTag(itemXml, 'link')
    const description = extractTag(itemXml, 'description')
    const pubDate = extractTag(itemXml, 'pubDate')
    const guid = extractTag(itemXml, 'guid')

    // Extract CVE IDs from description
    const cveIds = extractCVEs(title + ' ' + description)

    items.push({
      title,
      link,
      description: cleanHtml(description),
      pub_date: pubDate ? new Date(pubDate).toISOString() : null,
      guid,
      cve_ids: cveIds,
    })
  }

  return items
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = xml.match(regex)
  if (match) {
    // Handle CDATA
    let content = match[1]
    content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    return content.trim()
  }
  return ''
}

function cleanHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000)
}

function extractCVEs(text) {
  const cveRegex = /CVE-\d{4}-\d{4,}/gi
  const matches = text.match(cveRegex) || []
  return [...new Set(matches.map(c => c.toUpperCase()))]
}

function categorizeAlert(title, description) {
  const text = (title + ' ' + description).toLowerCase()

  if (text.includes('ransomware')) return 'ransomware'
  if (text.includes('malware')) return 'malware'
  if (text.includes('phishing')) return 'phishing'
  if (text.includes('vulnerability') || text.includes('cve')) return 'vulnerability'
  if (text.includes('apt') || text.includes('nation-state')) return 'apt'
  if (text.includes('ddos') || text.includes('denial of service')) return 'ddos'
  if (text.includes('data breach') || text.includes('leak')) return 'data_breach'
  return 'general'
}

async function ingestCISAAlerts() {
  console.log('Fetching CISA Alerts...')

  let allAlerts = []

  // Fetch Alerts RSS
  try {
    console.log('Fetching CISA Alerts RSS...')
    const alertsXml = await fetchText(CISA_ALERTS_URL)
    const alerts = parseRSSFeed(alertsXml)
    console.log(`  Alerts: ${alerts.length} entries`)
    allAlerts = allAlerts.concat(alerts.map(a => ({ ...a, alert_type: 'alert' })))
  } catch (e) {
    console.error('Error fetching Alerts:', e.message)
  }

  // Fetch Current Activity RSS
  try {
    console.log('Fetching CISA Current Activity RSS...')
    const currentXml = await fetchText(CISA_CURRENT_URL)
    const current = parseRSSFeed(currentXml)
    console.log(`  Current Activity: ${current.length} entries`)
    allAlerts = allAlerts.concat(current.map(a => ({ ...a, alert_type: 'current_activity' })))
  } catch (e) {
    console.error('Error fetching Current Activity:', e.message)
  }

  console.log(`\nTotal alerts: ${allAlerts.length}`)

  let added = 0
  let failed = 0

  for (const alert of allAlerts) {
    try {
      const record = {
        id: alert.guid || alert.link,
        title: alert.title,
        description: alert.description,
        source: 'cisa',
        alert_type: alert.alert_type,
        category: categorizeAlert(alert.title, alert.description),
        severity: alert.title.toLowerCase().includes('critical') ? 'critical' : 'high',
        published_date: alert.pub_date,
        url: alert.link,
        cve_ids: alert.cve_ids,
        metadata: {
          guid: alert.guid,
        }
      }

      const { error } = await supabase
        .from('alerts')
        .upsert(record, { onConflict: 'id' })

      if (error) {
        failed++
        if (failed < 5) console.error(`Error inserting alert:`, error.message)
      } else {
        added++
      }
    } catch (e) {
      failed++
    }
  }

  console.log(`\nCISA Alerts Ingestion Complete:`)
  console.log(`  Added/Updated: ${added}`)
  console.log(`  Failed: ${failed}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'cisa_alerts',
    status: 'success',
    completed_at: new Date().toISOString(),
    records_processed: allAlerts.length,
    records_added: added,
  })

  return { added, failed }
}

ingestCISAAlerts().catch(console.error)
