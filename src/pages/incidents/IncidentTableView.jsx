/**
 * Incident Table View Component
 * Table display for incidents with sorting and filtering
 */
import { SkeletonTable } from '../../components/Skeleton'
import { EmptyIncidents } from '../../components/EmptyState'
import { NewBadge } from '../../components/NewIndicator'
import { WatchButton } from '../../components/WatchButton'
import { SmartTime } from '../../components/TimeDisplay'
import { ColumnMenu } from '../../components/Tooltip'
import { Sparkline } from '../../components/Sparkline'
import { STATUS_OPTIONS, SECTOR_FILTER_OPTIONS, getStatusColor } from './IncidentConstants'

export function IncidentTableView({
  incidents,
  loading,
  loadingMore,
  hasMore,
  loadMore,
  totalCount,
  sortConfig,
  setSortConfig,
  sectorFilter,
  setSectorFilter,
  statusFilter,
  setStatusFilter,
  selectedRows,
  selectedIncident,
  focusedRowIndex,
  onRowClick,
  onGoToActor,
  actorTrends,
  tableRef,
}) {
  if (loading) {
    return <SkeletonTable rows={8} cols={5} />
  }

  if (incidents.length === 0) {
    return <EmptyIncidents />
  }

  return (
    <div className="cyber-card overflow-hidden">
      <table className="cyber-table">
        <thead>
          <tr>
            <th>
              <ColumnMenu
                field="victim_name"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={null}
                onFilter={() => {}}
                tooltip={{
                  content: 'Organization or company targeted in the attack',
                  source: 'ransomware.live',
                }}
              >
                Victim
              </ColumnMenu>
            </th>
            <th>
              <ColumnMenu
                field="actor_name"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={null}
                onFilter={() => {}}
                tooltip={{
                  content: 'Threat actor or ransomware group responsible',
                  source: 'ransomware.live',
                }}
              >
                Actor
              </ColumnMenu>
            </th>
            <th className="hidden md:table-cell">
              <ColumnMenu
                field="victim_sector"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={sectorFilter}
                onFilter={setSectorFilter}
                filterOptions={SECTOR_FILTER_OPTIONS}
                tooltip={{
                  content: 'Industry sector of the victim organization',
                  source: 'Classified',
                }}
              >
                Sector
              </ColumnMenu>
            </th>
            <th className="hidden lg:table-cell">
              <ColumnMenu
                field="status"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={statusFilter}
                onFilter={setStatusFilter}
                filterOptions={STATUS_OPTIONS}
                tooltip={{
                  content:
                    'claimed = announced by actor, confirmed = verified, leaked = data published, paid = ransom paid',
                  source: 'ransomware.live',
                }}
              >
                Status
              </ColumnMenu>
            </th>
            <th>
              <ColumnMenu
                field="discovered_date"
                currentSort={sortConfig}
                onSort={setSortConfig}
                currentFilter={null}
                onFilter={() => {}}
                tooltip={{
                  content: 'Date the incident was discovered or announced',
                  source: 'ransomware.live',
                }}
              >
                Date
              </ColumnMenu>
            </th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident, index) => (
            <tr
              key={incident.id}
              onClick={(e) => onRowClick(incident, e)}
              className={`cursor-pointer transition-colors ${
                selectedRows.has(incident.id) ? 'bg-cyan-900/30' : ''
              } ${selectedIncident?.id === incident.id ? 'bg-cyan-900/20' : ''} ${
                focusedRowIndex === index ? 'ring-1 ring-inset ring-cyan-500' : ''
              }`}
            >
              <td>
                <div className="flex items-center gap-2">
                  <WatchButton entityType="incident" entityId={incident.id} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {incident.victim_name || 'Unknown'}
                      </span>
                      <NewBadge date={incident.discovered_date} thresholdHours={48} />
                    </div>
                    {incident.victim_country && (
                      <div className="text-xs text-gray-500">{incident.victim_country}</div>
                    )}
                  </div>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onGoToActor(incident.actor_id)
                    }}
                    className="text-cyber-accent hover:text-cyan-300 hover:underline text-left"
                  >
                    {incident.threat_actor?.name || 'Unknown'}
                  </button>
                  {actorTrends[incident.actor_id] && (
                    <Sparkline
                      data={[
                        actorTrends[incident.actor_id].week4,
                        actorTrends[incident.actor_id].week3,
                        actorTrends[incident.actor_id].week2,
                        actorTrends[incident.actor_id].week1,
                      ]}
                      width={40}
                      height={16}
                    />
                  )}
                </div>
              </td>
              <td className="hidden md:table-cell text-gray-400 capitalize">
                {incident.victim_sector || '—'}
              </td>
              <td className="hidden lg:table-cell">
                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(incident.status)}`}>
                  {incident.status || 'unknown'}
                </span>
              </td>
              <td className="text-gray-400 text-sm">
                <SmartTime date={incident.discovered_date} />
              </td>
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
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              `Load More (${incidents.length} of ${totalCount})`
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default IncidentTableView
