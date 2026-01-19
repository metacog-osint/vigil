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
    // Computed
    threatLevel,
  } = useDashboardData()

  if (loading) {
    return <SkeletonDashboard />
  }

  return (
    <div className="space-y-4">
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
      <DashboardTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

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

        {activeTab === 'geography' && (
          <GeographyTab />
        )}
      </div>
    </div>
  )
}
