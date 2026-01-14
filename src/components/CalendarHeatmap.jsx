import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// Helper to get dates for the past N days
function getDaysArray(numDays) {
  const days = []
  const today = new Date()
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    days.push(date)
  }
  return days
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

// Get color based on count
function getColor(count, maxCount) {
  if (count === 0) return '#1f2937' // Gray-800
  const intensity = Math.min(count / maxCount, 1)

  if (intensity > 0.75) return '#0891b2' // Cyan-600
  if (intensity > 0.5) return '#06b6d4' // Cyan-500
  if (intensity > 0.25) return '#22d3ee' // Cyan-400
  return '#67e8f9' // Cyan-300
}

// Month names
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarHeatmap({
  days = 365,
  actorId = null,
  sector = null,
  onDayClick,
  title = 'Attack Activity',
}) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)

  // Calculate the date array
  const dateArray = useMemo(() => getDaysArray(days), [days])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      let query = supabase
        .from('incidents')
        .select('discovered_date')
        .gte('discovered_date', cutoffDate.toISOString())

      if (actorId) {
        query = query.eq('actor_id', actorId)
      }

      if (sector) {
        query = query.eq('victim_sector', sector)
      }

      const { data: incidents } = await query

      if (incidents) {
        const countByDate = {}
        incidents.forEach(inc => {
          const dateStr = inc.discovered_date?.split('T')[0]
          if (dateStr) {
            countByDate[dateStr] = (countByDate[dateStr] || 0) + 1
          }
        })
        setData(countByDate)
      }

      setLoading(false)
    }

    fetchData()
  }, [days, actorId, sector])

  // Calculate max for color scaling
  const maxCount = useMemo(() => {
    const counts = Object.values(data)
    return Math.max(...counts, 1)
  }, [data])

  // Organize days into weeks for grid layout
  const weeks = useMemo(() => {
    const result = []
    let currentWeek = []

    // Pad the first week with empty cells
    const firstDay = dateArray[0]
    const startPadding = firstDay.getDay()
    for (let i = 0; i < startPadding; i++) {
      currentWeek.push(null)
    }

    dateArray.forEach(date => {
      currentWeek.push(date)
      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
      }
    })

    // Add remaining days
    if (currentWeek.length > 0) {
      result.push(currentWeek)
    }

    return result
  }, [dateArray])

  // Get month labels with positions
  const monthLabels = useMemo(() => {
    const labels = []
    let lastMonth = -1

    weeks.forEach((week, weekIndex) => {
      const firstValidDay = week.find(d => d !== null)
      if (firstValidDay) {
        const month = firstValidDay.getMonth()
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], weekIndex })
          lastMonth = month
        }
      }
    })

    return labels
  }, [weeks])

  // Stats
  const stats = useMemo(() => {
    const counts = Object.values(data)
    const total = counts.reduce((a, b) => a + b, 0)
    const activeDays = counts.filter(c => c > 0).length
    const avgPerDay = total / Math.max(dateArray.length, 1)
    const peakDay = Object.entries(data).sort((a, b) => b[1] - a[1])[0]

    return { total, activeDays, avgPerDay, peakDay }
  }, [data, dateArray])

  const handleMouseEnter = (date, count, evt) => {
    if (!date) return
    setTooltip({
      date: formatDate(date),
      count,
      x: evt.clientX,
      y: evt.clientY,
    })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  const handleClick = (date, count) => {
    if (date && onDayClick) {
      onDayClick({ date: formatDate(date), count })
    }
  }

  const cellSize = 11
  const cellGap = 2
  const labelWidth = 30

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{stats.total.toLocaleString()} incidents</span>
          <span>{stats.activeDays} active days</span>
          <span>{stats.avgPerDay.toFixed(1)}/day avg</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="flex mb-1" style={{ marginLeft: labelWidth }}>
            {monthLabels.map((label, i) => (
              <div
                key={i}
                className="text-xs text-gray-500"
                style={{
                  position: 'absolute',
                  left: `${labelWidth + label.weekIndex * (cellSize + cellGap)}px`,
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          <div className="flex mt-4">
            {/* Day labels */}
            <div className="flex flex-col justify-around pr-2" style={{ width: labelWidth }}>
              <span className="text-xs text-gray-500">Mon</span>
              <span className="text-xs text-gray-500">Wed</span>
              <span className="text-xs text-gray-500">Fri</span>
            </div>

            {/* Grid */}
            <div className="flex gap-0.5">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-0.5">
                  {week.map((date, dayIndex) => {
                    if (!date) {
                      return (
                        <div
                          key={dayIndex}
                          style={{ width: cellSize, height: cellSize }}
                        />
                      )
                    }

                    const dateStr = formatDate(date)
                    const count = data[dateStr] || 0

                    return (
                      <div
                        key={dayIndex}
                        className="rounded-sm cursor-pointer transition-colors hover:ring-1 hover:ring-cyan-400"
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: getColor(count, maxCount),
                        }}
                        onMouseEnter={(e) => handleMouseEnter(date, count, e)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(date, count)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500">
            <span>Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: getColor(intensity * maxCount, maxCount),
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      )}

      {/* Peak day highlight */}
      {stats.peakDay && (
        <div className="text-xs text-gray-500">
          Peak: {stats.peakDay[1]} incidents on {new Date(stats.peakDay[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded shadow-lg px-3 py-2 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          <div className="text-sm text-white font-medium">{tooltip.count} incidents</div>
          <div className="text-xs text-gray-400">
            {new Date(tooltip.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for dashboard
export function CalendarHeatmapMini({ days = 90, onViewFull }) {
  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Activity Calendar</h3>
        {onViewFull && (
          <button
            onClick={onViewFull}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            View Full Year
          </button>
        )}
      </div>
      <CalendarHeatmap days={days} />
    </div>
  )
}
