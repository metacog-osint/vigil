/**
 * STIX/TAXII Export Module
 * Converts Vigil entities to STIX 2.1 format
 */

// STIX 2.1 Object Types
const STIX_TYPES = {
  actor: 'threat-actor',
  incident: 'report',
  ioc: 'indicator',
  vulnerability: 'vulnerability',
  malware: 'malware',
  campaign: 'campaign',
  technique: 'attack-pattern',
}

// Generate STIX ID
function generateStixId(type, id) {
  return `${type}--${id}`
}

// Current timestamp in STIX format
function stixTimestamp(date = new Date()) {
  return new Date(date).toISOString()
}

// Create STIX Identity for Vigil
function createVigilIdentity() {
  return {
    type: 'identity',
    spec_version: '2.1',
    id: 'identity--vigil-threat-intel',
    created: '2024-01-01T00:00:00.000Z',
    modified: stixTimestamp(),
    name: 'Vigil Threat Intelligence',
    identity_class: 'organization',
    sectors: ['technology'],
    description: 'Automated threat intelligence from Vigil platform',
  }
}

/**
 * Convert IOC to STIX Indicator
 */
export function iocToStix(ioc) {
  const indicator = {
    type: 'indicator',
    spec_version: '2.1',
    id: generateStixId('indicator', ioc.id),
    created: stixTimestamp(ioc.created_at),
    modified: stixTimestamp(ioc.updated_at || ioc.created_at),
    name: `${ioc.type}: ${ioc.value}`,
    description: ioc.description || `${ioc.type} indicator from ${ioc.source || 'Vigil'}`,
    indicator_types: getIndicatorTypes(ioc.type, ioc),
    pattern: createPattern(ioc),
    pattern_type: 'stix',
    valid_from: stixTimestamp(ioc.first_seen || ioc.created_at),
    confidence: ioc.confidence || 50,
    labels: ioc.tags || [],
    external_references: [],
    created_by_ref: 'identity--vigil-threat-intel',
  }

  // Add external references
  if (ioc.source) {
    indicator.external_references.push({
      source_name: ioc.source,
      description: 'Original source of this indicator',
    })
  }

  // Add malware reference if available
  if (ioc.malware_family) {
    indicator.external_references.push({
      source_name: 'malware-family',
      description: ioc.malware_family,
    })
  }

  return indicator
}

// Create STIX pattern from IOC
function createPattern(ioc) {
  switch (ioc.type) {
    case 'ip':
    case 'ipv4':
      return `[ipv4-addr:value = '${escapePattern(ioc.value)}']`
    case 'ipv6':
      return `[ipv6-addr:value = '${escapePattern(ioc.value)}']`
    case 'domain':
      return `[domain-name:value = '${escapePattern(ioc.value)}']`
    case 'url':
      return `[url:value = '${escapePattern(ioc.value)}']`
    case 'md5':
      return `[file:hashes.MD5 = '${escapePattern(ioc.value)}']`
    case 'sha1':
      return `[file:hashes.'SHA-1' = '${escapePattern(ioc.value)}']`
    case 'sha256':
      return `[file:hashes.'SHA-256' = '${escapePattern(ioc.value)}']`
    case 'email':
      return `[email-addr:value = '${escapePattern(ioc.value)}']`
    case 'hash':
      // Detect hash type by length
      if (ioc.value.length === 32) {
        return `[file:hashes.MD5 = '${escapePattern(ioc.value)}']`
      } else if (ioc.value.length === 40) {
        return `[file:hashes.'SHA-1' = '${escapePattern(ioc.value)}']`
      } else if (ioc.value.length === 64) {
        return `[file:hashes.'SHA-256' = '${escapePattern(ioc.value)}']`
      }
      return `[file:hashes.MD5 = '${escapePattern(ioc.value)}']`
    default:
      return `[x-vigil-indicator:value = '${escapePattern(ioc.value)}']`
  }
}

