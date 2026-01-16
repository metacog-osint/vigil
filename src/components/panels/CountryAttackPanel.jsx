import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import TrendBadge from '../TrendBadge'
import SeverityBadge from '../SeverityBadge'

export default function CountryAttackPanel({ country, days = 30, onActorClick, onClose }) {
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState([])
  const [actors, setActors] = useState([])
  const [sectors, setSectors] = useState([])
  const [vulnerabilities, setVulnerabilities] = useState([])

  useEffect(() => {
    if (!country?.code) return

    async function fetchData() {
      setLoading(true)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      // Get incidents for this country
      const { data: incidentData } = await supabase
        .from('incidents')
        .select(`
          id, victim_name, victim_sector, discovered_date, status,
          threat_actor:threat_actors(id, name, trend_status, actor_type)
        `)
        .ilike('victim_country', country.code)
        .gte('discovered_date', cutoffDate.toISOString())
        .order('discovered_date', { ascending: false })
        .limit(50)

      if (incidentData) {
        setIncidents(incidentData)

        // Aggregate actors
        const actorMap = {}
        incidentData.forEach(inc => {
          if (inc.threat_actor?.id) {
            if (!actorMap[inc.threat_actor.id]) {
              actorMap[inc.threat_actor.id] = {
                ...inc.threat_actor,
                incidentCount: 0,
              }
            }
            actorMap[inc.threat_actor.id].incidentCount++
          }
        })
        setActors(Object.values(actorMap).sort((a, b) => b.incidentCount - a.incidentCount))

        // Aggregate sectors
        const sectorMap = {}
        incidentData.forEach(inc => {
          if (inc.victim_sector) {
            sectorMap[inc.victim_sector] = (sectorMap[inc.victim_sector] || 0) + 1
          }
        })
        setSectors(
          Object.entries(sectorMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }))
        )
      }

      // Get recent KEVs that might affect this country
      const { data: kevData } = await supabase
        .from('vulnerabilities')
        .select('cve_id, cvss_score, description, affected_vendors, kev_date')
        .not('kev_date', 'is', null)
        .gte('kev_date', cutoffDate.toISOString())
        .order('kev_date', { ascending: false })
        .limit(5)

      if (kevData) {
        setVulnerabilities(kevData)
      }

      setLoading(false)
    }

    fetchData()
  }, [country?.code, days])

  if (!country) return null

  const getSeverityFromCvss = (score) => {
    if (score >= 9) return 'critical'
    if (score >= 7) return 'high'
    if (score >= 4) return 'medium'
    return 'low'
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900/30 to-gray-900 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{country.name}</h3>
            <p className="text-sm text-gray-400">
              {country.count} incidents in last {days} days
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto" />
        </div>
      ) : (
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {/* Active Actors */}
          {actors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <span className="text-red-400">Active Threat Actors</span>
                <span className="text-xs text-gray-500">({actors.length})</span>
              </h4>
              <div className="space-y-2">
                {actors.slice(0, 5).map(actor => (
                  <div
                    key={actor.id}
                    className="bg-gray-800 rounded p-3 hover:bg-gray-750 cursor-pointer transition-colors"
                    onClick={() => onActorClick?.(actor)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{actor.name}</span>
                        {actor.trend_status && (
                          <TrendBadge status={actor.trend_status} showLabel={false} />
                        )}
                      </div>
                      <span className="text-cyan-400 text-sm">{actor.incidentCount} attacks</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">{actor.actor_type}</div>
                  </div>
                ))}
                {actors.length > 5 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    +{actors.length - 5} more actors
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Targeted Sectors */}
          {sectors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Targeted Industries
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {sectors.slice(0, 6).map(sector => (
                  <div
                    key={sector.name}
                    className="bg-gray-800 rounded p-2 text-center"
                  >
                    <div className="text-white text-sm capitalize">{sector.name}</div>
                    <div className="text-cyan-400 text-xs">{sector.count} incidents</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Incidents */}
          {incidents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Recent Incidents
              </h4>
              <div className="space-y-1">
                {incidents.slice(0, 5).map(inc => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between py-1.5 px-2 bg-gray-800 rounded text-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-gray-300 truncate">{inc.victim_name}</span>
                      {inc.threat_actor?.name && (
                        <span className="text-red-400 text-xs">
                          {inc.threat_actor.name}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs whitespace-nowrap ml-2">
                      {new Date(inc.discovered_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active KEVs */}
          {vulnerabilities.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Recent KEVs to Prioritize
              </h4>
              <div className="space-y-2">
                {vulnerabilities.map(vuln => (
                  <div
                    key={vuln.cve_id}
                    className="bg-gray-800 rounded p-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-cyan-400 font-mono text-sm">{vuln.cve_id}</span>
                      <SeverityBadge severity={getSeverityFromCvss(vuln.cvss_score)} />
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-2">
                      {vuln.description?.substring(0, 100)}...
                    </p>
                    {vuln.affected_vendors?.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Vendors: {vuln.affected_vendors.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defensive Recommendations */}
          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-orange-400 mb-2">
              Defensive Recommendations
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              {actors.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400">•</span>
                  Monitor for {actors[0]?.name} TTPs and IOCs
                </li>
              )}
              {sectors.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400">•</span>
                  Prioritize {sectors[0]?.name} sector defenses
                </li>
              )}
              {vulnerabilities.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400">•</span>
                  Patch {vulnerabilities[0]?.cve_id} immediately
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-orange-400">•</span>
                Review access controls for remote services
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
