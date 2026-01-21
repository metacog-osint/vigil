/**
 * AlertSettingsSection - Real-time alert configuration
 * Allows users to configure push notifications, email alerts, and webhooks
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../contexts/SubscriptionContext'
import {
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  getAlertPreferences,
  updateAlertPreferences,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  getAlertHistory,
  regenerateWebhookSecret,
  formatWebhookType,
  getWebhookIcon,
  validateWebhookUrl,
} from '../lib/alerts'
import { formatDistanceToNow } from 'date-fns'
import { UpgradePrompt } from './UpgradePrompt'
import { Tooltip } from './Tooltip'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

const EVENT_TYPES = [
  {
    id: 'ransomware',
    label: 'Ransomware Incidents',
    description: 'New victim claims on leak sites',
  },
  { id: 'kev', label: 'CISA KEV Additions', description: 'CVEs added to Known Exploited list' },
  { id: 'cisa_alert', label: 'CISA Alerts', description: 'Security advisories from CISA' },
  {
    id: 'watchlist',
    label: 'Watchlist Activity',
    description: 'Updates to actors/CVEs you follow',
  },
  { id: 'vendor_cve', label: 'Vendor CVEs', description: 'CVEs affecting your tech stack' },
]

const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Critical Only' },
  { value: 'high', label: 'High & Above' },
  { value: 'medium', label: 'Medium & Above' },
  { value: 'low', label: 'Low & Above' },
  { value: 'info', label: 'All Severities' },
]

export default function AlertSettingsSection() {
  const { user } = useAuth()
  const { canAccess, tier: _tier } = useSubscription()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Push notification state
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Preferences state
  const [preferences, setPreferences] = useState({
    push_enabled: true,
    push_ransomware: true,
    push_kev: true,
    push_cisa_alerts: true,
    push_watchlist: true,
    push_vendor_cve: true,
    email_alerts: true,
    email_instant_alerts: false,
    digest_frequency: 'daily',
    digest_time: '08:00',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    timezone: 'UTC',
    severity_threshold: 'low',
  })

  // Webhooks state
  const [webhooks, setWebhooks] = useState([])
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [testingWebhookId, setTestingWebhookId] = useState(null)
  const [testResult, setTestResult] = useState(null) // { webhookId, success, message }
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    type: 'slack',
    url: '',
    eventTypes: ['ransomware', 'kev', 'cisa_alert'],
    severityMin: 'medium',
  })

  // Delivery logs state
  const [showDeliveryLogs, setShowDeliveryLogs] = useState(false)
  const [deliveryLogs, setDeliveryLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Secret management state
  const [expandedWebhookId, setExpandedWebhookId] = useState(null)
  const [regeneratingSecret, setRegeneratingSecret] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const hasCustomAlerts = canAccess('custom_alert_rules')

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user?.id])

  useEffect(() => {
    // Check push support
    setPushSupported(isPushSupported())
    checkPushSubscription()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const [prefs, hooks] = await Promise.all([
        getAlertPreferences(user.id),
        hasCustomAlerts ? getWebhooks(user.id) : Promise.resolve([]),
      ])

      setPreferences(prefs)
      setWebhooks(hooks)
    } catch (err) {
      console.error('Failed to load alert settings:', err)
      setError('Failed to load alert settings')
    } finally {
      setLoading(false)
    }
  }

  async function checkPushSubscription() {
    if (isPushSupported()) {
      const subscribed = await isPushSubscribed()
      setPushSubscribed(subscribed)
    }
  }

  async function handleTogglePush() {
    setPushLoading(true)
    setError(null)

    try {
      if (pushSubscribed) {
        await unsubscribeFromPush(user.id)
        setPushSubscribed(false)
      } else {
        await subscribeToPush(user.id)
        setPushSubscribed(true)
      }
    } catch (err) {
      console.error('Push toggle failed:', err)
      setError(err.message || 'Failed to update push notifications')
    } finally {
      setPushLoading(false)
    }
  }

  async function handleSavePreferences() {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await updateAlertPreferences(user.id, preferences)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save preferences:', err)
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddWebhook() {
    setError(null)

    // Validate URL
    const validation = validateWebhookUrl(newWebhook.type, newWebhook.url)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    try {
      const created = await createWebhook(user.id, newWebhook)
      setWebhooks([created, ...webhooks])
      setShowAddWebhook(false)
      setNewWebhook({
        name: '',
        type: 'slack',
        url: '',
        eventTypes: ['ransomware', 'kev', 'cisa_alert'],
        severityMin: 'medium',
      })
    } catch (err) {
      console.error('Failed to create webhook:', err)
      setError('Failed to create webhook')
    }
  }

  async function handleDeleteWebhook(webhookId) {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    try {
      await deleteWebhook(webhookId)
      setWebhooks(webhooks.filter((w) => w.id !== webhookId))
    } catch (err) {
      console.error('Failed to delete webhook:', err)
      setError('Failed to delete webhook')
    }
  }

  async function handleTestWebhook(webhookId) {
    setTestingWebhookId(webhookId)
    setTestResult(null)

    try {
      const result = await testWebhook(webhookId)
      setTestResult({
        webhookId,
        success: true,
        message: result?.message || 'Test message sent successfully!',
      })
    } catch (err) {
      console.error('Webhook test failed:', err)
      setTestResult({
        webhookId,
        success: false,
        message: err.message || 'Failed to send test message',
      })
    } finally {
      setTestingWebhookId(null)
      // Clear result after 5 seconds
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  async function loadDeliveryLogs() {
    setLogsLoading(true)
    try {
      const { data } = await getAlertHistory(user.id, { limit: 50, channel: 'webhook' })
      setDeliveryLogs(data || [])
    } catch (err) {
      console.error('Failed to load delivery logs:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  function handleShowDeliveryLogs() {
    setShowDeliveryLogs(true)
    loadDeliveryLogs()
  }

  async function handleRegenerateSecret(webhookId) {
    if (!confirm('Are you sure? This will invalidate the current secret.')) return

    setRegeneratingSecret(true)
    try {
      const newSecret = await regenerateWebhookSecret(webhookId)
      // Update local state with new secret
      setWebhooks(webhooks.map((w) => (w.id === webhookId ? { ...w, secret: newSecret } : w)))
    } catch (err) {
      console.error('Failed to regenerate secret:', err)
      setError('Failed to regenerate webhook secret')
    } finally {
      setRegeneratingSecret(false)
    }
  }

  function handleCopySecret(secret) {
    navigator.clipboard.writeText(secret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  function handlePreferenceChange(key, value) {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-800 rounded w-1/3"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
          Alert preferences saved successfully!
        </div>
      )}

      {/* Push Notifications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Push Notifications</h4>
            <p className="text-xs text-gray-500 mt-1">
              Receive instant browser notifications for important events
            </p>
          </div>
          {pushSupported ? (
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pushSubscribed ? 'bg-cyber-primary' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  pushSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          ) : (
            <span className="text-xs text-gray-500">Not supported in this browser</span>
          )}
        </div>

        {pushSubscribed && (
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-400 mb-3">
              Choose which events trigger push notifications:
            </p>

            {EVENT_TYPES.map((event) => (
              <label key={event.id} className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-300">{event.label}</span>
                  <p className="text-xs text-gray-500">{event.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences[`push_${event.id}`] ?? true}
                  onChange={(e) => handlePreferenceChange(`push_${event.id}`, e.target.checked)}
                  className="rounded border-gray-600 text-cyber-primary focus:ring-cyber-primary"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Email Alerts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Email Alerts</h4>
            <p className="text-xs text-gray-500 mt-1">Receive email notifications and digests</p>
          </div>
          <button
            onClick={() => handlePreferenceChange('email_alerts', !preferences.email_alerts)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.email_alerts ? 'bg-cyber-primary' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.email_alerts ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {preferences.email_alerts && (
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
            {/* Instant Alerts */}
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-300">Instant Critical Alerts</span>
                <p className="text-xs text-gray-500">
                  Send email immediately for critical events (not just in digest)
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences.email_instant_alerts}
                onChange={(e) => handlePreferenceChange('email_instant_alerts', e.target.checked)}
                className="rounded border-gray-600 text-cyber-primary focus:ring-cyber-primary"
              />
            </label>

            {/* Digest Frequency */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Digest Frequency</label>
              <select
                value={preferences.digest_frequency}
                onChange={(e) => handlePreferenceChange('digest_frequency', e.target.value)}
                className="cyber-input w-full"
              >
                <option value="none">No digest (alerts only)</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </div>

            {preferences.digest_frequency !== 'none' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Digest Time</label>
                  <input
                    type="time"
                    value={preferences.digest_time}
                    onChange={(e) => handlePreferenceChange('digest_time', e.target.value)}
                    className="cyber-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Timezone</label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => handlePreferenceChange('timezone', e.target.value)}
                    className="cyber-input w-full"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Severity Threshold */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Minimum Severity
                <Tooltip content="Only receive alerts for events at or above this severity level">
                  <span className="ml-1 text-gray-500 cursor-help">(?)</span>
                </Tooltip>
              </label>
              <select
                value={preferences.severity_threshold}
                onChange={(e) => handlePreferenceChange('severity_threshold', e.target.value)}
                className="cyber-input w-full"
              >
                {SEVERITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quiet Hours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Quiet Hours</h4>
            <p className="text-xs text-gray-500 mt-1">
              Suppress non-critical alerts during specified hours
            </p>
          </div>
          <button
            onClick={() =>
              handlePreferenceChange('quiet_hours_enabled', !preferences.quiet_hours_enabled)
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.quiet_hours_enabled ? 'bg-cyber-primary' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.quiet_hours_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {preferences.quiet_hours_enabled && (
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Start Time</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={(e) => handlePreferenceChange('quiet_hours_start', e.target.value)}
                  className="cyber-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">End Time</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={(e) => handlePreferenceChange('quiet_hours_end', e.target.value)}
                  className="cyber-input w-full"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Critical alerts will still be delivered during quiet hours
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-800">
        <button onClick={handleSavePreferences} disabled={saving} className="cyber-button-primary">
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      {/* Webhooks (Pro+ Feature) */}
      <div className="space-y-4 pt-6 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Webhook Integrations</h4>
            <p className="text-xs text-gray-500 mt-1">
              Send alerts to Slack, Discord, Teams, or custom endpoints
            </p>
          </div>
          {hasCustomAlerts && (
            <button onClick={() => setShowAddWebhook(true)} className="cyber-button text-sm">
              + Add Webhook
            </button>
          )}
        </div>

        {!hasCustomAlerts ? (
          <UpgradePrompt
            feature="Webhook Integrations"
            description="Connect alerts to Slack, Discord, Microsoft Teams, or custom webhook endpoints."
            requiredTier="professional"
          />
        ) : (
          <>
            {/* Existing Webhooks */}
            {webhooks.length > 0 ? (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: getWebhookIcon(webhook.webhook_type) }}
                        >
                          {webhook.webhook_type.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{webhook.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatWebhookType(webhook.webhook_type)} ·{' '}
                            {webhook.event_types?.length || 0} event types
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            webhook.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {webhook.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => handleTestWebhook(webhook.id)}
                          disabled={testingWebhookId === webhook.id}
                          className="text-xs px-3 py-1.5 rounded bg-cyber-primary/20 text-cyber-accent hover:bg-cyber-primary/30 transition-colors disabled:opacity-50"
                        >
                          {testingWebhookId === webhook.id ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Testing...
                            </span>
                          ) : (
                            'Test'
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                    {/* Test result feedback */}
                    {testResult && testResult.webhookId === webhook.id && (
                      <div
                        className={`mt-3 px-3 py-2 rounded text-xs ${
                          testResult.success
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {testResult.success ? '✓' : '✗'} {testResult.message}
                      </div>
                    )}

                    {/* HMAC Secret Section (for generic webhooks) */}
                    {webhook.webhook_type === 'generic' && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <button
                          onClick={() =>
                            setExpandedWebhookId(
                              expandedWebhookId === webhook.id ? null : webhook.id
                            )
                          }
                          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${expandedWebhookId === webhook.id ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          HMAC Signature Verification
                        </button>

                        {expandedWebhookId === webhook.id && (
                          <div className="mt-3 space-y-3">
                            <div className="bg-gray-900/50 rounded p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500">Signing Secret</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopySecret(webhook.secret)}
                                    className="text-xs text-gray-400 hover:text-cyber-accent"
                                  >
                                    {copiedSecret ? 'Copied!' : 'Copy'}
                                  </button>
                                  <button
                                    onClick={() => handleRegenerateSecret(webhook.id)}
                                    disabled={regeneratingSecret}
                                    className="text-xs text-gray-400 hover:text-yellow-400"
                                  >
                                    {regeneratingSecret ? 'Regenerating...' : 'Regenerate'}
                                  </button>
                                </div>
                              </div>
                              <code className="text-xs text-cyber-accent font-mono break-all">
                                {webhook.secret || 'No secret generated'}
                              </code>
                            </div>

                            <div className="text-xs text-gray-500 space-y-1">
                              <p>
                                <span className="text-gray-400">Header:</span>{' '}
                                <code className="text-gray-300">
                                  {webhook.hmac_header || 'X-Vigil-Signature'}
                                </code>
                              </p>
                              <p>
                                <span className="text-gray-400">Algorithm:</span>{' '}
                                <code className="text-gray-300">HMAC-SHA256</code>
                              </p>
                              <p className="text-gray-600 mt-2">
                                Verify payloads using:{' '}
                                <code>HMAC-SHA256(request_body, secret)</code>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800/30 rounded-lg p-6 text-center">
                <p className="text-gray-500 text-sm">No webhooks configured</p>
                <p className="text-gray-600 text-xs mt-1">
                  Add a webhook to receive alerts in Slack, Discord, or Teams
                </p>
              </div>
            )}

            {/* Delivery Logs Button */}
            {webhooks.length > 0 && (
              <button
                onClick={handleShowDeliveryLogs}
                className="text-sm text-gray-400 hover:text-cyber-accent transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                View Delivery Logs
              </button>
            )}

            {/* Add Webhook Modal */}
            {showAddWebhook && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Add Webhook</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                        placeholder="e.g., Security Team Slack"
                        className="cyber-input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Type</label>
                      <select
                        value={newWebhook.type}
                        onChange={(e) => setNewWebhook({ ...newWebhook, type: e.target.value })}
                        className="cyber-input w-full"
                      >
                        <option value="slack">Slack</option>
                        <option value="discord">Discord</option>
                        <option value="teams">Microsoft Teams</option>
                        <option value="generic">Custom Webhook</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Webhook URL</label>
                      <input
                        type="url"
                        value={newWebhook.url}
                        onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                        placeholder="https://hooks.slack.com/..."
                        className="cyber-input w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {newWebhook.type === 'slack' &&
                          'Find this in Slack > Apps > Incoming Webhooks'}
                        {newWebhook.type === 'discord' &&
                          'Find this in Server Settings > Integrations > Webhooks'}
                        {newWebhook.type === 'teams' &&
                          'Find this in Channel > Connectors > Incoming Webhook'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Event Types</label>
                      <div className="space-y-2">
                        {EVENT_TYPES.slice(0, 3).map((event) => (
                          <label key={event.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newWebhook.eventTypes.includes(event.id)}
                              onChange={(e) => {
                                const types = e.target.checked
                                  ? [...newWebhook.eventTypes, event.id]
                                  : newWebhook.eventTypes.filter((t) => t !== event.id)
                                setNewWebhook({ ...newWebhook, eventTypes: types })
                              }}
                              className="rounded border-gray-600 text-cyber-primary"
                            />
                            <span className="text-sm text-gray-300">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Minimum Severity</label>
                      <select
                        value={newWebhook.severityMin}
                        onChange={(e) =>
                          setNewWebhook({ ...newWebhook, severityMin: e.target.value })
                        }
                        className="cyber-input w-full"
                      >
                        {SEVERITY_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => setShowAddWebhook(false)} className="cyber-button">
                      Cancel
                    </button>
                    <button
                      onClick={handleAddWebhook}
                      disabled={!newWebhook.name || !newWebhook.url}
                      className="cyber-button-primary"
                    >
                      Add Webhook
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Logs Modal */}
            {showDeliveryLogs && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">Webhook Delivery Logs</h3>
                    <button
                      onClick={() => setShowDeliveryLogs(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                    {logsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <svg
                          className="w-6 h-6 animate-spin text-cyber-accent"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </div>
                    ) : deliveryLogs.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500">No delivery logs yet</p>
                        <p className="text-gray-600 text-sm mt-1">
                          Logs will appear here when alerts are sent
                        </p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                            <th className="pb-2 font-medium">Time</th>
                            <th className="pb-2 font-medium">Event</th>
                            <th className="pb-2 font-medium">Status</th>
                            <th className="pb-2 font-medium">Response</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                          {deliveryLogs.map((log) => (
                            <tr key={log.id} className="text-sm">
                              <td className="py-3 text-gray-400">
                                {log.queued_at
                                  ? formatDistanceToNow(new Date(log.queued_at), {
                                      addSuffix: true,
                                    })
                                  : '—'}
                              </td>
                              <td className="py-3 text-gray-300">{log.event_type || '—'}</td>
                              <td className="py-3">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                                    log.status === 'delivered' || log.status === 'sent'
                                      ? 'bg-green-500/20 text-green-400'
                                      : log.status === 'failed'
                                        ? 'bg-red-500/20 text-red-400'
                                        : log.status === 'pending' || log.status === 'queued'
                                          ? 'bg-yellow-500/20 text-yellow-400'
                                          : 'bg-gray-500/20 text-gray-400'
                                  }`}
                                >
                                  {log.status === 'delivered' || log.status === 'sent'
                                    ? '✓'
                                    : log.status === 'failed'
                                      ? '✗'
                                      : '○'}{' '}
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-3 text-gray-500 text-xs font-mono">
                                {log.response_code ? `HTTP ${log.response_code}` : '—'}
                                {log.retry_count > 0 && (
                                  <span className="ml-2 text-yellow-500">
                                    ({log.retry_count} retries)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="p-4 border-t border-gray-800 flex justify-between items-center">
                    <button
                      onClick={loadDeliveryLogs}
                      className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </button>
                    <button onClick={() => setShowDeliveryLogs(false)} className="cyber-button">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
