// Advanced Search - Query language powered search
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { supabase } from '../lib/supabase'
import {
  parseQuery,
  buildSupabaseQuery,
  validateQuery,
  getQuerySuggestions,
} from '../lib/queryParser'
import {
  SkeletonTable,
  EmptySearch,
  ErrorMessage,
  TimeAgo,
  SeverityBadge,
  ExportButton,
} from '../components'
import { FeatureGate } from '../components/UpgradePrompt'

const ENTITY_TYPES = [
  { value: 'actors', label: 'Threat Actors', table: 'threat_actors' },
  { value: 'incidents', label: 'Incidents', table: 'incidents' },
  { value: 'vulnerabilities', label: 'Vulnerabilities', table: 'vulnerabilities' },
  { value: 'iocs', label: 'IOCs', table: 'iocs' },
]

const EXAMPLE_QUERIES = [
  { query: 'trend:ESCALATING', description: 'Escalating threat actors' },
  { query: 'cvss:>=9.0 kev:true', description: 'Critical KEV vulnerabilities' },
  { query: 'type:ip confidence:high', description: 'High confidence IP IOCs' },
  { query: 'sector:healthcare', description: 'Healthcare sector incidents' },
  { query: 'source:malwarebazaar tag:ransomware', description: 'Ransomware IOCs' },
]

