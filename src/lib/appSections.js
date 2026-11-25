/**
 * The first path segment of every signed-in route in App.jsx (ideas#300).
 *
 * A visitor who has not signed in and opens one of these (a shared link,
 * or a reload that drops demo mode) goes to the landing page, as before.
 * Any other unknown address shows the Not found page. A test checks this
 * list against the routes in App.jsx, so add a section here with its route.
 */
export const APP_SECTIONS = new Set([
  'actors',
  'advanced-search',
  'advisories',
  'alerts',
  'api-docs',
  'assets',
  'attack-chains',
  'audit-logs',
  'benchmarks',
  'bulk-search',
  'chat',
  'compare',
  'contested-claims',
  'custom-iocs',
  'disclosures',
  'events',
  'financial-crime',
  'geographic-analysis',
  'help',
  'incidents',
  'investigations',
  'iocs',
  'ops',
  'patterns',
  'ransom-payments',
  'ransomware',
  'reports',
  'research',
  'review',
  'sanctions',
  'settings',
  'status',
  'techniques',
  'threat-hunts',
  'trends',
  'upper-midwest',
  'vendors',
  'vulnerabilities',
  'watchlists',
  'webhooks',
])

/** True when a logged-out visitor on this path should go to the landing page. */
export function isAppSection(pathname) {
  return APP_SECTIONS.has((pathname || '').split('/')[1] || '')
}
