/**
 * Custom IOC Lists Module
 * API for managing private IOC collections
 */

import { supabase } from './supabase'

// IOC types
export const IOC_TYPES = {
  ip: { label: 'IP Address', icon: 'server', color: 'blue', pattern: /^(\d{1,3}\.){3}\d{1,3}$/ },
  ipv6: { label: 'IPv6 Address', icon: 'server', color: 'blue', pattern: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/ },
  domain: { label: 'Domain', icon: 'globe', color: 'green', pattern: /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/ },
  url: { label: 'URL', icon: 'link', color: 'purple', pattern: /^https?:\/\/.+/ },
  email: { label: 'Email', icon: 'mail', color: 'yellow', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  md5: { label: 'MD5 Hash', icon: 'fingerprint', color: 'red', pattern: /^[a-fA-F0-9]{32}$/ },
  sha1: { label: 'SHA1 Hash', icon: 'fingerprint', color: 'red', pattern: /^[a-fA-F0-9]{40}$/ },
  sha256: { label: 'SHA256 Hash', icon: 'fingerprint', color: 'red', pattern: /^[a-fA-F0-9]{64}$/ },
  filename: { label: 'Filename', icon: 'document', color: 'gray', pattern: /^.+$/ },
  filepath: { label: 'File Path', icon: 'folder', color: 'gray', pattern: /^.+$/ },
  registry_key: { label: 'Registry Key', icon: 'key', color: 'orange', pattern: /^.+$/ },
  user_agent: { label: 'User Agent', icon: 'globe', color: 'cyan', pattern: /^.+$/ },
  asn: { label: 'ASN', icon: 'server', color: 'indigo', pattern: /^AS\d+$/ },
  cidr: { label: 'CIDR Range', icon: 'cube', color: 'blue', pattern: /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/ },
  bitcoin_address: { label: 'Bitcoin Address', icon: 'currency-dollar', color: 'yellow', pattern: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/ },
  cve: { label: 'CVE ID', icon: 'shield-exclamation', color: 'orange', pattern: /^CVE-\d{4}-\d+$/i },
  other: { label: 'Other', icon: 'dots-horizontal', color: 'gray', pattern: /^.+$/ },
}

// Threat types
export const THREAT_TYPES = [
  { value: 'malware', label: 'Malware' },
  { value: 'c2', label: 'C2 Server' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'ransomware', label: 'Ransomware' },
  { value: 'botnet', label: 'Botnet' },
  { value: 'dropper', label: 'Dropper' },
  { value: 'spam', label: 'Spam' },
  { value: 'exploit', label: 'Exploit' },
  { value: 'data_theft', label: 'Data Theft' },
  { value: 'apt', label: 'APT' },
  { value: 'other', label: 'Other' },
]

// Import formats
export const IMPORT_FORMATS = {
  csv: { label: 'CSV', extension: '.csv', description: 'Comma-separated values' },
  stix: { label: 'STIX 2.1', extension: '.json', description: 'STIX 2.1 bundle' },
  misp: { label: 'MISP JSON', extension: '.json', description: 'MISP event export' },
  json: { label: 'JSON', extension: '.json', description: 'Simple JSON array' },
  text: { label: 'Plain Text', extension: '.txt', description: 'One IOC per line' },
}

export const customIocLists = {
  /**
   * Get all lists for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('custom_ioc_lists')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get a single list by ID
   */
  async getById(listId, userId) {
    const { data, error } = await supabase
      .from('custom_ioc_lists')
      .select('*')
      .eq('id', listId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new list
   */
  async create(userId, listData) {
    const { data, error } = await supabase
      .from('custom_ioc_lists')
      .insert({
        user_id: userId,
        name: listData.name,
        description: listData.description,
        color: listData.color,
        source: listData.source,
        source_url: listData.sourceUrl,
        is_public: listData.isPublic || false,
        auto_enrich: listData.autoEnrich !== false,
        team_id: listData.teamId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a list
   */
  async update(listId, userId, updates) {
    const updateData = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.source !== undefined) updateData.source = updates.source
    if (updates.sourceUrl !== undefined) updateData.source_url = updates.sourceUrl
    if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic
    if (updates.autoEnrich !== undefined) updateData.auto_enrich = updates.autoEnrich

    const { data, error } = await supabase
      .from('custom_ioc_lists')
      .update(updateData)
      .eq('id', listId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a list
   */
  async delete(listId, userId) {
    const { error } = await supabase
      .from('custom_ioc_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Get import history for a list
   */
  async getImportHistory(listId, userId) {
    const { data, error } = await supabase
      .from('custom_ioc_imports')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  },
}

export const customIocs = {
  /**
   * Get IOCs from a list
   */
  async getByList(listId, userId, filters = {}) {
    let query = supabase
      .from('v_custom_iocs_summary')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)

    if (filters.iocType) {
      query = query.eq('ioc_type', filters.iocType)
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    if (filters.threatType) {
      query = query.eq('threat_type', filters.threatType)
    }

    if (filters.active !== undefined) {
      query = query.eq('is_active', filters.active)
    }

    if (filters.search) {
      query = query.ilike('value', `%${filters.search}%`)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 500)

    if (error) throw error
    return data || []
  },

  /**
   * Get all IOCs for a user (across all lists)
   */
  async getAll(userId, filters = {}) {
    let query = supabase
      .from('v_custom_iocs_summary')
      .select('*')
      .eq('user_id', userId)

    if (filters.iocType) {
      query = query.eq('ioc_type', filters.iocType)
    }

    if (filters.search) {
      query = query.ilike('value', `%${filters.search}%`)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 500)

    if (error) throw error
    return data || []
  },

  /**
   * Add a single IOC
   */
  async add(listId, userId, iocData) {
    const normalized = normalizeIocValue(iocData.value, iocData.iocType)

    const { data, error } = await supabase
      .from('custom_iocs')
      .insert({
        list_id: listId,
        user_id: userId,
        ioc_type: iocData.iocType,
        value: iocData.value,
        value_normalized: normalized,
        threat_type: iocData.threatType,
        malware_family: iocData.malwareFamily,
        confidence: iocData.confidence || 50,
        severity: iocData.severity || 'medium',
        description: iocData.description,
        tags: iocData.tags || [],
        first_seen: iocData.firstSeen,
        last_seen: iocData.lastSeen,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Add multiple IOCs at once
   */
  async addBulk(listId, userId, iocsData) {
    const records = iocsData.map(ioc => ({
      list_id: listId,
      user_id: userId,
      ioc_type: ioc.iocType,
      value: ioc.value,
      value_normalized: normalizeIocValue(ioc.value, ioc.iocType),
      threat_type: ioc.threatType,
      malware_family: ioc.malwareFamily,
      confidence: ioc.confidence || 50,
      severity: ioc.severity || 'medium',
      description: ioc.description,
      tags: ioc.tags || [],
    }))

    const { data, error } = await supabase
      .from('custom_iocs')
      .upsert(records, {
        onConflict: 'list_id,ioc_type,value_normalized',
        ignoreDuplicates: true,
      })
      .select()

    if (error) throw error
    return data || []
  },

  /**
   * Update an IOC
   */
  async update(iocId, userId, updates) {
    const updateData = {}
    if (updates.threatType !== undefined) updateData.threat_type = updates.threatType
    if (updates.malwareFamily !== undefined) updateData.malware_family = updates.malwareFamily
    if (updates.confidence !== undefined) updateData.confidence = updates.confidence
    if (updates.severity !== undefined) updateData.severity = updates.severity
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.isFalsePositive !== undefined) updateData.is_false_positive = updates.isFalsePositive

    const { data, error } = await supabase
      .from('custom_iocs')
      .update(updateData)
      .eq('id', iocId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete an IOC
   */
  async delete(iocId, userId) {
    const { error } = await supabase
      .from('custom_iocs')
      .delete()
      .eq('id', iocId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Delete multiple IOCs
   */
  async deleteBulk(iocIds, userId) {
    const { error } = await supabase
      .from('custom_iocs')
      .delete()
      .in('id', iocIds)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Mark IOC as false positive
   */
  async markFalsePositive(iocId, userId, isFalsePositive = true) {
    const { data, error } = await supabase
      .from('custom_iocs')
      .update({
        is_false_positive: isFalsePositive,
        verified_at: new Date().toISOString(),
        verified_by: userId,
      })
      .eq('id', iocId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Check for matches with public IOCs
   */
  async checkPublicMatches(listId, userId) {
    // Query custom IOCs and check against public iocs table
    const { data: customIocsData, error: customError } = await supabase
      .from('custom_iocs')
      .select('id, value_normalized, ioc_type')
      .eq('list_id', listId)
      .is('public_match_id', null)

    if (customError) throw customError
    if (!customIocsData?.length) return { matched: 0 }

    let matchedCount = 0

    // Check each IOC against public database
    for (const customIoc of customIocsData) {
      const { data: publicMatch } = await supabase
        .from('iocs')
        .select('id')
        .eq('value', customIoc.value_normalized)
        .limit(1)
        .single()

      if (publicMatch) {
        await supabase
          .from('custom_iocs')
          .update({
            public_match_id: publicMatch.id,
            public_match_at: new Date().toISOString(),
          })
          .eq('id', customIoc.id)

        matchedCount++
      }
    }

    return { matched: matchedCount }
  },
}

// Helper functions
export function normalizeIocValue(value, type) {
  let normalized = value.trim()

  switch (type) {
    case 'domain':
    case 'email':
    case 'url':
      normalized = normalized.toLowerCase()
      break
    case 'md5':
    case 'sha1':
    case 'sha256':
      normalized = normalized.toLowerCase()
      break
    case 'ip':
    case 'ipv6':
      // Remove leading zeros
      normalized = normalized.replace(/\b0+(\d)/g, '$1')
      break
    case 'asn':
      normalized = normalized.toUpperCase()
      break
  }

  return normalized
}

export function detectIocType(value) {
  const v = value.trim()

  // Check each type's pattern
  if (IOC_TYPES.md5.pattern.test(v)) return 'md5'
  if (IOC_TYPES.sha1.pattern.test(v)) return 'sha1'
  if (IOC_TYPES.sha256.pattern.test(v)) return 'sha256'
  if (IOC_TYPES.ip.pattern.test(v)) return 'ip'
  if (IOC_TYPES.cidr.pattern.test(v)) return 'cidr'
  if (IOC_TYPES.email.pattern.test(v)) return 'email'
  if (IOC_TYPES.url.pattern.test(v)) return 'url'
  if (IOC_TYPES.cve.pattern.test(v)) return 'cve'
  if (IOC_TYPES.asn.pattern.test(v)) return 'asn'
  if (IOC_TYPES.domain.pattern.test(v)) return 'domain'
  if (IOC_TYPES.bitcoin_address.pattern.test(v)) return 'bitcoin_address'

  return 'other'
}

export function parseIocsFromText(text) {
  const lines = text.split(/[\n\r]+/).filter(Boolean)
  const iocs = []

  for (const line of lines) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue

    const iocType = detectIocType(value)
    iocs.push({ value, iocType })
  }

  return iocs
}

export function parseIocsFromCsv(csvText, columnMap = {}) {
  const lines = csvText.split(/[\n\r]+/).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const iocs = []

  // Default column mapping
  const valueCol = columnMap.value || headers.findIndex(h => ['value', 'ioc', 'indicator', 'observable'].includes(h))
  const typeCol = columnMap.type || headers.findIndex(h => ['type', 'ioc_type', 'indicator_type'].includes(h))
  const threatCol = columnMap.threat || headers.findIndex(h => ['threat', 'threat_type', 'category'].includes(h))
  const descCol = columnMap.description || headers.findIndex(h => ['description', 'notes', 'comment'].includes(h))

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const value = cols[valueCol >= 0 ? valueCol : 0]

    if (!value) continue

    const iocType = typeCol >= 0 && cols[typeCol] ? cols[typeCol].toLowerCase() : detectIocType(value)

    iocs.push({
      value,
      iocType: IOC_TYPES[iocType] ? iocType : 'other',
      threatType: threatCol >= 0 ? cols[threatCol] : null,
      description: descCol >= 0 ? cols[descCol] : null,
    })
  }

  return iocs
}

export function exportIocsToCsv(iocs) {
  const headers = ['value', 'type', 'threat_type', 'severity', 'confidence', 'tags', 'description', 'created_at']
  const rows = [headers.join(',')]

  for (const ioc of iocs) {
    const row = [
      `"${ioc.value}"`,
      ioc.ioc_type,
      ioc.threat_type || '',
      ioc.severity,
      ioc.confidence,
      `"${(ioc.tags || []).join(';')}"`,
      `"${(ioc.description || '').replace(/"/g, '""')}"`,
      ioc.created_at,
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n')
}

export function exportIocsToStix(iocs, listName) {
  const bundle = {
    type: 'bundle',
    id: `bundle--${crypto.randomUUID()}`,
    objects: [],
  }

  for (const ioc of iocs) {
    const stixType = getStixType(ioc.ioc_type)
    if (!stixType) continue

    const obj = {
      type: 'indicator',
      spec_version: '2.1',
      id: `indicator--${ioc.id}`,
      created: ioc.created_at,
      modified: ioc.updated_at || ioc.created_at,
      name: `${ioc.ioc_type}: ${ioc.value}`,
      description: ioc.description || '',
      pattern: `[${stixType}:value = '${ioc.value}']`,
      pattern_type: 'stix',
      valid_from: ioc.first_seen || ioc.created_at,
      labels: ioc.tags || [],
      confidence: ioc.confidence,
    }

    bundle.objects.push(obj)
  }

  return JSON.stringify(bundle, null, 2)
}

function getStixType(iocType) {
  const mapping = {
    ip: 'ipv4-addr',
    ipv6: 'ipv6-addr',
    domain: 'domain-name',
    url: 'url',
    email: 'email-addr',
    md5: 'file:hashes.MD5',
    sha1: 'file:hashes.SHA-1',
    sha256: 'file:hashes.SHA-256',
    filename: 'file:name',
  }
  return mapping[iocType]
}

export default { customIocLists, customIocs }
