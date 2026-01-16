/**
 * IOC Import Module
 * Parse and import IOCs from STIX 2.1, MISP JSON, and OpenIOC formats
 */

import { supabase } from './supabase'

// STIX 2.1 indicator type mapping
const STIX_TYPE_MAP = {
  'ipv4-addr': 'ip',
  'ipv6-addr': 'ip',
  'domain-name': 'domain',
  'url': 'url',
  'file': 'hash',
  'email-addr': 'email',
  'mac-addr': 'mac',
  'autonomous-system': 'asn',
}

// Extract IOC value from STIX pattern
function parseSTIXPattern(pattern) {
  // STIX patterns like: [ipv4-addr:value = '1.2.3.4']
  // or [file:hashes.'SHA-256' = 'abc123...']
  const results = []

  // IPv4/IPv6
  const ipMatch = pattern.match(/ipv[46]-addr:value\s*=\s*'([^']+)'/i)
  if (ipMatch) {
    results.push({ type: 'ip', value: ipMatch[1] })
  }

  // Domain
  const domainMatch = pattern.match(/domain-name:value\s*=\s*'([^']+)'/i)
  if (domainMatch) {
    results.push({ type: 'domain', value: domainMatch[1] })
  }

  // URL
  const urlMatch = pattern.match(/url:value\s*=\s*'([^']+)'/i)
  if (urlMatch) {
    results.push({ type: 'url', value: urlMatch[1] })
  }

  // File hashes
  const md5Match = pattern.match(/file:hashes\.'MD5'\s*=\s*'([^']+)'/i)
  if (md5Match) {
    results.push({ type: 'md5', value: md5Match[1] })
  }

  const sha1Match = pattern.match(/file:hashes\.'SHA-1'\s*=\s*'([^']+)'/i)
  if (sha1Match) {
    results.push({ type: 'sha1', value: sha1Match[1] })
  }

  const sha256Match = pattern.match(/file:hashes\.'SHA-256'\s*=\s*'([^']+)'/i)
  if (sha256Match) {
    results.push({ type: 'sha256', value: sha256Match[1] })
  }

  // Email
  const emailMatch = pattern.match(/email-addr:value\s*=\s*'([^']+)'/i)
  if (emailMatch) {
    results.push({ type: 'email', value: emailMatch[1] })
  }

  return results
}

// Parse STIX 2.1 bundle
export function parseSTIX(stixJson) {
  const bundle = typeof stixJson === 'string' ? JSON.parse(stixJson) : stixJson
  const iocs = []
  const metadata = {
    format: 'stix2.1',
    created: bundle.created,
    id: bundle.id,
  }

  if (!bundle.objects || !Array.isArray(bundle.objects)) {
    throw new Error('Invalid STIX bundle: missing objects array')
  }

  // Build a map of related objects for context
  const objectMap = new Map()
  for (const obj of bundle.objects) {
    objectMap.set(obj.id, obj)
  }

  // Process indicators
  for (const obj of bundle.objects) {
    if (obj.type === 'indicator' && obj.pattern) {
      const parsed = parseSTIXPattern(obj.pattern)

      for (const ioc of parsed) {
        iocs.push({
          ...ioc,
          name: obj.name,
          description: obj.description,
          confidence: obj.confidence,
          valid_from: obj.valid_from,
          valid_until: obj.valid_until,
          labels: obj.labels || [],
          external_references: obj.external_references || [],
          stix_id: obj.id,
        })
      }
    }

    // Also process observable objects directly
    if (STIX_TYPE_MAP[obj.type]) {
      const iocType = STIX_TYPE_MAP[obj.type]
      let value = obj.value

      // Handle file hashes
      if (obj.type === 'file' && obj.hashes) {
        if (obj.hashes['SHA-256']) {
          iocs.push({ type: 'sha256', value: obj.hashes['SHA-256'], stix_id: obj.id })
        }
        if (obj.hashes['SHA-1']) {
          iocs.push({ type: 'sha1', value: obj.hashes['SHA-1'], stix_id: obj.id })
        }
        if (obj.hashes['MD5']) {
          iocs.push({ type: 'md5', value: obj.hashes['MD5'], stix_id: obj.id })
        }
      } else if (value) {
        iocs.push({ type: iocType, value, stix_id: obj.id })
      }
    }
  }

  return { iocs, metadata, objectCount: bundle.objects.length }
}

