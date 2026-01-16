/**
 * Vendor Risk Monitoring Module
 * API for managing third-party vendor security risk
 */

import { supabase } from './supabase'

// Vendor categories
export const VENDOR_CATEGORIES = {
  cloud: { label: 'Cloud Infrastructure', icon: 'cloud' },
  saas: { label: 'SaaS Application', icon: 'desktop-computer' },
  security: { label: 'Security', icon: 'shield-check' },
  identity: { label: 'Identity & Access', icon: 'key' },
  productivity: { label: 'Productivity', icon: 'briefcase' },
  communication: { label: 'Communication', icon: 'chat' },
  development: { label: 'Development', icon: 'code' },
  infrastructure: { label: 'Infrastructure', icon: 'server' },
  data: { label: 'Data & Analytics', icon: 'chart-bar' },
  financial: { label: 'Financial', icon: 'currency-dollar' },
  hr: { label: 'HR & Payroll', icon: 'users' },
  marketing: { label: 'Marketing', icon: 'speakerphone' },
  other: { label: 'Other', icon: 'puzzle' },
}

// Criticality levels
export const CRITICALITY_LEVELS = {
  critical: { label: 'Critical', color: 'red', description: 'Business cannot operate without this vendor' },
  high: { label: 'High', color: 'orange', description: 'Significant impact if unavailable' },
  medium: { label: 'Medium', color: 'yellow', description: 'Moderate impact, workarounds exist' },
  low: { label: 'Low', color: 'green', description: 'Minimal impact if unavailable' },
}

// Risk levels
export const RISK_LEVELS = {
  critical: { label: 'Critical', color: 'red', min: 80 },
  high: { label: 'High', color: 'orange', min: 60 },
  medium: { label: 'Medium', color: 'yellow', min: 40 },
  low: { label: 'Low', color: 'green', min: 0 },
}

// Data types
export const DATA_TYPES = [
  { value: 'pii', label: 'Personal Information (PII)' },
  { value: 'phi', label: 'Health Information (PHI)' },
  { value: 'financial', label: 'Financial Data' },
  { value: 'credentials', label: 'Credentials/Secrets' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'customer_data', label: 'Customer Data' },
  { value: 'employee_data', label: 'Employee Data' },
  { value: 'public', label: 'Public Data Only' },
]

// Event types
export const EVENT_TYPES = {
  breach: { label: 'Data Breach', color: 'red', icon: 'exclamation-triangle' },
  vulnerability: { label: 'Vulnerability', color: 'orange', icon: 'shield-exclamation' },
  incident: { label: 'Security Incident', color: 'yellow', icon: 'exclamation' },
  compliance: { label: 'Compliance Issue', color: 'purple', icon: 'document-text' },
  news: { label: 'Security News', color: 'blue', icon: 'newspaper' },
}

