/**
 * MITRE ATT&CK Techniques Module
 * Database queries for technique and tactic management
 */

import { supabase } from './client'

export const techniques = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, tactic = '', search = '' } = options

    let query = supabase
      .from('techniques')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (tactic) {
      query = query.contains('tactics', [tactic])
    }

    if (search) {
      query = query.or(`id.ilike.%${search}%,name.ilike.%${search}%`)
    }

    return query
  },

  async getById(techniqueId) {
    return supabase.from('techniques').select('*').eq('id', techniqueId).single()
  },

  async getByTactic(tactic, limit = 50) {
    return supabase
      .from('techniques')
      .select('*')
      .contains('tactics', [tactic])
      .order('id', { ascending: true })
      .limit(limit)
  },

  async getForActor(actorId) {
    return supabase
      .from('actor_techniques')
      .select(
        `
        *,
        technique:techniques(*)
      `
      )
      .eq('actor_id', actorId)
      .order('created_at', { ascending: false })
  },

  async getTacticSummary() {
    const { data } = await supabase.from('techniques').select('tactics')

    const counts = {}
    for (const row of data || []) {
      for (const tactic of row.tactics || []) {
        counts[tactic] = (counts[tactic] || 0) + 1
      }
    }
    return counts
  },
}

export default techniques
