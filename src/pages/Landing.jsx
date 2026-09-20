/**
 * Public Landing Page - App-Style Demo Experience
 *
 * The landing page IS the product. Visitors see the full interface
 * with demo data, can search and explore, and sign up when ready.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../contexts/DemoContext'
import { landing } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

// Formatting for the live snapshot. Nothing on this page is invented: every
// figure comes from the database, and a section that cannot load shows nothing
// rather than a placeholder number.

function compact(n) {
  if (n === null || n === undefined) return null
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 10000) return Math.round(n / 1000) + 'k'
  return n.toLocaleString()
}

function sinceDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return formatDistanceToNow(d, { addSuffix: true })
}

const ACRONYMS = new Set(['apt', 'ics', 'ot', 'iot'])

function titleCase(value) {
  if (!value) return null
  if (ACRONYMS.has(value.toLowerCase())) return value.toUpperCase()
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const NAV_ITEMS = [
  { icon: '📊', label: 'Dashboard', active: true },
  { icon: '👤', label: 'Threat Actors' },
  { icon: '🔴', label: 'Incidents' },
  { icon: '⚠️', label: 'Vulnerabilities' },
  { icon: '🔍', label: 'IOC Search' },
  { icon: '📈', label: 'Trends' },
]

function TrendBadge({ trend }) {
  const styles = {
    ESCALATING: 'bg-red-900/50 text-red-400 border-red-700/50',
    STABLE: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
    DECLINING: 'bg-green-900/50 text-green-400 border-green-700/50',
  }
  const icons = { ESCALATING: '↑', STABLE: '→', DECLINING: '↓' }

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[trend]}`}>
      {icons[trend]} {trend}
    </span>
  )
}

function Sidebar({ onNavClick }) {
  return (
    <div className="hidden lg:flex w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="text-xl font-bold text-cyber-accent">VIGIL</div>
        <div className="text-xs text-gray-500">Threat Intelligence</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => onNavClick(item.label)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              item.active
                ? 'bg-cyber-accent/10 text-cyber-accent'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom CTA */}
      <div className="p-4 border-t border-gray-800">
        <Link
          to="/auth?mode=register"
          className="block w-full py-2 px-4 bg-cyber-accent text-black text-sm font-medium rounded-lg text-center hover:bg-cyber-accent/90 transition-colors"
        >
          Create Free Account
        </Link>
        <p className="text-xs text-gray-500 text-center mt-2">Full access. No credit card.</p>
      </div>
    </div>
  )
}

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch(query)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search actors, CVEs, IOCs, incidents..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyber-accent/50"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </form>
  )
}

