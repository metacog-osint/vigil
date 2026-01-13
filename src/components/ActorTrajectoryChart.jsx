import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'

// Color palette for actors
const ACTOR_COLORS = [
  '#00ff88', // cyber accent
  '#ff6b35', // warning
  '#00b4d8', // info
  '#ff3366', // critical
  '#a855f7', // purple
  '#eab308', // yellow
  '#14b8a6', // teal
  '#f97316', // orange
]

/**
 * ActorTrajectoryChart - Shows activity trends for selected actors over time
 */
export function ActorTrajectoryChart({
  actorIds = [],
  days = 30,
  height = 300,
  showLegend = true,
  className = '',
}) {
  const [data, setData] = useState([])
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (actorIds.length > 0) {
      loadTrajectoryData()
    } else {
      setData([])
      setLoading(false)
    }
  }, [actorIds, days])

  async function loadTrajectoryData() {
    setLoading(true)
    try {
      // Get actor names
      const { data: actorData } = await supabase
        .from('threat_actors')
        .select('id, name')
        .in('id', actorIds)

      setActors(actorData || [])

      // Get trajectory history
      const startDate = subDays(new Date(), days).toISOString().split('T')[0]
      const { data: historyData } = await supabase
        .from('actor_trend_history')
        .select('actor_id, recorded_date, incidents_7d')
        .in('actor_id', actorIds)
        .gte('recorded_date', startDate)
        .order('recorded_date', { ascending: true })

      // Transform data for chart
      const dateMap = new Map()

      // Initialize all dates
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd')
        dateMap.set(date, { date })
      }

      // Fill in actor data
      for (const record of historyData || []) {
        const entry = dateMap.get(record.recorded_date)
        if (entry) {
          entry[record.actor_id] = record.incidents_7d
        }
      }

      setData(Array.from(dateMap.values()))
    } catch (error) {
      console.error('Error loading trajectory data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-800/50 rounded-lg ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading trajectory data...
        </div>
      </div>
    )
  }

  if (actorIds.length === 0) {
    return (
      <div className={`bg-gray-800/30 rounded-lg ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full text-gray-500">
          Select actors to view trajectory
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(value) => format(new Date(value), 'MM/dd')}
          />
          <YAxis stroke="#9ca3af" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => {
                const actor = actors.find((a) => a.id === value)
                return <span className="text-gray-300">{actor?.name || value}</span>
              }}
            />
          )}
          {actorIds.map((actorId, index) => (
            <Line
              key={actorId}
              type="monotone"
              dataKey={actorId}
              stroke={ACTOR_COLORS[index % ACTOR_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name={actorId}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * ActorTrajectoryMini - Compact version for detail panels
 */
export function ActorTrajectoryMini({ actorId, days = 14, height = 80 }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (actorId) {
      loadData()
    }
  }, [actorId, days])

  async function loadData() {
    setLoading(true)
    try {
      const startDate = subDays(new Date(), days).toISOString().split('T')[0]
      const { data: historyData } = await supabase
        .from('actor_trend_history')
        .select('recorded_date, incidents_7d')
        .eq('actor_id', actorId)
        .gte('recorded_date', startDate)
        .order('recorded_date', { ascending: true })

      setData(
        (historyData || []).map((d) => ({
          date: d.recorded_date,
          value: d.incidents_7d,
        }))
      )
    } catch (error) {
      console.error('Error loading mini trajectory:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || data.length === 0) {
    return (
      <div className="h-20 bg-gray-800/30 rounded animate-pulse" />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="#00ff88"
          strokeWidth={2}
          dot={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '4px',
            fontSize: '12px',
          }}
          labelFormatter={(value) => format(new Date(value), 'MMM d')}
          formatter={(value) => [`${value} incidents`, '7d']}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * ActorSelector - Multi-select dropdown for choosing actors
 */
export function ActorSelector({ selectedIds, onChange, maxSelections = 5 }) {
  const [actors, setActors] = useState([])
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadActors()
  }, [])

  async function loadActors() {
    const { data } = await supabase
      .from('threat_actors')
      .select('id, name, incidents_7d, trend_status')
      .order('incidents_7d', { ascending: false, nullsFirst: false })
      .limit(50)

    setActors(data || [])
  }

  const filteredActors = actors.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedActors = actors.filter((a) => selectedIds.includes(a.id))

  function toggleActor(actorId) {
    if (selectedIds.includes(actorId)) {
      onChange(selectedIds.filter((id) => id !== actorId))
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, actorId])
    }
  }

  return (
    <div className="relative">
      <div
        className="cyber-input flex flex-wrap gap-1 min-h-[40px] cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedActors.length === 0 ? (
          <span className="text-gray-500">Select actors to compare...</span>
        ) : (
          selectedActors.map((actor) => (
            <span
              key={actor.id}
              className="badge-info flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation()
                toggleActor(actor.id)
              }}
            >
              {actor.name}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actors..."
              className="cyber-input w-full text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredActors.map((actor) => (
              <div
                key={actor.id}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-gray-700 ${
                  selectedIds.includes(actor.id) ? 'bg-gray-700' : ''
                }`}
                onClick={() => toggleActor(actor.id)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(actor.id)}
                    readOnly
                    className="form-checkbox text-cyber-accent"
                  />
                  <span className="text-white">{actor.name}</span>
                </div>
                <span className="text-xs text-gray-400">{actor.incidents_7d || 0}/7d</span>
              </div>
            ))}
          </div>
          {selectedIds.length >= maxSelections && (
            <div className="p-2 text-xs text-gray-500 border-t border-gray-700">
              Max {maxSelections} actors can be selected
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  )
}

export default ActorTrajectoryChart
