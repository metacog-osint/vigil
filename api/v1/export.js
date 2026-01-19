/**
 * SIEM Export API Endpoint
 * GET /api/v1/export/:format - Export data in SIEM-compatible formats
 *
 * Formats: splunk, elastic, sentinel, stix, csv
 */

import { validateApiKey, hasScope, logRequest, errorResponse, jsonResponse, supabase } from '../_lib/auth.js'

export const config = {
  runtime: 'edge'
}

/**
 * Format IOCs for Splunk HEC
 */
function formatSplunk(data, dataType) {
  return data.map(item => ({
    time: new Date(item.created_at || item.discovered_date || item.published_date).getTime() / 1000,
    event: {
      type: dataType,
      ...item,
      source: 'vigil',
    },
    sourcetype: `vigil:${dataType}`,
  }))
}

/**
 * Format for Elastic Common Schema
 */
function formatElastic(data, dataType) {
  if (dataType === 'iocs') {
    return data.map(ioc => ({
      '@timestamp': ioc.created_at,
      event: { kind: 'enrichment', category: 'threat', type: 'indicator' },
      threat: {
        indicator: {
          type: mapIOCType(ioc.type),
          [ioc.type === 'ip' ? 'ip' : ioc.type === 'domain' ? 'domain' : 'file.hash.' + getHashType(ioc.value)]: ioc.value,
          confidence: ioc.confidence > 75 ? 'High' : ioc.confidence > 50 ? 'Medium' : 'Low',
          provider: 'vigil',
          first_seen: ioc.created_at,
        },
        software: ioc.malware_family ? { name: ioc.malware_family } : undefined,
      },
      tags: ['vigil', dataType],
    }))
  }

  if (dataType === 'incidents') {
    return data.map(incident => ({
      '@timestamp': incident.discovered_date,
      event: { kind: 'alert', category: 'intrusion_detection', type: 'info' },
      threat: {
        framework: 'ransomware',
        group: { name: incident.threat_actor?.name },
      },
      organization: {
        name: incident.victim_name,
        sector: incident.victim_sector,
      },
      geo: { country_name: incident.victim_country },
      tags: ['vigil', 'ransomware'],
    }))
  }

  if (dataType === 'vulnerabilities') {
    return data.map(vuln => ({
      '@timestamp': vuln.published_date,
      event: { kind: 'enrichment', category: 'vulnerability' },
      vulnerability: {
        id: vuln.cve_id,
        description: vuln.description,
        severity: getSeverity(vuln.cvss_score),
        score: { base: vuln.cvss_score },
        reference: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
      },
      tags: ['vigil', 'cve', vuln.is_kev ? 'kev' : null].filter(Boolean),
    }))
  }

  return data
}

/**
 * Format for Microsoft Sentinel (Log Analytics)
 */
function formatSentinel(data, dataType) {
  if (dataType === 'iocs') {
    return data.map(ioc => ({
      TimeGenerated: ioc.created_at,
      IndicatorType: mapIndicatorType(ioc.type),
      ThreatIntelIndicatorValue: ioc.value,
      Confidence: ioc.confidence,
      ThreatType: ioc.malware_family || 'Unknown',
      SourceSystem: 'Vigil',
      Description: `IOC from Vigil - ${ioc.source || 'threat intelligence'}`,
      ExpirationDateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      Active: true,
    }))
  }

  if (dataType === 'incidents') {
    return data.map(incident => ({
      TimeGenerated: incident.discovered_date,
      IncidentName: `Ransomware: ${incident.victim_name}`,
      Severity: incident.severity || 'High',
      Status: 'New',
      Classification: 'TruePositive',
      ClassificationReason: 'SuspiciousActivity',
      Owner: '',
      Description: `Ransomware incident involving ${incident.victim_name} claimed by ${incident.threat_actor?.name || 'unknown actor'}`,
      AdditionalData: JSON.stringify({
        sector: incident.victim_sector,
        country: incident.victim_country,
        actor: incident.threat_actor?.name,
      }),
    }))
  }

  return data
}

/**
 * Format for STIX 2.1
 */
function formatSTIX(data, dataType) {
  const bundle = {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    objects: [],
  }

  if (dataType === 'iocs') {
    data.forEach(ioc => {
      bundle.objects.push({
        type: 'indicator',
        spec_version: '2.1',
        id: `indicator--${ioc.id}`,
        created: ioc.created_at,
        modified: ioc.updated_at || ioc.created_at,
        name: `${ioc.type}: ${ioc.value}`,
        description: ioc.malware_family ? `Associated with ${ioc.malware_family}` : undefined,
        indicator_types: ['malicious-activity'],
        pattern: getSTIXPattern(ioc),
        pattern_type: 'stix',
        valid_from: ioc.created_at,
        confidence: ioc.confidence,
        labels: [ioc.type, ioc.malware_family].filter(Boolean),
      })
    })
  }

  if (dataType === 'actors') {
    data.forEach(actor => {
      bundle.objects.push({
        type: 'threat-actor',
        spec_version: '2.1',
        id: `threat-actor--${actor.id}`,
        created: actor.created_at,
        modified: actor.updated_at || actor.created_at,
        name: actor.name,
        description: actor.description,
        aliases: actor.aliases,
        threat_actor_types: [actor.actor_type || 'crime-syndicate'],
        first_seen: actor.first_seen,
        last_seen: actor.last_seen,
        goals: actor.target_sectors?.map(s => `Target ${s}`) || [],
      })
    })
  }

  return bundle
}

