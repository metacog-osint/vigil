/**
 * Integrations Section Component
 * Manages external integrations (Slack, Teams, Jira, etc.)
 */

import { useState, useEffect } from 'react'
import { integrations, INTEGRATION_TYPES, NOTIFICATION_EVENTS, webhooks } from '../lib/integrations'
import { canAccess } from '../lib/features'

// Integration icons
const IntegrationIcon = ({ type, className = 'w-8 h-8' }) => {
  const icons = {
    slack: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
    teams: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.625 8.073c.574 0 1.125.224 1.53.623.407.4.636.94.636 1.505v5.607c0 .566-.229 1.106-.636 1.505a2.179 2.179 0 0 1-1.53.623h-2.166v3.126c0 .377-.15.74-.418 1.007a1.431 1.431 0 0 1-1.01.416H11.51a1.42 1.42 0 0 1-1.008-.416 1.42 1.42 0 0 1-.417-1.007v-3.126H5.375a2.179 2.179 0 0 1-1.53-.623 2.125 2.125 0 0 1-.636-1.505V10.2c0-.566.229-1.106.636-1.505a2.179 2.179 0 0 1 1.53-.623h6.71V4.947c0-.377.15-.74.418-1.007a1.431 1.431 0 0 1 1.01-.416h5.498c.38 0 .743.15 1.01.416.269.268.419.63.419 1.007v3.126h.185zM9.99 13.63H7.542v3.936H9.99v-3.936zm6.468 0h-2.446v3.936h2.446v-3.936z"/>
      </svg>
    ),
    jira: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0z"/>
      </svg>
    ),
    webhook: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    splunk: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 16.091l-2.187-1.268-.014-.008-3.693-2.132 3.693-2.132.014-.008 2.187-1.268v1.536l-1.65.954 1.65.954v1.536l-1.65.954 1.65.954v1.536l-1.65.954v-1.536zm-11.788 0v-1.536l1.65-.954-1.65-.954V11.11l1.65-.954-1.65-.954V7.665l1.65-.954v1.536l1.65.954-1.65.954v1.536l1.65.954-1.65.954v1.536l-1.65.954v-1.536l-1.65-.954z"/>
      </svg>
    ),
    elastic: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.444 11.833H24c-.015-3.953-2.273-7.384-5.685-9.168l-5.81 6.675.939 2.493zm.939-2.493l5.81-6.675c-1.603-.873-3.45-1.37-5.413-1.37-2.667 0-5.113.926-7.053 2.466L12.5 9.34l1.883 0zM12.5 9.34L7.727 3.761C4.3 6.121 2.056 9.87 2.01 14.167h8.49l2-4.827zm2 4.827H2.01c.047 4.296 2.291 8.045 5.717 10.406L12.5 18.593l2-4.426zm-2 4.426l-4.773 5.578c1.94 1.54 4.386 2.466 7.053 2.466 1.963 0 3.81-.497 5.413-1.37l-5.81-6.674-1.883 0zm1.883 0l5.81 6.674c3.412-1.784 5.67-5.215 5.685-9.167H13.444l.939 2.493z"/>
      </svg>
    ),
    sentinel: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm0 2.885l7.785 4.5v9l-7.785 4.5-7.785-4.5v-9l7.785-4.5z"/>
      </svg>
    ),
    pagerduty: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.965 1.18C15.085.164 13.769 0 10.683 0H3.73v14.55h6.926c2.743 0 4.8-.164 6.61-1.37 1.975-1.303 3.004-3.47 3.004-6.202 0-2.743-.839-4.622-3.305-5.798zM11.79 9.14c-.707.354-1.552.354-2.942.354H8.14V4.17h.708c1.398 0 2.235 0 2.942.354.854.448 1.413 1.412 1.413 2.313 0 .9-.559 1.855-1.413 2.303zM3.73 24h4.41v-6.705H3.73V24z"/>
      </svg>
    ),
    servicenow: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18.96c-3.84 0-6.96-3.12-6.96-6.96S8.16 5.04 12 5.04s6.96 3.12 6.96 6.96-3.12 6.96-6.96 6.96z"/>
      </svg>
    ),
  }

  return icons[type] || icons.webhook
}