// Escape special characters in STIX patterns
function escapePattern(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// Get indicator types based on IOC type
function getIndicatorTypes(type, ioc) {
  const types = []

  if (ioc.malware_family) {
    types.push('malicious-activity')
  }

  switch (type) {
    case 'ip':
    case 'ipv4':
    case 'ipv6':
      types.push('anomalous-activity')
      if (ioc.metadata?.is_c2) types.push('c2')
      break
    case 'domain':
      types.push('anomalous-activity')
      if (ioc.metadata?.is_phishing) types.push('phishing')
      break
    case 'url':
      types.push('malicious-activity')
      break
    case 'hash':
    case 'md5':
    case 'sha1':
    case 'sha256':
      types.push('malicious-activity')
      break
    default:
      types.push('unknown')
  }

  return types.length > 0 ? types : ['unknown']
}

/**
 * Convert Threat Actor to STIX
 */
export function actorToStix(actor) {
  const threatActor = {
    type: 'threat-actor',
    spec_version: '2.1',
    id: generateStixId('threat-actor', actor.id),
    created: stixTimestamp(actor.created_at || actor.first_observed),
    modified: stixTimestamp(actor.updated_at || actor.last_observed),
    name: actor.name,
    description: actor.description || `Threat actor tracked by Vigil`,
    threat_actor_types: getActorTypes(actor),
    aliases: actor.aliases || [],
    first_seen: actor.first_observed ? stixTimestamp(actor.first_observed) : undefined,
    last_seen: actor.last_observed ? stixTimestamp(actor.last_observed) : undefined,
    roles: ['agent'], // Simplified
    goals: actor.goals || [],
    sophistication: mapSophistication(actor),
    resource_level: mapResourceLevel(actor),
    primary_motivation: actor.motivation || 'personal-gain',
    secondary_motivations: [],
    labels: [],
    created_by_ref: 'identity--vigil-threat-intel',
  }

  // Add sector targeting
  if (actor.target_sectors?.length > 0) {
    threatActor.labels.push(...actor.target_sectors.map(s => `targets-${s}`))
  }

  // Add country targeting
  if (actor.target_countries?.length > 0) {
    threatActor.labels.push(...actor.target_countries.map(c => `targets-${c.toLowerCase()}`))
  }

  return threatActor
}

// Get threat actor types
function getActorTypes(actor) {
  const types = []

  if (actor.actor_type === 'nation_state') {
    types.push('nation-state')
  } else if (actor.actor_type === 'criminal') {
    types.push('crime-syndicate')
  } else if (actor.actor_type === 'hacktivist') {
    types.push('hacktivist')
  } else {
    types.push('unknown')
  }

  return types
}

// Map sophistication level
function mapSophistication(actor) {
  if (actor.sophistication) return actor.sophistication

  // Infer from metrics
  if (actor.incident_velocity > 3) return 'expert'
  if (actor.incidents_7d > 10) return 'advanced'
  if (actor.incidents_30d > 5) return 'intermediate'
  return 'minimal'
}

// Map resource level
function mapResourceLevel(actor) {
  if (actor.actor_type === 'nation_state') return 'government'
  if (actor.incidents_30d > 20) return 'organization'
  if (actor.incidents_7d > 5) return 'club'
  return 'individual'
}

/**
 * Convert Vulnerability to STIX
 */
export function vulnerabilityToStix(vuln) {
  const vulnerability = {
    type: 'vulnerability',
    spec_version: '2.1',
    id: generateStixId('vulnerability', vuln.id),
    created: stixTimestamp(vuln.created_at || vuln.published_date),
    modified: stixTimestamp(vuln.updated_at),
    name: vuln.cve_id,
    description: vuln.description || `Vulnerability ${vuln.cve_id}`,
    external_references: [
      {
        source_name: 'cve',
        external_id: vuln.cve_id,
        url: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
      },
    ],
    labels: [],
    created_by_ref: 'identity--vigil-threat-intel',
  }

  // Add CVSS info
  if (vuln.cvss_score !== null && vuln.cvss_score !== undefined) {
    vulnerability.external_references.push({
      source_name: 'cvss',
      description: `CVSS Score: ${vuln.cvss_score}`,
    })
  }

  // Add KEV info
  if (vuln.kev_date) {
    vulnerability.labels.push('cisa-kev')
    vulnerability.external_references.push({
      source_name: 'cisa-kev',
      url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
      description: `Added to KEV: ${vuln.kev_date}`,
    })
  }

  // Add severity labels
  if (vuln.cvss_score >= 9) {
    vulnerability.labels.push('severity-critical')
  } else if (vuln.cvss_score >= 7) {
    vulnerability.labels.push('severity-high')
  } else if (vuln.cvss_score >= 4) {
    vulnerability.labels.push('severity-medium')
  } else {
    vulnerability.labels.push('severity-low')
  }

  return vulnerability
}

/**
 * Convert Incident to STIX Report
 */
export function incidentToStix(incident) {
  const report = {
    type: 'report',
    spec_version: '2.1',
    id: generateStixId('report', incident.id),
    created: stixTimestamp(incident.created_at),
    modified: stixTimestamp(incident.updated_at || incident.created_at),
    name: `Incident: ${incident.victim_name}`,
    description: incident.description || `Attack on ${incident.victim_name} by ${incident.threat_actor?.name || 'unknown actor'}`,
    report_types: ['threat-actor', 'attack-pattern'],
    published: stixTimestamp(incident.discovered_date || incident.created_at),
    object_refs: [],
    labels: [],
    external_references: [],
    created_by_ref: 'identity--vigil-threat-intel',
  }

  // Add sector label
  if (incident.victim_sector) {
    report.labels.push(`sector-${incident.victim_sector.toLowerCase()}`)
  }

  // Add country label
  if (incident.victim_country) {
    report.labels.push(`country-${incident.victim_country.toLowerCase()}`)
  }

  // Add source reference
  if (incident.source_url) {
    report.external_references.push({
      source_name: incident.source || 'original-source',
      url: incident.source_url,
    })
  }

  return report
}

/**
 * Create STIX Bundle
 */
export function createStixBundle(objects) {
  const identity = createVigilIdentity()

  return {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    objects: [identity, ...objects],
  }
}

/**
 * Export entities to STIX format
 */
export function exportToStix(entities, entityType) {
  const stixObjects = []

  for (const entity of entities) {
    switch (entityType) {
      case 'iocs':
      case 'ioc':
        stixObjects.push(iocToStix(entity))
        break
      case 'actors':
      case 'actor':
        stixObjects.push(actorToStix(entity))
        break
      case 'vulnerabilities':
      case 'vulnerability':
        stixObjects.push(vulnerabilityToStix(entity))
        break
      case 'incidents':
      case 'incident':
        stixObjects.push(incidentToStix(entity))
        break
      default:
        console.warn(`Unknown entity type: ${entityType}`)
    }
  }

  return createStixBundle(stixObjects)
}

/**
 * Download STIX bundle as JSON file
 */
export function downloadStixBundle(bundle, filename = 'vigil-export.json') {
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default {
  iocToStix,
  actorToStix,
  vulnerabilityToStix,
  incidentToStix,
  createStixBundle,
  exportToStix,
  downloadStixBundle,
  STIX_TYPES,
}
