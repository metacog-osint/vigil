/**
 * Custom IOC Modal Components
 */
import { useState, useEffect, useRef } from 'react'
import {
  IOC_TYPES,
  THREAT_TYPES,
  parseIocsFromText,
  parseIocsFromCsv,
  detectIocType,
} from '../../lib/customIocs'
import { parseIOCFile } from '../../lib/iocImport'

export function CreateListModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await onSave({ name, description, source })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Create New List</h3>
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
            <label className="block text-sm font-medium text-gray-400 mb-1">List Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Internal Blocklist"
              className="cyber-input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="cyber-input w-full h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., Internal, Vendor name, OSINT"
              className="cyber-input w-full"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="cyber-button">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name} className="cyber-button-primary">
              {saving ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddIocModal({ onClose, onSave }) {
  const [value, setValue] = useState('')
  const [iocType, setIocType] = useState('')
  const [threatType, setThreatType] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [confidence, setConfidence] = useState(50)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (value && !iocType) {
      const detected = detectIocType(value)
      setIocType(detected)
    }
  }, [value])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      value,
      iocType: iocType || 'other',
      threatType,
      severity,
      confidence,
      description,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add IOC</h3>
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
            <label className="block text-sm font-medium text-gray-400 mb-1">Value *</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="IP, domain, hash, URL..."
              className="cyber-input w-full font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
              <select
                value={iocType}
                onChange={(e) => setIocType(e.target.value)}
                className="cyber-input w-full"
              >
                <option value="">Auto-detect</option>
                {Object.entries(IOC_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Threat Type</label>
              <select
                value={threatType}
                onChange={(e) => setThreatType(e.target.value)}
                className="cyber-input w-full"
              >
                <option value="">Select...</option>
                {THREAT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="cyber-input w-full"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Confidence: {confidence}%
              </label>
              <input
                type="range"
                value={confidence}
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                min="0"
                max="100"
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes..."
              className="cyber-input w-full h-16"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="cyber-button">
              Cancel
            </button>
            <button type="submit" disabled={saving || !value} className="cyber-button-primary">
              {saving ? 'Adding...' : 'Add IOC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ImportModal({ onClose, onImport }) {
  const [mode, setMode] = useState('paste') // paste | file
  const [format, setFormat] = useState('text')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState([])
  const [importing, setImporting] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [parseError, setParseError] = useState(null)
  const fileInputRef = useRef(null)

  // Parse text input
  useEffect(() => {
    if (mode !== 'paste' || !text) {
      if (mode === 'paste') setParsed([])
      return
    }

    setParseError(null)
    try {
      if (format === 'csv') {
        setParsed(parseIocsFromCsv(text))
      } else if (format === 'stix' || format === 'misp') {
        const result = parseIOCFile(text, format === 'stix' ? 'bundle.json' : 'event.json')
        setParsed(
          result.iocs.map((ioc) => ({
            value: ioc.value,
            iocType: ioc.type,
            threatType: ioc.category || '',
            description: ioc.description || ioc.comment || '',
            confidence: ioc.confidence || 70,
          }))
        )
      } else {
        setParsed(parseIocsFromText(text))
      }
    } catch (err) {
      setParseError(err.message)
      setParsed([])
    }
  }, [text, format, mode])

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return

    setFileInfo({ name: file.name, size: file.size })
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      try {
        const result = parseIOCFile(content, file.name)
        setParsed(
          result.iocs.map((ioc) => ({
            value: ioc.value,
            iocType: ioc.type,
            threatType: ioc.category || '',
            description: ioc.description || ioc.comment || '',
            confidence: ioc.confidence || 70,
          }))
        )
        setFileInfo((prev) => ({ ...prev, format: result.format, metadata: result.metadata }))
      } catch (err) {
        setParseError(err.message)
        setParsed([])
      }
    }
    reader.onerror = () => {
      setParseError('Failed to read file')
    }
    reader.readAsText(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (parsed.length === 0) return
    setImporting(true)
    await onImport(parsed)
    setImporting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-lg">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Import IOCs</h3>
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
          {/* Mode Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setMode('paste')
                setParsed([])
                setFileInfo(null)
                setParseError(null)
              }}
              className={`flex-1 py-1.5 text-sm rounded ${mode === 'paste' ? 'bg-cyber-accent text-black' : 'text-gray-400'}`}
            >
              Paste Text
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('file')
                setParsed([])
                setText('')
                setParseError(null)
              }}
              className={`flex-1 py-1.5 text-sm rounded ${mode === 'file' ? 'bg-cyber-accent text-black' : 'text-gray-400'}`}
            >
              Upload File
            </button>
          </div>

          {mode === 'paste' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="cyber-input w-full"
                >
                  <option value="text">Plain Text (one per line)</option>
                  <option value="csv">CSV</option>
                  <option value="stix">STIX 2.1 JSON</option>
                  <option value="misp">MISP JSON</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Paste IOCs</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    format === 'csv'
                      ? 'value,type,threat_type,description\n192.168.1.1,ip,c2,Command and control'
                      : format === 'stix'
                        ? '{"type": "bundle", "objects": [...]}'
                        : format === 'misp'
                          ? '{"Event": {"Attribute": [...]}}'
                          : '192.168.1.1\nevil.com\n5d41402abc4b2a76b9719d911017c592'
                  }
                  className="cyber-input w-full h-48 font-mono text-sm"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Upload STIX, MISP, or OpenIOC File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.xml,.stix,.misp,.ioc"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-gray-600 transition-colors"
              >
                {fileInfo ? (
                  <div>
                    <svg
                      className="w-8 h-8 text-green-400 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-white font-medium">{fileInfo.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(fileInfo.size / 1024).toFixed(1)} KB
                      {fileInfo.format && ` • ${fileInfo.format.toUpperCase()}`}
                    </div>
                  </div>
                ) : (
                  <div>
                    <svg
                      className="w-8 h-8 text-gray-500 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <div className="text-gray-400">Click to upload or drag and drop</div>
                    <div className="text-xs text-gray-500 mt-1">
                      STIX 2.1, MISP JSON, OpenIOC XML
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {parseError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm text-red-400">
              {parseError}
            </div>
          )}

          {parsed.length > 0 && (
            <div className="text-sm bg-gray-800/50 rounded p-3">
              <span className="text-green-400 font-medium">{parsed.length}</span>
              <span className="text-gray-400"> IOCs detected</span>
              <div className="mt-2 text-xs text-gray-500">
                Types:{' '}
                {Object.entries(
                  parsed.reduce((acc, p) => {
                    acc[p.iocType] = (acc[p.iocType] || 0) + 1
                    return acc
                  }, {})
                )
                  .map(([type, count]) => `${type}: ${count}`)
                  .join(', ')}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="cyber-button">
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing || parsed.length === 0}
              className="cyber-button-primary"
            >
              {importing ? 'Importing...' : `Import ${parsed.length} IOCs`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ExportModal({ onClose, onExport, count }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-sm">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Export IOCs</h3>
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

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-400 mb-4">
            Export {count} IOCs in your preferred format:
          </p>

          <button onClick={() => onExport('csv')} className="w-full cyber-button text-left">
            <div className="font-medium">CSV</div>
            <div className="text-xs text-gray-500">Comma-separated values for spreadsheets</div>
          </button>

          <button onClick={() => onExport('stix')} className="w-full cyber-button text-left">
            <div className="font-medium">STIX 2.1</div>
            <div className="text-xs text-gray-500">Standard threat intelligence format</div>
          </button>

          <button onClick={() => onExport('text')} className="w-full cyber-button text-left">
            <div className="font-medium">Plain Text</div>
            <div className="text-xs text-gray-500">One IOC per line</div>
          </button>
        </div>
      </div>
    </div>
  )
}
