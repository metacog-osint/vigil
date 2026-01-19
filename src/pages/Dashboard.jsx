/**
 * Dashboard Page
 *
 * Redesigned dashboard with above-the-fold priority content and tabbed navigation.
 * Reduced from 638 lines to ~120 lines by extracting components and data loading.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SkeletonDashboard } from '../components'

// Dashboard module components
import useDashboardData from './dashboard/useDashboardData'
import DashboardTabs from './dashboard/DashboardTabs'
import AboveFoldSection from './dashboard/AboveFoldSection'
import PrioritiesSection from './dashboard/PrioritiesSection'
import ActivityTab from './dashboard/tabs/ActivityTab'
import ThreatsTab from './dashboard/tabs/ThreatsTab'
import VulnerabilitiesTab from './dashboard/tabs/VulnerabilitiesTab'
import GeographyTab from './dashboard/tabs/GeographyTab'
import IndustryThreatsTab from './dashboard/tabs/IndustryThreatsTab'
import CountryThreatsTab from './dashboard/tabs/CountryThreatsTab'

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'activity')

  // All data loading is handled by the custom hook
  const {
    // Core data
    stats,
    topActors,
    recentKEVs,
    sectorData,
    vulnsBySeverity,
    escalatingActors,
    calendarData,
    lastSync,
    aiSummary,
    loading,
    error,
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
  } = useDashboardData()

  if (loading) {
    return <SkeletonDashboard />
  }

  // Show error banner but still render dashboard with whatever data we have
  const errorBanner = error ? (
    <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="text-red-400">
          Some data failed to load. Showing available information.
        </span>
      </div>
    </div>
  ) : null

  return (
    <div className="space-y-4">
      {/* Error banner if data failed to load */}
      {errorBanner}

      {/* Above the Fold - No scroll needed */}
      <AboveFoldSection
        lastSync={lastSync}
        aiSummary={aiSummary}
        escalatingActors={escalatingActors}
        stats={stats}
      />

      {/* Priorities for You - Personalized content */}
      <PrioritiesSection
        userProfile={userProfile}
        relevantActors={relevantActors}
        relevantVulns={relevantVulns}
      />

      {/* Tab Navigation */}
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'activity' && (
          <ActivityTab
            weekComparison={weekComparison}
            changeSummary={changeSummary}
            calendarData={calendarData}
          />
        )}

        {activeTab === 'threats' && (
          <ThreatsTab
            topActors={topActors}
            sectorData={sectorData}
            sectorDetails={sectorDetails}
            widgetsLoading={widgetsLoading}
            userProfile={userProfile}
            threatLevel={threatLevel}
          />
        )}

        {activeTab === 'vulnerabilities' && (
          <VulnerabilitiesTab
            targetedServices={targetedServices}
            activeExploits={activeExploits}
            widgetsLoading={widgetsLoading}
            userProfile={userProfile}
            vulnsBySeverity={vulnsBySeverity}
            recentKEVs={recentKEVs}
          />
        )}

        {activeTab === 'geography' && <GeographyTab />}

        {activeTab === 'industries' && (
          <IndustryThreatsTab industryThreats={industryThreats} loading={correlationsLoading} />
        )}

        {activeTab === 'countries' && (
          <CountryThreatsTab countryThreats={countryThreats} loading={correlationsLoading} />
        )}
      </div>
    </div>
  )
}
