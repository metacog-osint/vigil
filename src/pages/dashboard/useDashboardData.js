/**
 * useDashboardData Hook
 *
 * Centralized data fetching and state management for the dashboard.
 * Extracts all state variables and loading logic from Dashboard.jsx.
 */
import { useState, useEffect, useCallback } from 'react'
import { dashboard, incidents, threatActors, vulnerabilities, syncLog, orgProfile, relevance, trendAnalysis, correlations } from '../../lib/supabase'
import { generateBLUF } from '../../lib/ai'
import { getTopTargetedServices } from '../../lib/service-categories'

// Calculate threat level on a reasonable scale
// Uses log scale to prevent maxing out too quickly:
// - 100 incidents/month → ~33 base score
// - 500 incidents/month → ~45 base score
// - 1000 incidents/month → ~50 base score
// - 5000 incidents/month → ~60 base score
// Escalating actors add 3 points each (max 20)
// This ensures score reflects actual threat increase, not just volume
export function calculateThreatLevel(incidents30d, escalatingActors = 0) {
  // Use log10 for gentler scaling, multiply by 15 to spread values
  const incidentScore = incidents30d > 0
    ? Math.min(60, Math.round(Math.log10(incidents30d + 1) * 20))
    : 0
  // Each escalating actor adds to risk, but capped
  const escalationScore = Math.min(20, escalatingActors * 4)
  // Additional factor: if many actors are escalating, it's more concerning
  const escalationBonus = escalatingActors >= 3 ? 10 : (escalatingActors >= 1 ? 5 : 0)
  return Math.min(100, incidentScore + escalationScore + escalationBonus)
}

export default function useDashboardData() {
  // Core dashboard data
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

  // Sprint 1 widgets data
  const [targetedServices, setTargetedServices] = useState([])
  const [activeExploits, setActiveExploits] = useState([])
  const [sectorDetails, setSectorDetails] = useState([])
  const [widgetsLoading, setWidgetsLoading] = useState(true)

  // Correlation dashboard data
  const [industryThreats, setIndustryThreats] = useState([])
  const [countryThreats, setCountryThreats] = useState([])
  const [correlationsLoading, setCorrelationsLoading] = useState(true)

  // Track which tabs have been loaded (for lazy loading)
  const [loadedTabs, setLoadedTabs] = useState({ activity: false, threats: false, vulnerabilities: false, geography: false })

  // Load personalization data (org profile + relevance scores)
  const loadPersonalizationData = useCallback(async () => {
    try {
      const profile = await orgProfile.get()
      if (profile) {
        setUserProfile(profile)
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
  }, [])

  // Load trend analysis data
  const loadTrendData = useCallback(async () => {
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
  }, [])

  // Load Sprint 1 widgets data
  const loadWidgetsData = useCallback(async () => {
    setWidgetsLoading(true)
    try {
      const [servicesVulns, exploitedCVEs, sectors] = await Promise.all([
        vulnerabilities.getRecentForServices(30),
        vulnerabilities.getActivelyExploited(30, 8),
        incidents.getSectorDetails(30),
      ])
      const servicesData = getTopTargetedServices(servicesVulns, 8)
      setTargetedServices(servicesData)
      setActiveExploits(exploitedCVEs)
      setSectorDetails(sectors)
    } catch (error) {
      console.error('Error loading widgets data:', error)
    } finally {
      setWidgetsLoading(false)
    }
  }, [])

  // Load correlation dashboard data (industry and country threats)
  const loadCorrelationsData = useCallback(async () => {
    setCorrelationsLoading(true)
    try {
      const [industryData, countryData] = await Promise.all([
        correlations.getAllIndustryThreats(50),
        correlations.getAllCountryThreats(50),
      ])
      setIndustryThreats(industryData.data || [])
      setCountryThreats(countryData.data || [])
    } catch (error) {
      console.error('Error loading correlations data:', error)
    } finally {
      setCorrelationsLoading(false)
    }
  }, [])

  // Main dashboard load
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
          incidents30d: statsData?.incidents30d || 0,
          totalIncidents: statsData?.incidentsTotal || 0,
          kevCount: statsData?.kevTotal || 0,
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

        // Load correlations data (non-blocking)
        loadCorrelationsData()

      } catch (error) {
        console.error('Dashboard load error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [loadPersonalizationData, loadTrendData, loadWidgetsData, loadCorrelationsData])

  // Mark a tab as loaded (for lazy loading support)
  const markTabLoaded = useCallback((tabId) => {
    setLoadedTabs(prev => ({ ...prev, [tabId]: true }))
  }, [])

  // Computed values - use incidents30d for proper threat calculation
  const threatLevel = calculateThreatLevel(stats?.incidents30d || 0, escalatingActors?.length || 0)

  return {
    // Core data
    stats,
    recentIncidents,
    topActors,
    recentKEVs,
    sectorData,
    vulnsBySeverity,
    escalatingActors,
    calendarData,
    lastSync,
    aiSummary,
    loading,

    // Personalization
    userProfile,
    relevantActors,
    relevantVulns,

    // Trends
    weekComparison,
    changeSummary,

    // Widgets
    targetedServices,
    activeExploits,
    sectorDetails,
    widgetsLoading,

    // Correlations
    industryThreats,
    countryThreats,
    correlationsLoading,

    // Computed
    threatLevel,

    // Tab loading
    loadedTabs,
    markTabLoaded,
  }
}
