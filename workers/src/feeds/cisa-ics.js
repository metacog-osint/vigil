/**
 * CISA ICS-CERT Advisories Ingestion
 * Cloudflare Worker version
 *
 * Fetches Industrial Control System advisories from CISA RSS feed
 * https://www.cisa.gov/cybersecurity-advisories/ics-advisories
 */

const CISA_ICS_RSS = 'https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml'

export async function ingestCISAICS(supabase) {
  console.log('Starting CISA ICS-CERT ingestion...')

  let updated = 0
  let failed = 0
  let lastError = null

  try {
    const response = await fetch(CISA_ICS_RSS, {
      headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xml = await response.text()

    // Parse RSS XML - extract items
    const items = parseRSSItems(xml)

    console.log(`Fetched ${items.length} ICS-CERT advisories`)

    if (items.length === 0) {
      console.log('No advisories found in RSS feed')
      return { success: true, source: 'cisa-ics', updated: 0, skipped: true }
    }

    const batchSize = 50
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)

      const records = batch.map((item, idx) => {
        // Extract CVE IDs from the advisory
        const cvePattern = /CVE-\d{4}-\d{4,}/g
        const cveMatches = (item.title + ' ' + (item.description || '')).match(cvePattern) || []

        // Extract advisory ID from link (e.g., ICSA-24-123-01)
        const advisoryIdMatch = item.link?.match(/icsa-\d{2}-\d{3}-\d{2}/i) ||
                                item.title?.match(/ICSA-\d{2}-\d{3}-\d{2}/i)
        const advisoryId = advisoryIdMatch ? advisoryIdMatch[0].toUpperCase() : `ICS-${Date.now()}-${idx}`

        // Parse date
        let publishedDate = null
        if (item.pubDate) {
          try {
            publishedDate = new Date(item.pubDate).toISOString().split('T')[0]
          } catch (e) {
            publishedDate = null
          }
        }

        return {
          advisory_id: advisoryId,
          title: item.title || 'Untitled Advisory',
          description: item.description || null,
          severity: 'high',  // ICS advisories are generally high severity
          source: 'cisa-ics',
          source_url: item.link || null,
          published_date: publishedDate,
          cve_ids: cveMatches,
          affected_products: [],
          affected_vendors: [],
          metadata: {
            advisory_type: 'ics-cert',
            guid: item.guid
          }
        }
      })

      const { error } = await supabase
        .from('ics_advisories')
        .upsert(records, { onConflict: 'advisory_id' })

      if (error) {
        console.error(`ICS-CERT batch error: ${error.message}`)
        lastError = error.message
        failed += batch.length
      } else {
        updated += batch.length
      }
    }

  } catch (error) {
    console.error('CISA ICS-CERT error:', error.message)
    return { success: false, error: error.message }
  }

  console.log(`CISA ICS-CERT complete: ${updated} updated, ${failed} failed`)
  return { success: true, source: 'cisa-ics', updated, failed, lastError }
}

/**
 * Parse RSS XML and extract items
 * Simple regex-based parser for Cloudflare Workers (no DOMParser)
 */
function parseRSSItems(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1]

    const getTag = (tag) => {
      const tagMatch = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
      if (tagMatch) {
        // Decode HTML entities and strip CDATA
        return tagMatch[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/<[^>]+>/g, '')  // Strip HTML tags
          .trim()
      }
      return null
    }

    items.push({
      title: getTag('title'),
      link: getTag('link'),
      description: getTag('description'),
      pubDate: getTag('pubDate'),
      guid: getTag('guid')
    })
  }

  return items
}