// MISP attribute type mapping
const MISP_TYPE_MAP = {
  'ip-src': 'ip',
  'ip-dst': 'ip',
  'domain': 'domain',
  'hostname': 'domain',
  'url': 'url',
  'link': 'url',
  'md5': 'md5',
  'sha1': 'sha1',
  'sha256': 'sha256',
  'sha512': 'sha512',
  'ssdeep': 'ssdeep',
  'email-src': 'email',
  'email-dst': 'email',
  'filename': 'filename',
  'filename|md5': 'md5',
  'filename|sha1': 'sha1',
  'filename|sha256': 'sha256',
}

// Parse MISP JSON format
export function parseMISP(mispJson) {
  const data = typeof mispJson === 'string' ? JSON.parse(mispJson) : mispJson
  const iocs = []
  const metadata = {
    format: 'misp',
  }

  // Handle single event or array of events
  const events = data.Event ? [data.Event] : (data.response || []).map(r => r.Event)

  for (const event of events) {
    if (!event) continue

    metadata.event_id = event.id
    metadata.event_info = event.info
    metadata.org = event.Orgc?.name

    const attributes = event.Attribute || []

    for (const attr of attributes) {
      const iocType = MISP_TYPE_MAP[attr.type]
      if (!iocType) continue

      let value = attr.value

      // Handle composite types like filename|hash
      if (attr.type.includes('|')) {
        const parts = attr.value.split('|')
        value = parts[parts.length - 1] // Get the hash part
      }

      iocs.push({
        type: iocType,
        value,
        category: attr.category,
        comment: attr.comment,
        to_ids: attr.to_ids === '1' || attr.to_ids === true,
        timestamp: attr.timestamp ? new Date(attr.timestamp * 1000).toISOString() : null,
        misp_uuid: attr.uuid,
        tags: (attr.Tag || []).map(t => t.name),
      })
    }

    // Also check for objects with attributes
    const objects = event.Object || []
    for (const obj of objects) {
      const objAttrs = obj.Attribute || []
      for (const attr of objAttrs) {
        const iocType = MISP_TYPE_MAP[attr.type]
        if (!iocType) continue

        iocs.push({
          type: iocType,
          value: attr.value,
          category: attr.category,
          object_name: obj.name,
          misp_uuid: attr.uuid,
        })
      }
    }
  }

  return { iocs, metadata, eventCount: events.length }
}

// Parse OpenIOC XML format (simplified)
export function parseOpenIOC(xmlString) {
  const iocs = []
  const metadata = { format: 'openioc' }

  // Extract indicator items using regex (basic XML parsing)
  const itemRegex = /<IndicatorItem[^>]*>[\s\S]*?<Context[^>]*document="([^"]*)"[^>]*search="([^"]*)"[^/]*\/>[\s\S]*?<Content[^>]*>([^<]*)<\/Content>[\s\S]*?<\/IndicatorItem>/gi

  let match
  while ((match = itemRegex.exec(xmlString)) !== null) {
    const document = match[1]
    const search = match[2]
    const value = match[3].trim()

    // Map OpenIOC contexts to our types
    let type = null
    if (search.includes('md5')) type = 'md5'
    else if (search.includes('sha1')) type = 'sha1'
    else if (search.includes('sha256')) type = 'sha256'
    else if (document.includes('Network') && search.includes('IP')) type = 'ip'
    else if (document.includes('Network') && search.includes('DNS')) type = 'domain'
    else if (search.includes('URI') || search.includes('URL')) type = 'url'

    if (type && value) {
      iocs.push({ type, value, openioc_context: `${document}/${search}` })
    }
  }

  return { iocs, metadata }
}

// Detect format and parse
export function parseIOCFile(content, filename = '') {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content)

  // Try to detect format
  if (filename.endsWith('.xml') || contentStr.includes('<ioc ') || contentStr.includes('<OpenIOC')) {
    return { ...parseOpenIOC(contentStr), format: 'openioc' }
  }

  try {
    const json = typeof content === 'string' ? JSON.parse(content) : content

    // STIX bundle
    if (json.type === 'bundle' || json.spec_version?.startsWith('2.')) {
      return { ...parseSTIX(json), format: 'stix' }
    }

    // MISP event
    if (json.Event || json.response) {
      return { ...parseMISP(json), format: 'misp' }
    }

    throw new Error('Unknown JSON format')
  } catch (e) {
    throw new Error(`Failed to parse IOC file: ${e.message}`)
  }
}

