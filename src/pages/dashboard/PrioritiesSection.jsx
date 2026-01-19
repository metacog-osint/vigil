/**
 * PrioritiesSection Component
 *
 * Shows personalized priority threats above the fold:
 * - If no org profile: shows PersonalizationPrompt
 * - If profile exists: shows top 3 relevant actors + top 3 CVEs
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RelevanceBadge } from '../../components'

// Personalization Prompt Component (inline)
function PersonalizationPrompt() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-white font-medium mb-1">Personalize Your Threat Feed</h3>
          <p className="text-sm text-gray-400 mb-3">
            Tell us about your industry and tech stack to get alerts tailored to your organization.
            Get notified about Cisco zero-days, healthcare ransomware, or whatever matters to you.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="px-4 py-1.5 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 transition-colors"
            >
              Set Up Now
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Maybe later
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-500 hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function PrioritiesSection({
  userProfile,
  relevantActors,
  relevantVulns,
}) {
  // Show personalization prompt if no profile
  if (!userProfile?.sector) {
    return <PersonalizationPrompt />
  }

  // Don't show if no relevant data
  if (relevantActors.length === 0 && relevantVulns.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-cyber-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h2 className="text-base font-semibold text-white">Priorities for You</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {userProfile.sector} | {userProfile.country || userProfile.region}
          </span>
          <Link to="/settings" className="text-cyber-accent text-xs hover:underline">
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Relevant Actors */}
        {relevantActors.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Priority Actors</h3>
            <div className="space-y-1.5">
              {relevantActors.slice(0, 3).map((actor) => (
                <Link
                  key={actor.id}
                  to="/actors"
                  className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white font-medium truncate">{actor.name}</span>
                    {actor.target_sectors?.length > 0 && (
                      <span className="text-xs text-gray-500 truncate hidden sm:inline">
                        targets {actor.target_sectors[0]}
                      </span>
                    )}
                  </div>
                  <RelevanceBadge score={actor.relevanceScore} size="sm" showLabel={false} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Relevant Vulnerabilities */}
        {relevantVulns.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Priority CVEs</h3>
            <div className="space-y-1.5">
              {relevantVulns.slice(0, 3).map((vuln) => (
                <Link
                  key={vuln.cve_id}
                  to="/vulnerabilities"
                  className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-cyber-accent font-mono text-sm">{vuln.cve_id}</span>
                    {vuln.affected_vendors?.length > 0 && (
                      <span className="text-xs text-gray-500 truncate hidden sm:inline">
                        {vuln.affected_vendors[0]}
                      </span>
                    )}
                  </div>
                  <RelevanceBadge score={vuln.relevanceScore} size="sm" showLabel={false} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
