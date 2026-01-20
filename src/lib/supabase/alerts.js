/**
 * Alerts Module
 * Database queries for CISA alerts and security advisories
 */

import { supabase } from './client'

export const alerts = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, search = '', category = '', severity = '' } = options

    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .order('published_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    return query
  },

  async getRecent(options = {}) {
    const { limit = 50, offset = 0, category = '', severity = '', days = 30 } = options

    let query = supabase
      .from('alerts')
      .select('*', { count: 'exact' })
      .order('published_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (days > 0) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('published_date', cutoffDate.toISOString())
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    return query
  },

  async getById(id) {
    return supabase.from('alerts').select('*').eq('id', id).single()
  },

  async getByCVE(cveId) {
    return supabase
      .from('alerts')
      .select('*')
      .contains('cve_ids', [cveId])
      .order('published_date', { ascending: false })
  },
}

export default alerts
