import { useEffect, useState } from 'react'
import { sourceLicences } from '../lib/supabase'
import { commercialUseStatus } from '../lib/supabase/sourceLicences'
import { calendarDay } from '../lib/format'
import { DATA_CREDITS, LICENSE_URL, REPO_URL } from '../components/common/SiteFooter'

const TONE = {
  allowed: 'text-green-400',
  'not-allowed': 'text-red-400',
  unread: 'text-yellow-400',
}

const ATTACK_TERMS = 'https://attack.mitre.org/resources/legal-and-branding/terms-of-use/'

/**
 * Every source Vigil draws on, and what its licence says, read live from
 * `source_licences` so this page cannot drift from what the database enforces.
 *
 * The notes column is deliberately not shown: it carries internal reasoning
 * written for whoever maintains the licence table, not for readers.
 */
export default function Sources() {
  const [state, setState] = useState({ loading: true, error: null, rows: [] })

  useEffect(() => {
    let cancelled = false
    sourceLicences.getAll().then(({ data, error }) => {
      if (cancelled) return
      setState({ loading: false, error, rows: data || [] })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 text-gray-300">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-white">Sources and licences</h1>
        <p>
          Vigil&apos;s{' '}
          <a href={REPO_URL} className="text-cyan-400 hover:underline">
            source code
          </a>{' '}
          is open source under the{' '}
          <a href={LICENSE_URL} className="text-cyan-400 hover:underline">
            GNU Affero General Public License v3.0
          </a>
          . That licence covers the code only. The data comes from the sources below, each on its
          own terms.
        </p>
        <p className="text-sm text-gray-400">
          A leak-site claim is the group&apos;s assertion, not a confirmed breach. &ldquo;Terms
          read&rdquo; is the date someone last read the source&apos;s own terms; a blank means
          nobody has, and a licence nobody has read is not treated as a permissive one.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Every source</h2>
        {state.loading ? (
          <p className="text-sm text-gray-400">Loading the licence register...</p>
        ) : state.error ? (
          <p className="text-sm text-orange-400">
            The licence register could not be read just now. The credits below still apply.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Licence</th>
                  <th className="py-2 pr-4 font-medium">Commercial use</th>
                  <th className="py-2 pr-4 font-medium">Attribution</th>
                  <th className="py-2 font-medium">Terms read</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => {
                  const status = commercialUseStatus(row)
                  return (
                    <tr key={row.source_id} className="border-b border-gray-800/60 align-top">
                      <td className="py-2 pr-4 text-gray-200">
                        {row.licence_url ? (
                          <a href={row.licence_url} className="hover:text-cyan-400 hover:underline">
                            {row.display_name}
                          </a>
                        ) : (
                          row.display_name
                        )}
                      </td>
                      <td className="py-2 pr-4">{row.licence}</td>
                      <td className={`py-2 pr-4 whitespace-nowrap ${TONE[status.tone]}`}>
                        {status.label}
                      </td>
                      <td className="py-2 pr-4">{row.attribution_required ? 'Required' : '—'}</td>
                      <td className="py-2 whitespace-nowrap">
                        {row.checked_on ? calendarDay(row.checked_on) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="text-lg font-semibold text-white">Credits and notices</h2>
        <ul className="space-y-2">
          {DATA_CREDITS.flatMap((group) =>
            group.sources.map((s) => (
              <li key={s.name}>
                {group.label}:{' '}
                <a href={s.url} className="text-cyan-400 hover:underline">
                  {s.name}
                </a>{' '}
                ({s.licence}).
              </li>
            ))
          )}
          <li>
            Source: Ransomware.live (
            <a href="https://www.ransomware.live/" className="text-cyan-400 hover:underline">
              ransomware.live
            </a>
            ), used under its non-commercial terms.
          </li>
          <li>
            Ransom payments: the Ransomwhere dataset,{' '}
            <a
              href="https://doi.org/10.5281/zenodo.6512122"
              className="text-cyan-400 hover:underline"
            >
              doi:10.5281/zenodo.6512122
            </a>
            . A snapshot: payments after its publication date are not in it.
          </li>
          <li>
            ATT&amp;CK®: © 2026 The MITRE Corporation. This work is reproduced and distributed with
            the permission of The MITRE Corporation. (
            <a href={ATTACK_TERMS} className="text-cyan-400 hover:underline">
              Terms of use
            </a>
            )
          </li>
        </ul>
      </section>
    </div>
  )
}