// Enrichment functions for auto-enrichment on import
async function enrichIP(value) {
  const enrichment = { enriched: true, enriched_at: new Date().toISOString() }

  try {
    // Check AbuseIPDB via InternetDB (free, no API key needed)
    const response = await fetch(`https://internetdb.shodan.io/${value}`)
    if (response.ok) {
      const data = await response.json()
      enrichment.shodan = {
        ports: data.ports || [],
        hostnames: data.hostnames || [],
        tags: data.tags || [],
        vulns: data.vulns || [],
        cpes: data.cpes || [],
      }
      enrichment.has_open_ports = (data.ports?.length || 0) > 0
      enrichment.has_vulns = (data.vulns?.length || 0) > 0
    }
  } catch (e) {
    enrichment.shodan_error = e.message
  }

  return enrichment
}

async function enrichDomain(value) {
  const enrichment = { enriched: true, enriched_at: new Date().toISOString() }

  try {
    // Basic domain info from DNS
    // Note: In browser context, we can't do DNS lookups directly
    // This would be done server-side in production
    enrichment.domain = value
    enrichment.tld = value.split('.').pop()

    // Check if it's a known bad TLD
    const suspiciousTLDs = ['xyz', 'top', 'club', 'work', 'click', 'link', 'gq', 'ml', 'cf', 'tk', 'ga']
    enrichment.suspicious_tld = suspiciousTLDs.includes(enrichment.tld.toLowerCase())
  } catch (e) {
    enrichment.error = e.message
  }

  return enrichment
}

async function enrichHash(value, type) {
  const enrichment = { enriched: true, enriched_at: new Date().toISOString(), hash_type: type }

  // Validate hash format
  const hashLengths = { md5: 32, sha1: 40, sha256: 64, sha512: 128 }
  enrichment.valid_format = value.length === hashLengths[type]

  return enrichment
}

async function enrichIOC(ioc) {
  switch (ioc.type) {
    case 'ip':
      return enrichIP(ioc.value)
    case 'domain':
      return enrichDomain(ioc.value)
    case 'md5':
    case 'sha1':
    case 'sha256':
    case 'sha512':
      return enrichHash(ioc.value, ioc.type)
    default:
      return { enriched: false }
  }
}

// Import parsed IOCs to database
export async function importIOCs(parsedIOCs, userId, options = {}) {
  const {
    source = 'import',
    tags = [],
    autoEnrich = false,
  } = options

  const results = {
    total: parsedIOCs.length,
    imported: 0,
    duplicates: 0,
    errors: 0,
    enriched: 0,
    errorMessages: [],
  }

  const now = new Date().toISOString()

  for (const ioc of parsedIOCs) {
    // Auto-enrich if enabled
    let enrichmentData = {}
    if (autoEnrich) {
      try {
        enrichmentData = await enrichIOC(ioc)
        if (enrichmentData.enriched) {
          results.enriched++
        }
      } catch (e) {
        enrichmentData = { enrichment_error: e.message }
      }
    }

    const record = {
      type: ioc.type,
      value: ioc.value,
      source,
      source_ref: ioc.stix_id || ioc.misp_uuid || null,
      threat_type: ioc.category || null,
      confidence_score: ioc.confidence ? ioc.confidence / 100 : 0.7,
      is_active: true,
      first_seen: ioc.valid_from || ioc.timestamp || now,
      last_seen: now,
      tags: [...tags, ...(ioc.tags || []), ...(ioc.labels || [])],
      metadata: {
        import_format: options.format,
        description: ioc.description,
        comment: ioc.comment,
        to_ids: ioc.to_ids,
        external_references: ioc.external_references,
        ...enrichmentData,
      },
      user_id: userId,
    }

    const { error } = await supabase
      .from('iocs')
      .upsert(record, { onConflict: 'type,value', ignoreDuplicates: false })

    if (error) {
      if (error.code === '23505') {
        results.duplicates++
      } else {
        results.errors++
        results.errorMessages.push(`${ioc.value}: ${error.message}`)
      }
    } else {
      results.imported++
    }
  }

  return results
}

// Main import function
export async function importIOCFile(content, filename, userId, options = {}) {
  const parsed = parseIOCFile(content, filename)

  const importOptions = {
    ...options,
    format: parsed.format,
    source: options.source || `import_${parsed.format}`,
  }

  const results = await importIOCs(parsed.iocs, userId, importOptions)

  return {
    ...results,
    format: parsed.format,
    metadata: parsed.metadata,
  }
}

export default {
  parseSTIX,
  parseMISP,
  parseOpenIOC,
  parseIOCFile,
  importIOCs,
  importIOCFile,
}
