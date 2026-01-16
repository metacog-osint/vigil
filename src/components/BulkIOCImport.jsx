/**
 * BulkIOCImport Component
 * UI for importing multiple IOCs from text or file
 */

import { useState, useCallback } from 'react'
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  TrashIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { importIOCs } from '../lib/iocImport'

// IOC type patterns for auto-detection
const IOC_PATTERNS = {
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/,
  domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
  url: /^https?:\/\/[^\s]+$/i,
  md5: /^[a-fA-F0-9]{32}$/,
  sha1: /^[a-fA-F0-9]{40}$/,
  sha256: /^[a-fA-F0-9]{64}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
}

// Detect IOC type
function detectIOCType(value) {
  value = value.trim()

  if (IOC_PATTERNS.ipv4.test(value)) return 'ip'
  if (IOC_PATTERNS.ipv6.test(value)) return 'ipv6'
  if (IOC_PATTERNS.url.test(value)) return 'url'
  if (IOC_PATTERNS.email.test(value)) return 'email'
  if (IOC_PATTERNS.sha256.test(value)) return 'sha256'
  if (IOC_PATTERNS.sha1.test(value)) return 'sha1'
  if (IOC_PATTERNS.md5.test(value)) return 'md5'
  if (IOC_PATTERNS.domain.test(value)) return 'domain'

  return null
}

// Parse input text into IOC objects
function parseIOCInput(text) {
  const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)
  const iocs = []
  const errors = []

  for (const line of lines) {
    // Skip comments
    if (line.startsWith('#') || line.startsWith('//')) continue

    // Try to parse as value or value|type
    let value = line
    let explicitType = null

    if (line.includes('|')) {
      const parts = line.split('|')
      value = parts[0].trim()
      explicitType = parts[1]?.trim().toLowerCase()
    }

    // Defang common patterns
    value = value
      .replace(/\[.\]/g, '.')  // example[.]com
      .replace(/hxxp/gi, 'http')  // hxxp://
      .replace(/\s+/g, '')  // Remove whitespace

    // Detect type
    const detectedType = explicitType || detectIOCType(value)

    if (detectedType) {
      iocs.push({
        value,
        type: detectedType,
        original: line,
      })
    } else {
      errors.push({
        value: line,
        error: 'Unable to detect IOC type',
      })
    }
  }

  return { iocs, errors }
}