/**
 * Format as CSV
 */
function formatCSV(data, dataType) {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object')
  const rows = data.map(item =>
    headers.map(h => {
      const val = item[h]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

// Helper functions
function mapIOCType(type) {
  const mapping = { ip: 'ipv4-addr', domain: 'domain-name', url: 'url', hash: 'file' }
  return mapping[type] || type
}

function mapIndicatorType(type) {
  const mapping = { ip: 'IP', domain: 'DomainName', url: 'URL', hash: 'FileHash' }
  return mapping[type] || type
}

function getHashType(value) {
  if (value.length === 32) return 'md5'
  if (value.length === 40) return 'sha1'
  if (value.length === 64) return 'sha256'
  return 'md5'
}

function getSeverity(cvss) {
  if (cvss >= 9) return 'critical'
  if (cvss >= 7) return 'high'
  if (cvss >= 4) return 'medium'
  return 'low'
}

function getSTIXPattern(ioc) {
  switch (ioc.type) {
    case 'ip': return `[ipv4-addr:value = '${ioc.value}']`
    case 'domain': return `[domain-name:value = '${ioc.value}']`
    case 'url': return `[url:value = '${ioc.value}']`
    case 'hash': return `[file:hashes.'SHA-256' = '${ioc.value}']`
    default: return `[artifact:payload_bin = '${ioc.value}']`
  }
}

export default async function handler(request) {
  const startTime = Date.now()

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  const auth = await validateApiKey(request.headers.get('authorization'))
  if (!auth) {
    return errorResponse('Invalid or missing API key', 401)
  }

  if (!hasScope(auth.scopes, 'read')) {
    return errorResponse('Insufficient permissions', 403)
  }

  if (!['team', 'enterprise'].includes(auth.tier)) {
    return errorResponse('API access requires Team plan or higher', 403)
  }

  const url = new URL(request.url)
  const params = url.searchParams

  const format = params.get('format') || 'json'
  const dataType = params.get('type') || 'iocs' // iocs, incidents, vulnerabilities, actors
  const days = parseInt(params.get('days') || '7')
  const limit = Math.min(parseInt(params.get('limit') || '1000'), 10000)

  if (!['splunk', 'elastic', 'sentinel', 'stix', 'csv', 'json'].includes(format)) {
    return errorResponse('Invalid format. Use: splunk, elastic, sentinel, stix, csv, json', 400)
  }

  if (!['iocs', 'incidents', 'vulnerabilities', 'actors'].includes(dataType)) {
    return errorResponse('Invalid type. Use: iocs, incidents, vulnerabilities, actors', 400)
  }

  try {
    // Fetch data
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    let query
    switch (dataType) {
      case 'iocs':
        query = supabase
          .from('iocs')
          .select('*, threat_actor:threat_actors(id, name)')
          .gte('created_at', cutoffDate.toISOString())
          .limit(limit)
        break
      case 'incidents':
        query = supabase
          .from('incidents')
          .select('*, threat_actor:threat_actors(id, name)')
          .gte('discovered_date', cutoffDate.toISOString())
          .limit(limit)
        break
      case 'vulnerabilities':
        query = supabase
          .from('vulnerabilities')
          .select('*')
          .gte('published_date', cutoffDate.toISOString())
          .limit(limit)
        break
      case 'actors':
        query = supabase
          .from('threat_actors')
          .select('*')
          .limit(limit)
        break
    }

    const { data, error } = await query

    if (error) {
      return errorResponse(error.message, 500)
    }

    // Format data
    let formattedData
    let contentType = 'application/json'

    switch (format) {
      case 'splunk':
        formattedData = formatSplunk(data, dataType)
        break
      case 'elastic':
        formattedData = formatElastic(data, dataType)
        break
      case 'sentinel':
        formattedData = formatSentinel(data, dataType)
        break
      case 'stix':
        formattedData = formatSTIX(data, dataType)
        break
      case 'csv':
        formattedData = formatCSV(data, dataType)
        contentType = 'text/csv'
        break
      default:
        formattedData = data
    }

    const responseBody = contentType === 'text/csv'
      ? formattedData
      : JSON.stringify(formattedData, null, 2)

    const response = new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename="vigil-${dataType}-${format}.${format === 'csv' ? 'csv' : 'json'}"`,
      },
    })

    await logRequest({ ...auth, responseTime: Date.now() - startTime }, request, response)
    return response

  } catch (err) {
    console.error('Export API Error:', err)
    return errorResponse('Internal server error', 500)
  }
}
