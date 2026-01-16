import { useState, useEffect } from 'react'
import {
  chatIntegrations,
  channelSubscriptions,
  commandLogs,
  PLATFORMS,
  COMMANDS,
  getOAuthUrl,
} from '../lib/chat'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../contexts/SubscriptionContext'
import { FeatureGate } from '../components/UpgradePrompt'

export default function ChatIntegrations() {
  const { user } = useAuth()
  const { tier } = useSubscription()
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState([])
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [view, setView] = useState('integrations') // integrations, subscriptions, logs
  const [showConnectModal, setShowConnectModal] = useState(false)

  useEffect(() => {
    if (user?.uid) {
      loadIntegrations()
    }
  }, [user?.uid])

  useEffect(() => {
    if (selectedIntegration) {
      loadIntegrationDetails()
    }
  }, [selectedIntegration?.id])

  async function loadIntegrations() {
    setLoading(true)
    try {
      const data = await chatIntegrations.getAll(user.uid)
      setIntegrations(data)
      if (data.length > 0 && !selectedIntegration) {
        setSelectedIntegration(data[0])
      }
    } catch (err) {
      console.error('Failed to load integrations:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadIntegrationDetails() {
    try {
      const [subs, recent, statsData] = await Promise.all([
        channelSubscriptions.getForIntegration(selectedIntegration.id),
        commandLogs.getRecent(selectedIntegration.id, 20),
        commandLogs.getStats(selectedIntegration.id),
      ])
      setSubscriptions(subs)
      setLogs(recent)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load integration details:', err)
    }
  }

  async function handleDisconnect(integration) {
    if (!confirm(`Disconnect ${PLATFORMS[integration.platform]?.name}?`)) return

    try {
      await chatIntegrations.disconnect(integration.id)
      await loadIntegrations()
      if (selectedIntegration?.id === integration.id) {
        setSelectedIntegration(null)
      }
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  async function handleToggleSubscription(sub) {
    try {
      await channelSubscriptions.toggle(sub.id, !sub.is_active)
      await loadIntegrationDetails()
    } catch (err) {
      console.error('Failed to toggle subscription:', err)
    }
  }

  async function handleDeleteSubscription(sub) {
    if (!confirm('Delete this subscription?')) return
    try {
      await channelSubscriptions.delete(sub.id)
      await loadIntegrationDetails()
    } catch (err) {
      console.error('Failed to delete subscription:', err)
    }
  }

  function handleConnect(platform) {
    const state = btoa(JSON.stringify({ userId: user.uid, timestamp: Date.now() }))
    const redirectUri = `${window.location.origin}/api/chat/${platform}/callback`
    const url = getOAuthUrl(platform, redirectUri, state)
    window.location.href = url
  }

  return (
    <FeatureGate feature="chat_integrations" requiredTier="team">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Chat Integrations</h1>
            <p className="text-gray-400 text-sm mt-1">
              Connect Slack or Teams to query Vigil from chat
            </p>
          </div>
          <button
            onClick={() => setShowConnectModal(true)}
            className="cyber-button-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Connect Platform
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="cyber-card p-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : integrations.length === 0 ? (
          <div className="cyber-card p-8 text-center">
            <svg
              className="w-16 h-16 text-gray-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-400 mb-2">No Integrations</h3>
            <p className="text-gray-500 text-sm mb-4">
              Connect Slack or Teams to query threat intelligence from chat
            </p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="cyber-button-primary"
            >
              Connect Your First Platform
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Integrations List */}
            <div className="lg:col-span-1">
              <div className="cyber-card p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Connected</h3>
                <div className="space-y-2">
                  {integrations.map((integration) => {
                    const platform = PLATFORMS[integration.platform]
                    const isSelected = selectedIntegration?.id === integration.id

                    return (
                      <button
                        key={integration.id}
                        onClick={() => setSelectedIntegration(integration)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-cyber-accent/20 border-cyber-accent'
                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: platform?.color + '30' }}
                          >
                            <span className="text-lg">
                              {integration.platform === 'slack' ? '📱' : integration.platform === 'teams' ? '💬' : '🎮'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">
                              {integration.workspace_name || platform?.name}
                            </div>
                            <div className="text-xs text-gray-500">{platform?.name}</div>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              integration.is_active ? 'bg-green-500' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => setShowConnectModal(true)}
                  className="w-full mt-4 p-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
                >
                  + Add Another
                </button>
              </div>
            </div>

            {/* Integration Details */}
            <div className="lg:col-span-3">
              {selectedIntegration ? (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="cyber-card p-4">
                      <div className="text-gray-400 text-sm">Commands (7d)</div>
                      <div className="text-2xl font-bold text-white">
                        {stats?.total || 0}
                      </div>
                    </div>
                    <div className="cyber-card p-4">
                      <div className="text-gray-400 text-sm">Success Rate</div>
                      <div className="text-2xl font-bold text-green-400">
                        {stats?.successRate || 100}%
                      </div>
                    </div>
                    <div className="cyber-card p-4">
                      <div className="text-gray-400 text-sm">Subscriptions</div>
                      <div className="text-2xl font-bold text-white">
                        {subscriptions.filter((s) => s.is_active).length}
                      </div>
                    </div>
                    <div className="cyber-card p-4">
                      <div className="text-gray-400 text-sm">Default Channel</div>
                      <div className="text-lg font-medium text-white truncate">
                        {selectedIntegration.default_channel_name || 'Not set'}
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-gray-700 pb-2">
                    {['subscriptions', 'commands', 'logs'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                          view === v
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="cyber-card p-4">
                    {view === 'subscriptions' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-white">Channel Subscriptions</h4>
                        </div>

                        {subscriptions.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>No subscriptions yet.</p>
                            <p className="text-sm mt-1">
                              Use <code className="bg-gray-800 px-1 rounded">/vigil subscribe</code> in a channel
                            </p>
                          </div>
                        ) : (
                          subscriptions.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">
                                    #{sub.channel_name || sub.channel_id}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                    {sub.subscription_type}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {sub.notification_count} notifications sent
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleSubscription(sub)}
                                  className={`px-3 py-1 text-xs rounded ${
                                    sub.is_active
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-gray-700 text-gray-400'
                                  }`}
                                >
                                  {sub.is_active ? 'Active' : 'Paused'}
                                </button>
                                <button
                                  onClick={() => handleDeleteSubscription(sub)}
                                  className="p-1 text-gray-500 hover:text-red-400"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {view === 'commands' && (
                      <div className="space-y-4">
                        <h4 className="font-medium text-white">Available Commands</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.values(COMMANDS).map((cmd) => (
                            <div
                              key={cmd.name}
                              className="p-3 bg-gray-800/30 rounded-lg"
                            >
                              <div className="font-mono text-sm text-cyber-accent mb-1">
                                {cmd.usage}
                              </div>
                              <div className="text-sm text-gray-400">
                                {cmd.description}
                              </div>
                              <div className="text-xs text-gray-600 mt-2">
                                e.g., {cmd.examples[0]}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {view === 'logs' && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-white">Recent Commands</h4>
                        {logs.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No commands executed yet
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {logs.map((log) => (
                              <div
                                key={log.id}
                                className="flex items-center justify-between p-2 bg-gray-800/30 rounded text-sm"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      log.response_status === 'success'
                                        ? 'bg-green-500'
                                        : 'bg-red-500'
                                    }`}
                                  />
                                  <span className="font-mono text-gray-300">
                                    /{log.command}
                                  </span>
                                  {log.arguments && (
                                    <span className="text-gray-500">
                                      {log.arguments}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>@{log.platform_user_name || 'unknown'}</span>
                                  <span>
                                    {new Date(log.executed_at).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDisconnect(selectedIntegration)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Disconnect Integration
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cyber-card p-8 text-center">
                  <p className="text-gray-500">Select an integration to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connect Modal */}
        {showConnectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-cyber-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Connect Platform</h3>
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-400 text-sm mb-6">
                Choose a platform to connect. You'll be redirected to authorize Vigil.
              </p>

              <div className="space-y-3">
                {Object.entries(PLATFORMS).map(([key, platform]) => (
                  <button
                    key={key}
                    onClick={() => handleConnect(key)}
                    className="w-full flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: platform.color + '30' }}
                    >
                      {key === 'slack' ? '📱' : key === 'teams' ? '💬' : '🎮'}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-white">{platform.name}</div>
                      <div className="text-sm text-gray-500">
                        Connect to {platform.name} workspace
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Required scopes will be requested during authorization
              </p>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  )
}
