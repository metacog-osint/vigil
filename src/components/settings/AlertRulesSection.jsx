import { useState, useEffect } from 'react'
import { alertRules } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const RULE_TYPES = [
  {
    value: 'vendor_cve',
    label: 'Vendor CVE',
    description: 'Alert when CVEs affect specific vendors',
  },
  {
    value: 'actor_activity',
    label: 'Actor Activity',
    description: 'Alert when threat actors become active',
  },
  {
    value: 'sector_incident',
    label: 'Sector Incident',
    description: 'Alert on incidents in your sector',
  },
  { value: 'kev_added', label: 'New KEV', description: 'Alert when CVEs are added to KEV catalog' },
  {
    value: 'severity_threshold',
    label: 'Severity Threshold',
    description: 'Alert on high severity events',
  },
]

const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low']

export default function AlertRulesSection() {
  const { user } = useAuth()
  const userId = user?.uid || 'anonymous'

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  useEffect(() => {
    loadRules()
  }, [userId])

  async function loadRules() {
    setLoading(true)
    try {
      const { data, error } = await alertRules.getForUser(userId, false)
      if (error) throw error
      setRules(data || [])
    } catch (error) {
      console.error('Error loading alert rules:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(rule) {
    try {
      const { data, error } = await alertRules.toggle(rule.id, !rule.enabled)
      if (error) throw error
      setRules(rules.map((r) => (r.id === rule.id ? data : r)))
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  async function handleDelete(ruleId) {
    if (!confirm('Delete this alert rule?')) return
    try {
      const { error } = await alertRules.delete(ruleId)
      if (error) throw error
      setRules(rules.filter((r) => r.id !== ruleId))
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  async function handleCreate(ruleData) {
    try {
      const { data, error } = await alertRules.create({
        ...ruleData,
        userId,
      })
      if (error) throw error
      setRules([...rules, data])
      setShowCreateModal(false)
    } catch (error) {
      console.error('Error creating rule:', error)
    }
  }

  async function handleUpdate(ruleId, updates) {
    try {
      const { data, error } = await alertRules.update(ruleId, updates)
      if (error) throw error
      setRules(rules.map((r) => (r.id === ruleId ? data : r)))
      setEditingRule(null)
    } catch (error) {
      console.error('Error updating rule:', error)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block w-5 h-5 border-2 border-gray-600 border-t-cyan-400 rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 mt-2">Loading alert rules...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-6 bg-gray-800/30 rounded-lg border border-gray-700">
          <div className="text-2xl mb-2">🔔</div>
          <p className="text-sm text-gray-400">No alert rules configured</p>
          <p className="text-xs text-gray-500 mt-1">
            Create rules to get notified about relevant threats
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => handleToggle(rule)}
              onEdit={() => setEditingRule(rule)}
              onDelete={() => handleDelete(rule.id)}
            />
          ))}
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        + Create alert rule
      </button>

      {/* Create Modal */}
      {showCreateModal && (
        <RuleModal onClose={() => setShowCreateModal(false)} onSave={handleCreate} />
      )}

      {/* Edit Modal */}
      {editingRule && (
        <RuleModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSave={(updates) => handleUpdate(editingRule.id, updates)}
        />
      )}
    </div>
  )
}

function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  const ruleType = RULE_TYPES.find((t) => t.value === rule.rule_type)

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        rule.enabled
          ? 'bg-gray-800/30 border-gray-700'
          : 'bg-gray-900/30 border-gray-800 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">{rule.rule_name}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
              {ruleType?.label || rule.rule_type}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            <ConditionsDisplay conditions={rule.conditions} ruleType={rule.rule_type} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
            {rule.notify_email && <span>📧 Email</span>}
            {rule.notify_in_app && <span>🔔 In-app</span>}
            {rule.trigger_count > 0 && <span>Triggered {rule.trigger_count} times</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle */}
          <button
            onClick={onToggle}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              rule.enabled ? 'bg-cyan-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                rule.enabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
          {/* Edit */}
          <button
            onClick={onEdit}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  )
}

function ConditionsDisplay({ conditions, ruleType }) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return <span>No conditions configured</span>
  }

  const parts = []

  if (conditions.vendors?.length > 0) {
    parts.push(`Vendors: ${conditions.vendors.join(', ')}`)
  }
  if (conditions.actor_names?.length > 0) {
    parts.push(`Actors: ${conditions.actor_names.join(', ')}`)
  }
  if (conditions.sectors?.length > 0) {
    parts.push(`Sectors: ${conditions.sectors.join(', ')}`)
  }
  if (conditions.min_severity) {
    parts.push(`Min severity: ${conditions.min_severity}`)
  }
  if (conditions.kev_only) {
    parts.push('KEV only')
  }

  return <span>{parts.join(' • ') || 'All matching events'}</span>
}

