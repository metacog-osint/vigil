// Empty state components for when no data is available
import { clsx } from 'clsx'

// SVG illustrations for empty states
const illustrations = {
  // Generic empty/search illustration
  search: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="50" cy="50" r="20" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="72" y1="72" x2="95" y2="95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <circle cx="95" cy="95" r="8" fill="currentColor" opacity="0.2" />
      <path d="M45 45 L55 55 M55 45 L45 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  // Shield/security illustration
  shield: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 15 L95 30 V60 C95 85 60 105 60 105 C60 105 25 85 25 60 V30 L60 15Z" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <path d="M60 25 L85 37 V58 C85 78 60 93 60 93 C60 93 35 78 35 58 V37 L60 25Z" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M50 55 L57 62 L72 47" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  ),
  // Users/actors illustration
  users: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="35" r="15" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="60" cy="35" r="10" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M30 95 C30 75 45 65 60 65 C75 65 90 75 90 95" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <path d="M38 90 C38 75 48 68 60 68 C72 68 82 75 82 90" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="35" cy="50" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="85" cy="50" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  ),
  // List/data illustration
  list: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="25" width="80" height="15" rx="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <rect x="20" y="50" width="80" height="15" rx="3" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <rect x="20" y="75" width="80" height="15" rx="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="30" cy="32.5" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="30" cy="57.5" r="3" fill="currentColor" opacity="0.6" />
      <circle cx="30" cy="82.5" r="3" fill="currentColor" opacity="0.5" />
      <line x1="40" y1="32.5" x2="90" y2="32.5" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="40" y1="57.5" x2="75" y2="57.5" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="40" y1="82.5" x2="85" y2="82.5" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    </svg>
  ),
  // Alert/warning illustration
  alert: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 20 L100 90 H20 L60 20Z" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <path d="M60 30 L90 85 H30 L60 30Z" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="60" y1="50" x2="60" y2="65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <circle cx="60" cy="75" r="3" fill="currentColor" opacity="0.6" />
    </svg>
  ),
  // Chart/analytics illustration
  chart: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="95" x2="100" y2="95" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="20" y1="25" x2="20" y2="95" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <rect x="30" y="55" width="15" height="40" rx="2" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      <rect x="52" y="35" width="15" height="60" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <rect x="74" y="50" width="15" height="45" rx="2" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
    </svg>
  ),
  // Network/IOC illustration
  network: (
    <svg className="w-full h-full" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="12" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <circle cx="30" cy="35" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.4" />
      <circle cx="90" cy="35" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.4" />
      <circle cx="30" cy="85" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.4" />
      <circle cx="90" cy="85" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.4" />
      <line x1="50" y1="52" x2="36" y2="41" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="70" y1="52" x2="84" y2="41" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="50" y1="68" x2="36" y2="79" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="70" y1="68" x2="84" y2="79" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="60" cy="60" r="5" fill="currentColor" opacity="0.3" />
    </svg>
  ),
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className = '',
  size = 'md', // sm, md, lg
}) {
  const sizes = {
    sm: { container: 'py-8', illustration: 'w-16 h-16', title: 'text-base', desc: 'text-xs' },
    md: { container: 'py-12', illustration: 'w-24 h-24', title: 'text-lg', desc: 'text-sm' },
    lg: { container: 'py-16', illustration: 'w-32 h-32', title: 'text-xl', desc: 'text-base' },
  }

  const s = sizes[size]

  return (
    <div className={clsx('flex flex-col items-center justify-center px-4 text-center', s.container, className)}>
      {/* Illustration or Icon */}
      {illustration && illustrations[illustration] ? (
        <div className={clsx('text-gray-600 mb-4', s.illustration)}>
          {illustrations[illustration]}
        </div>
      ) : icon ? (
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-gray-500">
          {icon}
        </div>
      ) : null}

      <h3 className={clsx('font-medium text-gray-300 mb-2', s.title)}>{title}</h3>
      {description && (
        <p className={clsx('text-gray-500 max-w-sm mb-4', s.desc)}>{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function EmptyIncidents() {
  return (
    <EmptyState
      illustration="alert"
      title="No incidents found"
      description="No ransomware incidents match your current filters. Try adjusting your search criteria."
    />
  )
}

export function EmptyActors() {
  return (
    <EmptyState
      illustration="users"
      title="No threat actors found"
      description="No threat actors match your current search. Try different keywords or clear filters."
    />
  )
}

export function EmptyVulnerabilities() {
  return (
    <EmptyState
      illustration="shield"
      title="No vulnerabilities found"
      description="No CVEs match your current filters. Try adjusting severity or date range."
    />
  )
}

export function EmptyIOCs() {
  return (
    <EmptyState
      illustration="network"
      title="No IOCs found"
      description="Enter an IP address, domain, URL, or hash to search our threat intelligence database."
    />
  )
}

export function EmptySearch({ query }) {
  return (
    <EmptyState
      illustration="search"
      title={query ? `No results for "${query}"` : 'No results found'}
      description="Try different keywords or check for typos in your search."
    />
  )
}

export function EmptyList({ title = 'No items yet', description }) {
  return (
    <EmptyState
      illustration="list"
      title={title}
      description={description || 'Items will appear here once available.'}
    />
  )
}

export function EmptyChart({ title = 'No data available', description }) {
  return (
    <EmptyState
      illustration="chart"
      title={title}
      description={description || 'Chart data will appear once available.'}
      size="sm"
    />
  )
}

export default EmptyState
