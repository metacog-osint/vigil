/**
 * What's New Module
 *
 * Calculates and tracks new items since user's last visit.
 */
import { supabase } from './supabase/client'

/**
 * Get counts of new items since a given timestamp
 * @param {Date} since - Timestamp to count from
 * @returns {Promise<Object>} Counts by category
 */
export async function getNewItemCounts(since) {
  if (!since) return { total: 0, breakdown: {} }

  const sinceISO = since.toISOString()

  try {
    // Run queries in parallel for performance
    const [incidentsResult, actorsResult, kevsResult, iocsResult] = await Promise.all([
      // New incidents
      supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceISO),

      // New or updated actors (escalating)
      supabase
        .from('threat_actors')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', sinceISO),

      // New KEVs
      supabase
        .from('vulnerabilities')
        .select('id', { count: 'exact', head: true })
        .not('kev_date', 'is', null)
        .gte('kev_date', sinceISO.split('T')[0]),

      // New IOCs
      supabase
        .from('iocs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceISO),
    ])

    const breakdown = {
      incidents: incidentsResult.count || 0,
      actors: actorsResult.count || 0,
      kevs: kevsResult.count || 0,
      iocs: iocsResult.count || 0,
    }

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0)

    return { total, breakdown }
  } catch (error) {
    console.error('Error fetching new item counts:', error)
    return { total: 0, breakdown: {}, error }
  }
}

/**
 * Get recent new items for the dropdown
 * @param {Date} since - Timestamp to count from
 * @param {number} limit - Max items per category
 * @returns {Promise<Object>} Recent items by category
 */
export async function getNewItems(since, limit = 3) {
  if (!since) return { incidents: [], actors: [], kevs: [], iocs: [] }

  const sinceISO = since.toISOString()

  try {
    const [incidentsResult, actorsResult, kevsResult] = await Promise.all([
      // Recent incidents
      supabase
        .from('incidents')
        .select('id, victim_name, threat_actor:threat_actors(name), created_at')
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Recently updated actors
      supabase
        .from('threat_actors')
        .select('id, name, trend_status, updated_at')
        .gte('updated_at', sinceISO)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // Recent KEVs
      supabase
        .from('vulnerabilities')
        .select('cve_id, description, cvss_score, kev_date')
        .not('kev_date', 'is', null)
        .gte('kev_date', sinceISO.split('T')[0])
        .order('kev_date', { ascending: false })
        .limit(limit),
    ])

    return {
      incidents: incidentsResult.data || [],
      actors: actorsResult.data || [],
      kevs: kevsResult.data || [],
    }
  } catch (error) {
    console.error('Error fetching new items:', error)
    return { incidents: [], actors: [], kevs: [], error }
  }
}

/**
 * Check if an item is "new" based on timestamp
 * @param {string} createdAt - ISO timestamp
 * @param {Date} since - Last visit timestamp
 * @returns {boolean}
 */
export function isNewSince(createdAt, since) {
  if (!createdAt || !since) return false
  return new Date(createdAt) > since
}

/**
 * Get category icon and color for display
 */
export const categoryMeta = {
  incidents: {
    icon: 'alert',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    label: 'Incidents',
    singularLabel: 'incident',
  },
  actors: {
    icon: 'users',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    label: 'Actors',
    singularLabel: 'actor',
  },
  kevs: {
    icon: 'shield',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    label: 'KEVs',
    singularLabel: 'KEV',
  },
  iocs: {
    icon: 'fingerprint',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    label: 'IOCs',
    singularLabel: 'IOC',
  },
}

export default {
  getNewItemCounts,
  getNewItems,
  isNewSince,
  categoryMeta,
}