// Integration configuration modal
function IntegrationConfigModal({ integration, config, onSave, onClose, onTest }) {
  const [formData, setFormData] = useState(config || {})
  const [notifyOn, setNotifyOn] = useState(integration?.notify_on || {
    critical_incidents: true,
    high_incidents: true,
    watchlist_updates: true,
    new_kevs: true,
    actor_escalations: true,
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)

  const integrationType = INTEGRATION_TYPES[integration.integration_type]

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await onTest(integration.integration_type, formData)
    setTestResult(result)
    setTesting(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(formData, notifyOn)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gray-800 rounded-lg">
            <IntegrationIcon type={integration.integration_type} className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">{integrationType.name}</h3>
            <p className="text-sm text-gray-400">{integrationType.description}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Configuration fields */}
          {integrationType.requiredFields.map((field) => (
            <div key={field}>
              <label className="block text-sm text-gray-400 mb-1">
                {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} *
              </label>
              <input
                type={field.includes('token') || field.includes('password') || field.includes('secret') || field.includes('key') ? 'password' : 'text'}
                value={formData[field] || ''}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder={`Enter ${field.replace(/_/g, ' ')}`}
              />
            </div>
          ))}

          {integrationType.optionalFields?.map((field) => (
            <div key={field}>
              <label className="block text-sm text-gray-400 mb-1">
                {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </label>
              <input
                type="text"
                value={formData[field] || ''}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                placeholder={`Enter ${field.replace(/_/g, ' ')} (optional)`}
              />
            </div>
          ))}

          {/* Test result */}
          {testResult && (
            <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>
                {testResult.message}
              </span>
            </div>
          )}

          {/* Notification preferences */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Send notifications for:</h4>
            <div className="space-y-2">
              {Object.entries(NOTIFICATION_EVENTS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifyOn[key] ?? true}
                    onChange={(e) => setNotifyOn({ ...notifyOn, [key]: e.target.checked })}
                    className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Documentation link */}
          {integrationType.docsUrl && (
            <a
              href={integrationType.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan-400 hover:underline"
            >
              View setup documentation
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Webhook configuration modal
function WebhookModal({ webhook, onSave, onClose }) {
  const [formData, setFormData] = useState(webhook || {
    name: '',
    url: '',
    secret: '',
    events: ['incident.new', 'kev.new'],
  })
  const [saving, setSaving] = useState(false)

  const eventOptions = [
    { value: 'incident.new', label: 'New incidents' },
    { value: 'incident.updated', label: 'Incident updates' },
    { value: 'kev.new', label: 'New KEVs' },
    { value: 'actor.escalating', label: 'Actor escalations' },
    { value: 'ioc.new', label: 'New IOCs' },
    { value: 'watchlist.update', label: 'Watchlist updates' },
  ]

  const handleSave = async () => {
    setSaving(true)
    await onSave(formData)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4">
        <h3 className="text-lg font-medium text-white mb-4">
          {webhook ? 'Edit Webhook' : 'Create Webhook'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              placeholder="My Webhook"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              placeholder="https://your-server.com/webhook"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Secret (for HMAC signature)</label>
            <input
              type="password"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              placeholder="Optional secret for signature verification"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Events to send</label>
            <div className="space-y-2">
              {eventOptions.map((event) => (
                <label key={event.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.events?.includes(event.value)}
                    onChange={(e) => {
                      const events = e.target.checked
                        ? [...(formData.events || []), event.value]
                        : formData.events?.filter(ev => ev !== event.value)
                      setFormData({ ...formData, events })
                    }}
                    className="rounded border-gray-600 bg-gray-800 text-cyan-500"
                  />
                  <span className="text-sm text-gray-300">{event.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.name || !formData.url}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main integrations section component
export default function IntegrationsSection({ userId, userTier = 'free' }) {
  const [userIntegrations, setUserIntegrations] = useState([])
  const [userWebhooks, setUserWebhooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState(null) // { type: 'integration'|'webhook', data: ... }
  const [error, setError] = useState(null)

  const hasIntegrationAccess = canAccess(userTier, 'siem_integration')

  useEffect(() => {
    if (userId && hasIntegrationAccess) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [userId, hasIntegrationAccess])

  const loadData = async () => {
    try {
      const [integrationsData, webhooksData] = await Promise.all([
        integrations.getAll(userId),
        webhooks.getAll(userId),
      ])
      setUserIntegrations(integrationsData)
      setUserWebhooks(webhooksData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveIntegration = async (integrationType, config, notifyOn) => {
    try {
      await integrations.upsert(userId, integrationType, config, notifyOn)
      await loadData()
      setActiveModal(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteIntegration = async (integrationType) => {
    if (!confirm('Are you sure you want to remove this integration?')) return
    try {
      await integrations.delete(userId, integrationType)
      setUserIntegrations(userIntegrations.filter(i => i.integration_type !== integrationType))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleIntegration = async (integrationType, enabled) => {
    try {
      await integrations.toggle(userId, integrationType, enabled)
      setUserIntegrations(userIntegrations.map(i =>
        i.integration_type === integrationType ? { ...i, is_enabled: enabled } : i
      ))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSaveWebhook = async (webhookData) => {
    try {
      if (webhookData.id) {
        await webhooks.update(webhookData.id, userId, webhookData)
      } else {
        await webhooks.create(userId, webhookData)
      }
      await loadData()
      setActiveModal(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteWebhook = async (webhookId) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return
    try {
      await webhooks.delete(webhookId, userId)
      setUserWebhooks(userWebhooks.filter(w => w.id !== webhookId))
    } catch (err) {
      setError(err.message)
    }
  }

  // Check access
  if (!hasIntegrationAccess) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <h4 className="text-white font-medium mb-2">Integrations Available on Enterprise Plan</h4>
        <p className="text-gray-400 text-sm mb-4">
          Connect Vigil to your SIEM, ticketing system, and communication tools.
        </p>
        <a
          href="/pricing"
          className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          Upgrade to Enterprise
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto" />
      </div>
    )
  }

  // Available integrations (not yet configured)
  const configuredTypes = userIntegrations.map(i => i.integration_type)
  const availableIntegrations = Object.entries(INTEGRATION_TYPES)
    .filter(([type]) => !configuredTypes.includes(type))

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Configured Integrations */}
      {userIntegrations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3">Active Integrations</h4>
          <div className="space-y-3">
            {userIntegrations.map((integration) => {
              const typeInfo = INTEGRATION_TYPES[integration.integration_type]
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      <IntegrationIcon type={integration.integration_type} className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">{typeInfo?.name}</div>
                      <div className="text-sm text-gray-400">
                        {integration.is_connected ? 'Connected' : 'Not connected'}
                        {integration.last_sync_at && ` · Last sync: ${new Date(integration.last_sync_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleIntegration(integration.integration_type, !integration.is_enabled)}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        integration.is_enabled ? 'bg-cyan-600' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`block w-4 h-4 bg-white rounded-full transform transition-transform mx-1 ${
                        integration.is_enabled ? 'translate-x-4' : ''
                      }`} />
                    </button>
                    <button
                      onClick={() => setActiveModal({ type: 'integration', data: integration })}
                      className="p-2 text-gray-400 hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteIntegration(integration.integration_type)}
                      className="p-2 text-gray-400 hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-3">Add Integration</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {availableIntegrations.map(([type, info]) => (
            <button
              key={type}
              onClick={() => setActiveModal({ type: 'integration', data: { integration_type: type, config: {} } })}
              className="flex items-center gap-3 p-4 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700 rounded-lg transition-colors text-left"
            >
              <IntegrationIcon type={type} className="w-6 h-6 text-gray-400" />
              <div>
                <div className="text-white text-sm font-medium">{info.name}</div>
                <div className="text-gray-500 text-xs">{info.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Webhooks */}
      <div className="border-t border-gray-700 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-300">Custom Webhooks</h4>
          <button
            onClick={() => setActiveModal({ type: 'webhook', data: null })}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            + Add Webhook
          </button>
        </div>

        {userWebhooks.length === 0 ? (
          <p className="text-gray-500 text-sm">No webhooks configured</p>
        ) : (
          <div className="space-y-2">
            {userWebhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-center justify-between bg-gray-800/30 rounded-lg p-3"
              >
                <div>
                  <div className="text-white text-sm">{webhook.name}</div>
                  <div className="text-gray-500 text-xs font-mono">{webhook.url}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveModal({ type: 'webhook', data: webhook })}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal?.type === 'integration' && (
        <IntegrationConfigModal
          integration={activeModal.data}
          config={activeModal.data.config}
          onSave={(config, notifyOn) => handleSaveIntegration(activeModal.data.integration_type, config, notifyOn)}
          onClose={() => setActiveModal(null)}
          onTest={integrations.test}
        />
      )}

      {activeModal?.type === 'webhook' && (
        <WebhookModal
          webhook={activeModal.data}
          onSave={handleSaveWebhook}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  )
}
