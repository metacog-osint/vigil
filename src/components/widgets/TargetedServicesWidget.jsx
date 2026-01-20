// Targeted Services Widget
// Shows which services/technologies are being actively targeted (per Jake's feedback)
// Helps users understand what types of infrastructure are under attack
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SERVICE_CATEGORIES } from '../../lib/service-categories'
import { Tooltip } from '../Tooltip'

// Icon components for each service type
const ServiceIcons = {
  shield: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  mail: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  cloud: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
      />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  globe: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  ),
  database: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  ),
  folder: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  ),
  network: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
      />
    </svg>
  ),
  desktop: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  archive: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  ),
}

export function TargetedServicesWidget({ data = [], loading = false, timeRange = '7 days' }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedService, setSelectedService] = useState(null)

  if (loading) {
    return (
      <div className="cyber-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-700 rounded animate-pulse" />
          <div className="h-5 w-40 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 h-4 bg-gray-700 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-gray-700 rounded animate-pulse" />
              <div className="w-8 h-4 bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const displayData = expanded ? data : data.slice(0, 5)
  const totalVulns = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="cyber-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Services Under Attack</h3>
          <Tooltip
            content={`Vulnerabilities affecting these service categories in the last ${timeRange}`}
          >
            <span className="text-gray-500 hover:text-gray-300 cursor-help">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </Tooltip>
        </div>
        <span className="text-xs text-gray-500">{totalVulns} total CVEs</span>
      </div>

      {/* Service bars */}
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-600"
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
          <p>No targeted services detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayData.map((service, index) => {
            const Icon = ServiceIcons[service.icon] || ServiceIcons.globe
            const barWidth = (service.count / maxCount) * 100
            const isSelected = selectedService === service.id

            return (
              <div key={service.id}>
                <button
                  onClick={() => setSelectedService(isSelected ? null : service.id)}
                  className={`w-full text-left transition-all ${isSelected ? 'mb-2' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2 w-36 flex-shrink-0">
                      <span style={{ color: service.color }}>{Icon}</span>
                      <span className="text-sm text-gray-300 truncate">
                        {service.shortName || service.name}
                      </span>
                    </div>
                    <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: service.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-white w-10 text-right">
                      {service.count}
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isSelected && (
                  <div className="ml-8 p-3 bg-gray-800/50 rounded-lg border border-gray-700 animate-fadeIn">
                    <p className="text-xs text-gray-400 mb-2">{service.description}</p>
                    {service.cves && service.cves.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Recent CVEs:</p>
                        <div className="flex flex-wrap gap-1">
                          {service.cves.slice(0, 5).map((cve) => (
                            <Link
                              key={cve}
                              to={`/vulnerabilities?search=${cve}`}
                              className="text-xs px-2 py-0.5 bg-gray-700 text-cyan-400 rounded hover:bg-gray-600"
                            >
                              {cve}
                            </Link>
                          ))}
                          {service.cves.length > 5 && (
                            <span className="text-xs text-gray-500 px-2 py-0.5">
                              +{service.cves.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <Link
                      to={`/vulnerabilities?search=${service.name}`}
                      className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 inline-block"
                    >
                      View all {service.name} vulnerabilities →
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Show more/less */}
      {data.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 pt-3 border-t border-gray-800 text-sm text-gray-400 hover:text-cyan-400 flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              Show less
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </>
          ) : (
            <>
              Show {data.length - 5} more
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default TargetedServicesWidget
