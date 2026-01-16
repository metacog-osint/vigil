/**
 * Settings Page
 *
 * Extracted components in ./settings/:
 * - SettingsConstants.js: TIME_RANGES, ITEMS_PER_PAGE, TAG_COLORS
 * - SettingsComponents.jsx: SettingSection, Toggle, SavedSearchesList, TagsList, CreateTagModal, SyncLogList
 * - SubscriptionSection.jsx: Subscription management
 * - useSettingsData.js: Data hooks
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { SkeletonCard, ErrorMessage } from '../components'
import { OrganizationProfileSetup, OrganizationProfileSummary } from '../components/OrganizationProfileSetup'
import DataSourcesPanel from '../components/DataSourcesPanel'
import AlertRulesSection from '../components/AlertRulesSection'
import AlertSettingsSection from '../components/AlertSettingsSection'
import ApiKeysSection from '../components/ApiKeysSection'
import IntegrationsSection from '../components/IntegrationsSection'
import SSOConfigSection from '../components/SSOConfigSection'
import BrandingConfigSection from '../components/BrandingConfigSection'
import { useAuth } from '../hooks/useAuth'
import { RestartTourButton } from '../components/OnboardingTour'
import PersonalizationWizard, { PersonalizeButton } from '../components/PersonalizationWizard'
import { TIME_RANGES, ITEMS_PER_PAGE } from './settings/SettingsConstants'
import { SettingSection, Toggle, SavedSearchesList, TagsList, CreateTagModal, SyncLogList } from './settings/SettingsComponents.jsx'
import SubscriptionSection from './settings/SubscriptionSection.jsx'
import { useSettingsData, useSettingsActions } from './settings/useSettingsData'

export default function Settings() {
  const { user } = useAuth()
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [isEditingOrgProfile, setIsEditingOrgProfile] = useState(false)
  const [showPersonalizationWizard, setShowPersonalizationWizard] = useState(false)

  const {
    preferences,
    setPreferences,
    savedSearches,
    setSavedSearches,
    tags,
    setTags,
    syncLogs,
    orgProfile,
    setOrgProfile,
    subscription,
    isLoading,
    error,
    setError,
    isSaving,
    setIsSaving,
    loadData,
  } = useSettingsData(user)

  const {
    updatePreference,
    saveOrgProfile,
    deleteSavedSearch,
    createTag,
    deleteTag,
  } = useSettingsActions({
    preferences,
    setPreferences,
    savedSearches,
    setSavedSearches,
    tags,
    setTags,
    setOrgProfile,
    setError,
    setIsSaving,
  })

  const handleSaveOrgProfile = async (profile) => {
    const success = await saveOrgProfile(profile)
    if (success) {
      setIsEditingOrgProfile(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Customize your Vigil experience</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-4" />}

      {/* Quick Setup - Personalization Wizard */}
      {!orgProfile?.sector && (
        <div className="mb-6">
          <PersonalizeButton onClick={() => setShowPersonalizationWizard(true)} />
        </div>
      )}

      <div className="space-y-6">
        {/* Subscription */}
        <SettingSection
          title="Subscription"
          description="Manage your Vigil subscription plan"
        >
          <SubscriptionSection
            subscription={subscription}
            userId={user?.uid}
            onError={setError}
          />
        </SettingSection>

        {/* API Keys */}
        <SettingSection
          title="API Access"
          description="Manage API keys for programmatic access to Vigil data"
        >
          <ApiKeysSection userId={user?.uid} />
        </SettingSection>

        {/* Integrations */}
        <SettingSection
          title="Integrations"
          description="Connect Vigil to your SIEM, ticketing, and communication tools"
        >
          <IntegrationsSection userId={user?.uid} />
        </SettingSection>

        {/* SSO/SAML Configuration */}
        <SettingSection
          title="Single Sign-On (SSO)"
          description="Configure enterprise SSO with Okta, Azure AD, Google Workspace, or custom SAML"
        >
          <SSOConfigSection />
        </SettingSection>

        {/* White-Label Branding */}
        <SettingSection
          title="White-Label Branding"
          description="Customize logos, colors, and branding for your organization"
        >
          <BrandingConfigSection />
        </SettingSection>

        {/* Organization Profile */}
        <SettingSection
          title="Organization Profile"
          description="Configure your organization's sector, geography, and tech stack for personalized threat intelligence"
        >
          {isEditingOrgProfile ? (
            <OrganizationProfileSetup
              profile={orgProfile}
              onSave={handleSaveOrgProfile}
              onCancel={() => setIsEditingOrgProfile(false)}
            />
          ) : (
            <OrganizationProfileSummary
              profile={orgProfile}
              onEdit={() => setIsEditingOrgProfile(true)}
            />
          )}
        </SettingSection>

        {/* Alert Rules */}
        <SettingSection
          title="Alert Rules"
          description="Configure custom alerts for threats that matter to you"
        >
          <AlertRulesSection />
        </SettingSection>

        {/* Real-Time Alerts */}
        <SettingSection
          title="Real-Time Alerts"
          description="Configure push notifications, email alerts, and webhook integrations"
        >
          <AlertSettingsSection />
        </SettingSection>

        {/* Display Preferences */}
        <SettingSection
          title="Display Preferences"
          description="Customize how data is displayed"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Default Time Range</label>
              <div className="flex flex-wrap gap-2">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => updatePreference('defaultTimeRange', range.value)}
                    className={clsx(
                      'px-3 py-1.5 rounded text-sm transition-colors',
                      preferences?.defaultTimeRange === range.value
                        ? 'bg-cyber-accent text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Items Per Page</label>
              <div className="flex gap-2">
                {ITEMS_PER_PAGE.map((count) => (
                  <button
                    key={count}
                    onClick={() => updatePreference('itemsPerPage', count)}
                    className={clsx(
                      'px-3 py-1.5 rounded text-sm transition-colors',
                      preferences?.itemsPerPage === count
                        ? 'bg-cyber-accent text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingSection>

        {/* UI Options */}
        <SettingSection title="Interface Options">
          <div className="space-y-4">
            <Toggle
              checked={preferences?.compactView || false}
              onChange={(v) => updatePreference('compactView', v)}
              label="Compact View"
            />
            <Toggle
              checked={preferences?.showNewIndicators !== false}
              onChange={(v) => updatePreference('showNewIndicators', v)}
              label="Show 'New' Indicators"
            />
            <Toggle
              checked={preferences?.sidebarCollapsed || false}
              onChange={(v) => updatePreference('sidebarCollapsed', v)}
              label="Collapse Sidebar by Default"
            />
          </div>
        </SettingSection>

        {/* Saved Searches */}
        <SettingSection
          title="Saved Searches"
          description="Manage your saved search queries"
        >
          <SavedSearchesList searches={savedSearches} onDelete={deleteSavedSearch} />
        </SettingSection>

        {/* Tags */}
        <SettingSection
          title="Tags"
          description="Create and manage tags for organizing entities"
        >
          <div className="space-y-4">
            <TagsList tags={tags} onDelete={deleteTag} />
            <button
              onClick={() => setIsTagModalOpen(true)}
              className="text-sm text-cyber-accent hover:text-cyber-accent/80 transition-colors"
            >
              + Create new tag
            </button>
          </div>
        </SettingSection>

        {/* Sync History */}
        <SettingSection
          title="Data Sync History"
          description="Recent data ingestion status from external sources"
        >
          <SyncLogList logs={syncLogs} />
        </SettingSection>

        {/* Data & Privacy */}
        <SettingSection
          title="Data & Privacy"
          description="Manage your local data"
        >
          <div className="space-y-4">
            <button
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              className="px-4 py-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors text-sm"
            >
              Clear Local Data
            </button>
            <p className="text-xs text-gray-500">
              This will clear your local preferences, recent searches, and other cached data.
            </p>
          </div>
        </SettingSection>

        {/* Data Sources */}
        <SettingSection
          title="Data Sources"
          description="View data source status and trigger manual updates"
        >
          <DataSourcesPanel />
        </SettingSection>

        {/* About */}
        <SettingSection title="About Vigil">
          <div className="text-sm text-gray-400 space-y-2">
            <p>
              <span className="text-gray-500">Version:</span> 0.3.0
            </p>
            <p>
              <span className="text-gray-500">Automated sources:</span> 13 feeds updating every 6 hours
            </p>
            <div className="pt-2">
              <RestartTourButton />
            </div>
            <p className="text-xs text-gray-600 mt-4">
              Vigil - Cyber Threat Intelligence Platform
            </p>
          </div>
        </SettingSection>
      </div>

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-gray-300 px-4 py-2 rounded shadow-lg">
          Saving...
        </div>
      )}

      {/* Create Tag Modal */}
      <CreateTagModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        onCreate={createTag}
      />

      {/* Personalization Wizard Modal */}
      {showPersonalizationWizard && (
        <PersonalizationWizard
          onComplete={() => {
            setShowPersonalizationWizard(false)
            loadData()
          }}
          onSkip={() => setShowPersonalizationWizard(false)}
        />
      )}
    </div>
  )
}