function RuleModal({ rule, onClose, onSave }) {
  const [ruleName, setRuleName] = useState(rule?.rule_name || '')
  const [ruleType, setRuleType] = useState(rule?.rule_type || 'vendor_cve')
  const [notifyEmail, setNotifyEmail] = useState(rule?.notify_email ?? true)
  const [notifyInApp, setNotifyInApp] = useState(rule?.notify_in_app ?? true)
  const [conditions, setConditions] = useState(rule?.conditions || {})
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ruleName.trim()) return

    setSaving(true)
    await onSave({
      ruleName: ruleName.trim(),
      ruleType,
      conditions,
      notifyEmail,
      notifyInApp,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cyber-dark border border-gray-700 rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-white mb-4">
          {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rule Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full cyber-input"
              placeholder="e.g., Cisco CVE Alerts"
              required
            />
          </div>

          {/* Rule Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Rule Type</label>
            <select
              value={ruleType}
              onChange={(e) => {
                setRuleType(e.target.value)
                setConditions({}) // Reset conditions when type changes
              }}
              className="w-full cyber-input"
            >
              {RULE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {RULE_TYPES.find((t) => t.value === ruleType)?.description}
            </p>
          </div>

          {/* Conditions based on type */}
          <ConditionsEditor ruleType={ruleType} conditions={conditions} onChange={setConditions} />

          {/* Notification Options */}
          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Notifications</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-300">Email notifications</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyInApp}
                onChange={(e) => setNotifyInApp(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-300">In-app notifications</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !ruleName.trim()}
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConditionsEditor({ ruleType, conditions, onChange }) {
  const updateCondition = (key, value) => {
    onChange({ ...conditions, [key]: value })
  }

  switch (ruleType) {
    case 'vendor_cve':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendors (comma-separated)</label>
            <input
              type="text"
              value={conditions.vendors?.join(', ') || ''}
              onChange={(e) =>
                updateCondition(
                  'vendors',
                  e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean)
                )
              }
              className="w-full cyber-input"
              placeholder="e.g., Cisco, Microsoft, Palo Alto"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Minimum Severity</label>
            <select
              value={conditions.min_severity || ''}
              onChange={(e) => updateCondition('min_severity', e.target.value)}
              className="w-full cyber-input"
            >
              <option value="">Any</option>
              {SEVERITY_OPTIONS.map((sev) => (
                <option key={sev} value={sev}>
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={conditions.kev_only || false}
              onChange={(e) => updateCondition('kev_only', e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-cyan-500"
            />
            <span className="text-sm text-gray-300">Only KEV catalog CVEs</span>
          </label>
        </div>
      )

    case 'actor_activity':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Actor Names (comma-separated)
            </label>
            <input
              type="text"
              value={conditions.actor_names?.join(', ') || ''}
              onChange={(e) =>
                updateCondition(
                  'actor_names',
                  e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean)
                )
              }
              className="w-full cyber-input"
              placeholder="e.g., LockBit, ALPHV, Clop"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to monitor all escalating actors
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Event Types</label>
            <div className="flex flex-wrap gap-2">
              {['escalating', 'new_incident', 'new_actor'].map((type) => (
                <label key={type} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={(conditions.event_types || []).includes(type)}
                    onChange={(e) => {
                      const current = conditions.event_types || []
                      updateCondition(
                        'event_types',
                        e.target.checked ? [...current, type] : current.filter((t) => t !== type)
                      )
                    }}
                    className="rounded border-gray-600 bg-gray-800 text-cyan-500"
                  />
                  <span className="text-sm text-gray-300">{type.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )

    case 'sector_incident':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sectors (comma-separated)</label>
            <input
              type="text"
              value={conditions.sectors?.join(', ') || ''}
              onChange={(e) =>
                updateCondition(
                  'sectors',
                  e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean)
                )
              }
              className="w-full cyber-input"
              placeholder="e.g., healthcare, finance, education"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use your organization's sector
            </p>
          </div>
        </div>
      )

    case 'kev_added':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Minimum CVSS Score</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={conditions.min_cvss || ''}
              onChange={(e) =>
                updateCondition('min_cvss', e.target.value ? parseFloat(e.target.value) : null)
              }
              className="w-full cyber-input"
              placeholder="e.g., 7.0"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={conditions.ransomware_only || false}
              onChange={(e) => updateCondition('ransomware_only', e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-cyan-500"
            />
            <span className="text-sm text-gray-300">Only CVEs used in ransomware campaigns</span>
          </label>
        </div>
      )

    case 'severity_threshold':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Minimum Severity</label>
            <select
              value={conditions.min_severity || 'high'}
              onChange={(e) => updateCondition('min_severity', e.target.value)}
              className="w-full cyber-input"
            >
              {SEVERITY_OPTIONS.map((sev) => (
                <option key={sev} value={sev}>
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Alert on any event with severity at or above this threshold
          </p>
        </div>
      )

    default:
      return null
  }
}
