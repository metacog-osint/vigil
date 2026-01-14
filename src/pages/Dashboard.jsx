import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboard, incidents, threatActors, vulnerabilities, syncLog, orgProfile, relevance, trendAnalysis } from '../lib/supabase'
import { generateBLUF } from '../lib/ai'
import { getTopTargetedServices } from '../lib/service-categories'
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
import WeekComparisonCard from '../components/WeekComparisonCard'
import ChangeSummaryCard from '../components/ChangeSummaryCard'
import { RelevanceBadge } from '../components/RelevanceBadge'
import { SmartTime } from '../components/TimeDisplay'
import { NewBadge } from '../components/NewIndicator'
import { TargetedServicesWidget } from '../components/TargetedServicesWidget'
import { ActiveExploitationWidget } from '../components/ActiveExploitationWidget'
import { SectorDrilldown } from '../components/SectorDrilldown'
import ThreatAttributionMap from '../components/ThreatAttributionMap'
import CountryAttackPanel from '../components/CountryAttackPanel'
import { KillChainMini } from '../components/KillChainVisualization'

// Calculate threat level on a reasonable scale
// Baseline: ~300 incidents/month is "normal" (score ~50)
// 600+ incidents/month is "high" (score ~75)
// 1000+ incidents/month is "critical" (score ~90+)
function calculateThreatLevel(incidents30d, escalatingActors = 0) {
  // Use logarithmic scaling for incidents
  // log2(300) ≈ 8.2, so we normalize around that
  const incidentScore = incidents30d > 0
    ? Math.min(70, Math.round(Math.log2(incidents30d) * 7))
    : 0

  // Add points for escalating actors (max 30 points)
  const escalationScore = Math.min(30, escalatingActors * 6)

  return Math.min(100, incidentScore + escalationScore)
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentIncidents, setRecentIncidents] = useState([])
  const [topActors, setTopActors] = useState([])
  const [recentKEVs, setRecentKEVs] = useState([])
  const [sectorData, setSectorData] = useState([])
  const [vulnsBySeverity, setVulnsBySeverity] = useState([])
  const [escalatingActors, setEscalatingActors] = useState([])
  const [calendarData, setCalendarData] = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  // Personalization and trend data
  const [userProfile, setUserProfile] = useState(null)
  const [relevantActors, setRelevantActors] = useState([])
  const [relevantVulns, setRelevantVulns] = useState([])
  const [weekComparison, setWeekComparison] = useState(null)
  const [changeSummary, setChangeSummary] = useState(null)

  // New Sprint 1 widgets data
  const [targetedServices, setTargetedServices] = useState([])
  const [activeExploits, setActiveExploits] = useState([])
  const [sectorDetails, setSectorDetails] = useState([])
  const [widgetsLoading, setWidgetsLoading] = useState(true)

  // Sprint 3 - Map visualization state
  const [mapViewMode, setMapViewMode] = useState('victims')
  const [selectedCountry, setSelectedCountry] = useState(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsData, incidentsData, actorsData, kevsData, sectorStats, vulnStats, escalatingData, syncData, calendarStats] = await Promise.all([
          dashboard.getOverview(),
          incidents.getRecent({ limit: 10, days: 365 }),
          threatActors.getTopActive(365, 5),
          vulnerabilities.getRecentKEV(365),
          incidents.getBySector(),
          vulnerabilities.getBySeverity(),
          threatActors.getEscalating(5),
          syncLog.getRecent(1),
          incidents.getDailyCounts(90),
        ])

        setStats(statsData)
        setRecentIncidents(incidentsData.data || [])
        setTopActors(actorsData.data || [])
        setRecentKEVs(kevsData.data || [])
        setSectorData(sectorStats || [])
        setVulnsBySeverity(vulnStats || [])
        setEscalatingActors(escalatingData.data || [])
        setCalendarData(calendarStats || [])
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
          if (summary) {
            setAiSummary(summary)
          } else {
            console.warn('AI summary returned null - check VITE_GROQ_API_KEY')
          }
        }).catch(err => {
          console.error('AI summary generation error:', err)
        })

        // Load personalization data (non-blocking)
        loadPersonalizationData()

        // Load trend data (non-blocking)
        loadTrendData()

        // Load Sprint 1 widgets data (non-blocking)
        loadWidgetsData()
      } catch (error) {
        console.error('Dashboard load error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  // Load personalization data (org profile + relevance scores)
  async function loadPersonalizationData() {
    try {
      const profile = await orgProfile.get()
      if (profile) {
        setUserProfile(profile)
        // Get relevant actors and vulnerabilities based on profile
        const [actors, vulns] = await Promise.all([
          relevance.getRelevantActors(profile, 5),
          relevance.getRelevantVulnerabilities(profile, 5),
        ])
        setRelevantActors(actors || [])
        setRelevantVulns(vulns || [])
      }
    } catch (error) {
      console.error('Error loading personalization:', error)
    }
  }

  // Load trend analysis data
  async function loadTrendData() {
    try {
      const [weekData, changeData] = await Promise.all([
        trendAnalysis.getWeekOverWeekChange(),
        trendAnalysis.getChangeSummary(7),
      ])
      setWeekComparison(weekData)
      setChangeSummary(changeData)
    } catch (error) {
      console.error('Error loading trend data:', error)
    }
  }

  // Load Sprint 1 widgets data (non-blocking)
  async function loadWidgetsData() {
    setWidgetsLoading(true)
    try {
      const [servicesVulns, exploitedCVEs, sectors] = await Promise.all([
        vulnerabilities.getRecentForServices(30),
        vulnerabilities.getActivelyExploited(30, 8),
        incidents.getSectorDetails(30),
      ])

      // Process services data
      const servicesData = getTopTargetedServices(servicesVulns, 8)
      setTargetedServices(servicesData)
      setActiveExploits(exploitedCVEs)
      setSectorDetails(sectors)
    } catch (error) {
      console.error('Error loading widgets data:', error)
    } finally {
      setWidgetsLoading(false)
    }
  }

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
            Last sync: <SmartTime date={lastSync.completed_at} />
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

      {/* Trend Analysis Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeekComparisonCard data={weekComparison} loading={!weekComparison} />
        <ChangeSummaryCard data={changeSummary} loading={!changeSummary} />
      </div>

      {/* Actionable Intelligence Row - Sprint 1 Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TargetedServicesWidget
          data={targetedServices}
          loading={widgetsLoading}
          timeRange="30 days"
        />
        <ActiveExploitationWidget
          data={activeExploits}
          loading={widgetsLoading}
          userProfile={userProfile}
          timeRange="30 days"
        />
      </div>

      {/* Sector Drilldown - Expandable sectors with incident activity */}
      <SectorDrilldown
        sectors={sectorDetails}
        loading={widgetsLoading}
        userSector={userProfile?.sector}
        onSectorClick={(sector) => console.log('Sector clicked:', sector.name)}
      />

      {/* Global Threat Map - Sprint 3 */}
      <div className="cyber-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Global Threat Map</h2>
            <p className="text-sm text-gray-400">Geographic distribution of attacks (30 days)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMapViewMode('victims')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                mapViewMode === 'victims'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Victims
            </button>
            <button
              onClick={() => setMapViewMode('attackers')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                mapViewMode === 'attackers'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Attackers
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ThreatAttributionMap
              days={30}
              viewMode={mapViewMode}
              onCountryClick={setSelectedCountry}
              selectedCountry={selectedCountry?.code}
              height={350}
            />
          </div>
          <div>
            {selectedCountry ? (
              <CountryAttackPanel
                country={selectedCountry}
                days={30}
                onActorClick={(actor) => console.log('Actor clicked:', actor.name)}
                onClose={() => setSelectedCountry(null)}
              />
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-4 h-full flex flex-col justify-center items-center text-center">
                <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 text-sm mb-1">Click a country to see details</p>
                <p className="text-gray-500 text-xs">Active actors, targeted sectors, and incidents</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Relevant to You Section (if org profile exists) */}
      {userProfile && (relevantActors.length > 0 || relevantVulns.length > 0) && (
        <div className="cyber-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h2 className="text-lg font-semibold text-white">Relevant to Your Organization</h2>
            </div>
            <Link to="/settings" className="text-cyber-accent text-sm hover:underline">
              Edit profile
            </Link>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Based on your {userProfile.sector} sector in {userProfile.country || userProfile.region}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Relevant Actors */}
            {relevantActors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Priority Threat Actors</h3>
                <div className="space-y-2">
                  {relevantActors.slice(0, 3).map((actor) => (
                    <Link
                      key={actor.id}
                      to="/actors"
                      className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <div>
                        <span className="text-white font-medium">{actor.name}</span>
                        {actor.target_sectors?.length > 0 && (
                          <span className="text-xs text-gray-500 ml-2">
                            targets {actor.target_sectors[0]}
                          </span>
                        )}
                      </div>
                      <RelevanceBadge score={actor.relevanceScore} size="sm" showLabel={false} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Relevant Vulnerabilities */}
            {relevantVulns.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Priority Vulnerabilities</h3>
                <div className="space-y-2">
                  {relevantVulns.slice(0, 3).map((vuln) => (
                    <Link
                      key={vuln.cve_id}
                      to="/vulnerabilities"
                      className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <div>
                        <span className="text-cyber-accent font-mono text-sm">{vuln.cve_id}</span>
                        {vuln.affected_vendors?.length > 0 && (
                          <span className="text-xs text-gray-500 ml-2">
                            {vuln.affected_vendors[0]}
                          </span>
                        )}
                      </div>
                      <RelevanceBadge score={vuln.relevanceScore} size="sm" showLabel={false} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visualizations Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Threat Level Gauge */}
        <ThreatGauge
          score={calculateThreatLevel(stats?.incidents24h || 0, escalatingActors?.length || 0)}
          trend={stats?.incidents24h > 100 ? 'up' : 'stable'}
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
        <ActivityCalendar data={calendarData} days={90} />
      </div>

      {/* Kill Chain Overview */}
      <KillChainMini onViewFull={() => console.log('View full kill chain')} />

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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-cyber-accent">{kev.cve_id}</span>
                      <NewBadge date={kev.kev_date} thresholdHours={168} />
                    </div>
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
