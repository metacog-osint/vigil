/**
 * Regulator disclosures.
 *
 * Everything else in Vigil is an attacker's claim. This page is the other
 * side: what the organisation itself filed with a state attorney general or
 * the SEC, under a legal obligation, naming itself as the victim.
 *
 * Two things this page refuses to do, both deliberate:
 *
 *   It never adds up `persons_affected` across states. Washington counts its
 *   own residents; Oregon counts everyone worldwide. Summing them produces
 *   1.45 billion "people affected", a number about nothing. Each figure is
 *   shown beside the scope that makes it readable.
 *
 *   It never presents `unreviewed` as "no attacker known". Deciding that a
 *   notice and a leak-site claim describe one event is a judgment, and the
 *   review queue is where that happens.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { disclosures, DISCLOSURE_SOURCES, COUNT_SCOPES } from '../lib/supabase'
import { figure } from '../lib/format'

const PAGE_SIZE = 50

/** A dozen or so states publish a readable list. Three of them are in. */
const STATES_INGESTED = 3

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function SourceBadge({ source }) {
  const meta = DISCLOSURE_SOURCES[source]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-700 bg-gray-800/60 text-gray-300 whitespace-nowrap">
      {meta?.label || source}
    </span>
  )
}

/**
 * A count, with the scope that makes it mean something.
 *
 * A bare "1,397,860,427" invites the reader to compare Oregon with Washington,
 * which is the one comparison the data does not support.
 */
function AffectedCount({ value, scope }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600">not published</span>
  }

  const meta = COUNT_SCOPES[scope]
  return (
    <span className="text-gray-300" title={meta?.note || undefined}>
      {value.toLocaleString()}
      {meta && <span className="block text-xs text-gray-500">{meta.label}</span>}
    </span>
  )
}

function StateTotals({ rows }) {
  if (!rows?.length) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const count = row.residents_affected ?? row.people_affected_worldwide
        const scope = COUNT_SCOPES[row.scope]

        return (
          <div key={row.state} className="cyber-card p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-white font-medium">{row.state}</h3>
              <span className="text-2xl font-semibold text-white">{figure(row.notices)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              notices, {formatDate(row.earliest)} to {formatDate(row.latest)}
            </p>

            <div className="mt-3 pt-3 border-t border-gray-800">
              {count === null ? (
                <p className="text-xs text-gray-500">
                  This registry publishes no count of people affected.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-300">
                    {count.toLocaleString()}{' '}
                    <span className="text-gray-500">{scope?.label || 'people'}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    From {figure(row.notices_with_a_count)} of {figure(row.notices)} notices.{' '}
                    {scope?.note}
                  </p>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Disclosures() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(null)
  const [states, setStates] = useState([])
  const [sources, setSources] = useState([])
  const [coverage, setCoverage] = useState(null)

  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // The summaries do not change with the filters, so they load once.
  useEffect(() => {
    let cancelled = false

    async function loadSummaries() {
      const [byState, bySource, cov] = await Promise.all([
        disclosures.totalsByState(),
        disclosures.countsBySource(),
        disclosures.getCoverage(),
      ])
      if (cancelled) return
      if (byState.data) setStates(byState.data)
      if (bySource.data) setSources(bySource.data)
      if (cov.data) setCoverage(cov.data)
    }

    loadSummaries()
    return () => {
      cancelled = true
    }
  }, [])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data,
      count,
      error: err,
    } = await disclosures.getAll({
      source: source || null,
      search: appliedSearch || null,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })

    if (err) {
      setError(err.message)
      setRows([])
      setTotal(null)
    } else {
      setRows(data || [])
      setTotal(count)
    }
    setLoading(false)
  }, [source, appliedSearch, page])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  const lastPage = useMemo(
    () => (typeof total === 'number' ? Math.max(0, Math.ceil(total / PAGE_SIZE) - 1) : 0),
    [total]
  )

  function submitSearch(e) {
    e.preventDefault()
    setPage(0)
    setAppliedSearch(search.trim())
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Regulator disclosures</h1>
        <p className="text-gray-400 mt-1 max-w-3xl">
          What organisations filed about themselves, with a state attorney general or the SEC,
          because the law required it. Every other source in Vigil records what an attacker claimed.
        </p>
      </header>

      {coverage && (
        <div className="cyber-card p-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-semibold text-white">{figure(coverage.total)}</p>
              <p className="text-xs text-gray-500 mt-0.5">filings held</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{figure(coverage.withCount)}</p>
              <p className="text-xs text-gray-500 mt-0.5">carry a count of people affected</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {figure(coverage.withIncidentDate)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">say when the incident happened</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{figure(coverage.reviewed)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                ruled on against Vigil&apos;s incidents
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-800">
            Deciding that a notice and a leak-site claim describe the same event is a judgment, so
            it is queued for a person rather than guessed from a name. An unreviewed filing does not
            mean no attacker is known — it means nobody has ruled on it yet.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-medium text-white">By registry</h2>
          <p className="text-xs text-gray-500">
            {STATES_INGESTED} states ingested; about a dozen more publish a readable list
          </p>
        </div>
        <StateTotals rows={states} />
        <p className="text-xs text-amber-500/90">
          These counts are not comparable with each other. Washington counts its own residents;
          Oregon counts everyone affected worldwide. They are shown separately for that reason and
          are never added together.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">Filings</h2>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label htmlFor="source" className="block text-xs text-gray-400 mb-1">
              Registry
            </label>
            <select
              id="source"
              value={source}
              onChange={(e) => {
                setPage(0)
                setSource(e.target.value)
              }}
              className="cyber-input"
            >
              <option value="">All registries</option>
              {sources.map((s) => (
                <option key={s.source} value={s.source}>
                  {DISCLOSURE_SOURCES[s.source]?.label || s.source} ({s.notices.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={submitSearch} className="flex-1 flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="company" className="block text-xs text-gray-400 mb-1">
                Organisation
              </label>
              <input
                id="company"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the filer's name…"
                className="cyber-input w-full"
              />
            </div>
            <button type="submit" className="cyber-button">
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-500">
          {loading ? 'Loading…' : `${figure(total)} filings match.`}
          {appliedSearch && ` Filtered to names containing "${appliedSearch}".`}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-4 font-medium">Organisation</th>
                <th className="py-2 pr-4 font-medium">Registry</th>
                <th className="py-2 pr-4 font-medium">Filed</th>
                <th className="py-2 pr-4 font-medium">Incident</th>
                <th className="py-2 pr-4 font-medium">People affected</th>
                <th className="py-2 font-medium">Filing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-900 hover:bg-gray-900/40">
                  <td className="py-2 pr-4 text-white">
                    {row.company_name}
                    {Array.isArray(row.items) && row.items.length > 0 && (
                      <span className="ml-2 text-xs text-gray-500">
                        {row.form} item {row.items.join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <SourceBadge source={row.source} />
                  </td>
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                    {formatDate(row.filed_date)}
                  </td>
                  <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                    {formatDate(row.incident_date)}
                  </td>
                  <td className="py-2 pr-4">
                    <AffectedCount
                      value={row.persons_affected}
                      scope={row.persons_affected_scope}
                    />
                  </td>
                  <td className="py-2">
                    {row.filing_url ? (
                      <a
                        href={row.filing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyber-accent hover:underline"
                      >
                        Read it
                      </a>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && rows.length === 0 && !error && (
          <p className="text-gray-500 text-sm py-8 text-center">No filing matches those filters.</p>
        )}

        {typeof total === 'number' && total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="cyber-button disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} of {lastPage + 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="cyber-button disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
