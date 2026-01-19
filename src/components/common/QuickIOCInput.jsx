/**
 * QuickIOCInput Component
 *
 * Inline IOC lookup input for the header.
 * Auto-detects IOC type and shows results instantly.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { detectIOCType, IOC_TYPE_META } from '../../lib/iocDetection'
import { iocs } from '../../lib/supabase'

const RECENT_LOOKUPS_KEY = 'vigil_recent_ioc_lookups'
const MAX_RECENT = 5

// Status colors
const STATUS_COLORS = {
  malicious: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
  suspicious: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
  clean: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
  unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
}

export function QuickIOCInput({ className = '' }) {
  const [value, setValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [recentLookups, setRecentLookups] = useState([])
  const [detectedType, setDetectedType] = useState(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Load recent lookups
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_LOOKUPS_KEY)
      if (stored) {
        setRecentLookups(JSON.parse(stored))
      }
    } catch {
      setRecentLookups([])
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Detect IOC type as user types
  useEffect(() => {
    if (value.length >= 3) {
      const detected = detectIOCType(value)
      setDetectedType(detected)
    } else {
      setDetectedType(null)
    }
  }, [value])

  // Debounced lookup
  const performLookup = useCallback(async (searchValue) => {
    if (!searchValue || searchValue.length < 3) {
      setResult(null)
      return
    }

    setIsLoading(true)
    try {
      const detected = detectIOCType(searchValue)

      // Handle CVE separately
      if (detected.type === 'cve') {
        // Could fetch CVE details here
        setResult({
          ioc: searchValue,
          type: 'cve',
          status: 'unknown',
          message: 'View in Vulnerabilities',
          link: `/vulnerabilities?search=${encodeURIComponent(searchValue)}`,
        })
      } else {
        // Look up in IOC database
        const lookupResult = await iocs.quickLookup(searchValue)

        if (lookupResult.found) {
          const iocData = lookupResult.iocs?.[0]
          setResult({
            ioc: searchValue,
            type: detected.type,
            status: iocData?.malicious ? 'malicious' : 'suspicious',
            confidence: iocData?.confidence,
            actor: iocData?.threat_actor,
            firstSeen: iocData?.first_seen,
            lastSeen: iocData?.last_seen,
            sources: lookupResult.sources || [],
            link: `/iocs?search=${encodeURIComponent(searchValue)}`,
          })
        } else {
          setResult({
            ioc: searchValue,
            type: detected.type,
            status: 'unknown',
            message: 'Not found in threat intelligence',
            link: `/iocs?search=${encodeURIComponent(searchValue)}`,
          })
        }
      }

      // Save to recent lookups
      saveRecentLookup(searchValue, detected.type)
    } catch (error) {
      console.error('IOC lookup error:', error)
      setResult({
        ioc: searchValue,
        type: detectedType?.type || 'unknown',
        status: 'unknown',
        error: 'Lookup failed',
      })
    } finally {
      setIsLoading(false)
    }
  }, [detectedType])

  // Handle input change with debounce
  const handleChange = (e) => {
    const newValue = e.target.value
    setValue(newValue)
    setIsOpen(true)

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce lookup
    debounceRef.current = setTimeout(() => {
      performLookup(newValue)
    }, 300)
  }

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault()
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    performLookup(value)
  }

  // Save to recent lookups
  const saveRecentLookup = (ioc, type) => {
    try {
      const updated = [
        { ioc, type, timestamp: Date.now() },
        ...recentLookups.filter(r => r.ioc !== ioc),
      ].slice(0, MAX_RECENT)
      setRecentLookups(updated)
      localStorage.setItem(RECENT_LOOKUPS_KEY, JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }
  }

  // Handle recent item click
  const handleRecentClick = (recent) => {
    setValue(recent.ioc)
    performLookup(recent.ioc)
  }

  // Clear input
  const handleClear = () => {
    setValue('')
    setResult(null)
    setDetectedType(null)
    inputRef.current?.focus()
  }

  const statusColors = result ? STATUS_COLORS[result.status] : STATUS_COLORS.unknown

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          {/* Search icon or type indicator */}
          <div className="absolute left-3 flex items-center">
            {detectedType?.type && detectedType.type !== 'unknown' ? (
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${detectedType.meta?.bgColor} ${detectedType.meta?.color}`}>
                {detectedType.type.toUpperCase()}
              </span>
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            placeholder="Quick IOC check..."
            className={`
              w-full pl-${detectedType?.type && detectedType.type !== 'unknown' ? '16' : '10'} pr-8 py-1.5
              bg-gray-800/50 border border-gray-700 rounded-lg
              text-sm text-gray-300 placeholder-gray-500
              focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20
              transition-all
            `}
            aria-label="Quick IOC lookup"
            autoComplete="off"
          />

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 p-1 text-gray-500 hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && (value || recentLookups.length > 0) && (
        <div className="absolute top-full mt-2 left-0 right-0 min-w-[300px] bg-cyber-dark border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Loading state */}
          {isLoading && (
            <div className="px-4 py-6 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-gray-400 mt-2">Looking up...</p>
            </div>
          )}

          {/* Result */}
          {!isLoading && result && (
            <div className={`p-4 border-b border-gray-700 ${statusColors.bg}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-white truncate">{result.ioc}</span>
                    {result.type !== 'unknown' && (
                      <span className="text-xs text-gray-500">({result.type})</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className={`flex items-center gap-2 ${statusColors.text}`}>
                    {result.status === 'malicious' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    )}
                    <span className="text-sm font-medium uppercase">{result.status}</span>
                    {result.confidence && (
                      <span className="text-xs text-gray-500">({result.confidence}% confidence)</span>
                    )}
                  </div>

                  {/* Actor association */}
                  {result.actor && (
                    <div className="mt-2 text-sm text-gray-400">
                      Associated with: <span className="text-white">{result.actor.name || result.actor}</span>
                    </div>
                  )}

                  {/* Message */}
                  {result.message && (
                    <p className="text-sm text-gray-400 mt-1">{result.message}</p>
                  )}
                </div>
              </div>

              {/* View details link */}
              {result.link && (
                <Link
                  to={result.link}
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1 mt-3 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  View details
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          )}

          {/* Recent lookups */}
          {!isLoading && !result && recentLookups.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">Recent</div>
              {recentLookups.map((recent, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentClick(recent)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${IOC_TYPE_META[recent.type]?.bgColor || 'bg-gray-700'} ${IOC_TYPE_META[recent.type]?.color || 'text-gray-400'}`}>
                      {recent.type?.toUpperCase() || '?'}
                    </span>
                    <span className="text-sm text-gray-300 truncate">{recent.ioc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results state */}
          {!isLoading && value && !result && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-400">Type at least 3 characters to search</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default QuickIOCInput
