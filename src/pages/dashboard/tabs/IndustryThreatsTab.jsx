/**
 * IndustryThreatsTab Component
 *
 * Dashboard tab showing threats by industry sector:
 * - Industry threat landscape table
 * - Industry event distribution chart
 * - Actor types targeting each industry
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SkeletonTable } from '../../../components'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const ACTOR_TYPE_COLORS = {
  'Nation-State': '#ef4444',
  'Criminal': '#f97316',
  'Hacktivist': '#a855f7',
  'Unknown': '#6b7280',
}

function IndustryRow({ industry, onSelect, isSelected }) {
  return (
    <tr
      onClick={() => onSelect(industry)}
      className={`cursor-pointer transition-colors ${
        isSelected ? 'bg-cyber-accent/10' : 'hover:bg-gray-800/50'
      }`}
    >
      <td>
        <div className="font-medium text-white">{industry.industry}</div>
        <div className="text-xs text-gray-500">
          {industry.unique_actors || 0} unique actors
        </div>
      </td>
      <td>
        <span className="text-lg font-bold text-cyber-accent">
          {industry.event_count?.toLocaleString() || 0}
        </span>
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {industry.actors?.slice(0, 3).map((actor) => (
            <span
              key={actor}
              className="px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400"
            >
              {actor}
            </span>
          ))}
          {industry.actors?.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-500">
              +{industry.actors.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="hidden lg:table-cell">
        <span
          className={`px-2 py-0.5 text-xs rounded border ${
            ACTOR_TYPE_COLORS[industry.actor_type]
              ? `bg-${industry.actor_type === 'Nation-State' ? 'red' : industry.actor_type === 'Criminal' ? 'orange' : 'purple'}-900/50 text-${industry.actor_type === 'Nation-State' ? 'red' : industry.actor_type === 'Criminal' ? 'orange' : 'purple'}-400 border-${industry.actor_type === 'Nation-State' ? 'red' : industry.actor_type === 'Criminal' ? 'orange' : 'purple'}-700/50`
              : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}
        >
          {industry.actor_type || 'Mixed'}
        </span>
      </td>
      <td className="hidden md:table-cell text-sm text-gray-400">
        {industry.events_last_90d || 0}
      </td>
    </tr>
  )
}

function IndustryDetailPanel({ industry, onClose }) {
  if (!industry) return null

  return (
    <div className="w-80 cyber-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">{industry.industry}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="cyber-card bg-gray-800/50">
            <div className="text-2xl font-bold text-cyber-accent">
              {industry.event_count?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-500">Total Events</div>
          </div>
          <div className="cyber-card bg-gray-800/50">
            <div className="text-2xl font-bold text-yellow-400">
              {industry.unique_actors || 0}
            </div>
            <div className="text-xs text-gray-500">Unique Actors</div>
          </div>
        </div>

        {industry.actors?.length > 0 && (
          <div>
            <div className="text-gray-500 mb-2">Top Actors</div>
            <div className="space-y-1">
              {industry.actors.slice(0, 5).map((actor) => (
                <Link
                  key={actor}
                  to={`/actors?search=${encodeURIComponent(actor)}`}
                  className="block px-2 py-1 text-sm rounded bg-gray-800/50 text-gray-300 hover:text-cyber-accent hover:bg-gray-800"
                >
                  {actor}
                </Link>
              ))}
            </div>
          </div>
        )}

        {industry.motives?.length > 0 && (
          <div>
            <div className="text-gray-500 mb-2">Attack Motives</div>
            <div className="flex flex-wrap gap-1">
              {industry.motives.map((motive) => (
                <span
                  key={motive}
                  className="px-2 py-0.5 text-xs rounded bg-purple-900/50 text-purple-400 border border-purple-700/50"
                >
                  {motive}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <div className="text-gray-500 text-xs">Last 90 Days</div>
            <div className="text-white font-medium">{industry.events_last_90d || 0}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Last Year</div>
            <div className="text-white font-medium">{industry.events_last_year || 0}</div>
          </div>
        </div>

        {industry.last_event && (
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
            Last event: {new Date(industry.last_event).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  )
}

export default function IndustryThreatsTab({ industryThreats, loading }) {
  const [selectedIndustry, setSelectedIndustry] = useState(null)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="cyber-card">
          <SkeletonTable rows={10} cols={5} />
        </div>
      </div>
    )
  }

  if (!industryThreats || industryThreats.length === 0) {
    return (
      <div className="cyber-card text-center py-12">
        <svg className="w-12 h-12 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 className="text-gray-400 font-medium">No industry threat data</h3>
        <p className="text-gray-500 text-sm mt-1">
          Run the correlation view refresh to populate industry threats
        </p>
      </div>
    )
  }

  // Aggregate data for chart (group by industry, sum events)
  const chartData = Object.values(
    industryThreats.reduce((acc, item) => {
      if (!acc[item.industry]) {
        acc[item.industry] = { industry: item.industry, events: 0 }
      }
      acc[item.industry].events += item.event_count || 0
      return acc
    }, {})
  )
    .sort((a, b) => b.events - a.events)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Top Industries Chart */}
      <div className="cyber-card">
        <h2 className="text-lg font-semibold text-white mb-4">Top Targeted Industries</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis
                type="category"
                dataKey="industry"
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
                width={95}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="events" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? '#06b6d4' : index < 3 ? '#0891b2' : '#0e7490'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Industry Table + Detail */}
      <div className="flex gap-6">
        <div className="flex-1 cyber-card overflow-hidden">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Industry</th>
                <th>Events</th>
                <th>Top Actors</th>
                <th className="hidden lg:table-cell">Actor Type</th>
                <th className="hidden md:table-cell">Last 90d</th>
              </tr>
            </thead>
            <tbody>
              {industryThreats.slice(0, 20).map((industry, i) => (
                <IndustryRow
                  key={`${industry.industry}-${industry.actor_type}-${i}`}
                  industry={industry}
                  onSelect={setSelectedIndustry}
                  isSelected={selectedIndustry?.industry === industry.industry && selectedIndustry?.actor_type === industry.actor_type}
                />
              ))}
            </tbody>
          </table>
        </div>

        {selectedIndustry && (
          <IndustryDetailPanel
            industry={selectedIndustry}
            onClose={() => setSelectedIndustry(null)}
          />
        )}
      </div>
    </div>
  )
}
