/**
 * Dashboard Module
 * Database queries for dashboard statistics
 */

import { supabase } from './client'

export const dashboard = {
  async getOverview() {
    const now = new Date()
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000)

    // Run queries in parallel
    const [
      actorCount,
      incidentCount30d,
      incidentCountTotal,
      kevCount,
      iocCount,
    ] = await Promise.all([
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }),
      supabase.from('incidents').select('*', { count: 'exact', head: true })
        .gte('discovered_date', last30d.toISOString()),
      supabase.from('incidents').select('*', { count: 'exact', head: true }),
      supabase.from('vulnerabilities').select('*', { count: 'exact', head: true })
        .not('kev_date', 'is', null),
      supabase.from('iocs').select('*', { count: 'exact', head: true }),
    ])

    return {
      totalActors: actorCount.count || 0,
      incidents24h: incidentCount30d.count || 0,
      incidents7d: incidentCountTotal.count || 0,
      newKEV7d: kevCount.count || 0,
      newIOCs24h: iocCount.count || 0,
    }
  },
}

export default dashboard
