/**
 * Scheduled Reports Module
 * Manages report schedules and generation
 */

import { supabase } from './supabase'

// Available report sections
export const REPORT_SECTIONS = {
  summary: {
    id: 'summary',
    label: 'Executive Summary',
    description: 'AI-generated BLUF and key metrics',
    icon: 'document-text',
  },
  incidents: {
    id: 'incidents',
    label: 'Ransomware Incidents',
    description: 'New ransomware attacks and victim organizations',
    icon: 'exclamation-triangle',
  },
  actors: {
    id: 'actors',
    label: 'Threat Actors',
    description: 'Active actors and trend changes',
    icon: 'user-group',
  },
  vulnerabilities: {
    id: 'vulnerabilities',
    label: 'Vulnerabilities',
    description: 'New CVEs and KEV additions',
    icon: 'shield-exclamation',
  },
  iocs: {
    id: 'iocs',
    label: 'IOCs',
    description: 'New indicators of compromise',
    icon: 'fingerprint',
  },
  trends: {
    id: 'trends',
    label: 'Trend Analysis',
    description: 'Week-over-week comparisons and patterns',
    icon: 'trending-up',
  },
  watchlist: {
    id: 'watchlist',
    label: 'Watchlist Updates',
    description: 'Activity on your watched items',
    icon: 'eye',
  },
  historical: {
    id: 'historical',
    label: 'Historical Trends',
    description: '30/60/90-day trend comparison charts',
    icon: 'chart-bar',
  },
  compliance_soc2: {
    id: 'compliance_soc2',
    label: 'SOC 2 Summary',
    description: 'Security incidents and controls summary for SOC 2',
    icon: 'shield-check',
  },
  compliance_pci: {
    id: 'compliance_pci',
    label: 'PCI-DSS Summary',
    description: 'Vulnerability and threat summary for PCI compliance',
    icon: 'credit-card',
  },
}

// Pre-built report templates
export const REPORT_TEMPLATES = {
  executive: {
    id: 'executive',
    name: 'Executive Briefing',
    description: 'High-level summary for leadership, focusing on key metrics and strategic risks',
    sections: ['summary', 'trends', 'actors'],
    frequency: 'weekly',
    recommended: true,
  },
  security_ops: {
    id: 'security_ops',
    name: 'Security Operations',
    description: 'Detailed technical report for SOC teams with IOCs and vulnerabilities',
    sections: ['summary', 'incidents', 'vulnerabilities', 'iocs', 'watchlist'],
    frequency: 'daily',
  },
  threat_intel: {
    id: 'threat_intel',
    name: 'Threat Intelligence',
    description: 'Comprehensive actor analysis and trend data for threat analysts',
    sections: ['summary', 'actors', 'incidents', 'trends', 'historical'],
    frequency: 'weekly',
  },
  compliance: {
    id: 'compliance',
    name: 'Compliance Report',
    description: 'Audit-ready report with SOC 2 and PCI-DSS compliance summaries',
    sections: ['summary', 'vulnerabilities', 'compliance_soc2', 'compliance_pci'],
    frequency: 'monthly',
  },
  vulnerability: {
    id: 'vulnerability',
    name: 'Vulnerability Digest',
    description: 'Focus on new CVEs, KEV updates, and exploitability',
    sections: ['summary', 'vulnerabilities', 'trends'],
    frequency: 'daily',
  },
  custom: {
    id: 'custom',
    name: 'Custom Report',
    description: 'Build your own report with selected sections',
    sections: ['summary'],
    frequency: 'weekly',
  },
}

export const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekly', label: 'Weekly', description: 'Once per week' },
  { value: 'monthly', label: 'Monthly', description: 'Once per month' },
]

export const DAY_OPTIONS = {
  weekly: [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ],
  monthly: Array.from({ length: 28 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
  })),
}

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export const scheduledReports = {
  /**
   * Get all scheduled reports for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get a single report by ID
   */
  async getById(reportId, userId) {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Create a new scheduled report
   */
  async create(userId, reportConfig) {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .insert({
        user_id: userId,
        name: reportConfig.name,
        frequency: reportConfig.frequency,
        delivery_day: reportConfig.deliveryDay,
        delivery_time: reportConfig.deliveryTime || '08:00:00',
        timezone: reportConfig.timezone || 'UTC',
        sections: reportConfig.sections || ['summary', 'incidents', 'actors', 'vulnerabilities'],
        filters: reportConfig.filters || {},
        recipients: reportConfig.recipients || [],
        format: reportConfig.format || 'pdf',
        branding: reportConfig.branding || {},
        is_enabled: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a scheduled report
   */
  async update(reportId, userId, updates) {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .update({
        name: updates.name,
        frequency: updates.frequency,
        delivery_day: updates.deliveryDay,
        delivery_time: updates.deliveryTime,
        timezone: updates.timezone,
        sections: updates.sections,
        filters: updates.filters,
        recipients: updates.recipients,
        format: updates.format,
        branding: updates.branding,
        is_enabled: updates.isEnabled,
      })
      .eq('id', reportId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a scheduled report
   */
  async delete(reportId, userId) {
    const { error } = await supabase
      .from('scheduled_reports')
      .delete()
      .eq('id', reportId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Toggle report enabled status
   */
  async toggle(reportId, userId, enabled) {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .update({ is_enabled: enabled })
      .eq('id', reportId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get report generation history
   */
  async getHistory(reportId, userId, limit = 10) {
    const { data, error } = await supabase
      .from('report_history')
      .select('*')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get all report history for a user
   */
  async getAllHistory(userId, limit = 20) {
    const { data, error } = await supabase
      .from('report_history')
      .select(
        `
        *,
        scheduled_reports (
          name,
          frequency
        )
      `
      )
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Record report generation
   */
  async recordGeneration(reportId, userId, stats, deliveryStatus = 'pending') {
    const now = new Date()
    const { data, error } = await supabase
      .from('report_history')
      .insert({
        report_id: reportId,
        user_id: userId,
        time_range_start: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        time_range_end: now.toISOString(),
        stats,
        delivery_status: deliveryStatus,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update report history with delivery status
   */
  async updateDeliveryStatus(
    historyId,
    status,
    recipientsSent = [],
    recipientsFailed = [],
    errorMessage = null
  ) {
    const { data, error } = await supabase
      .from('report_history')
      .update({
        delivery_status: status,
        recipients_sent: recipientsSent,
        recipients_failed: recipientsFailed,
        error_message: errorMessage,
      })
      .eq('id', historyId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get reports due for delivery
   */
  async getDueReports() {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_scheduled_at', new Date().toISOString())
      .order('next_scheduled_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Mark report as sent and update schedule
   */
  async markSent(reportId) {
    const { data, error } = await supabase
      .from('scheduled_reports')
      .update({
        last_sent_at: new Date().toISOString(),
        send_count: supabase.sql`send_count + 1`,
      })
      .eq('id', reportId)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

export default scheduledReports
