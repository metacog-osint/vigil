import { useState, useEffect } from 'react'
import {
  statusOverview,
  statusComponents,
  statusIncidents,
  statusMaintenance,
  STATUS_TYPES,
  IMPACT_LEVELS,
  INCIDENT_STATUSES,
  formatUptime,
  getStatusColor,
  getTimeRelative,
} from '../lib/status'
import { SmartTime } from '../components/TimeDisplay'
import { useSubscription } from '../contexts/SubscriptionContext'

// SLA Targets (can be customized per tier)
const SLA_TARGETS = {
  free: 99.0,
  professional: 99.5,
  team: 99.9,
  enterprise: 99.95,
}

const STATUS_COLORS = {
  operational: 'bg-green-500',
  degraded_performance: 'bg-yellow-500',
  partial_outage: 'bg-orange-500',
  major_outage: 'bg-red-500',
  maintenance: 'bg-blue-500',
}

const STATUS_TEXT_COLORS = {
  operational: 'text-green-400',
  degraded_performance: 'text-yellow-400',
  partial_outage: 'text-orange-400',
  major_outage: 'text-red-400',
  maintenance: 'text-blue-400',
}

export default function Status() {
  const { tier } = useSubscription()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentIncidents, setRecentIncidents] = useState([])
  const [slaCompliance, setSlaCompliance] = useState(null)
  const [uptimeHistory, setUptimeHistory] = useState([])
  const [view, setView] = useState('current') // current | history

  const slaTarget = SLA_TARGETS[tier] || SLA_TARGETS.free

  useEffect(() => {
    loadData()
    // Refresh every 60 seconds
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const [statusData, recent, sla] = await Promise.all([
        statusOverview.getStatusPageData(),
        statusIncidents.getRecent(30),
        statusOverview.getSlaCompliance(null, 30),
      ])
      setData(statusData)
      setRecentIncidents(recent)
      setSlaCompliance(sla)
    } catch (err) {
      console.error('Failed to load status:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyber-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-gray-400 text-sm">Loading status...</div>
        </div>
      </div>
    )
  }

  const { systemStatus, components, incidents, maintenance } = data || {}

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">System Status</h1>
        <p className="text-gray-400">Current status and uptime for Vigil services</p>
      </div>

      {/* Overall Status Banner */}
      <OverallStatusBanner status={systemStatus} />

      {/* Active Incidents */}
      {incidents && incidents.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Active Incidents</h2>
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      )}

      {/* Upcoming Maintenance */}
      {maintenance && maintenance.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Scheduled Maintenance</h2>
          {maintenance.map((maint) => (
            <MaintenanceCard key={maint.id} maintenance={maint} />
          ))}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex justify-center">
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setView('current')}
            className={`px-4 py-2 text-sm rounded ${
              view === 'current' ? 'bg-cyber-accent text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Current Status
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 py-2 text-sm rounded ${
              view === 'history' ? 'bg-cyber-accent text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Incident History
          </button>
        </div>
      </div>

      {view === 'current' ? (
        /* Component Status List */
        <div className="space-y-6">
          {Object.entries(components || {}).map(([groupName, groupComponents]) => (
            <ComponentGroup key={groupName} name={groupName} components={groupComponents} />
          ))}
        </div>
      ) : (
        /* Incident History */
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Past 30 Days</h2>
          {recentIncidents.length === 0 ? (
            <div className="cyber-card p-6 text-center text-gray-500">
              No incidents in the past 30 days
            </div>
          ) : (
            recentIncidents.map((incident) => (
              <IncidentHistoryCard key={incident.id} incident={incident} />
            ))
          )}
        </div>
      )}

      {/* Uptime Summary */}
      <UptimeSummary components={Object.values(components || {}).flat()} />

      {/* SLA Compliance */}
      {slaCompliance && (
        <SlaComplianceCard compliance={slaCompliance} target={slaTarget} tier={tier} />
      )}

      {/* Footer */}
      <div className="text-center text-gray-500 text-sm pt-8 border-t border-gray-800">
        <p>Last updated: {new Date().toLocaleString()}</p>
        <p className="mt-1">
          Powered by <span className="text-cyber-accent">Vigil</span> by The Intelligence Company
        </p>
      </div>
    </div>
  )
}

/**
 * Overall Status Banner
 */
function OverallStatusBanner({ status }) {
  if (!status) return null

  const statusConfig = {
    operational: {
      bg: 'bg-green-500/20',
      border: 'border-green-500',
      text: 'text-green-400',
      message: 'All Systems Operational',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    degraded: {
      bg: 'bg-yellow-500/20',
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      message: 'Degraded Performance',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
    },
    maintenance: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500',
      text: 'text-blue-400',
      message: 'Maintenance in Progress',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    major_outage: {
      bg: 'bg-red-500/20',
      border: 'border-red-500',
      text: 'text-red-400',
      message: 'System Outage',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  }

  const config = statusConfig[status.overall_status] || statusConfig.operational

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-6`}>
      <div className="flex items-center justify-center gap-4">
        <div className={config.text}>{config.icon}</div>
        <div>
          <h2 className={`text-2xl font-bold ${config.text}`}>{config.message}</h2>
          <p className="text-gray-400 text-sm mt-1">
            {status.components_operational} operational
            {status.components_degraded > 0 && `, ${status.components_degraded} degraded`}
            {status.components_outage > 0 && `, ${status.components_outage} outage`}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Component Group
 */
