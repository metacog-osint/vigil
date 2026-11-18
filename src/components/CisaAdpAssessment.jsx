/**
 * CISA's ADP SSVC assessment of one CVE, on the vulnerability panel (migrations 176, 177).
 *
 * Its own line, never a KEV label: CISA rating exploitation "active" is CISA's assessment of
 * reliable public evidence, which is not the same thing as a KEV listing. Where the CVE is not in
 * CISA's KEV catalog the line says so, because that is the case this source adds.
 */
import { useEffect, useState } from 'react'
import { vulnerabilities } from '../lib/supabase'
import { fmt } from '../lib/time'

const SOURCE_URL = 'https://github.com/cisagov/vulnrichment'

const EXPLOITATION = {
  active: 'exploitation active',
  poc: 'exploitation poc (public proof of concept)',
  none: 'exploitation none',
}

/** The line's text, for a row and the vulnerability's KEV status. Exported for tests. */
export function adpLine(row, isKev) {
  if (!row) return null
  const what = EXPLOITATION[row.exploitation] || `exploitation ${row.exploitation}`
  const when = row.assessed_at ? ` (assessed ${fmt(row.assessed_at, { year: true })})` : ''
  const kev = row.exploitation === 'active' && !isKev ? "; not in CISA's KEV catalog" : ''
  return `CISA's ADP assessment: ${what}${when}${kev}`
}

export default function CisaAdpAssessment({ cveId, isKev, demo = false }) {
  const [state, setState] = useState({ loading: true, row: null, failed: false })

  useEffect(() => {
    if (demo || !cveId) return undefined
    let live = true
    setState({ loading: true, row: null, failed: false })
    vulnerabilities
      .getCisaAdp(cveId)
      .then(({ data, error }) => {
        if (live) setState({ loading: false, row: error ? null : data, failed: Boolean(error) })
      })
      .catch(() => live && setState({ loading: false, row: null, failed: true }))
    return () => {
      live = false
    }
  }, [cveId, demo])

  if (demo || !cveId || state.loading) return null
  // A failed read is not "no assessment": say nothing rather than something false.
  if (state.failed) return null

  const { row } = state
  const active = row?.exploitation === 'active'
  return (
    <div
      className={
        active && !isKev
          ? 'p-2 bg-orange-900/20 border border-orange-800/50 rounded'
          : 'p-2 bg-gray-800/40 border border-gray-700/50 rounded'
      }
    >
      <div className={`text-xs ${active ? 'text-orange-300 font-medium' : 'text-gray-300'}`}>
        {row ? adpLine(row, isKev) : "CISA's ADP has not rated this CVE poc or active"}
      </div>
      {row && (row.automatable || row.technical_impact) && (
        <div className="text-xs text-gray-400 mt-1">
          {[
            row.automatable ? `Automatable: ${row.automatable}` : null,
            row.technical_impact ? `Technical impact: ${row.technical_impact}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:underline"
      >
        CISA Vulnrichment (CC0)
      </a>
    </div>
  )
}