// Preview Row Component
function PreviewRow({ ioc, onRemove, onTypeChange }) {
  const typeColors = {
    ip: 'bg-cyan-500/20 text-cyan-400',
    ipv6: 'bg-cyan-500/20 text-cyan-400',
    domain: 'bg-green-500/20 text-green-400',
    url: 'bg-blue-500/20 text-blue-400',
    md5: 'bg-purple-500/20 text-purple-400',
    sha1: 'bg-purple-500/20 text-purple-400',
    sha256: 'bg-purple-500/20 text-purple-400',
    email: 'bg-pink-500/20 text-pink-400',
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded group">
      <select
        value={ioc.type}
        onChange={(e) => onTypeChange(ioc.value, e.target.value)}
        className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[ioc.type] || 'bg-gray-700 text-gray-300'}`}
      >
        <option value="ip">IP</option>
        <option value="ipv6">IPv6</option>
        <option value="domain">Domain</option>
        <option value="url">URL</option>
        <option value="md5">MD5</option>
        <option value="sha1">SHA1</option>
        <option value="sha256">SHA256</option>
        <option value="email">Email</option>
      </select>

      <span className="flex-1 text-sm text-gray-300 font-mono truncate">
        {ioc.value}
      </span>

      <button
        onClick={() => onRemove(ioc.value)}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

// Error Row Component
function ErrorRow({ error }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
      <XCircleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="flex-1 text-sm text-gray-400 font-mono truncate">
        {error.value}
      </span>
      <span className="text-xs text-red-400">
        {error.error}
      </span>
    </div>
  )
}

// Import Result Component
function ImportResult({ result }) {
  if (!result) return null

  const hasSuccess = result.imported > 0
  const hasErrors = result.errors?.length > 0

  return (
    <div className={`p-4 rounded-lg border ${
      hasErrors ? 'bg-yellow-500/10 border-yellow-500/30' :
      hasSuccess ? 'bg-green-500/10 border-green-500/30' :
      'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {hasSuccess ? (
          <>
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <span className="font-medium text-green-400">Import Complete</span>
          </>
        ) : (
          <>
            <ExclamationCircleIcon className="w-5 h-5 text-red-400" />
            <span className="font-medium text-red-400">Import Failed</span>
          </>
        )}
      </div>

      <div className="text-sm text-gray-300 space-y-1">
        <div>Imported: {result.imported}</div>
        <div>Duplicates: {result.duplicates}</div>
        {hasErrors && <div>Errors: {result.errors.length}</div>}
      </div>

      {hasErrors && result.errors.length <= 5 && (
        <div className="mt-3 space-y-1">
          {result.errors.map((err, i) => (
            <div key={i} className="text-xs text-red-400">
              {err.value}: {err.error}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Main BulkIOCImport Component
export default function BulkIOCImport({
  onImportComplete,
  onClose,
  defaultSource = 'manual',
  defaultConfidence = 70,
  defaultTags = [],
}) {
  const [inputText, setInputText] = useState('')
  const [parsedIOCs, setParsedIOCs] = useState([])
  const [parseErrors, setParseErrors] = useState([])
  const [source, setSource] = useState(defaultSource)
  const [confidence, setConfidence] = useState(defaultConfidence)
  const [tags, setTags] = useState(defaultTags.join(', '))
  const [enableEnrichment, setEnableEnrichment] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [step, setStep] = useState('input') // input, preview, complete

  // Parse input
  const handleParse = useCallback(() => {
    const { iocs, errors } = parseIOCInput(inputText)
    setParsedIOCs(iocs)
    setParseErrors(errors)
    if (iocs.length > 0) {
      setStep('preview')
    }
  }, [inputText])

  // Handle file upload
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setInputText(event.target.result)
    }
    reader.readAsText(file)
  }, [])

  // Handle paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInputText(prev => prev + (prev ? '\n' : '') + text)
    } catch (err) {
      console.error('Failed to read clipboard:', err)
    }
  }, [])

  // Remove IOC from preview
  const handleRemoveIOC = useCallback((value) => {
    setParsedIOCs(prev => prev.filter(ioc => ioc.value !== value))
  }, [])

  // Change IOC type
  const handleTypeChange = useCallback((value, newType) => {
    setParsedIOCs(prev => prev.map(ioc =>
      ioc.value === value ? { ...ioc, type: newType } : ioc
    ))
  }, [])

  // Perform import
  const handleImport = useCallback(async () => {
    setImporting(true)
    setImportResult(null)

    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)

      const iocsToImport = parsedIOCs.map(ioc => ({
        value: ioc.value,
        type: ioc.type,
        source,
        confidence,
        tags: tagArray,
      }))

      const result = await importIOCs(iocsToImport, {
        autoEnrich: enableEnrichment,
      })

      setImportResult(result)
      setStep('complete')
      onImportComplete?.(result)
    } catch (error) {
      setImportResult({
        imported: 0,
        duplicates: 0,
        errors: [{ value: 'Import failed', error: error.message }],
      })
    } finally {
      setImporting(false)
    }
  }, [parsedIOCs, source, confidence, tags, enableEnrichment, onImportComplete])

  // Reset and start over
  const handleReset = useCallback(() => {
    setInputText('')
    setParsedIOCs([])
    setParseErrors([])
    setImportResult(null)
    setStep('input')
  }, [])

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <CloudArrowUpIcon className="w-6 h-6 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Bulk IOC Import</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">
                  Paste IOCs (one per line, or comma/semicolon separated)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handlePaste}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    <ClipboardDocumentIcon className="w-3 h-3" />
                    Paste
                  </button>
                  <label className="flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer">
                    <DocumentTextIcon className="w-3 h-3" />
                    Upload File
                    <input
                      type="file"
                      accept=".txt,.csv,.ioc"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`192.168.1.1
example.com
hxxp://malicious[.]site/payload
d41d8cd98f00b204e9800998ecf8427e|md5
# Comments are ignored`}
                className="cyber-input w-full h-48 font-mono text-sm"
              />
            </div>

            <p className="text-xs text-gray-500">
              Supports: IP addresses, domains, URLs, MD5/SHA1/SHA256 hashes, email addresses.
              Use <code className="text-cyan-400">value|type</code> format to specify type explicitly.
              Defanged IOCs are automatically converted.
            </p>

            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="w-full cyber-button-primary"
            >
              Parse & Preview
            </button>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <>
            {/* Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400">Source</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="cyber-input w-full mt-1"
                  placeholder="e.g., internal, osint"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Confidence (%)</label>
                <input
                  type="number"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value) || 0)}
                  className="cyber-input w-full mt-1"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="cyber-input w-full mt-1"
                  placeholder="tag1, tag2"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enableEnrichment}
                onChange={(e) => setEnableEnrichment(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600 text-cyan-500"
              />
              <SparklesIcon className="w-4 h-4 text-purple-400" />
              <span className="text-gray-300">Auto-enrich IOCs after import</span>
            </label>

            {/* Preview list */}
            <div className="space-y-2">
              <div className="text-sm text-gray-400">
                {parsedIOCs.length} IOCs ready to import
              </div>

              <div className="max-h-64 overflow-auto space-y-1">
                {parsedIOCs.map((ioc) => (
                  <PreviewRow
                    key={ioc.value}
                    ioc={ioc}
                    onRemove={handleRemoveIOC}
                    onTypeChange={handleTypeChange}
                  />
                ))}
              </div>
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm text-red-400">
                  {parseErrors.length} entries could not be parsed
                </div>
                <div className="max-h-32 overflow-auto space-y-1">
                  {parseErrors.map((error, i) => (
                    <ErrorRow key={i} error={error} />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setStep('input')}
                className="cyber-button"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || parsedIOCs.length === 0}
                className="flex-1 cyber-button-primary"
              >
                {importing ? 'Importing...' : `Import ${parsedIOCs.length} IOCs`}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <>
            <ImportResult result={importResult} />

            <div className="flex gap-2">
              <button onClick={handleReset} className="flex-1 cyber-button">
                Import More
              </button>
              {onClose && (
                <button onClick={onClose} className="flex-1 cyber-button-primary">
                  Done
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export { parseIOCInput, detectIOCType, IOC_PATTERNS }
