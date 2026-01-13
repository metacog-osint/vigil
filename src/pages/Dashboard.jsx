import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboard, incidents, threatActors, vulnerabilities, syncLog } from '../lib/supabase'
import { generateBLUF } from '../lib/ai'
import StatCard from '../components/StatCard'
import ActivityChart from '../components/ActivityChart'
import RecentIncidents from '../components/RecentIncidents'
import TopActors from '../components/TopActors'
import { SkeletonDashboard } from '../components/Skeleton'
import { ThreatGauge } from '../components/ThreatGauge'
import { SectorChart } from '../components/SectorChart'
import { AttackMatrixMini } from '../components/AttackMatrixHeatmap'
import { VulnTreemapMini } from '../components/VulnTreemap'
import { ActivityCalendar } from '../components/ActivityCalendar'
import { formatDistanceToNow } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentIncidents, setRecentIncidents] = useState([])
  const [topActors, setTopActors] = useState([])
  const [recentKEVs, setRecentKEVs] = useState([])
  const [sectorData, setSectorData] = useState([])
  const [vulnsBySeverity, setVulnsBySeverity] = useState([])
  const [escalatingActors, setEscalatingActors] = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsData, incidentsData, actorsData, kevsData, sectorStats, vulnStats, escalatingData, syncData] = await Promise.all([
          dashboard.getOverview(),
          incidents.getRecent({ limit: 10, days: 365 }),
          threatActors.getTopActive(365, 5),
          vulnerabilities.getRecentKEV(365),
          incidents.getBySector(),
          vulnerabilities.getBySeverity(),
          threatActors.getEscalating(5),
          syncLog.getRecent(1),
        ])

        setStats(statsData)
        setRecentIncidents(incidentsData.data || [])
        setTopActors(actorsData.data || [])
        setRecentKEVs(kevsData.data || [])
        setSectorData(sectorStats || [])
        setVulnsBySeverity(vulnStats || [])
        setEscalatingActors(escalatingData.data || [])
        setLastSync(syncData.data?.[0] || null)

        // Generate AI BLUF summary (non-blocking)
        generateBLUF({
          totalActors: statsData?.totalActors || 0,
          incidents30d: statsData?.incidents24h || 0,
          totalIncidents: statsData?.incidents7d || 0,
          kevCount: statsData?.newKEV7d || 0,
          escalatingActors: escalatingData.data || [],
          topSectors: sectorStats || [],
          recentIncidents: incidentsData.data || [],
          topActors: actorsData.data || [],
        }).then(summary => {
          if (summary) setAiSummary(summary)
        })
      } catch (error) {
        console.error('Dashboard load error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  if (loading) {
    return <SkeletonDashboard />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vigil Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time cyber threat intelligence overview
          </p>
        </div>
        {lastSync && (
          <div className="text-xs text-gray-500">
            Last sync: {formatDistanceToNow(new Date(lastSync.completed_at), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* AI BLUF Summary */}
      {aiSummary && (
        <div className="bg-cyber-accent/10 border border-cyber-accent/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="font-medium text-cyber-accent">Intelligence Summary (BLUF)</span>
            <span className="text-xs text-gray-500 ml-auto">AI-Generated</span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Escalating Actors Alert */}
      {escalatingActors.length > 0 && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium text-red-400">Escalating Threat Actors</span>
            <span className="text-xs text-gray-500">({escalatingActors.length} actors with increasing activity)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {escalatingActors.map((actor) => (
              <Link
                key={actor.id}
                to="/actors"
                className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 rounded text-sm text-red-300 hover:bg-red-900/50 transition-colors"
              >
                <span>{actor.name}</span>
                {actor.incidents_7d > 0 && (
                  <span className="text-xs text-red-400">({actor.incidents_7d} in 7d)</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Active Actors"
          value={stats?.totalActors || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          label="Incidents (30d)"
          value={stats?.incidents24h || 0}
          trend={stats?.incidents24h > 5 ? 'up' : 'neutral'}
          trendLabel={stats?.incidents24h > 5 ? 'elevated' : 'normal'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Total Incidents"
          value={stats?.incidents7d || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          label="Total KEVs"
          value={stats?.newKEV7d || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
        <StatCard
          label="Total IOCs"
          value={stats?.newIOCs24h || 0}
          trend="neutral"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threat Level Gauge */}
        <ThreatGauge
          score={Math.min(100, Math.round((stats?.incidents24h || 0) * 2 + (recentIncidents?.length || 0) * 3))}
          trend={stats?.incidents24h > 5 ? 'up' : 'stable'}
        />

        {/* Sector Distribution */}
        <div className="cyber-card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Targeted Sectors</h2>
          <SectorChart data={sectorData} height={200} />
        </div>

        {/* Vulnerability Severity */}
        <div className="cyber-card">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Vulnerability Severity</h2>
          <VulnTreemapMini data={vulnsBySeverity} />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart - Takes 2 columns */}
        <div className="lg:col-span-2 cyber-card">
          <h2 className="text-lg font-semibold text-white mb-4">Incident Activity</h2>
          <ActivityChart />
        </div>

        {/* Top Actors */}
        <div className="cyber-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Top Actors</h2>
            <Link to="/actors" className="text-cyber-accent text-sm hover:underline">
              View all
            </Link>
          </div>
          <TopActors actors={topActors} />
        </div>
      </div>

      {/* Activity Calendar */}
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Incident Activity (90 Days)</h2>
        <ActivityCalendar days={90} />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <div className="cyber-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Incidents</h2>
            <Link to="/incidents" className="text-cyber-accent text-sm hover:underline">
              View all
            </Link>
          </div>
          <RecentIncidents incidents={recentIncidents} />
        </div>

        {/* Recent KEVs */}
        <div className="cyber-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Latest KEVs</h2>
            <Link to="/vulnerabilities" className="text-cyber-accent text-sm hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentKEVs.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                No KEVs found
              </div>
            ) : (
              recentKEVs.map((kev) => (
                <div
                  key={kev.cve_id}
                  className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800"
                >
                  <div>
                    <div className="text-sm font-mono text-cyber-accent">{kev.cve_id}</div>
                    <div className="text-xs text-gray-400 truncate max-w-xs">
                      {kev.description?.slice(0, 80)}...
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {kev.cvss_score && (
                      <span className={`badge-${kev.cvss_score >= 9 ? 'critical' : kev.cvss_score >= 7 ? 'high' : 'medium'}`}>
                        {kev.cvss_score}
                      </span>
                    )}
                    {kev.ransomware_campaign_use && (
                      <span className="badge-critical">RW</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
