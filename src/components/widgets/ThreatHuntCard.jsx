import { useState } from 'react'
import { threatHunts } from '../../lib/supabase'
import { Link } from 'react-router-dom'

const CONFIDENCE_COLORS = {
  high: 'text-red-400 bg-red-500/20 border-red-500/50',
  medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
  low: 'text-blue-400 bg-blue-500/20 border-blue-500/50',
}

const SIEM_LABELS = {
  splunk: 'Splunk',
  elastic: 'Elastic',
  sentinel: 'Microsoft Sentinel',
  chronicle: 'Chronicle',
  qradar: 'QRadar',
}

export default function ThreatHuntCard({
  hunt,
  userId = 'anonymous',
  progress = null,
  onProgressUpdate,
  expanded = false,
  showActorLink = true,
}) {
  const [isExpanded, setIsExpanded] = useState(expanded)
  const [completedChecks, setCompletedChecks] = useState(progress?.completed_checks || [])
  const [copiedQuery, setCopiedQuery] = useState(null)
  const [notes, setNotes] = useState(progress?.notes || '')
  const [saving, setSaving] = useState(false)

  const quickChecks = hunt.quick_checks || []
  const logQueries = hunt.log_queries || {}
  const recommendations = hunt.recommendations || []
  const totalChecks = quickChecks.length

  const handleCheckToggle = async (index) => {
    const newChecks = completedChecks.includes(index)
      ? completedChecks.filter((i) => i !== index)
      : [...completedChecks, index]

    setCompletedChecks(newChecks)

    // Auto-save progress
    if (onProgressUpdate) {
      setSaving(true)
      await threatHunts.updateProgress(userId, hunt.id, newChecks, notes)
      onProgressUpdate(hunt.id, newChecks, notes)
      setSaving(false)
    }
  }

  const handleCopyQuery = (siemType, query) => {
    navigator.clipboard.writeText(query)
    setCopiedQuery(siemType)
    setTimeout(() => setCopiedQuery(null), 2000)
  }

  const handleStartHunt = async () => {
    if (onProgressUpdate) {
      await threatHunts.startHunt(userId, hunt.id)
      onProgressUpdate(hunt.id, [], '')
    }
  }

  const handleCompleteHunt = async () => {
    if (onProgressUpdate) {
      await threatHunts.completeHunt(userId, hunt.id, notes)
      onProgressUpdate(hunt.id, completedChecks, notes, true)
    }
  }

  const progressPercent =
    totalChecks > 0 ? Math.round((completedChecks.length / totalChecks) * 100) : 0
  const isComplete = progress?.status === 'completed'
  const isInProgress = progress?.status === 'in_progress'

  return (
    <div
      className={`bg-cyber-dark border rounded-lg overflow-hidden transition-all ${
        isComplete ? 'border-green-500/50' : 'border-gray-800 hover:border-gray-700'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {/* Confidence badge */}
          <span
            className={`text-[10px] px-2 py-1 rounded border ${CONFIDENCE_COLORS[hunt.confidence]}`}
          >
            {hunt.confidence?.toUpperCase()}
          </span>

          <div>
            <h3 className="text-white font-medium">{hunt.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {hunt.actor_name && (
                <>
                  <span className="text-xs text-gray-500">Associated with</span>
                  {showActorLink ? (
                    <Link
                      to={`/actors?search=${encodeURIComponent(hunt.actor_name)}`}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hunt.actor_name}
                    </Link>
                  ) : (
                    <span className="text-xs text-cyan-400">{hunt.actor_name}</span>
                  )}
                </>
              )}
              {hunt.source && (
                <span className="text-xs text-gray-600">• Source: {hunt.source}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          {isInProgress && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{progressPercent}%</span>
            </div>
          )}
          {isComplete && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Complete
            </span>
          )}

          {/* Expand/collapse */}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-800 animate-fadeIn">
          {/* Description */}
          {hunt.description && (
            <div className="px-4 py-3 border-b border-gray-800/50">
              <p className="text-sm text-gray-400">{hunt.description}</p>
            </div>
          )}

          {/* Quick Checks Section */}
          {quickChecks.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <span className="text-lg">🔍</span>
                  Quick Checks
                </h4>
                {!isInProgress && !isComplete && (
                  <button
                    onClick={handleStartHunt}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Start tracking
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {quickChecks.map((check, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-colors ${
                      completedChecks.includes(index)
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-gray-700 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleCheckToggle(index)}
                        disabled={!isInProgress && !isComplete}
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5 transition-colors ${
                          completedChecks.includes(index)
                            ? 'bg-green-500 border-green-500 text-black'
                            : 'border-gray-600 hover:border-gray-500'
                        } ${!isInProgress && !isComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {completedChecks.includes(index) && (
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="text-sm text-white font-medium">{check.title}</div>
                        {check.command && (
                          <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
                            <code className="text-xs text-cyan-400 font-mono whitespace-pre-wrap break-all">
                              {check.command}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(check.command)
                              }}
                              className="mt-1 text-[10px] text-gray-500 hover:text-gray-400"
                            >
                              Copy command
                            </button>
                          </div>
                        )}
                        {check.look_for && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span className="text-gray-400">Look for:</span> {check.look_for}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIEM Queries Section */}
          {Object.keys(logQueries).length > 0 && (
            <div className="px-4 py-3 border-b border-gray-800/50">
              <h4 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                <span className="text-lg">📊</span>
                SIEM Detection Queries
              </h4>

              <div className="space-y-3">
                {Object.entries(logQueries).map(([siemType, query]) => (
                  <div
                    key={siemType}
                    className="bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border-b border-gray-700">
                      <span className="text-xs font-medium text-gray-300">
                        {SIEM_LABELS[siemType] || siemType}
                      </span>
                      <button
                        onClick={() => handleCopyQuery(siemType, query)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        {copiedQuery === siemType ? (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                      {query}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations Section */}
          {recommendations.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-800/50">
              <h4 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                <span className="text-lg">🛡️</span>
                Defensive Recommendations
              </h4>

              <ul className="space-y-2">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                    <svg
                      className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes & Actions */}
          {(isInProgress || isComplete) && (
            <div className="px-4 py-3 bg-gray-800/20">
              <div className="flex items-start gap-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about your findings..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500"
                  rows={2}
                />
                <div className="flex flex-col gap-2">
                  {isInProgress && (
                    <button
                      onClick={handleCompleteHunt}
                      disabled={completedChecks.length === 0}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        completedChecks.length === 0
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30'
                      }`}
                    >
                      Complete
                    </button>
                  )}
                  {saving && <span className="text-xs text-gray-500">Saving...</span>}
                </div>
              </div>
            </div>
          )}

          {/* Tags & Source URL */}
          <div className="px-4 py-2 bg-gray-800/30 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {(hunt.tags || []).map((tag, index) => (
                <span
                  key={index}
                  className="text-[10px] px-2 py-0.5 bg-gray-700/50 text-gray-400 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
            {hunt.source_url && (
              <a
                href={hunt.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Source
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Smaller summary card for dashboard/sidebar
export function ThreatHuntSummary({ hunt, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 bg-gray-800/30 border border-gray-700 rounded-lg text-left hover:bg-gray-800/50 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-[10px] px-2 py-0.5 rounded border ${CONFIDENCE_COLORS[hunt.confidence]}`}
        >
          {hunt.confidence?.toUpperCase()}
        </span>
        {hunt.actor_name && <span className="text-xs text-gray-500">{hunt.actor_name}</span>}
      </div>
      <h4 className="text-sm text-white font-medium truncate">{hunt.title}</h4>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-500">{(hunt.quick_checks || []).length} checks</span>
        <span className="text-gray-600">•</span>
        <span className="text-xs text-gray-500">
          {Object.keys(hunt.log_queries || {}).length} SIEM queries
        </span>
      </div>
    </button>
  )
}
