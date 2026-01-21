import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  webhooks,
  webhookDeliveries,
  WEBHOOK_EVENTS,
  AUTH_TYPES,
  getEventsByCategory,
  validateWebhookUrl,
} from '../lib/webhooks'
import { canAccess } from '../lib/features'
import { SmartTime } from '../components/TimeDisplay'

const STATUS_COLORS = {
  success: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-yellow-500',
  retrying: 'bg-orange-500',
}

export default function Webhooks() {
  const { user, profile } = useAuth()
  const [hookList, setHookList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHook, setSelectedHook] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [view, setView] = useState('list') // list | deliveries

  // Feature check
  const hasAccess = canAccess(profile?.tier, 'api_access')

  useEffect(() => {
    if (user?.id && hasAccess) {
      loadWebhooks()
    }
  }, [user?.id, hasAccess])

  async function loadWebhooks() {
    setLoading(true)
    try {
      const data = await webhooks.getAll(user.id)
      setHookList(data)
    } catch (err) {
      console.error('Failed to load webhooks:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(hook) {
    try {
      const updated = await webhooks.toggle(hook.id, !hook.is_enabled)
      setHookList((prev) => prev.map((h) => (h.id === hook.id ? updated : h)))
    } catch (err) {
      alert('Failed to update webhook: ' + err.message)
    }
  }

  async function handleDelete(hookId) {
    if (!confirm('Delete this webhook? This cannot be undone.')) return
    try {
      await webhooks.delete(hookId)
      setHookList((prev) => prev.filter((h) => h.id !== hookId))
      if (selectedHook?.id === hookId) setSelectedHook(null)
    } catch (err) {
      alert('Failed to delete webhook: ' + err.message)
    }
  }

  async function handleCreate(data) {
    try {
      const newHook = await webhooks.create(user.id, data)
      setHookList((prev) => [newHook, ...prev])
      setShowCreate(false)
      setSelectedHook(newHook)
    } catch (err) {
      alert('Failed to create webhook: ' + err.message)
    }
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Team Feature</h2>
          <p className="text-gray-400 mb-4">Webhooks are available on the Team plan and above.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-gray-400 text-sm mt-1">Push events to your systems in real-time</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="cyber-button-primary">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Webhook
        </button>
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Webhook List */}
        <div className="w-80 flex-shrink-0 space-y-2">
          {loading ? (
            <div className="cyber-card p-4 text-center text-gray-400">Loading...</div>
          ) : hookList.length === 0 ? (
            <div className="cyber-card p-6 text-center">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No webhooks configured</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-cyber-accent text-sm mt-2 hover:underline"
              >
                Create your first webhook
              </button>
            </div>
          ) : (
            hookList.map((hook) => (
              <div
                key={hook.id}
                onClick={() => setSelectedHook(hook)}
                className={`cyber-card p-3 cursor-pointer transition-colors ${
                  selectedHook?.id === hook.id ? 'border-cyber-accent' : 'hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white truncate">{hook.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${hook.is_enabled ? 'bg-green-500' : 'bg-gray-500'}`}
                  />
                </div>
                <div className="text-xs text-gray-500 truncate">{hook.url}</div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <span>{hook.events?.length || 0} events</span>
                  <span>•</span>
                  <span>{hook.total_sent || 0} sent</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1">
          {selectedHook ? (
            <WebhookDetail
              webhook={selectedHook}
              onUpdate={(updated) => {
                setHookList((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
                setSelectedHook(updated)
              }}
              onDelete={() => handleDelete(selectedHook.id)}
              onToggle={() => handleToggle(selectedHook)}
            />
          ) : (
            <div className="cyber-card p-8 text-center text-gray-500">
              Select a webhook to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateWebhookModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

/**
 * Webhook Detail Panel
 */
function WebhookDetail({ webhook, onUpdate, onDelete, onToggle }) {
  const [activeTab, setActiveTab] = useState('config')
  const [deliveries, setDeliveries] = useState([])
  const [loadingDeliveries, setLoadingDeliveries] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (activeTab === 'deliveries') {
      loadDeliveries()
    }
  }, [activeTab, webhook.id])

  async function loadDeliveries() {
    setLoadingDeliveries(true)
    try {
      const [deliveryData, statsData] = await Promise.all([
        webhookDeliveries.getForWebhook(webhook.id, 50),
        webhookDeliveries.getStats(webhook.id, 7),
      ])
      setDeliveries(deliveryData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load deliveries:', err)
    } finally {
      setLoadingDeliveries(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm('Regenerate secret? You will need to update your endpoint.')) return
    try {
      const updated = await webhooks.regenerateSecret(webhook.id)
      onUpdate(updated)
    } catch (err) {
      alert('Failed to regenerate secret: ' + err.message)
    }
  }

  return (
    <div className="cyber-card">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{webhook.name}</h2>
          <div className="text-sm text-gray-500 truncate max-w-md">{webhook.url}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 rounded text-sm ${
              webhook.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
            }`}
          >
            {webhook.is_enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button onClick={onDelete} className="text-red-400 hover:text-red-300 p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 flex">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm ${
            activeTab === 'config'
              ? 'text-cyber-accent border-b-2 border-cyber-accent'
              : 'text-gray-400'
          }`}
        >
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`px-4 py-2 text-sm ${
            activeTab === 'deliveries'
              ? 'text-cyber-accent border-b-2 border-cyber-accent'
              : 'text-gray-400'
          }`}
        >
          Deliveries
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'config' ? (
          <div className="space-y-4">
            {/* Events */}
            <div>
              <div className="text-sm text-gray-400 mb-2">Subscribed Events</div>
              <div className="flex flex-wrap gap-2">
                {webhook.events?.map((event) => (
                  <span key={event} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                    {WEBHOOK_EVENTS[event]?.name || event}
                  </span>
                ))}
                {(!webhook.events || webhook.events.length === 0) && (
                  <span className="text-gray-500 text-sm">No events selected</span>
                )}
              </div>
            </div>

            {/* Secret */}
            {webhook.secret && (
              <div>
                <div className="text-sm text-gray-400 mb-2">Signing Secret</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-gray-300 font-mono">
                    {webhook.secret.substring(0, 8)}...
                    {webhook.secret.substring(webhook.secret.length - 8)}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(webhook.secret)}
                    className="cyber-button text-sm"
                  >
                    Copy
                  </button>
                  <button onClick={handleRegenerate} className="cyber-button text-sm">
                    Regenerate
                  </button>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
              <div>
                <div className="text-2xl font-bold text-white">{webhook.total_sent || 0}</div>
                <div className="text-xs text-gray-500">Total Sent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{webhook.total_failed || 0}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">
                  {webhook.last_sent_at ? <SmartTime date={webhook.last_sent_at} /> : 'Never'}
                </div>
                <div className="text-xs text-gray-500">Last Sent</div>
              </div>
            </div>

            {/* Last Error */}
            {webhook.last_error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
                <div className="text-sm text-red-400 font-medium">Last Error</div>
                <div className="text-sm text-gray-400 mt-1">{webhook.last_error}</div>
                {webhook.last_error_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    <SmartTime date={webhook.last_error_at} />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Delivery Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{stats.total}</div>
                  <div className="text-xs text-gray-500">Total (7d)</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-400">{stats.success}</div>
                  <div className="text-xs text-gray-500">Success</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-400">{stats.failed}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">
                    {stats.pending + stats.retrying}
                  </div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
              </div>
            )}

            {/* Delivery List */}
            {loadingDeliveries ? (
              <div className="text-center text-gray-400 py-4">Loading...</div>
            ) : deliveries.length === 0 ? (
              <div className="text-center text-gray-500 py-4">No deliveries yet</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {deliveries.map((delivery) => (
                  <DeliveryRow key={delivery.id} delivery={delivery} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Delivery Row
 */
function DeliveryRow({ delivery }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-800 rounded">
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-800/50"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[delivery.status]}`} />
          <span className="text-sm text-white">
            {WEBHOOK_EVENTS[delivery.event_type]?.name || delivery.event_type}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {delivery.response_time_ms && <span>{delivery.response_time_ms}ms</span>}
          <SmartTime date={delivery.created_at} />
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="p-3 border-t border-gray-800 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Status:</span>
            <span
              className={`capitalize ${delivery.status === 'success' ? 'text-green-400' : delivery.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}
            >
              {delivery.status}
            </span>
            {delivery.response_status && (
              <span className="text-gray-400">({delivery.response_status})</span>
            )}
          </div>
          {delivery.attempts > 0 && (
            <div className="text-sm text-gray-500">
              Attempts: {delivery.attempts}/{delivery.max_attempts}
            </div>
          )}
          {delivery.error_message && (
            <div className="text-sm text-red-400">{delivery.error_message}</div>
          )}
          {delivery.payload && (
            <pre className="text-xs bg-gray-800 p-2 rounded overflow-x-auto text-gray-400 max-h-40">
              {JSON.stringify(delivery.payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Create Webhook Modal
 */
function CreateWebhookModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState('signature')
  const [selectedEvents, setSelectedEvents] = useState([])
  const [saving, setSaving] = useState(false)
  const [urlError, setUrlError] = useState('')

  const eventsByCategory = getEventsByCategory()

  function handleUrlChange(value) {
    setUrl(value)
    if (value) {
      const validation = validateWebhookUrl(value)
      setUrlError(validation.valid ? '' : validation.error)
    } else {
      setUrlError('')
    }
  }

  function toggleEvent(eventId) {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    )
  }

  function toggleCategory(categoryEvents) {
    const allSelected = categoryEvents.every((e) => selectedEvents.includes(e.id))
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !categoryEvents.find((ce) => ce.id === e)))
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...categoryEvents.map((e) => e.id)])])
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name || !url || selectedEvents.length === 0) return
    if (urlError) return

    setSaving(true)
    await onCreate({
      name,
      url,
      authType,
      events: selectedEvents,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Create Webhook</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Slack Notifications"
              className="cyber-input w-full"
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Endpoint URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className={`cyber-input w-full ${urlError ? 'border-red-500' : ''}`}
              required
            />
            {urlError && <p className="text-red-400 text-xs mt-1">{urlError}</p>}
          </div>

          {/* Auth Type */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Authentication</label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value)}
              className="cyber-input w-full"
            >
              {Object.entries(AUTH_TYPES).map(([key, auth]) => (
                <option key={key} value={key}>
                  {auth.label}
                </option>
              ))}
            </select>
            <p className="text-gray-500 text-xs mt-1">{AUTH_TYPES[authType].description}</p>
          </div>

          {/* Events */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Events *</label>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(eventsByCategory).map(([category, data]) => (
                <div key={category} className="border border-gray-800 rounded p-3">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={data.events.every((e) => selectedEvents.includes(e.id))}
                      onChange={() => toggleCategory(data.events)}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm font-medium text-white">{data.label}</span>
                  </label>
                  <div className="ml-6 space-y-1">
                    {data.events.map((event) => (
                      <label key={event.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event.id)}
                          onChange={() => toggleEvent(event.id)}
                          className="rounded border-gray-600"
                        />
                        <span className="text-sm text-gray-300">{event.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-800 flex justify-between items-center">
          <span className="text-sm text-gray-500">{selectedEvents.length} events selected</span>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="cyber-button">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name || !url || selectedEvents.length === 0 || urlError}
              className="cyber-button-primary"
            >
              {saving ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
