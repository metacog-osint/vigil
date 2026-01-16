/**
 * Investigation Sidebar Components (Desktop and Mobile)
 */
import { STATUSES, CATEGORIES } from '../../lib/investigations'
import InvestigationCard from './InvestigationCard.jsx'

export function InvestigationStats({ stats }) {
  if (!stats) return null

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <div className="bg-blue-500/10 rounded px-2 py-1 text-center">
        <div className="text-lg font-bold text-blue-400">{stats.open}</div>
        <div className="text-xs text-gray-500">Open</div>
      </div>
      <div className="bg-yellow-500/10 rounded px-2 py-1 text-center">
        <div className="text-lg font-bold text-yellow-400">{stats.in_progress}</div>
        <div className="text-xs text-gray-500">Active</div>
      </div>
      <div className="bg-green-500/10 rounded px-2 py-1 text-center">
        <div className="text-lg font-bold text-green-400">{stats.closed}</div>
        <div className="text-xs text-gray-500">Closed</div>
      </div>
      <div className="bg-gray-500/10 rounded px-2 py-1 text-center">
        <div className="text-lg font-bold text-gray-400">{stats.total}</div>
        <div className="text-xs text-gray-500">Total</div>
      </div>
    </div>
  )
}

export function InvestigationFilters({ filters, setFilters }) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Search investigations..."
        value={filters.search}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
      />
      <div className="flex gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All Status</option>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All Types</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function InvestigationList({ investigations, selectedId, onSelect, onShowCreate }) {
  if (investigations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No investigations yet</p>
        <button
          onClick={onShowCreate}
          className="mt-2 text-cyan-400 hover:text-cyan-300"
        >
          Create your first investigation
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {investigations.map(inv => (
        <InvestigationCard
          key={inv.id}
          investigation={inv}
          isSelected={selectedId === inv.id}
          onClick={() => onSelect(inv.id)}
        />
      ))}
    </div>
  )
}

export function MobileSidebar({
  show,
  onClose,
  investigations,
  selectedId,
  onSelect,
  stats,
  filters,
  setFilters,
}) {
  if (!show) return null

  return (
    <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose}>
      <div
        className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-r border-gray-800 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Investigations</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <InvestigationStats stats={stats} />
          <div className="mb-4">
            <InvestigationFilters filters={filters} setFilters={setFilters} />
          </div>
          <div className="space-y-2">
            {investigations.map(inv => (
              <InvestigationCard
                key={inv.id}
                investigation={inv}
                isSelected={selectedId === inv.id}
                onClick={() => {
                  onSelect(inv.id)
                  onClose()
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
