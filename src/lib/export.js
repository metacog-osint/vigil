// Export utilities - CSV, JSON, STIX 2.1
// Provides data export functionality for all entity types

// ============================================================
// CSV Export
// ============================================================

export function exportToCSV(data, filename, columns = null) {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  // Auto-detect columns from first row if not provided
  const cols = columns || Object.keys(data[0])

  // Build CSV content
  const rows = [
    // Header row
    cols.map((c) => escapeCSV(c.replace(/_/g, ' ').toUpperCase())).join(','),
    // Data rows
    ...data.map((row) => cols.map((col) => escapeCSV(formatCSVValue(row[col]))).join(',')),
  ]

  const csv = rows.join('\n')
  downloadFile(csv, filename + '.csv', 'text/csv')
}

function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatCSVValue(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join('; ')
  if (typeof value === 'object') return JSON.stringify(value)
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

// ============================================================
// JSON Export
// ============================================================

export function exportToJSON(data, filename, pretty = true) {
  if (!data) {
    console.warn('No data to export')
    return
  }

  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  downloadFile(json, filename + '.json', 'application/json')
}

// ============================================================
// STIX 2.1 Export
// ============================================================

export function exportToSTIX(entities, entityType, options = {}) {
  const { includeMetadata = true, bundleName = 'Vigil Export' } = options

  const stixObjects = []

  // Create identity for Vigil
  const vigilIdentity = {
    type: 'identity',
    spec_version: '2.1',
    id: 'identity--vigil-threat-intel',
    name: 'Vigil Threat Intelligence Platform',
    identity_class: 'system',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  }
  stixObjects.push(vigilIdentity)

  // Convert entities to STIX
  for (const entity of entities) {
    const stixObject = convertToSTIX(entity, entityType)
    if (stixObject) {
      stixObjects.push(stixObject)
    }
  }

  // Create STIX bundle
  const bundle = {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    objects: stixObjects,
  }

  downloadFile(
    JSON.stringify(bundle, null, 2),
    bundleName.toLowerCase().replace(/\s+/g, '-') + '.stix.json',
    'application/json'
  )

  return bundle
}

function convertToSTIX(entity, entityType) {
  switch (entityType) {
    case 'ioc':
      return iocToSTIX(entity)
    case 'actor':
      return actorToSTIX(entity)
    case 'vulnerability':
      return vulnerabilityToSTIX(entity)
    case 'incident':
      return incidentToSTIX(entity)
    default:
      return null
  }
}

function iocToSTIX(ioc) {
  const now = new Date().toISOString()
  const pattern = getSTIXPattern(ioc.type, ioc.value)

  if (!pattern) return null

  return {
    type: 'indicator',
    spec_version: '2.1',
    id: `indicator--${crypto.randomUUID()}`,
    created: ioc.first_seen || now,
    modified: ioc.last_seen || now,
    name: `${ioc.type}: ${ioc.value}`,
    description: ioc.description || `IOC from ${ioc.source || 'Vigil'}`,
    pattern_type: 'stix',
    pattern: pattern,
    valid_from: ioc.first_seen || now,
    valid_until: ioc.expires_at,
    indicator_types: getIndicatorTypes(ioc),
    confidence: ioc.confidence || 50,
    labels: ioc.tags || [],
    external_references: ioc.source
      ? [
          {
            source_name: ioc.source,
          },
        ]
      : [],
  }
}

function getSTIXPattern(type, value) {
  switch (type) {
    case 'ipv4':
    case 'ip':
      return `[ipv4-addr:value = '${value}']`
    case 'ipv6':
      return `[ipv6-addr:value = '${value}']`
    case 'domain':
      return `[domain-name:value = '${value}']`
    case 'url':
      return `[url:value = '${value}']`
    case 'md5':
      return `[file:hashes.MD5 = '${value}']`
    case 'sha1':
      return `[file:hashes.'SHA-1' = '${value}']`
    case 'sha256':
      return `[file:hashes.'SHA-256' = '${value}']`
    case 'email':
      return `[email-addr:value = '${value}']`
    default:
      return null
  }
}

function getIndicatorTypes(ioc) {
  const types = []
  if (ioc.tags?.includes('malware')) types.push('malicious-activity')
  if (ioc.tags?.includes('c2')) types.push('malicious-activity')
  if (ioc.tags?.includes('phishing')) types.push('compromised')
  if (ioc.type?.includes('hash') || ioc.type === 'md5' || ioc.type === 'sha256') {
    types.push('malicious-activity')
  }
  return types.length > 0 ? types : ['unknown']
}

function actorToSTIX(actor) {
  const now = new Date().toISOString()

  return {
    type: 'threat-actor',
    spec_version: '2.1',
    id: `threat-actor--${actor.id || crypto.randomUUID()}`,
    created: actor.created_at || now,
    modified: actor.updated_at || now,
    name: actor.name,
    description: actor.description,
    aliases: actor.aliases || [],
    threat_actor_types: [actor.actor_type || 'unknown'],
    roles: actor.roles || [],
    goals: actor.goals || [],
    sophistication: actor.sophistication,
    resource_level: actor.resource_level,
    primary_motivation: actor.motivation,
  }
}

function vulnerabilityToSTIX(vuln) {
  const now = new Date().toISOString()

  return {
    type: 'vulnerability',
    spec_version: '2.1',
    id: `vulnerability--${crypto.randomUUID()}`,
    created: vuln.published_date || now,
    modified: vuln.modified_date || now,
    name: vuln.cve_id,
    description: vuln.description,
    external_references: [
      {
        source_name: 'cve',
        external_id: vuln.cve_id,
        url: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
      },
    ],
  }
}

function incidentToSTIX(incident) {
  const now = new Date().toISOString()

  // STIX doesn't have a direct incident type, use report
  return {
    type: 'report',
    spec_version: '2.1',
    id: `report--${incident.id || crypto.randomUUID()}`,
    created: incident.discovered_date || now,
    modified: incident.updated_at || now,
    name: `Incident: ${incident.victim_name || 'Unknown'}`,
    description: incident.description || `Incident in ${incident.victim_sector} sector`,
    published: incident.discovered_date || now,
    report_types: ['incident'],
    labels: [incident.victim_sector, incident.severity].filter(Boolean),
  }
}

// ============================================================
// Helpers
// ============================================================

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ============================================================
// Predefined Export Configurations
// ============================================================

export const exportConfigs = {
  actors: {
    columns: [
      'name',
      'aliases',
      'actor_type',
      'target_sectors',
      'first_seen',
      'last_seen',
      'trend_status',
    ],
    filename: 'vigil-threat-actors',
  },
  incidents: {
    columns: ['discovered_date', 'victim_name', 'victim_sector', 'victim_country', 'description'],
    filename: 'vigil-incidents',
  },
  vulnerabilities: {
    columns: ['cve_id', 'description', 'cvss_score', 'severity', 'kev_date', 'exploited_in_wild'],
    filename: 'vigil-vulnerabilities',
  },
  iocs: {
    columns: ['type', 'value', 'source', 'confidence', 'tags', 'first_seen', 'last_seen'],
    filename: 'vigil-iocs',
  },
  alerts: {
    columns: ['published_date', 'title', 'category', 'severity', 'source', 'cve_ids'],
    filename: 'vigil-alerts',
  },
}

// ============================================================
// Export Menu Helper
// ============================================================

export function getExportOptions(entityType, data) {
  const config = exportConfigs[entityType] || {}

  return [
    {
      label: 'Export as CSV',
      icon: 'csv',
      action: () => exportToCSV(data, config.filename || `vigil-${entityType}`, config.columns),
    },
    {
      label: 'Export as JSON',
      icon: 'json',
      action: () => exportToJSON(data, config.filename || `vigil-${entityType}`),
    },
    ...(entityType === 'iocs' || entityType === 'actors'
      ? [
          {
            label: 'Export as STIX 2.1',
            icon: 'stix',
            action: () => exportToSTIX(data, entityType.slice(0, -1)), // Remove 's' for singular
          },
        ]
      : []),
  ]
}
