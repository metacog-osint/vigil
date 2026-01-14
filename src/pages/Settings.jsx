// Settings page - User preferences
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { userPreferences as prefsApi, savedSearches as searchesApi, tags as tagsApi, syncLog as syncLogApi, orgProfile as orgProfileApi } from '../lib/supabase'
import { SkeletonCard, ErrorMessage, TimeAgo } from '../components'
import { OrganizationProfileSetup, OrganizationProfileSummary } from '../components/OrganizationProfileSetup'
import DataSourcesPanel from '../components/DataSourcesPanel'
import AlertRulesSection from '../components/AlertRulesSection'
import ApiKeysSection from '../components/ApiKeysSection'
import { getUserSubscription, getSubscriptionDisplayInfo, createBillingPortalSession } from '../lib/stripe'
import { useAuth } from '../hooks/useAuth'
import { formatDistanceToNow, format } from 'date-fns'

const TIME_RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '365d', label: '1 year' },
  { value: 'all', label: 'All time' },
]

const ITEMS_PER_PAGE = [10, 25, 50, 100]

function SettingSection({ title, description, children }) {
  return (
    <div className="bg-cyber-card border border-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors',
          checked ? 'bg-cyber-accent' : 'bg-gray-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
            checked ? 'left-6' : 'left-1'
          )}
        />
      </button>
    </label>
  )
}

