/**
 * VulnerabilitiesTab Component
 *
 * Dashboard tab showing vulnerability information:
 * - Targeted services widget
 * - Active exploitation widget
 * - Vulnerability severity treemap
 * - Recent KEVs list
 */
import { Link } from 'react-router-dom'
import {
  TargetedServicesWidget,
  ActiveExploitationWidget,
  VulnTreemapMini,
  NewBadge,
} from '../../../components'

export default function VulnerabilitiesTab({
  targetedServices,
  activeExploits,
  widgetsLoading,
  userProfile,
  vulnsBySeverity,
  recentKEVs,
}) {
  return (
    <div className="space-y-6">
      {/* Actionable Intelligence Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TargetedServicesWidget
          data={targetedServices}
          loading={widgetsLoading}
          timeRange="30 days"
        />
        <ActiveExploitationWidget
          data={activeExploits}
          loading={widgetsLoading}
          userProfile={userProfile}
          timeRange="30 days"
        />
      </div>

      {/* Severity + KEVs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vulnerability Severity */}
        <div className="cyber-card">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Vulnerability Severity Distribution</h2>
          <VulnTreemapMini data={vulnsBySeverity} />
        </div>

        {/* Recent KEVs */}
        <div className="cyber-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Latest KEVs</h2>
            <Link to="/vulnerabilities" className="text-cyber-accent text-sm hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentKEVs.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                No KEVs found
              </div>
            ) : (
              recentKEVs.slice(0, 6).map((kev) => (
                <div
                  key={kev.cve_id}
                  className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-cyber-accent">{kev.cve_id}</span>
                      <NewBadge date={kev.kev_date} thresholdHours={168} />
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-xs">
                      {kev.description?.slice(0, 60)}...
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {kev.cvss_score && (
                      <span className={`badge-${kev.cvss_score >= 9 ? 'critical' : kev.cvss_score >= 7 ? 'high' : 'medium'}`}>
                        {kev.cvss_score}
                      </span>
                    )}
                    {kev.ransomware_campaign_use && (
                      <span className="badge-critical">RW</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
