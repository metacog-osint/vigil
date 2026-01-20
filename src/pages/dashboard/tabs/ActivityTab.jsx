/**
 * ActivityTab Component
 *
 * Dashboard tab showing activity-related visualizations:
 * - Week over week comparison
 * - Change summary
 * - Incident activity chart
 * - Activity calendar (90 days)
 */
import {
  ActivityChart,
  ActivityCalendar,
  WeekComparisonCard,
  ChangeSummaryCard,
} from '../../../components'

export default function ActivityTab({ weekComparison, changeSummary, calendarData }) {
  return (
    <div className="space-y-6">
      {/* Trend Analysis Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WeekComparisonCard data={weekComparison} loading={!weekComparison} />
        <ChangeSummaryCard data={changeSummary} loading={!changeSummary} />
      </div>

      {/* Activity Chart */}
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Incident Activity</h2>
        <ActivityChart />
      </div>

      {/* Activity Calendar */}
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Incident Activity (90 Days)</h2>
        <ActivityCalendar data={calendarData} days={90} />
      </div>
    </div>
  )
}