export default function AdvancedSearch() {
  const [query, setQuery] = useState('')
  const [entityType, setEntityType] = useState('actors')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 25

  // Validate query as user types
  const validation = useMemo(() => validateQuery(query), [query])

  // Get suggestions
  const suggestions = useMemo(() => {
    if (query.length < 2) return []
    return getQuerySuggestions(entityType, query)
  }, [query, entityType])

  const executeSearch = async (pageNum = 0) => {
    if (!query.trim()) {
      setResults([])
      setTotalCount(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const parsed = parseQuery(query)
      const config = ENTITY_TYPES.find((t) => t.value === entityType)

      let dbQuery = supabase
        .from(config.table)
        .select('*', { count: 'exact' })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)

      // Apply parsed conditions
      if (parsed) {
        dbQuery = buildSupabaseQuery(dbQuery, parsed)
      }

      // Default ordering
      if (entityType === 'vulnerabilities') {
        dbQuery = dbQuery.order('cvss_score', { ascending: false })
      } else if (entityType === 'incidents') {
        dbQuery = dbQuery.order('discovered_date', { ascending: false })
      } else if (entityType === 'actors') {
        dbQuery = dbQuery.order('last_seen', { ascending: false })
      } else {
        dbQuery = dbQuery.order('last_seen', { ascending: false })
      }

      const { data, count, error: queryError } = await dbQuery

      if (queryError) throw queryError

      setResults(data || [])
      setTotalCount(count || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    executeSearch(0)
  }

  const handleExampleClick = (exampleQuery) => {
    setQuery(exampleQuery)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <FeatureGate feature="advanced_search">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Advanced Search</h1>
          <p className="text-gray-400 mt-1">
            Use the query language to search across all threat data
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div className="flex gap-4">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyber-accent"
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="type:ip confidence:high first_seen:>2024-01-01"
                className={clsx(
                  'w-full bg-gray-800 border rounded px-4 py-2 text-white font-mono text-sm focus:outline-none',
                  validation.valid ? 'border-gray-700 focus:border-cyber-accent' : 'border-red-500'
                )}
              />
              {!validation.valid && validation.message && (
                <div className="absolute top-full mt-1 text-xs text-red-400">
                  {validation.message}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !validation.valid}
              className="px-6 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Query Examples */}
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-gray-500">Examples:</span>
            {EXAMPLE_QUERIES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExampleClick(ex.query)}
                className="text-cyber-accent hover:underline"
                title={ex.description}
              >
                {ex.query}
              </button>
            ))}
          </div>
        </form>

        {/* Query Syntax Help */}
        <details className="mb-6">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-white">
            Query syntax help
          </summary>
          <div className="mt-2 p-4 bg-gray-800/50 rounded text-sm text-gray-400 space-y-2">
            <p>
              <code className="text-cyber-accent">field:value</code> - Exact match
            </p>
            <p>
              <code className="text-cyber-accent">field:&gt;value</code> - Greater than
              (dates/numbers)
            </p>
            <p>
              <code className="text-cyber-accent">field:&gt;=value</code> - Greater than or equal
            </p>
            <p>
              <code className="text-cyber-accent">field:*value*</code> - Contains
            </p>
            <p>
              <code className="text-cyber-accent">AND / OR</code> - Boolean operators
            </p>
            <p>
              <code className="text-cyber-accent">NOT field:value</code> - Negation
            </p>
            <p className="pt-2 border-t border-gray-700">
              <strong>Fields:</strong> type, source, tags, confidence, cvss, severity, kev, sector,
              trend, country
            </p>
          </div>
        </details>

        {error && <ErrorMessage message={error} className="mb-4" />}

        {/* Results Header */}
        {results.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-400">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of{' '}
              {totalCount} results
            </div>
            <ExportButton
              data={results}
              entityType={entityType}
              filename={`vigil-search-${entityType}`}
            />
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : results.length === 0 && query ? (
          <EmptySearch query={query} />
        ) : (
          <div className="space-y-2">
            {results.map((item, i) => (
              <ResultCard key={item.id || i} item={item} entityType={entityType} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => executeSearch(page - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => executeSearch(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </FeatureGate>
  )
}

function ResultCard({ item, entityType }) {
  switch (entityType) {
    case 'actors':
      return (
        <div className="bg-cyber-card border border-gray-800 rounded-lg p-4 hover:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={`/actors?id=${item.id}`}
                className="font-medium text-white hover:text-cyber-accent"
              >
                {item.name}
              </Link>
              <div className="text-sm text-gray-400 mt-1">
                {item.target_sectors?.slice(0, 3).join(', ')}
              </div>
            </div>
            <div className="text-right text-sm">
              <div
                className={clsx(
                  'px-2 py-0.5 rounded text-xs',
                  item.trend_status === 'ESCALATING' && 'bg-red-500/20 text-red-400',
                  item.trend_status === 'STABLE' && 'bg-gray-500/20 text-gray-400',
                  item.trend_status === 'DECLINING' && 'bg-green-500/20 text-green-400'
                )}
              >
                {item.trend_status}
              </div>
              {item.last_seen && (
                <div className="text-gray-500 mt-1">
                  <TimeAgo date={item.last_seen} />
                </div>
              )}
            </div>
          </div>
        </div>
      )

    case 'vulnerabilities':
      return (
        <div className="bg-cyber-card border border-gray-800 rounded-lg p-4 hover:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono font-medium text-white">{item.cve_id}</span>
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.kev_date && (
                <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">KEV</span>
              )}
              <SeverityBadge severity={item.severity} score={item.cvss_score} />
            </div>
          </div>
        </div>
      )

    case 'iocs':
      return (
        <div className="bg-cyber-card border border-gray-800 rounded-lg p-4 hover:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="text-xs bg-gray-700 px-2 py-0.5 rounded mr-2">{item.type}</span>
              <span className="font-mono text-sm text-white break-all">{item.value}</span>
            </div>
            <div className="text-right text-sm text-gray-500 ml-4">
              <div>{item.source}</div>
              {item.last_seen && <TimeAgo date={item.last_seen} />}
            </div>
          </div>
        </div>
      )

    case 'incidents':
      return (
        <div className="bg-cyber-card border border-gray-800 rounded-lg p-4 hover:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-white">{item.victim_name || 'Unknown'}</span>
              <div className="text-sm text-gray-400 mt-1">
                {item.victim_sector} - {item.victim_country}
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              {item.discovered_date && <TimeAgo date={item.discovered_date} />}
            </div>
          </div>
        </div>
      )

    default:
      return null
  }
}
