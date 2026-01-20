/**
 * Public Landing Page - App-Style Demo Experience
 *
 * The landing page IS the product. Visitors see the full interface
 * with demo data, can search and explore, and sign up when ready.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../contexts/DemoContext'

// Demo data for the landing page preview
const DEMO_STATS = {
  totalActors: 247,
  activeIncidents: 523,
  kevCount: 1124,
  iocCount: '1.2M',
}

const DEMO_ACTORS = [
  {
    name: 'LockBit 3.0',
    type: 'Ransomware',
    trend: 'ESCALATING',
    incidents: 12,
    sectors: ['Healthcare', 'Manufacturing'],
  },
  {
    name: 'BlackCat (ALPHV)',
    type: 'Ransomware',
    trend: 'ESCALATING',
    incidents: 8,
    sectors: ['Healthcare', 'Legal'],
  },
  {
    name: 'APT29',
    type: 'Nation-State',
    trend: 'STABLE',
    incidents: 2,
    sectors: ['Government', 'Defense'],
  },
  {
    name: 'Cl0p',
    type: 'Ransomware',
    trend: 'DECLINING',
    incidents: 3,
    sectors: ['Finance', 'Retail'],
  },
  {
    name: 'Play',
    type: 'Ransomware',
    trend: 'ESCALATING',
    incidents: 6,
    sectors: ['Manufacturing', 'Technology'],
  },
]

const DEMO_INCIDENTS = [
  {
    victim: 'Regional Healthcare System',
    actor: 'LockBit 3.0',
    sector: 'Healthcare',
    country: 'United States',
    date: '2 hours ago',
  },
  {
    victim: 'European Manufacturer',
    actor: 'BlackCat',
    sector: 'Manufacturing',
    country: 'Germany',
    date: '5 hours ago',
  },
  {
    victim: 'Law Firm LLP',
    actor: 'BlackCat',
    sector: 'Legal',
    country: 'United Kingdom',
    date: '8 hours ago',
  },
  {
    victim: 'Tech Solutions Inc',
    actor: 'Play',
    sector: 'Technology',
    country: 'United States',
    date: '12 hours ago',
  },
  {
    victim: 'Financial Services Co',
    actor: 'Cl0p',
    sector: 'Finance',
    country: 'Canada',
    date: '1 day ago',
  },
]

const DEMO_KEVS = [
  { cve: 'CVE-2024-21887', product: 'Ivanti Connect Secure', severity: 'Critical', epss: '97.2%' },
  {
    cve: 'CVE-2024-1709',
    product: 'ConnectWise ScreenConnect',
    severity: 'Critical',
    epss: '94.8%',
  },
  { cve: 'CVE-2023-34362', product: 'MOVEit Transfer', severity: 'Critical', epss: '96.1%' },
  { cve: 'CVE-2024-3400', product: 'Palo Alto PAN-OS', severity: 'Critical', epss: '91.3%' },
]

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

function SeverityBadge({ severity }) {
  const styles = {
    Critical: 'bg-red-900/50 text-red-400 border-red-700/50',
    High: 'bg-orange-900/50 text-orange-400 border-orange-700/50',
    Medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded border ${styles[severity]}`}>{severity}</span>
  )
}

function Sidebar({ onNavClick }) {
  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
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

function StatsRow() {
  const stats = [
    { label: 'Threat Actors', value: DEMO_STATS.totalActors, icon: '👤', color: 'text-purple-400' },
    {
      label: 'Incidents (30d)',
      value: DEMO_STATS.activeIncidents,
      icon: '🔴',
      color: 'text-red-400',
    },
    {
      label: 'KEV Vulnerabilities',
      value: DEMO_STATS.kevCount,
      icon: '⚠️',
      color: 'text-yellow-400',
    },
    { label: 'IOC Database', value: DEMO_STATS.iocCount, icon: '🔍', color: 'text-blue-400' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <span>{stat.icon}</span>
            <span>{stat.label}</span>
          </div>
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
        </div>
      ))}
    </div>
  )
}

function EscalatingActors({ onExplore }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-medium text-white">Escalating Threat Actors</h3>
        <button onClick={onExplore} className="text-xs text-cyber-accent hover:underline">
          View All →
        </button>
      </div>
      <div className="divide-y divide-gray-700">
        {DEMO_ACTORS.filter((a) => a.trend === 'ESCALATING').map((actor, i) => (
          <div
            key={i}
            className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
            onClick={onExplore}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white">{actor.name}</span>
              <TrendBadge trend={actor.trend} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{actor.type}</span>
              <span>{actor.incidents} incidents this week</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentIncidents({ onExplore }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-medium text-white">Recent Incidents</h3>
        <button onClick={onExplore} className="text-xs text-cyber-accent hover:underline">
          View All →
        </button>
      </div>
      <div className="divide-y divide-gray-700">
        {DEMO_INCIDENTS.slice(0, 4).map((incident, i) => (
          <div
            key={i}
            className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
            onClick={onExplore}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-white">{incident.victim}</span>
              <span className="text-xs text-gray-500">{incident.date}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-red-400">{incident.actor}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{incident.sector}</span>
              <span className="text-gray-500">•</span>
              <span className="text-gray-400">{incident.country}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KEVList({ onExplore }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-medium text-white">Critical Vulnerabilities (KEV)</h3>
        <button onClick={onExplore} className="text-xs text-cyber-accent hover:underline">
          View All →
        </button>
      </div>
      <div className="divide-y divide-gray-700">
        {DEMO_KEVS.map((vuln, i) => (
          <div
            key={i}
            className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
            onClick={onExplore}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm text-yellow-400">{vuln.cve}</span>
              <SeverityBadge severity={vuln.severity} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{vuln.product}</span>
              <span className="text-orange-400">EPSS: {vuln.epss}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
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
        Search 1.2M+ indicators from ThreatFox, URLhaus, MalwareBazaar
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
          <span className="hidden sm:inline text-sm text-gray-400">
            You&apos;re viewing sample data
          </span>
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

function DashboardContent({ onExplore }) {
  return (
    <div className="space-y-6">
      {/* Search */}
      <SearchBar onSearch={onExplore} />

      {/* Stats */}
      <StatsRow />

      {/* Main Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <EscalatingActors onExplore={onExplore} />
        <RecentIncidents onExplore={onExplore} />
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <KEVList onExplore={onExplore} />
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
        <main className="flex-1 p-6 overflow-auto">
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
