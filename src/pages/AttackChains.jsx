/**
 * Attack Chains Page
 *
 * Displays attack chains showing the full attack flow:
 * Actor → Techniques → CVEs → IOCs → Targets
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { correlations } from '../lib/supabase'
import { SkeletonTable, EmptyState } from '../components'

const CONFIDENCE_COLORS = {
  high: 'bg-green-900/50 text-green-400 border-green-700/50',
  medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  low: 'bg-gray-800 text-gray-400 border-gray-700',
}

function ConfidenceBadge({ confidence }) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${CONFIDENCE_COLORS[confidence] || CONFIDENCE_COLORS.low}`}>
      {confidence}
    </span>
  )
}

function ChainFlow({ chain }) {
  const steps = [
    { label: 'Actor', value: chain.actor_name, icon: '👤', color: 'text-red-400' },
    { label: 'Techniques', value: chain.techniques?.length || 0, icon: '⚔️', color: 'text-orange-400' },
    { label: 'CVEs', value: chain.vulnerabilities?.length || 0, icon: '🛡️', color: 'text-yellow-400' },
    { label: 'Malware', value: chain.malware_families?.length || 0, icon: '🦠', color: 'text-purple-400' },
    { label: 'Sectors', value: chain.target_sectors?.length || 0, icon: '🏢', color: 'text-blue-400' },
  ]

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-lg">{step.icon}</span>
            <span className={`text-sm font-medium ${step.color}`}>
              {typeof step.value === 'number' ? step.value : step.value || 'Unknown'}
            </span>
            <span className="text-xs text-gray-500">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <svg className="w-4 h-4 text-gray-600 mx-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}

function AttackChainCard({ chain, onSelect, isSelected }) {
  return (
    <div
      onClick={() => onSelect(chain)}
      className={`cyber-card cursor-pointer transition-colors ${
        isSelected ? 'border-cyber-accent/50' : 'hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{chain.name || `${chain.actor_name} Chain`}</h3>
          {chain.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{chain.description}</p>
          )}
        </div>
        <ConfidenceBadge confidence={chain.confidence} />
      </div>

      <ChainFlow chain={chain} />

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        {chain.source && <span>Source: {chain.source}</span>}
        {chain.last_seen && (
          <span>Last seen: {new Date(chain.last_seen).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  )
}

function ChainDetailPanel({ chain, onClose }) {
  if (!chain) return null

  return (
    <div className="w-96 cyber-card max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">{chain.name || 'Attack Chain'}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 text-sm">
        {/* Actor */}
        <div>
          <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
            <span>👤</span> Threat Actor
          </div>
          <Link
            to={`/actors?search=${encodeURIComponent(chain.actor_name || '')}`}
            className="text-red-400 hover:underline font-medium"
          >
            {chain.actor_name || 'Unknown'}
          </Link>
        </div>

        {/* Techniques */}
        {chain.techniques?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <span>⚔️</span> Techniques ({chain.techniques.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {chain.techniques.map((tech) => (
                <Link
                  key={tech}
                  to={`/techniques?search=${encodeURIComponent(tech)}`}
                  className="px-2 py-0.5 text-xs rounded bg-orange-900/50 text-orange-400 border border-orange-700/50 hover:bg-orange-900"
                >
                  {tech}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Vulnerabilities */}
        {chain.vulnerabilities?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <span>🛡️</span> Vulnerabilities ({chain.vulnerabilities.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {chain.vulnerabilities.map((cve) => (
                <Link
                  key={cve}
                  to={`/vulnerabilities?search=${encodeURIComponent(cve)}`}
                  className="px-2 py-0.5 text-xs rounded bg-yellow-900/50 text-yellow-400 border border-yellow-700/50 hover:bg-yellow-900 font-mono"
                >
                  {cve}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Malware Families */}
        {chain.malware_families?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <span>🦠</span> Malware Families ({chain.malware_families.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {chain.malware_families.map((malware) => (
                <span
                  key={malware}
                  className="px-2 py-0.5 text-xs rounded bg-purple-900/50 text-purple-400 border border-purple-700/50"
                >
                  {malware}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Target Sectors */}
        {chain.target_sectors?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <span>🏢</span> Target Sectors ({chain.target_sectors.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {chain.target_sectors.map((sector) => (
                <span
                  key={sector}
                  className="px-2 py-0.5 text-xs rounded bg-blue-900/50 text-blue-400 border border-blue-700/50"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Target Countries */}
        {chain.target_countries?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <span>🌍</span> Target Countries ({chain.target_countries.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {chain.target_countries.map((country) => (
                <span
                  key={country}
                  className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300"
                >
                  {country}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* IOC Types */}
        {chain.ioc_types?.length > 0 && (
          <div>
            <div className="text-gray-500 text-xs mb-1 flex items-center gap-1">
              <span>🔍</span> IOC Types
            </div>
            <div className="flex flex-wrap gap-1">
              {chain.ioc_types.map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 text-xs rounded bg-cyan-900/50 text-cyan-400 border border-cyan-700/50"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {chain.description && (
          <div>
            <div className="text-gray-500 text-xs mb-1">Description</div>
            <p className="text-gray-300 text-xs">{chain.description}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-3 border-t border-gray-800 space-y-2 text-xs text-gray-500">
          {chain.source && <div>Source: {chain.source}</div>}
          {chain.source_url && (
            <a
              href={chain.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyber-accent hover:underline block"
            >
              View Source Report →
            </a>
          )}
          {chain.first_seen && (
            <div>First seen: {new Date(chain.first_seen).toLocaleDateString()}</div>
          )}
          {chain.last_seen && (
            <div>Last seen: {new Date(chain.last_seen).toLocaleDateString()}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AttackChains() {
  const [chains, setChains] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedChain, setSelectedChain] = useState(null)
  const [filters, setFilters] = useState({
    sector: '',
    confidence: '',
    search: '',
  })

  useEffect(() => {
    loadChains()
  }, [filters.sector, filters.confidence])

  async function loadChains() {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await correlations.getAttackChains({
        sector: filters.sector || undefined,
        confidence: filters.confidence || undefined,
        limit: 100,
      })

      if (fetchError) throw fetchError

      setChains(data || [])
    } catch (err) {
      console.error('Error loading attack chains:', err)
      setError('Failed to load attack chains')
    } finally {
      setLoading(false)
    }
  }

  // Filter by search
  const filteredChains = chains.filter((chain) => {
    if (!filters.search) return true
    const searchLower = filters.search.toLowerCase()
    return (
      chain.name?.toLowerCase().includes(searchLower) ||
      chain.actor_name?.toLowerCase().includes(searchLower) ||
      chain.techniques?.some((t) => t.toLowerCase().includes(searchLower)) ||
      chain.vulnerabilities?.some((v) => v.toLowerCase().includes(searchLower))
    )
  })

  // Get unique sectors for filter
  const allSectors = [...new Set(chains.flatMap((c) => c.target_sectors || []))].sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Attack Chains</h1>
        <p className="text-gray-400 text-sm mt-1">
          Documented attack flows showing full TTPs, CVEs, and IOCs
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search chains, actors, techniques..."
          className="cyber-input w-64"
        />

        <select
          value={filters.sector}
          onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
          className="cyber-input"
        >
          <option value="">All Sectors</option>
          {allSectors.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>

        <select
          value={filters.confidence}
          onChange={(e) => setFilters((f) => ({ ...f, confidence: e.target.value }))}
          className="cyber-input"
        >
          <option value="">All Confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cyber-card">
          <div className="text-2xl font-bold text-white">{chains.length}</div>
          <div className="text-sm text-gray-400">Total Chains</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-green-400">
            {chains.filter((c) => c.confidence === 'high').length}
          </div>
          <div className="text-sm text-gray-400">High Confidence</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-purple-400">
            {[...new Set(chains.map((c) => c.actor_name))].length}
          </div>
          <div className="text-sm text-gray-400">Unique Actors</div>
        </div>
        <div className="cyber-card">
          <div className="text-2xl font-bold text-orange-400">
            {[...new Set(chains.flatMap((c) => c.techniques || []))].length}
          </div>
          <div className="text-sm text-gray-400">Unique Techniques</div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="cyber-card animate-pulse">
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-2/3 mb-4" />
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-12 w-12 bg-gray-800 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="cyber-card text-center py-12">
          <div className="text-red-400 mb-2">{error}</div>
          <button
            onClick={loadChains}
            className="text-cyber-accent hover:underline text-sm"
          >
            Try Again
          </button>
        </div>
      ) : filteredChains.length === 0 ? (
        <div className="cyber-card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-gray-400 font-medium">No attack chains found</h3>
          <p className="text-gray-500 text-sm mt-1">
            {filters.search || filters.sector || filters.confidence
              ? 'Try adjusting your filters'
              : 'Attack chains will appear here when data is available'}
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            {filteredChains.map((chain) => (
              <AttackChainCard
                key={chain.id}
                chain={chain}
                onSelect={setSelectedChain}
                isSelected={selectedChain?.id === chain.id}
              />
            ))}
          </div>

          {selectedChain && (
            <ChainDetailPanel
              chain={selectedChain}
              onClose={() => setSelectedChain(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
