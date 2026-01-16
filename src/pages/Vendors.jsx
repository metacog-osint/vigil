import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  vendors,
  vendorEvents,
  VENDOR_CATEGORIES,
  CRITICALITY_LEVELS,
  RISK_LEVELS,
  DATA_TYPES,
  EVENT_TYPES,
  getRiskColor,
} from '../lib/vendors'
import { canAccess } from '../lib/features'
import { SmartTime } from '../components/TimeDisplay'

const RISK_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const RISK_TEXT_COLORS = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
}

export default function Vendors() {
  const { user, profile } = useAuth()
  const [vendorList, setVendorList] = useState([])
  const [openEvents, setOpenEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [view, setView] = useState('grid') // grid | list | risks
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState({ risk: '', category: '' })

  const hasAccess = canAccess(profile?.tier, 'attack_surface')

  useEffect(() => {
    if (user?.uid && hasAccess) {
      loadData()
    }
  }, [user?.uid, hasAccess])

  async function loadData() {
    setLoading(true)
    try {
      const [vendorData, eventsData, summaryData] = await Promise.all([
        vendors.getAll(user.uid),
        vendorEvents.getOpen(user.uid),
        vendors.getRiskSummary(user.uid),
      ])
      setVendorList(vendorData)
      setOpenEvents(eventsData)
      setSummary(summaryData)
    } catch (err) {
      console.error('Failed to load vendors:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(data) {
    try {
      const newVendor = await vendors.create(user.uid, data)
      setVendorList(prev => [newVendor, ...prev])
      setShowCreate(false)
    } catch (err) {
      alert('Failed to create vendor: ' + err.message)
    }
  }

  async function handleDelete(vendorId) {
    if (!confirm('Remove this vendor from monitoring?')) return
    try {
      await vendors.delete(vendorId)
      setVendorList(prev => prev.filter(v => v.id !== vendorId))
      if (selectedVendor?.id === vendorId) setSelectedVendor(null)
    } catch (err) {
      alert('Failed to delete vendor: ' + err.message)
    }
  }

  const filteredVendors = vendorList.filter(v => {
    if (filter.risk && v.risk_level !== filter.risk) return false
    if (filter.category && v.category !== filter.category) return false
    return true
  })

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Professional Feature</h2>
          <p className="text-gray-400 mb-4">Vendor Risk Monitoring is available on Professional and above.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendor Risk</h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitor third-party vendors for security issues
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="cyber-button-primary">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Vendor
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-white">{summary.total}</div>
            <div className="text-gray-400 text-sm">Total Vendors</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-red-400">{summary.byRiskLevel.critical}</div>
            <div className="text-gray-400 text-sm">Critical Risk</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-orange-400">{summary.byRiskLevel.high}</div>
            <div className="text-gray-400 text-sm">High Risk</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-yellow-400">{openEvents.length}</div>
            <div className="text-gray-400 text-sm">Open Events</div>
          </div>
          <div className="cyber-card p-4">
            <div className="text-2xl font-bold text-cyber-accent">{summary.avgRiskScore}</div>
            <div className="text-gray-400 text-sm">Avg Risk Score</div>
          </div>
        </div>
      )}

      {/* Filters & View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filter.risk}
            onChange={(e) => setFilter(prev => ({ ...prev, risk: e.target.value }))}
            className="cyber-input text-sm"
          >
            <option value="">All Risk Levels</option>
            {Object.entries(RISK_LEVELS).map(([key, level]) => (
              <option key={key} value={key}>{level.label}</option>
            ))}
          </select>
          <select
            value={filter.category}
            onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
            className="cyber-input text-sm"
          >
            <option value="">All Categories</option>
            {Object.entries(VENDOR_CATEGORIES).map(([key, cat]) => (
              <option key={key} value={key}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 text-sm rounded ${view === 'grid' ? 'bg-cyber-accent text-black' : 'text-gray-400'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm rounded ${view === 'list' ? 'bg-cyber-accent text-black' : 'text-gray-400'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('risks')}
            className={`px-3 py-1.5 text-sm rounded ${view === 'risks' ? 'bg-cyber-accent text-black' : 'text-gray-400'}`}
          >
            Risks
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading vendors...</div>
      ) : view === 'risks' ? (
        /* Risk Events View */
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Open Risk Events</h2>
          {openEvents.length === 0 ? (
            <div className="cyber-card p-6 text-center text-gray-500">
              No open risk events
            </div>
          ) : (
            <div className="space-y-2">
              {openEvents.map(event => (
                <RiskEventRow key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      ) : view === 'grid' ? (
        /* Grid View */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map(vendor => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onClick={() => setSelectedVendor(vendor)}
            />
          ))}
          {filteredVendors.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-8">
              No vendors match the filters
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div className="cyber-card overflow-hidden">
          <table className="cyber-table w-full">
            <thead>
              <tr>
                <th className="text-left">Vendor</th>
                <th className="text-left">Category</th>
                <th className="text-left">Criticality</th>
                <th className="text-left">Risk Score</th>
                <th className="text-left">Open Events</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map(vendor => (
                <tr
                  key={vendor.id}
                  onClick={() => setSelectedVendor(vendor)}
                  className="cursor-pointer hover:bg-gray-800/50"
                >
                  <td>
                    <div className="font-medium text-white">{vendor.name}</div>
                    {vendor.domain && <div className="text-xs text-gray-500">{vendor.domain}</div>}
                  </td>
                  <td className="text-gray-400 text-sm">
                    {VENDOR_CATEGORIES[vendor.category]?.label || vendor.category}
                  </td>
                  <td>
                    <span className={`text-sm ${RISK_TEXT_COLORS[vendor.criticality]}`}>
                      {CRITICALITY_LEVELS[vendor.criticality]?.label}
                    </span>
                  </td>
                  <td>
                    <RiskScoreBadge score={vendor.risk_score} level={vendor.risk_level} />
                  </td>
                  <td className="text-gray-400">-</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      vendor.is_monitored ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {vendor.is_monitored ? 'Monitored' : 'Not Monitored'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onUpdate={(updated) => {
            setVendorList(prev => prev.map(v => v.id === updated.id ? updated : v))
            setSelectedVendor(updated)
          }}
          onDelete={() => handleDelete(selectedVendor.id)}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateVendorModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

/**
 * Vendor Card
 */
function VendorCard({ vendor, onClick }) {
  return (
    <div onClick={onClick} className="cyber-card p-4 cursor-pointer hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-white">{vendor.name}</h3>
          {vendor.domain && <div className="text-xs text-gray-500">{vendor.domain}</div>}
        </div>
        <RiskScoreBadge score={vendor.risk_score} level={vendor.risk_level} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
          {VENDOR_CATEGORIES[vendor.category]?.label || vendor.category}
        </span>
        <span className={`text-xs ${RISK_TEXT_COLORS[vendor.criticality]}`}>
          {CRITICALITY_LEVELS[vendor.criticality]?.label}
        </span>
      </div>

      {vendor.data_types?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {vendor.data_types.slice(0, 3).map(dt => (
            <span key={dt} className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
              {DATA_TYPES.find(d => d.value === dt)?.label || dt}
            </span>
          ))}
          {vendor.data_types.length > 3 && (
            <span className="text-xs text-gray-500">+{vendor.data_types.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className={vendor.is_monitored ? 'text-green-400' : ''}>
          {vendor.is_monitored ? 'Monitored' : 'Not monitored'}
        </span>
      </div>
    </div>
  )
}

/**
 * Risk Score Badge
 */
function RiskScoreBadge({ score, level }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${RISK_COLORS[level]}`} />
      <span className={`text-sm font-medium ${RISK_TEXT_COLORS[level]}`}>{score}</span>
    </div>
  )
}

/**
 * Risk Event Row
 */
function RiskEventRow({ event }) {
  const eventType = EVENT_TYPES[event.event_type] || { label: event.event_type, color: 'gray' }

  return (
    <div className="cyber-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className={`px-2 py-0.5 rounded text-xs bg-${eventType.color}-500/20 text-${eventType.color}-400`}>
          {eventType.label}
        </span>
        <div>
          <div className="text-white">{event.title}</div>
          <div className="text-sm text-gray-500">
            {event.vendor?.name} • <SmartTime date={event.event_date} />
          </div>
        </div>
      </div>
      <span className={`px-2 py-0.5 rounded text-xs ${RISK_COLORS[event.severity].replace('bg-', 'bg-') + '/20'} ${RISK_TEXT_COLORS[event.severity]}`}>
        {event.severity}
      </span>
    </div>
  )
}

/**
 * Vendor Detail Modal
 */
function VendorDetailModal({ vendor, onClose, onUpdate, onDelete }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [vendor.id])

  async function loadEvents() {
    setLoading(true)
    try {
      const data = await vendorEvents.getForVendor(vendor.id, 20)
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{vendor.name}</h3>
            {vendor.domain && <div className="text-sm text-gray-500">{vendor.domain}</div>}
          </div>
          <div className="flex items-center gap-2">
            <RiskScoreBadge score={vendor.risk_score} level={vendor.risk_level} />
            <button onClick={onClose} className="text-gray-400 hover:text-white ml-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Category</div>
              <div className="text-gray-300">{VENDOR_CATEGORIES[vendor.category]?.label || vendor.category}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Criticality</div>
              <div className={RISK_TEXT_COLORS[vendor.criticality]}>
                {CRITICALITY_LEVELS[vendor.criticality]?.label}
              </div>
            </div>
            {vendor.primary_contact && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Contact</div>
                <div className="text-gray-300">{vendor.primary_contact}</div>
              </div>
            )}
            {vendor.contact_email && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Email</div>
                <div className="text-gray-300">{vendor.contact_email}</div>
              </div>
            )}
          </div>

          {/* Data Types */}
          {vendor.data_types?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Data Access</div>
              <div className="flex flex-wrap gap-2">
                {vendor.data_types.map(dt => (
                  <span key={dt} className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                    {DATA_TYPES.find(d => d.value === dt)?.label || dt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Technologies */}
          {vendor.technologies?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">Technologies</div>
              <div className="flex flex-wrap gap-2">
                {vendor.technologies.map(tech => (
                  <span key={tech} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk Events */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Recent Events</div>
            {loading ? (
              <div className="text-gray-400 text-sm">Loading...</div>
            ) : events.length === 0 ? (
              <div className="text-gray-500 text-sm">No events recorded</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {events.map(event => (
                  <div key={event.id} className="flex items-center justify-between text-sm p-2 bg-gray-800/50 rounded">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${RISK_COLORS[event.severity]}`} />
                      <span className="text-gray-300">{event.title}</span>
                    </div>
                    <SmartTime date={event.event_date} className="text-gray-500 text-xs" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-between">
          <button onClick={onDelete} className="text-red-400 hover:text-red-300 text-sm">
            Remove Vendor
          </button>
          <button onClick={onClose} className="cyber-button">Close</button>
        </div>
      </div>
    </div>
  )
}

/**
 * Create Vendor Modal
 */
function CreateVendorModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [category, setCategory] = useState('')
  const [criticality, setCriticality] = useState('medium')
  const [dataTypes, setDataTypes] = useState([])
  const [saving, setSaving] = useState(false)

  function toggleDataType(dt) {
    setDataTypes(prev =>
      prev.includes(dt) ? prev.filter(d => d !== dt) : [...prev, dt]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name) return

    setSaving(true)
    await onCreate({
      name,
      domain,
      category,
      criticality,
      dataTypes,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-gray-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Vendor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Vendor Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Salesforce"
              className="cyber-input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., salesforce.com"
              className="cyber-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="cyber-input w-full"
              >
                <option value="">Select...</option>
                {Object.entries(VENDOR_CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label}</option>
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
                {Object.entries(CRITICALITY_LEVELS).map(([key, level]) => (
                  <option key={key} value={key}>{level.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Data Access</label>
            <div className="flex flex-wrap gap-2">
              {DATA_TYPES.map(dt => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => toggleDataType(dt.value)}
                  className={`text-xs px-2 py-1 rounded border ${
                    dataTypes.includes(dt.value)
                      ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="cyber-button">Cancel</button>
            <button type="submit" disabled={saving || !name} className="cyber-button-primary">
              {saving ? 'Adding...' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
