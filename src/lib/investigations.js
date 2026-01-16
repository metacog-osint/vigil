/**
 * Investigations Module
 * API for threat investigation notebooks
 */

import { supabase } from './supabase'

// Entry types
export const ENTRY_TYPES = {
  note: { label: 'Note', icon: 'document-text', color: 'gray' },
  finding: { label: 'Finding', icon: 'light-bulb', color: 'yellow' },
  entity: { label: 'Linked Entity', icon: 'link', color: 'blue' },
  evidence: { label: 'Evidence', icon: 'paper-clip', color: 'purple' },
  action: { label: 'Action Taken', icon: 'check-circle', color: 'green' },
  timeline_event: { label: 'Timeline Event', icon: 'clock', color: 'cyan' },
}

// Investigation categories
export const CATEGORIES = [
  { value: 'ransomware', label: 'Ransomware' },
  { value: 'malware', label: 'Malware' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'apt', label: 'APT/Nation-State' },
  { value: 'insider', label: 'Insider Threat' },
  { value: 'data_breach', label: 'Data Breach' },
  { value: 'vulnerability', label: 'Vulnerability' },
  { value: 'other', label: 'Other' },
]

// Status options
export const STATUSES = [
  { value: 'open', label: 'Open', color: 'blue' },
  { value: 'in_progress', label: 'In Progress', color: 'yellow' },
  { value: 'closed', label: 'Closed', color: 'green' },
  { value: 'archived', label: 'Archived', color: 'gray' },
]

// Priority options
export const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'red' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'low', label: 'Low', color: 'green' },
]

// TLP options
export const TLP_OPTIONS = [
  { value: 'red', label: 'TLP:RED', color: 'red', description: 'Not for disclosure' },
  { value: 'amber', label: 'TLP:AMBER', color: 'amber', description: 'Limited disclosure' },
  { value: 'green', label: 'TLP:GREEN', color: 'green', description: 'Community sharing' },
  { value: 'white', label: 'TLP:WHITE', color: 'white', description: 'Public' },
]

export const investigations = {
  /**
   * Get all investigations for a user
   */
  async getAll(userId, filters = {}) {
    let query = supabase
      .from('v_investigation_summary')
      .select('*')
      .or(`user_id.eq.${userId},shared_with.cs.{${userId}}`)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  },

  /**
   * Get a single investigation with entries
   */
  async getById(investigationId, userId) {
    // Get investigation
    const { data: investigation, error: invError } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', investigationId)
      .single()

    if (invError) throw invError

    // Get entries
    const { data: entries, error: entriesError } = await supabase
      .from('investigation_entries')
      .select('*')
      .eq('investigation_id', investigationId)
      .order('created_at', { ascending: true })

    if (entriesError) throw entriesError

    // Get collaborators
    const { data: collaborators } = await supabase
      .from('investigation_collaborators')
      .select('*')
      .eq('investigation_id', investigationId)

    return {
      ...investigation,
      entries: entries || [],
      collaborators: collaborators || [],
    }
  },

  /**
   * Create a new investigation
   */
  async create(userId, data) {
    const { data: investigation, error } = await supabase
      .from('investigations')
      .insert({
        user_id: userId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || 'medium',
        tags: data.tags || [],
        tlp: data.tlp || 'amber',
        team_id: data.teamId,
      })
      .select()
      .single()

    if (error) throw error

    // If template specified, add default entries
    if (data.templateId) {
      const { data: template } = await supabase
        .from('investigation_templates')
        .select('default_entries')
        .eq('id', data.templateId)
        .single()

      if (template?.default_entries) {
        const entries = template.default_entries.map(entry => ({
          investigation_id: investigation.id,
          entry_type: entry.entry_type,
          content: entry.content,
          created_by: userId,
        }))

        if (entries.length > 0) {
          await supabase.from('investigation_entries').insert(entries)
        }
      }
    }

    return investigation
  },

  /**
   * Update an investigation
   */
  async update(investigationId, userId, updates) {
    const updateData = {}

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.priority !== undefined) updateData.priority = updates.priority
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.summary !== undefined) updateData.summary = updates.summary
    if (updates.tlp !== undefined) updateData.tlp = updates.tlp

    if (updates.status === 'closed') {
      updateData.closed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('investigations')
      .update(updateData)
      .eq('id', investigationId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete an investigation
   */
  async delete(investigationId, userId) {
    const { error } = await supabase
      .from('investigations')
      .delete()
      .eq('id', investigationId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Add an entry to an investigation
   */
  async addEntry(investigationId, userId, entryType, content) {
    const { data, error } = await supabase
      .from('investigation_entries')
      .insert({
        investigation_id: investigationId,
        entry_type: entryType,
        content,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update an entry
   */
  async updateEntry(entryId, content) {
    const { data, error } = await supabase
      .from('investigation_entries')
      .update({ content })
      .eq('id', entryId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete an entry
   */
  async deleteEntry(entryId) {
    const { error } = await supabase
      .from('investigation_entries')
      .delete()
      .eq('id', entryId)

    if (error) throw error
  },

  /**
   * Link an entity to an investigation
   */
  async linkEntity(investigationId, userId, entityType, entityId, entityName, notes = '') {
    return this.addEntry(investigationId, userId, 'entity', {
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      notes,
      linked_at: new Date().toISOString(),
    })
  },

  /**
   * Add a finding
   */
  async addFinding(investigationId, userId, title, description, severity = 'medium') {
    return this.addEntry(investigationId, userId, 'finding', {
      title,
      description,
      severity,
    })
  },

  /**
   * Add a timeline event
   */
  async addTimelineEvent(investigationId, userId, timestamp, event, source = '') {
    return this.addEntry(investigationId, userId, 'timeline_event', {
      timestamp,
      event,
      source,
    })
  },

  /**
   * Share investigation with users
   */
  async share(investigationId, userId, shareWithUserIds) {
    const { data, error } = await supabase
      .from('investigations')
      .update({ shared_with: shareWithUserIds, is_shared: shareWithUserIds.length > 0 })
      .eq('id', investigationId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get templates
   */
  async getTemplates() {
    const { data, error } = await supabase
      .from('investigation_templates')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get investigation stats for user
   */
  async getStats(userId) {
    const { data, error } = await supabase
      .from('investigations')
      .select('status')
      .eq('user_id', userId)

    if (error) throw error

    const stats = { total: 0, open: 0, in_progress: 0, closed: 0, archived: 0 }
    for (const inv of data || []) {
      stats.total++
      stats[inv.status] = (stats[inv.status] || 0) + 1
    }

    return stats
  },
}

export default investigations
