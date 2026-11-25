/**
 * Page titles for the signed-in routes (ideas#162).
 *
 * Each page needs its own `document.title` so a screen reader, a browser tab
 * and the history list can tell them apart. Keys are the path with any
 * trailing detail removed (`/actors/lockbit` -> `/actors`). A path that is not
 * here (a redirect, or the Not found page, which sets its own title) returns
 * null and the title is left alone.
 */
export const SITE_NAME = 'Vigil'

export const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/events': 'Activity',
  '/actors': 'Threat actors',
  '/vulnerabilities': 'Vulnerabilities',
  '/advisories': 'Advisories',
  '/research': 'Vendor research',
  '/sources': 'Sources',
  '/iocs': 'IOC search',
  '/advanced-search': 'Advanced search',
  '/techniques': 'ATT&CK matrix',
  '/watchlists': 'Watchlists',
  '/alerts': 'Alerts',
  '/trends': 'Trends',
  '/review': 'Review queue',
  '/review/reading': 'Review reading',
  '/contested-claims': 'Contested claims',
  '/financial-crime': 'Financial crime',
  '/sanctions': 'Sanctions',
  '/ransom-payments': 'Ransom payments',
  '/disclosures': 'Disclosures',
  '/upper-midwest': 'Upper Midwest',
  '/threat-hunts': 'Threat hunts',
  '/api-docs': 'API documentation',
  '/reports': 'Reports',
  '/investigations': 'Investigations',
  '/assets': 'Assets',
  '/audit-logs': 'Audit logs',
  '/status': 'Status',
  '/webhooks': 'Webhooks',
  '/vendors': 'Vendors',
  '/benchmarks': 'Benchmarks',
  '/chat': 'Chat integrations',
  '/compare': 'Compare',
  '/help': 'Help',
  '/settings': 'Settings',
  '/ops': 'Operations',
  '/patterns': 'Patterns',
  '/attack-chains': 'Attack chains',
  '/geographic-analysis': 'Geographic analysis',
}

/** The full title for a path, or null when the path has no entry. */
export function titleForPath(pathname) {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/'
  const exact = ROUTE_TITLES[clean]
  const name = exact ?? (clean.startsWith('/actors/') ? ROUTE_TITLES['/actors'] : null)
  if (!name) return null
  return `${name} | ${SITE_NAME}`
}
