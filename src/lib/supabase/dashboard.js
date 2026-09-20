/**
 * Dashboard Module
 * Database queries for dashboard statistics
 */

import { supabase } from './client'
import { dateDaysAgo, tally } from './counts'

export const dashboard = {
  async getOverview() {
    // A date, because discovered_date is a date column. This reads the same
    // as the ISO timestamp it replaces - PostgREST truncates the literal to
    // the column type - but it no longer implies a precision that is not
    // there.
    const last30d = dateDaysAgo(30)

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
          .gte('discovered_date', last30d),
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
