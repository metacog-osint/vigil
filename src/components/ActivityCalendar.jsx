// Activity Calendar - GitHub-style contribution grid
import { useMemo } from 'react'
import { clsx } from 'clsx'
import { format, subDays, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Get intensity level based on count
function getIntensity(count, maxCount) {
  if (count === 0) return 0
  if (!maxCount) return 1
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

const INTENSITY_COLORS = [
  'bg-gray-800',         // 0 - no activity
  'bg-red-900/50',       // 1 - low
  'bg-red-700/60',       // 2 - medium
  'bg-red-500/70',       // 3 - high
  'bg-red-400',          // 4 - very high
]

export function ActivityCalendar({
  data = [], // Array of { date: string, count: number }
  days = 90,
  onDayClick,
  className = '',
}) {
  const { grid, maxCount, months, stats } = useMemo(() => {
    const today = new Date()
    const startDate = subDays(today, days)
    const weekStart = startOfWeek(startDate)

    // Create date -> count lookup
    const dateMap = new Map()
    for (const item of data) {
      const key = format(new Date(item.date), 'yyyy-MM-dd')
      dateMap.set(key, (dateMap.get(key) || 0) + item.count)
    }

    // Generate all days
    const allDays = eachDayOfInterval({ start: weekStart, end: today })
    const maxCount = Math.max(...Array.from(dateMap.values()), 0)

    // Group into weeks
    const grid = []
    let currentWeek = []
    for (const day of allDays) {
      const key = format(day, 'yyyy-MM-dd')
      currentWeek.push({
        date: day,
        count: dateMap.get(key) || 0,
        intensity: getIntensity(dateMap.get(key) || 0, maxCount),
      })
      if (currentWeek.length === 7) {
        grid.push(currentWeek)
        currentWeek = []
      }
    }
    if (currentWeek.length > 0) {
      // Pad the last week
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      grid.push(currentWeek)
    }

    // Calculate month labels
    const months = []
    let lastMonth = -1
    for (let w = 0; w < grid.length; w++) {
      const firstDayOfWeek = grid[w].find(d => d !== null)
      if (firstDayOfWeek) {
        const month = firstDayOfWeek.date.getMonth()
        if (month !== lastMonth) {
          months.push({ week: w, label: MONTHS[month] })
          lastMonth = month
        }
      }
    }

    // Calculate stats
    const totalCount = Array.from(dateMap.values()).reduce((a, b) => a + b, 0)
    const activeDays = Array.from(dateMap.values()).filter(v => v > 0).length

    return { grid, maxCount, months, stats: { total: totalCount, activeDays } }
  }, [data, days])

  return (
    <div className={clsx('', className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-400">
          <span className="text-white font-medium">{stats.total}</span> incidents over{' '}
          <span className="text-white">{stats.activeDays}</span> active days
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>Less</span>
          {INTENSITY_COLORS.map((color, i) => (
            <div key={i} className={clsx('w-2.5 h-2.5 rounded-sm', color)} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Month labels */}
          <div className="flex mb-1" style={{ marginLeft: '24px' }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="text-xs text-gray-500"
                style={{ position: 'absolute', left: `${m.week * 14 + 24}px` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div className="flex mt-3">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1 text-xs text-gray-600">
              {DAYS.map((day, i) => (
                <div
                  key={i}
                  className="h-2.5 leading-[10px]"
                  style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-0.5">
              {grid.map((week, w) => (
                <div key={w} className="flex flex-col gap-0.5">
                  {week.map((day, d) =>
                    day ? (
                      <div
                        key={d}
                        onClick={() => onDayClick?.(day.date, day.count)}
                        className={clsx(
                          'w-2.5 h-2.5 rounded-sm cursor-pointer transition-colors',
                          INTENSITY_COLORS[day.intensity],
                          onDayClick && 'hover:ring-1 hover:ring-white/50'
                        )}
                        title={`${format(day.date, 'MMM d, yyyy')}: ${day.count} incident${day.count !== 1 ? 's' : ''}`}
                      />
                    ) : (
                      <div key={d} className="w-2.5 h-2.5" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ActivityCalendarMini({
  data = [],
  days = 30,
  className = '',
}) {
  const { cells, maxCount } = useMemo(() => {
    const today = new Date()
    const dateMap = new Map()

    for (const item of data) {
      const key = format(new Date(item.date), 'yyyy-MM-dd')
      dateMap.set(key, (dateMap.get(key) || 0) + item.count)
    }

    const maxCount = Math.max(...Array.from(dateMap.values()), 0)

    const cells = []
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i)
      const key = format(date, 'yyyy-MM-dd')
      const count = dateMap.get(key) || 0
      cells.push({
        date,
        count,
        intensity: getIntensity(count, maxCount),
      })
    }

    return { cells, maxCount }
  }, [data, days])

  return (
    <div className={clsx('flex gap-px', className)}>
      {cells.map((cell, i) => (
        <div
          key={i}
          className={clsx('w-1.5 h-4 rounded-sm', INTENSITY_COLORS[cell.intensity])}
          title={`${format(cell.date, 'MMM d')}: ${cell.count}`}
        />
      ))}
    </div>
  )
}

export default ActivityCalendar