function ComponentGroup({ name, components }) {
  return (
    <div className="cyber-card overflow-hidden">
      <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
        <h3 className="font-medium text-white">{name}</h3>
      </div>
      <div className="divide-y divide-gray-800">
        {components.map((component) => (
          <ComponentRow key={component.id} component={component} />
        ))}
      </div>
    </div>
  )
}

/**
 * Component Row
 */
function ComponentRow({ component }) {
  const statusInfo = STATUS_TYPES[component.status] || STATUS_TYPES.operational

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[component.status]}`} />
        <span className="text-gray-300">{component.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-500 text-sm">{formatUptime(component.uptime_month)} uptime</span>
        <span className={`text-sm ${STATUS_TEXT_COLORS[component.status]}`}>
          {statusInfo.label}
        </span>
      </div>
    </div>
  )
}

/**
 * Incident Card (Active)
 */
function IncidentCard({ incident }) {
  const [expanded, setExpanded] = useState(true)
  const impactInfo = IMPACT_LEVELS[incident.impact] || IMPACT_LEVELS.minor
  const statusInfo = INCIDENT_STATUSES[incident.status] || INCIDENT_STATUSES.investigating

  const impactColors = {
    minor: 'border-yellow-500 bg-yellow-500/10',
    major: 'border-orange-500 bg-orange-500/10',
    critical: 'border-red-500 bg-red-500/10',
  }

  return (
    <div className={`border rounded-lg ${impactColors[incident.impact] || impactColors.minor}`}>
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium bg-${impactInfo.color}-500/20 text-${impactInfo.color}-400`}
          >
            {impactInfo.label}
          </span>
          <h3 className="font-medium text-white">{incident.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400`}
          >
            {statusInfo.label}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50">
          {incident.description && (
            <p className="text-gray-400 text-sm mt-3">{incident.description}</p>
          )}

          {/* Updates Timeline */}
          {incident.updates && incident.updates.length > 0 && (
            <div className="mt-4 space-y-3">
              {incident.updates
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map((update) => (
                  <div key={update.id} className="flex gap-3 text-sm">
                    <div className="text-gray-500 whitespace-nowrap">
                      <SmartTime date={update.created_at} />
                    </div>
                    <div>
                      <span
                        className={`font-medium text-${INCIDENT_STATUSES[update.status]?.color || 'gray'}-400`}
                      >
                        {INCIDENT_STATUSES[update.status]?.label || update.status}
                      </span>
                      <span className="text-gray-400 ml-2">{update.message}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Maintenance Card
 */
function MaintenanceCard({ maintenance }) {
  return (
    <div className="cyber-card border-blue-500/30 bg-blue-500/5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
              Scheduled
            </span>
            <h3 className="font-medium text-white">{maintenance.title}</h3>
          </div>
          {maintenance.description && (
            <p className="text-gray-400 text-sm">{maintenance.description}</p>
          )}
        </div>
        <div className="text-right text-sm text-gray-400">
          <div>{new Date(maintenance.scheduled_start).toLocaleDateString()}</div>
          <div>
            {new Date(maintenance.scheduled_start).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' - '}
            {new Date(maintenance.scheduled_end).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Incident History Card (Resolved)
 */
function IncidentHistoryCard({ incident }) {
  const [expanded, setExpanded] = useState(false)
  const isResolved = incident.status === 'resolved'

  return (
    <div className="cyber-card">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${isResolved ? 'bg-green-500' : 'bg-yellow-500'}`}
          />
          <div>
            <h4 className="text-white text-sm font-medium">{incident.title}</h4>
            <p className="text-gray-500 text-xs">
              <SmartTime date={incident.started_at} />
              {incident.resolved_at && (
                <>
                  {' '}
                  - Resolved after {getIncidentDuration(incident.started_at, incident.resolved_at)}
                </>
              )}
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800">
          {incident.description && (
            <p className="text-gray-400 text-sm mt-3">{incident.description}</p>
          )}
          {incident.root_cause && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 uppercase mb-1">Root Cause</div>
              <p className="text-gray-400 text-sm">{incident.root_cause}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Uptime Summary
 */
function UptimeSummary({ components }) {
  if (!components || components.length === 0) return null

  const avgUptime = (
    components.reduce((sum, c) => sum + parseFloat(c.uptime_month || 100), 0) / components.length
  ).toFixed(2)

  return (
    <div className="cyber-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">30-Day Uptime Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-400">{avgUptime}%</div>
          <div className="text-gray-500 text-sm">Average Uptime</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{components.length}</div>
          <div className="text-gray-500 text-sm">Components</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-400">
            {components.filter((c) => c.status === 'operational').length}
          </div>
          <div className="text-gray-500 text-sm">Operational</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-400">
            {components.filter((c) => c.status !== 'operational').length}
          </div>
          <div className="text-gray-500 text-sm">Issues</div>
        </div>
      </div>
    </div>
  )
}

/**
 * SLA Compliance Card
 */
function SlaComplianceCard({ compliance, target, tier }) {
  const actual = parseFloat(compliance.average)
  const isMeetingSla = actual >= target
  const diff = (actual - target).toFixed(2)

  // Calculate downtime minutes based on target for 30 days
  const totalMinutes = 30 * 24 * 60
  const allowedDowntime = totalMinutes * ((100 - target) / 100)
  const actualDowntime = totalMinutes * ((100 - actual) / 100)

  return (
    <div className="cyber-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">SLA Compliance</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isMeetingSla ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {isMeetingSla ? 'Meeting SLA' : 'Below SLA'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className={`text-3xl font-bold ${isMeetingSla ? 'text-green-400' : 'text-red-400'}`}>
            {compliance.average}%
          </div>
          <div className="text-gray-500 text-sm">30-Day Uptime</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-cyan-400">{target}%</div>
          <div className="text-gray-500 text-sm">SLA Target</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${isMeetingSla ? 'text-green-400' : 'text-red-400'}`}>
            {diff > 0 ? '+' : ''}
            {diff}%
          </div>
          <div className="text-gray-500 text-sm">vs Target</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{Math.round(actualDowntime)}m</div>
          <div className="text-gray-500 text-sm">Actual Downtime</div>
        </div>
      </div>

      {/* SLA Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Uptime</span>
          <span className="text-gray-400">
            {compliance.average}% / {target}%
          </span>
        </div>
        <div className="h-4 bg-gray-800 rounded-full overflow-hidden relative">
          {/* Target line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10"
            style={{ left: `${target}%` }}
          />
          {/* Actual */}
          <div
            className={`h-full rounded-full transition-all ${isMeetingSla ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(actual, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>SLA: {target}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Tier info */}
      <div className="mt-4 pt-4 border-t border-gray-800 text-center">
        <p className="text-gray-500 text-sm">
          Your <span className="text-cyan-400 capitalize">{tier || 'free'}</span> plan includes{' '}
          {target}% uptime SLA
          {tier !== 'enterprise' && (
            <span className="text-gray-600"> - Upgrade for higher SLA guarantees</span>
          )}
        </p>
      </div>
    </div>
  )
}

// Helper: Calculate incident duration
function getIncidentDuration(start, end) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate - startDate

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}
