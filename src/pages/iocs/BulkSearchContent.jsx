/**
 * Bulk Search Content - used within the unified IOCs page
 */
import { useState, useCallback } from 'react'
import { iocs, vulnerabilities } from '../../lib/supabase'
import { detectIOCType } from '../../lib/utils'
import { SkeletonList } from '../../components/Skeleton'
import { FeatureGate } from '../../components/UpgradePrompt'

const MAX_BULK_ITEMS = 1000

export default function BulkSearchContent() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 })
  const [error, setError] = useState(null)

  const parseInput = useCallback((text) => {
    const items = text
      .split(/[\n,;\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, MAX_BULK_ITEMS)

    return [...new Set(items)]
  }, [])

  const handleSearch = async () => {
    const items = parseInput(input)

    if (items.length === 0) {
      setError('Please enter at least one IOC to search')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])

    try {
      const searchResults = []

      const grouped = {
        cve: [],
        ioc: [],
      }

      items.forEach((item) => {
        const type = detectIOCType(item)
        if (type === 'cve') {
          grouped.cve.push(item)
        } else {
          grouped.ioc.push({ value: item, type })
        }
      })

      for (const cveId of grouped.cve) {
        const { data, error } = await vulnerabilities.search(cveId, 1)
        if (!error && data && data.length > 0) {
          searchResults.push({
            input: cveId,
            type: 'cve',
            found: true,
            data: data[0],
          })
        } else {
          searchResults.push({
            input: cveId,
            type: 'cve',
            found: false,
            data: null,
          })
        }
      }

      for (const item of grouped.ioc) {
        const { data, error } = await iocs.search(item.value, null)
        if (!error && data && data.length > 0) {
          searchResults.push({
            input: item.value,
            type: item.type,
            found: true,
            data: data[0],
          })
        } else {
          searchResults.push({
            input: item.value,
            type: item.type,
            found: false,
            data: null,
          })
        }
      }

      setResults(searchResults)
      setStats({
        total: searchResults.length,
        found: searchResults.filter((r) => r.found).length,
        notFound: searchResults.filter((r) => !r.found).length,
      })
    } catch (err) {
      console.error('Bulk search error:', err)
      setError('An error occurred during search. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = () => {
    const headers = ['Input', 'Type', 'Found', 'Source', 'First Seen', 'Last Seen', 'Details']
    const rows = results.map((r) => [
      r.input,
      r.type,
      r.found ? 'Yes' : 'No',
      r.data?.source || '',
      r.data?.first_seen || '',
      r.data?.last_seen || '',
      r.data?.malware_family || r.data?.description?.slice(0, 100) || '',
    ])

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk-search-results-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setInput(event.target?.result || '')
    }
    reader.readAsText(file)
  }

  return (
    <FeatureGate feature="bulk_search">
      <div className="space-y-6">
        {/* Input area */}
        <div className="cyber-card">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Paste indicators (one per line, or comma/space separated)
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="192.168.1.1&#10;CVE-2024-1234&#10;a1b2c3d4e5f6...&#10;malicious-domain.com"
                className="cyber-input w-full h-40 font-mono text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded hover:border-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Upload File
                </span>
              </label>

              <span className="text-sm text-gray-500">
                {parseInput(input).length} items (max {MAX_BULK_ITEMS})
              </span>

              <button
                onClick={handleSearch}
                disabled={loading || !input.trim()}
                className="ml-auto cyber-button-primary"
              >
                {loading ? 'Searching...' : 'Search All'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {(results.length > 0 || loading) && (
          <div className="cyber-card">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-2xl font-bold text-white">{stats.total}</span>
                  <span className="text-sm text-gray-400 ml-2">searched</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-green-400">{stats.found}</span>
                  <span className="text-sm text-gray-400 ml-2">found</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-gray-500">{stats.notFound}</span>
                  <span className="text-sm text-gray-400 ml-2">not found</span>
                </div>
              </div>

              {results.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 text-gray-300 border border-gray-700 rounded hover:border-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export CSV
                </button>
              )}
            </div>

            {loading ? (
              <SkeletonList items={5} />
            ) : (
              <div className="overflow-x-auto">
                <table className="cyber-table w-full">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Input</th>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} className={result.found ? '' : 'opacity-60'}>
                        <td>
                          {result.found ? (
                            <span className="badge-high">Found</span>
                          ) : (
                            <span className="badge-info">Not Found</span>
                          )}
                        </td>
                        <td>
                          <span className="font-mono text-sm break-all">{result.input}</span>
                        </td>
                        <td>
                          <span className="text-xs px-2 py-0.5 bg-gray-800 rounded">
                            {result.type}
                          </span>
                        </td>
                        <td className="text-sm text-gray-400">{result.data?.source || '-'}</td>
                        <td className="text-sm text-gray-400 max-w-xs truncate">
                          {result.data?.malware_family ||
                            result.data?.description?.slice(0, 50) ||
                            '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>Supported formats: IP addresses, SHA256/MD5 hashes, domains, URLs, CVE IDs</p>
          <p>Results can be exported to CSV for further analysis.</p>
        </div>
      </div>
    </FeatureGate>
  )
}
