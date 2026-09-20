/**
 * Group Profiles Module
 * Tooling, leak sites and sanctions designations for a threat actor,
 * plus the address lookup that answers "is this wallet sanctioned?".
 */

import { supabase } from './client'

export const profiles = {
  /**
   * Everything a group page shows beyond incidents and techniques.
   * One round trip; each table is small and indexed on actor_id.
   */
  async getActorProfile(actorId) {
    if (!actorId) return { tools: [], sites: [], sanctions: [], takedowns: [] }

    const [tools, sites, sanctions, takedowns] = await Promise.all([
      supabase
        .from('actor_tools')
        .select('tool_name, category, source, last_seen')
        .eq('actor_id', actorId)
        .order('category')
        .order('tool_name'),
      supabase
        .from('actor_sites')
        .select('fqdn, enabled, available, source, last_seen')
        .eq('actor_id', actorId)
        .order('available', { ascending: false })
        .order('fqdn'),
      supabase
        .from('actor_sanctions')
        .select('entity_name, entity_uid, programs, match_basis, source, first_seen')
        .eq('actor_id', actorId),
      supabase
        .from('actor_takedowns')
        .select('event_date, kind, operation_name, authorities, summary, source_url, source_title')
        .eq('actor_id', actorId)
        .order('event_date', { ascending: false }),
    ])

    return {
      tools: tools.data || [],
      sites: sites.data || [],
      sanctions: sanctions.data || [],
      takedowns: takedowns.data || [],
    }
  },

  /**
   * Is this address on the OFAC SDN list?
   * Matched case-insensitively because Ethereum-style addresses are usually
   * pasted in whatever case the user copied. A delisted address still returns,
   * carrying the date it left the list.
   */
  async lookupSanctionedAddress(address) {
    const value = (address || '').trim()
    if (!value) return null

    const { data, error } = await supabase
      .from('sanctioned_addresses')
      .select(
        'address, currency, entity_name, programs, aliases, first_seen, last_seen, delisted_at'
      )
      .ilike('address', value)
      .limit(1)

    if (error) throw error
    return data?.[0] || null
  },

  /** Groups whose designations a sanctions-minded user can browse. */
  async getSanctionedActors() {
    const { data, error } = await supabase
      .from('actor_sanctions')
      .select('entity_name, programs, match_basis, actor:threat_actors(id, name, actor_type)')
      .order('entity_name')

    if (error) throw error
    return data || []
  },
}
