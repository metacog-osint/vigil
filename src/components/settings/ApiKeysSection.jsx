import { useState, useEffect } from 'react'
import { apiKeys } from '../../lib/apiKeys'
import { useSubscription } from '../../contexts/SubscriptionContext'

export default function ApiKeysSection({ userId }) {
  const { canAccess } = useSubscription()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScopes, setNewKeyScopes] = useState(['read'])
  const [newKey, setNewKey] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [usageStats, setUsageStats] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  const hasApiAccess = canAccess('api_access')

  useEffect(() => {
    if (hasApiAccess && userId) {
      loadKeys()
      loadUsageStats()
    } else {
      setLoading(false)
    }
  }, [userId, hasApiAccess])

  async function loadKeys() {
    try {
      const data = await apiKeys.getAll(userId)
      setKeys(data)
    } catch (err) {
      console.error('Error loading API keys:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadUsageStats() {
    try {
      const stats = await apiKeys.getUsageStats(userId, 30)
      setUsageStats(stats)
    } catch (err) {
      console.error('Error loading usage stats:', err)
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim()) {
      setError('Please enter a name for the API key')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const { key, keyData } = await apiKeys.create(userId, newKeyName.trim(), newKeyScopes)
      setNewKey(key)
      setKeys([keyData, ...keys])
      setNewKeyName('')
      setNewKeyScopes(['read'])
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(keyId) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    try {
      await apiKeys.revoke(keyId, userId)
      setKeys(keys.map(k => k.id === keyId ? { ...k, is_active: false } : k))
    } catch (err) {
      console.error('Error revoking key:', err)
    }
  }

  async function handleDelete(keyId) {
    if (!confirm('Are you sure you want to permanently delete this API key?')) {
      return
    }

    try {
      await apiKeys.delete(keyId, userId)
      setKeys(keys.filter(k => k.id !== keyId))
    } catch (err) {
      console.error('Error deleting key:', err)
    }
  }

  function copyToClipboard(text, keyId) {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyId)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // If user doesn't have API access, show upgrade prompt
  if (!hasApiAccess) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">API Access</h3>
            <p className="text-sm text-gray-400">Programmatic access to Vigil data</p>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h4 className="text-white font-medium mb-2">API Access Available on Team Plan</h4>
          <p className="text-gray-400 text-sm mb-4">
            Get programmatic access to threat actors, incidents, vulnerabilities, and IOCs.
          </p>
          <a
            href="/pricing"
            className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            Upgrade to Team
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">API Keys</h3>
          <p className="text-sm text-gray-400">Manage your API keys for programmatic access</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          Create API Key
        </button>
      </div>

      {/* Usage Stats */}
      {usageStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{usageStats.totalRequests.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Requests (30d)</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{usageStats.requestsToday.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Today</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{usageStats.avgResponseTime}ms</div>
            <div className="text-sm text-gray-400">Avg Response</div>
          </div>
        </div>
      )}

      {/* Keys List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto" />
        </div>
      ) : keys.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-gray-400 mb-4">No API keys yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Create your first API key
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`bg-gray-800/50 rounded-lg p-4 border ${
                key.is_active ? 'border-gray-700' : 'border-red-900/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{key.name}</span>
                    {!key.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <span className="font-mono">{key.key_prefix}</span>
                    <span>Scopes: {key.scopes?.join(', ')}</span>
                    {key.last_used_at && (
                      <span>Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {key.is_active && (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="px-3 py-1 text-sm text-yellow-400 hover:text-yellow-300"
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="px-3 py-1 text-sm text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-white mb-4">Create API Key</h3>

            {newKey ? (
              // Show the new key (only shown once)
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-400 font-medium">API Key Created</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Copy this key now. You won't be able to see it again.
                  </p>
                  <div className="bg-gray-800 rounded p-3 font-mono text-sm text-white break-all">
                    {newKey}
                  </div>
                  <button
                    onClick={() => copyToClipboard(newKey, 'new')}
                    className="mt-3 w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                  >
                    {copiedKey === 'new' ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setNewKey(null)
                    setShowCreateModal(false)
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              // Create form
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Key Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production, Testing"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Permissions</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('read')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, 'read'])
                          } else {
                            setNewKeyScopes(newKeyScopes.filter(s => s !== 'read'))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-white">Read</span>
                      <span className="text-sm text-gray-500">- Access to GET endpoints</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes('write')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, 'write'])
                          } else {
                            setNewKeyScopes(newKeyScopes.filter(s => s !== 'write'))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-white">Write</span>
                      <span className="text-sm text-gray-500">- Access to POST/PUT endpoints</span>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-sm">{error}</div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewKeyName('')
                      setError(null)
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
