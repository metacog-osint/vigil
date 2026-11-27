/**
 * Snapshots Module
 * Frozen results for the Compare page (migration 203). A snapshot is computed
 * by the database (take_snapshot) and is never updated.
 */

import { supabase } from './client'

const PAGE = 1000

export const snapshots = {
  async list() {
    return supabase.from('snapshots').select('*').order('taken_at', { ascending: false }).limit(200)
  },

  async take({ name, scopeType, scopeValue, windowStart, windowEnd }) {
    return supabase.rpc('take_snapshot', {
      p_name: name,
      p_scope_type: scopeType,
      p_scope_value: scopeValue,
      p_window_start: windowStart,
      p_window_end: windowEnd,
    })
  },

  /** The actors whose name matches exactly, ignoring case (two at most). */
  async findActor(name) {
    const pattern = name.trim().replace(/[\\%_]/g, '\\$&')
    return supabase.from('threat_actors').select('id, name').ilike('name', pattern).limit(2)
  },

  async actorNames(ids) {
    const names = {}
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from('threat_actors')
        .select('id, name')
        .in('id', ids.slice(i, i + 100))
      if (error) return { data: null, error }
      for (const row of data || []) names[row.id] = row.name
    }
    return { data: names, error: null }
  },

  /** Every actor name, paged: the summary check needs the names it must not see. */
  async allActorNames() {
    const names = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('threat_actors')
        .select('name')
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) return { data: null, error }
      names.push(...(data || []).map((r) => r.name))
      if (!data || data.length < PAGE) return { data: names, error: null }
    }
  },
}
