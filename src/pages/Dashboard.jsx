import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboard, incidents, threatActors, vulnerabilities } from '../lib/supabase'
import StatCard from '../components/StatCard'
import ActivityChart from '../components/ActivityChart'
import RecentIncidents from '../components/RecentIncidents'
import TopActors from '../components/TopActors'
import { SkeletonDashboard } from '../components/Skeleton'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentIncidents, setRecentIncidents] = useState([])
  const [topActors, setTopActors] = useState([])
  const [recentKEVs, setRecentKEVs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsData, incidentsData, actorsData, kevsData] = await Promise.all([
          dashboard.getOverview(),
          incidents.getRecent({ limit: 10, days: 365 }),
          threatActors.getTopActive(365, 5),
          vulnerabilities.getRecentKEV(365),
        ])

        setStats(statsData)
        setRecentIncidents(incidentsData.data || [])
        setTopActors(actorsData.data || [])
        setRecentKEVs(kevsData.data || [])
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
      <div>
        <h1 className="text-2xl font-bold text-white">Vigil Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time cyber threat intelligence overview
        </p>
      </div>

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