function SavedSearchesList({ searches, onDelete }) {
  if (searches.length === 0) {
    return <p className="text-gray-500 text-sm">No saved searches yet</p>
  }

  return (
    <div className="space-y-2">
      {searches.map((search) => (
        <div
          key={search.id}
          className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2"
        >
          <div>
            <div className="text-white text-sm">{search.name}</div>
            <div className="text-xs text-gray-500">
              {search.search_type} · used {search.use_count} times
            </div>
          </div>
          <button
            onClick={() => onDelete(search.id)}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function TagsList({ tags, onDelete, onEdit }) {
  if (tags.length === 0) {
    return <p className="text-gray-500 text-sm">No tags yet</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center gap-2 bg-gray-800/50 rounded-full px-3 py-1"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          <span className="text-sm text-white">{tag.name}</span>
          <span className="text-xs text-gray-500">({tag.entity_tags?.[0]?.count || 0})</span>
          <button
            onClick={() => onDelete(tag.id)}
            className="text-gray-500 hover:text-red-400 transition-colors ml-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

function CreateTagModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({ name, color })
    setName('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cyber-dark border border-gray-700 rounded-lg w-full max-w-sm p-6">
        <h3 className="text-lg font-medium text-white mb-4">Create Tag</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
              placeholder="Tag name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx(
                    'w-8 h-8 rounded-full transition-transform',
                    color === c && 'ring-2 ring-white scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SubscriptionSection({ subscription, userId, onError }) {
  const [isLoading, setIsLoading] = useState(false)
  const displayInfo = getSubscriptionDisplayInfo(subscription)

  const handleManageSubscription = async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const { url } = await createBillingPortalSession(userId)
      window.location.href = url
    } catch (err) {
      onError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold text-white">{displayInfo.tierName}</span>
            <span className={`text-sm capitalize ${displayInfo.statusColor}`}>
              {displayInfo.statusLabel}
            </span>
          </div>
          {displayInfo.renewalInfo && (
            <p className="text-sm text-gray-500 mt-1">{displayInfo.renewalInfo}</p>
          )}
        </div>
        <div className="flex gap-2">
          {subscription?.tier !== 'free' && subscription?.stripe_subscription_id && (
            <button
              onClick={handleManageSubscription}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
          {(subscription?.tier === 'free' || !subscription) && (
            <a
              href="/pricing"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
            >
              Upgrade Plan
            </a>
          )}
        </div>
      </div>

      {/* Tier benefits */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Your plan includes:</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          {subscription?.tier === 'enterprise' && (
            <>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Everything in Team, plus:
              </li>
              <li className="flex items-center gap-2 ml-6">SSO/SAML authentication</li>
              <li className="flex items-center gap-2 ml-6">Dedicated support</li>
              <li className="flex items-center gap-2 ml-6">Custom integrations</li>
            </>
          )}
          {subscription?.tier === 'team' && (
            <>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Everything in Professional, plus:
              </li>
              <li className="flex items-center gap-2 ml-6">REST API access</li>
              <li className="flex items-center gap-2 ml-6">Team collaboration features</li>
              <li className="flex items-center gap-2 ml-6">Custom reports</li>
            </>
          )}
          {subscription?.tier === 'professional' && (
            <>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Full threat actor database
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Advanced search & filters
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Unlimited watchlists
              </li>
            </>
          )}
          {(!subscription || subscription?.tier === 'free') && (
            <>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Basic threat intelligence
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Up to 3 watchlists
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                7-day data retention
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}

function SyncLogList({ logs }) {
  if (logs.length === 0) {
    return <p className="text-gray-500 text-sm">No sync history available</p>
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'text-green-400'
      case 'partial': return 'text-yellow-400'
      case 'failed': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-medium">{log.source}</span>
              <span className={`text-xs ${getStatusColor(log.status)}`}>
                {log.status}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {log.records_added} added, {log.records_updated} updated
              {log.error_count > 0 && `, ${log.error_count} errors`}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            {log.completed_at
              ? formatDistanceToNow(new Date(log.completed_at), { addSuffix: true })
              : 'In progress'}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(null)
  const [savedSearches, setSavedSearches] = useState([])
  const [tags, setTags] = useState([])
  const [syncLogs, setSyncLogs] = useState([])
  const [orgProfile, setOrgProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [isEditingOrgProfile, setIsEditingOrgProfile] = useState(false)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [prefsResult, searchesResult, tagsResult, syncResult, profileResult] = await Promise.all([
        prefsApi.get(),
        searchesApi.getAll(),
        tagsApi.getAll(),
        syncLogApi.getRecent(10),
        orgProfileApi.get(),
      ])

      setPreferences(prefsResult.data?.preferences || {})
      setSavedSearches(searchesResult.data || [])
      setTags(tagsResult.data || [])
      setSyncLogs(syncResult.data || [])
      setOrgProfile(profileResult || null)

      // Load subscription if user is logged in
      if (user?.uid) {
        const sub = await getUserSubscription(user.uid)
        setSubscription(sub)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const updatePreference = async (key, value) => {
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    setIsSaving(true)
    try {
      await prefsApi.update('anonymous', updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }

  const saveOrgProfile = async (profile) => {
    setIsSaving(true)
    try {
      await orgProfileApi.update(profile)
      setOrgProfile(profile)
      setIsEditingOrgProfile(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }
  }

  const deleteSavedSearch = async (id) => {
    const { error } = await searchesApi.delete(id)
    if (error) {
      setError(error.message)
      return
    }
    setSavedSearches(savedSearches.filter((s) => s.id !== id))
  }

  const createTag = async (tag) => {
    const { data, error } = await tagsApi.create(tag)
    if (error) {
      setError(error.message)
      return
    }
    setTags([...tags, data])
  }

  const deleteTag = async (id) => {
    const { error } = await tagsApi.delete(id)
    if (error) {
      setError(error.message)
      return
    }
    setTags(tags.filter((t) => t.id !== id))
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
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Customize your Vigil experience</p>
      </div>

      {error && <ErrorMessage message={error} className="mb-4" />}

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
          <ApiKeysSection
            userId={user?.uid}
            userTier={subscription?.tier || 'free'}
          />
        </SettingSection>

        {/* Organization Profile */}
        <SettingSection
          title="Organization Profile"
          description="Configure your organization's sector, geography, and tech stack for personalized threat intelligence"
        >
          {isEditingOrgProfile ? (
            <OrganizationProfileSetup
              profile={orgProfile}
              onSave={saveOrgProfile}
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
    </div>
  )
}
