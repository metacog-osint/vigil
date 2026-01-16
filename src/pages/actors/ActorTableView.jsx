/**
 * Actor Table View Component
 * Table display for threat actors with sorting and filtering
 */
import TrendBadge from '../../components/TrendBadge'
import { SmartTime } from '../../components/TimeDisplay'
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyActors } from '../../components/EmptyState'
import { NewBadge } from '../../components/NewIndicator'
import { WatchButton } from '../../components/WatchButton'
import { Sparkline } from '../../components/Sparkline'
import { Tooltip, ColumnMenu, FIELD_TOOLTIPS } from '../../components/Tooltip'
import { getTypeConfig, TYPE_FILTER_OPTIONS, TREND_FILTER_OPTIONS, STATUS_FILTER_OPTIONS } from './ActorConstants'

export function ActorTableView({
  actors,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  totalCount,
  sortConfig,
  setSortConfig,
  typeFilter,
  setTypeFilter,
  trendFilter,
  setTrendFilter,
  statusFilter,
  setStatusFilter,
  selectedRows,
  focusedRowIndex,
  onRowClick,
  userOrgProfile,
  riskScores,
}) {
  if (loading) {
    return <SkeletonTable rows={8} cols={6} />
  }

  if (actors.length === 0) {
    return <EmptyActors />
  }

  return (
    <div className="cyber-card overflow-hidden">
      <table className="cyber-table">
        <thead>
          <tr>
            <th>
              <ColumnMenu
                field="name"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={null}
                onFilter={() => {}}
                tooltip={FIELD_TOOLTIPS.actor_name}
              >
                Actor
              </ColumnMenu>
            </th>
            <th className="hidden md:table-cell">
              <ColumnMenu
                field="actor_type"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={typeFilter}
                onFilter={setTypeFilter}
                filterOptions={TYPE_FILTER_OPTIONS}
                tooltip={FIELD_TOOLTIPS.actor_type}
              >
                Type
              </ColumnMenu>
            </th>
            <th>
              <ColumnMenu
                field="trend_status"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={trendFilter}
                onFilter={setTrendFilter}
                filterOptions={TREND_FILTER_OPTIONS}
                tooltip={FIELD_TOOLTIPS.trend_status}
              >
                Trend
              </ColumnMenu>
            </th>
            <th className="hidden lg:table-cell">
              <ColumnMenu
                field="incidents_7d"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={null}
                onFilter={() => {}}
                tooltip={{
                  content: 'Current week incidents / previous week incidents. Velocity shows incidents per day.',
                  source: 'ransomware.live'
                }}
              >
                7d / Prev
              </ColumnMenu>
            </th>
            <th className="hidden md:table-cell">
              <ColumnMenu
                field="last_seen"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={null}
                onFilter={() => {}}
                tooltip={FIELD_TOOLTIPS.last_seen}
              >
                Last Seen
              </ColumnMenu>
            </th>
            <th>
              <ColumnMenu
                field="status"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={statusFilter}
                onFilter={setStatusFilter}
                filterOptions={STATUS_FILTER_OPTIONS}
                tooltip={FIELD_TOOLTIPS.status}
              >
                Status
              </ColumnMenu>
            </th>
            {userOrgProfile && (
              <th className="hidden xl:table-cell">
                <ColumnMenu
                  field="risk_score"
                  currentSort={sortConfig}
                  onSort={setSortConfig}
                  currentFilter={null}
                  onFilter={() => {}}
                  tooltip={{
                    content: 'Relevance to your organization based on your sector and tech stack profile.',
                    source: 'Calculated from org profile'
                  }}
                >
                  Risk
                </ColumnMenu>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {actors.map((actor, index) => (
            <tr
              key={actor.id}
              onClick={(e) => onRowClick(actor, e)}
              className={`cursor-pointer transition-colors ${
                selectedRows.has(actor.id) ? 'bg-cyan-900/30' : ''
              } ${
                focusedRowIndex === index ? 'ring-1 ring-inset ring-cyan-500' : ''
              }`}
            >
              {/* Actor Name Cell */}
              <td>
                <div className="flex items-center gap-2">
                  <WatchButton entityType="threat_actor" entityId={actor.id} size="sm" />
                  <div>
                    <Tooltip
                      content={FIELD_TOOLTIPS.actor_name.content}
                      source={actor.source || 'Multiple sources'}
                      position="right"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{actor.name}</span>
                        <NewBadge date={actor.last_seen} thresholdHours={48} />
                      </div>
                    </Tooltip>
                    {actor.aliases?.length > 0 && (
                      <Tooltip
                        content={`All aliases: ${actor.aliases.join(', ')}`}
                        source={FIELD_TOOLTIPS.aliases.source}
                        position="bottom"
                      >
                        <div className="text-xs text-gray-500">
                          aka {actor.aliases.slice(0, 2).join(', ')}
                          {actor.aliases.length > 2 && ` +${actor.aliases.length - 2}`}
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </td>

              {/* Actor Type Cell */}
              <td className="hidden md:table-cell">
                <Tooltip
                  content={getTypeConfig(actor.actor_type).tooltip}
                  source={FIELD_TOOLTIPS.actor_type.source}
                  position="right"
                >
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeConfig(actor.actor_type).color}`}>
                    {(actor.actor_type || 'unknown').replace(/_/g, ' ')}
                  </span>
                </Tooltip>
              </td>

              {/* Trend Status Cell */}
              <td>
                <Tooltip
                  content={
                    actor.trend_status === 'ESCALATING'
                      ? `Activity increased ${actor.incidents_7d > 0 && actor.incidents_prev_7d > 0 ? Math.round(((actor.incidents_7d - actor.incidents_prev_7d) / actor.incidents_prev_7d) * 100) : ''}% vs previous week.`
                      : actor.trend_status === 'DECLINING'
                      ? `Activity decreased vs previous week.`
                      : 'Activity is stable compared to previous week.'
                  }
                  source={FIELD_TOOLTIPS.trend_status.source}
                  position="right"
                >
                  <span>
                    <TrendBadge status={actor.trend_status} showLabel={false} />
                  </span>
                </Tooltip>
              </td>

              {/* Incidents 7d / Prev Cell with Sparkline */}
              <td className="hidden lg:table-cell text-sm">
                <Tooltip
                  content={`This week: ${actor.incidents_7d || 0} incidents. Last week: ${actor.incidents_prev_7d || 0} incidents.${
                    actor.incident_velocity > 0
                      ? ` Averaging ${actor.incident_velocity} incidents per day.`
                      : ''
                  }`}
                  source="ransomware.live"
                  position="left"
                >
                  <div className="flex items-center gap-2">
                    {(actor.incidents_7d > 0 || actor.incidents_prev_7d > 0) && (
                      <Sparkline
                        data={[
                          actor.incidents_prev_7d || 0,
                          Math.round((actor.incidents_prev_7d || 0) * 0.8 + (actor.incidents_7d || 0) * 0.2),
                          Math.round((actor.incidents_prev_7d || 0) * 0.5 + (actor.incidents_7d || 0) * 0.5),
                          Math.round((actor.incidents_prev_7d || 0) * 0.2 + (actor.incidents_7d || 0) * 0.8),
                          actor.incidents_7d || 0
                        ]}
                        width={40}
                        height={16}
                        showTrend={false}
                      />
                    )}
                    <span>
                      <span className="text-white font-medium">{actor.incidents_7d || 0}</span>
                      <span className="text-gray-500"> / </span>
                      <span className="text-gray-400">{actor.incidents_prev_7d || 0}</span>
                    </span>
                  </div>
                </Tooltip>
              </td>

              {/* Last Seen Cell */}
              <td className="hidden md:table-cell text-sm text-gray-400">
                <Tooltip
                  content={FIELD_TOOLTIPS.last_seen.content}
                  source={FIELD_TOOLTIPS.last_seen.source}
                  position="left"
                >
                  <span>
                    <SmartTime date={actor.last_seen} />
                  </span>
                </Tooltip>
              </td>

              {/* Status Cell */}
              <td>
                <Tooltip
                  content={FIELD_TOOLTIPS.status.content}
                  source={FIELD_TOOLTIPS.status.source}
                  position="left"
                >
                  <span
                    className={`badge-${
                      actor.status === 'active' ? 'high' : 'low'
                    }`}
                  >
                    {actor.status || 'active'}
                  </span>
                </Tooltip>
              </td>

              {/* Risk Score Cell */}
              {userOrgProfile && (
                <td className="hidden xl:table-cell">
                  {riskScores[actor.id] > 0 ? (
                    <Tooltip
                      content={`Relevance score based on your org profile: ${
                        riskScores[actor.id] >= 80 ? 'Critical - high relevance to your sector/region' :
                        riskScores[actor.id] >= 60 ? 'High - significant overlap with your profile' :
                        riskScores[actor.id] >= 40 ? 'Medium - some relevance to your organization' :
                        'Low - limited relevance'
                      }`}
                      position="left"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        riskScores[actor.id] >= 80 ? 'bg-red-900/50 text-red-400' :
                        riskScores[actor.id] >= 60 ? 'bg-orange-900/50 text-orange-400' :
                        riskScores[actor.id] >= 40 ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-blue-900/50 text-blue-400'
                      }`}>
                        {riskScores[actor.id]}
                      </span>
                    </Tooltip>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Load More button */}
      {hasMore && (
        <div className="p-4 text-center border-t border-gray-800">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </span>
            ) : (
              `Load More (${actors.length} of ${totalCount})`
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default ActorTableView
