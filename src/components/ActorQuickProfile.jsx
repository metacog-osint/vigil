import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { correlations } from '../lib/supabase'
import TrendBadge from './TrendBadge'
import SeverityBadge from './SeverityBadge'

export default function ActorQuickProfile({ actorId, actorName, onClose, onAddToWatchlist }) {
  const [loading, setLoading] = useState(true)
  const [actor, setActor] = useState(null)
  const [techniques, setTechniques] = useState([])
  const [vulnerabilities, setVulnerabilities] = useState([])
  const [recentIncidents, setRecentIncidents] = useState([])

  useEffect(() => {
    if (!actorId && !actorName) return

    async function fetchData() {
      setLoading(true)

      // Get actor details
      let actorQuery = supabase.from('threat_actors').select('*')
      if (actorId) {
        actorQuery = actorQuery.eq('id', actorId)
      } else {
        actorQuery = actorQuery.eq('name', actorName)
      }
      const { data: actorData } = await actorQuery.single()

      if (actorData) {
        setActor(actorData)

        // Get correlations (TTPs, CVEs)
        try {
          const corrData = await correlations.getActorCorrelations(actorData.id)
          if (corrData.techniques) {
            setTechniques(corrData.techniques.slice(0, 5))
          }
          if (corrData.vulnerabilities) {
            setVulnerabilities(corrData.vulnerabilities.slice(0, 5))
          }
        } catch (err) {
          // Correlations might not exist
        }

        // Get recent incidents
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 30)
        const { data: incData } = await supabase
          .from('incidents')
          .select('id, victim_name, victim_sector, discovered_date')
          .eq('actor_id', actorData.id)
          .gte('discovered_date', cutoffDate.toISOString())
          .order('discovered_date', { ascending: false })
          .limit(5)

        if (incData) {
          setRecentIncidents(incData)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [actorId, actorName])

  // Get defensive recommendations based on TTPs
  const getDefensiveRecommendations = () => {
    const recommendations = []

    // Based on common TTPs
    if (actor?.ttps?.includes('T1566') || techniques.some(t => t.technique_id === 'T1566')) {
      recommendations.push({
        ttp: 'T1566 - Phishing',
        action: 'Implement email filtering, enable MFA, conduct phishing awareness training',
      })
    }
    if (actor?.ttps?.includes('T1486') || techniques.some(t => t.technique_id === 'T1486')) {
      recommendations.push({
        ttp: 'T1486 - Data Encrypted',
        action: 'Maintain offline backups, implement EDR with ransomware protection',
      })
    }
    if (actor?.ttps?.includes('T1078') || techniques.some(t => t.technique_id === 'T1078')) {
      recommendations.push({
        ttp: 'T1078 - Valid Accounts',
        action: 'Enforce strong passwords, implement privileged access management',
      })
    }
    if (actor?.ttps?.includes('T1133') || techniques.some(t => t.technique_id === 'T1133')) {
      recommendations.push({
        ttp: 'T1133 - External Remote Services',
        action: 'Audit VPN/RDP access, implement network segmentation',
      })
    }
    if (actor?.ttps?.includes('T1190') || techniques.some(t => t.technique_id === 'T1190')) {
      recommendations.push({
        ttp: 'T1190 - Exploit Public-Facing',
        action: 'Patch internet-facing systems immediately, enable WAF',
      })
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        ttp: 'General',
        action: 'Monitor for IOCs, review access logs, ensure backups are current',
      })
    }

    return recommendations.slice(0, 4)
  }

  const getSeverityFromCvss = (score) => {
    if (score >= 9) return 'critical'
    if (score >= 7) return 'high'
    if (score >= 4) return 'medium'
    return 'low'
  }

  const getActorTypeBadgeColor = (type) => {
    const colors = {
      ransomware: 'bg-red-500/20 text-red-400 border-red-500/30',
      apt: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      cybercrime: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      hacktivism: 'bg-green-500/20 text-green-400 border-green-500/30',
      initial_access_broker: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      data_extortion: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    }
    return colors[type?.toLowerCase()] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto" />
      </div>
    )
  }

  if (!actor) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4">
        <p className="text-gray-400">Actor not found</p>
      </div>
    )
  }

  const recommendations = getDefensiveRecommendations()

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-w-md">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/30 to-gray-900 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-white">{actor.name}</h3>
              {actor.trend_status && (
                <TrendBadge status={actor.trend_status} showLabel={false} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded border capitalize ${getActorTypeBadgeColor(actor.actor_type)}`}>
                {actor.actor_type}
              </span>
              <span className="text-xs text-gray-500">
                {actor.status === 'active' ? 'Active' : actor.status}
              </span>
            </div>
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

      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-cyan-400 font-semibold">{actor.incidents_7d || 0}</div>
            <div className="text-xs text-gray-500">7d Attacks</div>
          </div>
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-cyan-400 font-semibold">{actor.target_sectors?.length || 0}</div>
            <div className="text-xs text-gray-500">Sectors</div>
          </div>
          <div className="bg-gray-800 rounded p-2 text-center">
            <div className="text-cyan-400 font-semibold">{actor.ttps?.length || techniques.length || 0}</div>
            <div className="text-xs text-gray-500">TTPs</div>
          </div>
        </div>

        {/* Target Sectors */}
        {actor.target_sectors?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-1.5">Target Sectors</h4>
            <div className="flex flex-wrap gap-1">
              {actor.target_sectors.slice(0, 5).map(sector => (
                <span
                  key={sector}
                  className="text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded capitalize"
                >
                  {sector}
                </span>
              ))}
              {actor.target_sectors.length > 5 && (
                <span className="text-xs text-gray-500">+{actor.target_sectors.length - 5}</span>
              )}
            </div>
          </div>
        )}

        {/* Active TTPs */}
        {(actor.ttps?.length > 0 || techniques.length > 0) && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-1.5">Known TTPs</h4>
            <div className="space-y-1">
              {(techniques.length > 0 ? techniques : actor.ttps?.slice(0, 5).map(t => ({ technique_id: t }))).map((tech, i) => (
                <div key={i} className="text-xs bg-gray-800 rounded px-2 py-1 font-mono text-purple-400">
                  {tech.technique_id} {tech.name && `- ${tech.name}`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exploited CVEs */}
        {vulnerabilities.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-1.5">Exploited Vulnerabilities</h4>
            <div className="space-y-1">
              {vulnerabilities.map(vuln => (
                <div key={vuln.cve_id} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1">
                  <span className="text-xs font-mono text-cyan-400">{vuln.cve_id}</span>
                  <SeverityBadge severity={getSeverityFromCvss(vuln.cvss_score)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentIncidents.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-400 mb-1.5">Recent Activity (30d)</h4>
            <div className="space-y-1">
              {recentIncidents.map(inc => (
                <div key={inc.id} className="text-xs bg-gray-800 rounded px-2 py-1 flex justify-between">
                  <span className="text-gray-300 truncate">{inc.victim_name}</span>
                  <span className="text-gray-500 whitespace-nowrap ml-2">
                    {new Date(inc.discovered_date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defensive Recommendations */}
        <div className="border-t border-gray-700 pt-3">
          <h4 className="text-xs font-medium text-orange-400 mb-2">
            Infrastructure Hardening Recommendations
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="text-xs">
                <div className="text-purple-400 font-mono mb-0.5">{rec.ttp}</div>
                <div className="text-gray-400">{rec.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-700 p-3 flex items-center justify-between bg-gray-800/50">
        <Link
          to={`/actors?search=${encodeURIComponent(actor.name)}`}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          View Full Profile →
        </Link>
        {onAddToWatchlist && (
          <button
            onClick={() => onAddToWatchlist(actor)}
            className="text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded"
          >
            Add to Watchlist
          </button>
        )}
      </div>
    </div>
  )
}
