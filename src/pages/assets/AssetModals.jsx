/**
 * Asset Modal Components
 */
import { useState, useEffect } from 'react'
import {
  ASSET_TYPES,
  CRITICALITY_OPTIONS,
  CATEGORY_OPTIONS,
  validateAssetValue,
  parseAssetsFromText,
} from '../../lib/assets'

export function AddAssetModal({ onClose, onSave }) {
  const [assetType, setAssetType] = useState('domain')
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [criticality, setCriticality] = useState('medium')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!validateAssetValue(assetType, value)) {
      setError(`Invalid ${ASSET_TYPES[assetType]?.label || assetType} format`)
      return
    }

    setSaving(true)
    try {
      await onSave({ assetType, value, name, criticality, category })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Asset</h3>
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Asset Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="cyber-input w-full"
            >
              {Object.entries(ASSET_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Value</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={ASSET_TYPES[assetType]?.placeholder || ''}
              className="cyber-input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friendly name for this asset"
              className="cyber-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Criticality</label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
                className="cyber-input w-full"
              >
                {CRITICALITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="cyber-input w-full"
              >
                <option value="">Select...</option>
                {CATEGORY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="cyber-button">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="cyber-button-primary">
              {saving ? 'Saving...' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BulkImportModal({ onClose, onSave }) {
  const [text, setText] = useState('')
  const [defaultType, setDefaultType] = useState('domain')
  const [criticality, setCriticality] = useState('medium')
  const [parsed, setParsed] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const items = parseAssetsFromText(text, defaultType)
    setParsed(items)
  }, [text, defaultType])

  async function handleSubmit(e) {
    e.preventDefault()
    if (parsed.length === 0) return

    setSaving(true)
    try {
      await onSave(parsed.map((p) => ({ assetType: p.type, value: p.value, criticality })))
    } catch (err) {
      alert('Import failed: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-lg">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Bulk Import Assets</h3>
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Paste assets (one per line, or comma/semicolon separated)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="example.com&#10;192.168.1.1&#10;company.com&#10;10.0.0.0/8"
              className="cyber-input w-full h-40 font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Default Type</label>
              <select
                value={defaultType}
                onChange={(e) => setDefaultType(e.target.value)}
                className="cyber-input w-full"
              >
                {Object.entries(ASSET_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Criticality</label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
                className="cyber-input w-full"
              >
                {CRITICALITY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {parsed.length > 0 && (
            <div className="text-sm text-gray-400">
              <span className="text-green-400 font-medium">{parsed.length}</span> valid assets
              detected
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="cyber-button">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || parsed.length === 0}
              className="cyber-button-primary"
            >
              {saving ? 'Importing...' : `Import ${parsed.length} Assets`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
