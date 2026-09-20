/**
 * Dashboard Module
 * Database queries for dashboard statistics
 */

import { supabase } from './client'

/**
 * A count that could not be read is null, not zero.
 *
 * supabase-js resolves rather than throws, so a failed count arrives as
 * { count: undefined, error }. Coercing that to 0 publishes a figure the
 * database never returned - "0 KEV Vulnerabilities" is a claim, and a wrong
 * one. Callers render null as an em dash.
 */
function tally(result) {
  if (result?.error) return null
  return typeof result?.count === 'number' ? result.count : null
}

export const dashboard = {
  async getOverview() {
    const now = new Date()
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000)

    // Whole-table totals use estimated counts: exact counts over the large
    // incidents/iocs tables exceed the statement timeout and return errors.
    // Filtered counts (30d incidents, KEV) stay exact.
    // Run queries in parallel
    const [actorCount, incidentCount30d, incidentCountTotal, kevCount, iocCount] =
      await Promise.all([
        supabase.from('threat_actors').select('*', { count: 'estimated', head: true }),
        supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .gte('discovered_date', last30d.toISOString()),
        supabase.from('incidents').select('*', { count: 'estimated', head: true }),
        supabase
          .from('vulnerabilities')
          .select('*', { count: 'exact', head: true })
          .not('kev_date', 'is', null),
        supabase.from('iocs').select('*', { count: 'estimated', head: true }),
      ])

    return {
      totalActors: tally(actorCount),
      incidents30d: tally(incidentCount30d),
      incidentsTotal: tally(incidentCountTotal),
      kevTotal: tally(kevCount),
      iocTotal: tally(iocCount),
    }
  },
}

export default dashboard
