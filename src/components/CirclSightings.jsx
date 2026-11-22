/**
 * Reported exploitation of one CVE from CIRCL's sightings, on the vulnerability panel (194).
 *
 * Its own block, never a KEV label. Each source class stays separate, because a honeypot hit and a
 * Telegram post are different kinds of evidence. Social and code-hosting sources are named by
 * platform and not linked.
 */
import { useEffect, useState } from 'react'
import { vulnerabilities } from '../lib/supabase'
import { fmt } from '../lib/time'

const CREDIT_URL = 'https://vulnerability.circl.lu/vuln/'

export const CLASS_LABELS = {
  honeypot: 'Honeypot',
  government: 'Government',
  vendor_press: 'Vendor or press',
  social_code: 'Social or code hosting',
}

const CLASS_ORDER = ['honeypot', 'government', 'vendor_press', 'social_code']

/** Rows grouped by source class, strongest kind first. Exported for tests. */
export function groupSightings(rows) {
  return CLASS_ORDER.map((key) => ({
    key,
    label: CLASS_LABELS[key],
    rows: (rows || []).filter((row) => row.source_class === key),
  })).filter((group) => group.rows.length > 0)
}

export default function CirclSightings({ cveId, isKev, demo = false }) {
  const [state, setState] = useState({ loading: true, rows: [], failed: false })

  useEffect(() => {
    if (demo || !cveId) return undefined
    let live = true
    setState({ loading: true, rows: [], failed: false })
    vulnerabilities
      .getCirclSightings(cveId)
      .then(({ data, error }) => {
        if (live)
          setState({ loading: false, rows: error ? [] : data || [], failed: Boolean(error) })
      })
      .catch(() => live && setState({ loading: false, rows: [], failed: true }))
    return () => {
      live = false
    }
  }, [cveId, demo])

  if (demo || !cveId || state.loading || state.failed || state.rows.length === 0) return null

  return (
    <div className="p-2 bg-gray-800/40 border border-gray-700/50 rounded">
      <div className="text-xs text-gray-200 font-medium">
        Reported exploited{isKev ? '' : "; not in CISA's KEV catalog"}
      </div>
      {groupSightings(state.rows).map((group) => (
        <div key={group.key} className="text-xs text-gray-400 mt-1">
          <span className="text-gray-300">{group.label}: </span>
          {group.rows.map((row, i) => (
            <span key={`${row.source_name}-${row.source_link}`}>
              {i > 0 ? '; ' : ''}
              {row.source_link ? (
                <a
                  href={row.source_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {row.source_name}
                </a>
              ) : (
                row.source_name
              )}{' '}
              (last {fmt(row.last_sighted_at, { year: true })})
            </span>
          ))}
        </div>
      ))}
      <a
        href={`${CREDIT_URL}${encodeURIComponent(cveId)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:underline"
      >
        Sightings via CIRCL Vulnerability-Lookup
      </a>
    </div>
  )
}