function StatsRow({ stats, loading }) {
  const cards = [
    {
      label: 'Threat Actors',
      value: compact(stats?.totalActors),
      icon: '👤',
      color: 'text-purple-400',
    },
    {
      label: 'Incidents (30d)',
      value: compact(stats?.incidents30d),
      icon: '🔴',
      color: 'text-red-400',
    },
    {
      label: 'KEV Vulnerabilities',
      value: compact(stats?.kevTotal),
      icon: '⚠️',
      color: 'text-yellow-400',
    },
    { label: 'Indicators', value: compact(stats?.iocTotal), icon: '🔍', color: 'text-blue-400' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((stat) => (
        <div key={stat.label} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <span>{stat.icon}</span>
            <span>{stat.label}</span>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-gray-700/50 rounded animate-pulse" />
          ) : (
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value ?? '—'}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function CardShell({ title, onExplore, children }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-medium text-white">{title}</h3>
        <button onClick={onExplore} className="text-xs text-cyber-accent hover:underline">
          View All →
        </button>
      </div>
      {children}
    </div>
  )
}

function RowSkeleton({ rows = 3 }) {
  return (
    <div className="divide-y divide-gray-700">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 space-y-2">
          <div className="h-4 w-1/2 bg-gray-700/50 rounded animate-pulse" />
          <div className="h-3 w-1/3 bg-gray-700/40 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function EmptyRow({ children }) {
  return <div className="p-4 text-sm text-gray-500">{children}</div>
}

function EscalatingActors({ actors, loading, onExplore }) {
  return (
    <CardShell title="Escalating Threat Actors" onExplore={onExplore}>
      {loading ? (
        <RowSkeleton />
      ) : actors.length === 0 ? (
        <EmptyRow>No group is escalating right now.</EmptyRow>
      ) : (
        <div className="divide-y divide-gray-700">
          {actors.map((actor) => (
            <div
              key={actor.id}
              className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={onExplore}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white">{actor.name}</span>
                <TrendBadge trend={actor.trend_status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{titleCase(actor.actor_type) || 'Unknown type'}</span>
                <span>
                  {actor.incidents_7d} {actor.incidents_7d === 1 ? 'victim' : 'victims'} this week
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

function RecentIncidents({ incidents, loading, onExplore }) {
  return (
    <CardShell title="Recent Incidents" onExplore={onExplore}>
      {loading ? (
        <RowSkeleton />
      ) : incidents.length === 0 ? (
        <EmptyRow>No incidents recorded yet.</EmptyRow>
      ) : (
        <div className="divide-y divide-gray-700">
          {incidents.slice(0, 4).map((incident) => (
            <div
              key={incident.id}
              className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={onExplore}
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-medium text-white truncate">{incident.victim}</span>
                <span className="text-xs text-gray-500 shrink-0">{sinceDate(incident.date)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {incident.actor && <span className="text-red-400">{incident.actor}</span>}
                {/* Sector and country appear only when the source supplied them */}
                {incident.sector && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">{titleCase(incident.sector)}</span>
                  </>
                )}
                {incident.country && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400">{incident.country}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

function KEVList({ kev, loading, onExplore }) {
  return (
    <CardShell title="Known Exploited Vulnerabilities" onExplore={onExplore}>
      {loading ? (
        <RowSkeleton />
      ) : kev.length === 0 ? (
        <EmptyRow>No KEV entries loaded.</EmptyRow>
      ) : (
        <div className="divide-y divide-gray-700">
          {kev.map((vuln) => (
            <div
              key={vuln.cve}
              className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={onExplore}
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-mono text-sm text-yellow-400">{vuln.cve}</span>
                {vuln.ransomware && (
                  <span className="px-2 py-0.5 text-xs rounded border bg-red-900/50 text-red-400 border-red-700/50">
                    Ransomware
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-400 truncate">{vuln.subject || 'See advisory'}</span>
                {/* EPSS exists for some entries only; no score is invented */}
                {vuln.epss !== null && vuln.epss !== undefined && (
                  <span className="text-orange-400 shrink-0">
                    EPSS {(Number(vuln.epss) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

function QuickIOCCheck({ onExplore }) {
  const [ioc, setIoc] = useState('')

  const handleCheck = (e) => {
    e.preventDefault()
    onExplore()
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <h3 className="font-medium text-white mb-3">Quick IOC Check</h3>
      <form onSubmit={handleCheck}>
        <div className="flex gap-2">
          <input
            type="text"
            value={ioc}
            onChange={(e) => setIoc(e.target.value)}
            placeholder="Enter IP, hash, or domain..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyber-accent/50"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-cyber-accent text-black text-sm font-medium rounded hover:bg-cyber-accent/90 transition-colors"
          >
            Check
          </button>
        </div>
      </form>
      <p className="text-xs text-gray-500 mt-2">
        Search indicators from ThreatFox, URLhaus, MalwareBazaar and more
      </p>
    </div>
  )
}

function TopBanner() {
  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">
            <span className="text-cyber-accent font-medium">Live threats.</span> Deep history.{' '}
            <span className="text-white">Full context.</span>
          </span>
          <span className="hidden sm:inline text-gray-500">|</span>
          {/* This page reads the live database, so it must not claim otherwise. */}
          <span className="hidden sm:inline text-sm text-gray-400">Live data, updated hourly</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth?mode=login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/auth?mode=register"
            className="px-4 py-1.5 bg-cyber-accent text-black text-sm font-medium rounded-lg hover:bg-cyber-accent/90 transition-colors"
          >
            Create Free Account
          </Link>
        </div>
      </div>
    </div>
  )
}

const EMPTY_SNAPSHOT = { stats: null, escalating: [], incidents: [], kev: [] }

function DashboardContent({ onExplore }) {
  // The landing page reads the live database as an anonymous visitor. If the
  // request fails the sections stay empty rather than showing invented figures.
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    landing
      .getSnapshot()
      .then((data) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch(() => {
        if (!cancelled) setSnapshot(EMPTY_SNAPSHOT)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Search */}
      <SearchBar onSearch={onExplore} />

      {/* Stats */}
      <StatsRow stats={snapshot.stats} loading={loading} />

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <EscalatingActors actors={snapshot.escalating} loading={loading} onExplore={onExplore} />
        <RecentIncidents incidents={snapshot.incidents} loading={loading} onExplore={onExplore} />
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <KEVList kev={snapshot.kev} loading={loading} onExplore={onExplore} />
        </div>
        <QuickIOCCheck onExplore={onExplore} />
      </div>
    </div>
  )
}

export default function Landing() {
  const { enterDemoMode } = useDemo()

  const handleExplore = () => {
    enterDemoMode()
  }

  const handleNavClick = () => {
    enterDemoMode()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Banner */}
      <TopBanner />

      {/* Main Layout */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar onNavClick={handleNavClick} />

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Threat Intelligence Dashboard</h1>
              <p className="text-gray-400 text-sm mt-1">
                Real-time monitoring of ransomware, APTs, and emerging threats
              </p>
            </div>

            {/* Dashboard Content */}
            <DashboardContent onExplore={handleExplore} />

            {/* Bottom CTA */}
            <div className="mt-12 text-center py-8 border-t border-gray-800">
              <h2 className="text-xl font-semibold text-white mb-2">
                Ready to explore the full platform?
              </h2>
              <p className="text-gray-400 mb-4">
                Create a free account for full access to all threat data, alerts, and exports.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  to="/auth?mode=register"
                  className="px-6 py-3 bg-cyber-accent text-black font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors"
                >
                  Create Free Account
                </Link>
                <button
                  onClick={enterDemoMode}
                  className="px-6 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  Continue Exploring Demo
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