export const vendors = {
  /**
   * Get all vendors for a user/team
   */
  async getAll(userId, teamId = null) {
    let query = supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)

    if (teamId) {
      query = query.or(`team_id.eq.${teamId}`)
    }

    const { data, error } = await query
      .neq('status', 'inactive')
      .order('risk_score', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get vendor by ID
   */
  async getById(vendorId) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get vendor with risk events
   */
  async getWithEvents(vendorId) {
    const [vendor, events] = await Promise.all([
      this.getById(vendorId),
      vendorEvents.getForVendor(vendorId),
    ])

    return { vendor, events }
  },

  /**
   * Create a new vendor
   */
  async create(userId, vendorData) {
    const { data, error } = await supabase
      .from('vendors')
      .insert({
        user_id: userId,
        team_id: vendorData.teamId,
        name: vendorData.name,
        domain: vendorData.domain,
        website: vendorData.website,
        description: vendorData.description,
        category: vendorData.category,
        criticality: vendorData.criticality || 'medium',
        primary_contact: vendorData.primaryContact,
        contact_email: vendorData.contactEmail,
        data_types: vendorData.dataTypes || [],
        data_classification: vendorData.dataClassification,
        technologies: vendorData.technologies || [],
        is_monitored: vendorData.isMonitored !== false,
        monitor_breaches: vendorData.monitorBreaches !== false,
        monitor_vulnerabilities: vendorData.monitorVulnerabilities !== false,
        notes: vendorData.notes,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a vendor
   */
  async update(vendorId, updates) {
    const updateData = { updated_at: new Date().toISOString() }

    const fields = [
      'name', 'domain', 'website', 'description', 'category', 'criticality',
      'primary_contact', 'contact_email', 'contract_owner',
      'contract_start_date', 'contract_end_date', 'contract_value',
      'data_types', 'data_classification', 'technologies', 'notes', 'status'
    ]

    const boolFields = ['is_monitored', 'monitor_breaches', 'monitor_vulnerabilities', 'monitor_news']

    fields.forEach(field => {
      const camelField = field.replace(/_([a-z])/g, g => g[1].toUpperCase())
      if (updates[camelField] !== undefined) {
        updateData[field] = updates[camelField]
      }
    })

    boolFields.forEach(field => {
      const camelField = field.replace(/_([a-z])/g, g => g[1].toUpperCase())
      if (updates[camelField] !== undefined) {
        updateData[field] = updates[camelField]
      }
    })

    const { data, error } = await supabase
      .from('vendors')
      .update(updateData)
      .eq('id', vendorId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a vendor (soft delete)
   */
  async delete(vendorId) {
    const { error } = await supabase
      .from('vendors')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', vendorId)

    if (error) throw error
  },

  /**
   * Get risk summary statistics
   */
  async getRiskSummary(userId, teamId = null) {
    const vendors = await this.getAll(userId, teamId)

    const summary = {
      total: vendors.length,
      byRiskLevel: { critical: 0, high: 0, medium: 0, low: 0 },
      byCategory: {},
      monitored: 0,
      withOpenEvents: 0,
      avgRiskScore: 0,
    }

    let totalRisk = 0

    for (const vendor of vendors) {
      summary.byRiskLevel[vendor.risk_level] = (summary.byRiskLevel[vendor.risk_level] || 0) + 1
      summary.byCategory[vendor.category] = (summary.byCategory[vendor.category] || 0) + 1
      if (vendor.is_monitored) summary.monitored++
      totalRisk += vendor.risk_score || 0
    }

    summary.avgRiskScore = vendors.length > 0 ? Math.round(totalRisk / vendors.length) : 0

    return summary
  },

  /**
   * Recalculate risk score for a vendor
   */
  async recalculateRisk(vendorId) {
    const { data, error } = await supabase.rpc('calculate_vendor_risk_score', {
      p_vendor_id: vendorId,
    })

    if (error) throw error
    return data
  },
}

export const vendorEvents = {
  /**
   * Get events for a vendor
   */
  async getForVendor(vendorId, limit = 50) {
    const { data, error } = await supabase
      .from('vendor_risk_events')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('event_date', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get all open events
   */
  async getOpen(userId, teamId = null) {
    const vendorList = await vendors.getAll(userId, teamId)
    const vendorIds = vendorList.map(v => v.id)

    if (vendorIds.length === 0) return []

    const { data, error } = await supabase
      .from('vendor_risk_events')
      .select(`
        *,
        vendor:vendors(id, name, criticality)
      `)
      .in('vendor_id', vendorIds)
      .in('status', ['open', 'acknowledged'])
      .order('event_date', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Create a risk event
   */
  async create(vendorId, eventData) {
    const { data, error } = await supabase
      .from('vendor_risk_events')
      .insert({
        vendor_id: vendorId,
        event_type: eventData.eventType,
        severity: eventData.severity,
        title: eventData.title,
        description: eventData.description,
        source: eventData.source || 'manual',
        source_url: eventData.sourceUrl,
        source_id: eventData.sourceId,
        affected_data_types: eventData.affectedDataTypes || [],
        affected_records: eventData.affectedRecords,
        event_date: eventData.eventDate || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Recalculate vendor risk
    await vendors.recalculateRisk(vendorId)

    return data
  },

  /**
   * Update event status
   */
  async updateStatus(eventId, status, notes, userId) {
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'acknowledged') {
      updateData.acknowledged_at = new Date().toISOString()
      updateData.acknowledged_by = userId
    } else if (status === 'resolved' || status === 'mitigated') {
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = userId
      updateData.resolution_notes = notes
    }

    const { data, error } = await supabase
      .from('vendor_risk_events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single()

    if (error) throw error

    // Recalculate vendor risk
    await vendors.recalculateRisk(data.vendor_id)

    return data
  },
}

export const vendorAssessments = {
  /**
   * Get assessments for a vendor
   */
  async getForVendor(vendorId) {
    const { data, error } = await supabase
      .from('vendor_assessments')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get latest assessment
   */
  async getLatest(vendorId) {
    const { data, error } = await supabase
      .from('vendor_assessments')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create assessment
   */
  async create(vendorId, assessmentData, userId) {
    const { data, error } = await supabase
      .from('vendor_assessments')
      .insert({
        vendor_id: vendorId,
        assessment_type: assessmentData.assessmentType || 'annual',
        responses: assessmentData.responses || {},
        assessed_by: userId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Complete assessment with scores
   */
  async complete(assessmentId, scores, findings, userId) {
    const { data, error } = await supabase
      .from('vendor_assessments')
      .update({
        status: 'completed',
        security_score: scores.security,
        privacy_score: scores.privacy,
        compliance_score: scores.compliance,
        operational_score: scores.operational,
        overall_score: scores.overall,
        findings: findings || [],
        reviewed_by: userId,
        completed_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .select()
      .single()

    if (error) throw error

    // Recalculate vendor risk
    const assessment = await this.getById(assessmentId)
    if (assessment) {
      await vendors.recalculateRisk(assessment.vendor_id)
    }

    return data
  },

  /**
   * Get assessment by ID
   */
  async getById(assessmentId) {
    const { data, error } = await supabase
      .from('vendor_assessments')
      .select('*')
      .eq('id', assessmentId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },
}

// Utility: Get risk level from score
export function getRiskLevel(score) {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

// Utility: Get risk level color
export function getRiskColor(level) {
  return RISK_LEVELS[level]?.color || 'gray'
}

// Utility: Format risk score with color
export function formatRiskScore(score) {
  const level = getRiskLevel(score)
  return { score, level, color: getRiskColor(level) }
}

export default { vendors, vendorEvents, vendorAssessments }
