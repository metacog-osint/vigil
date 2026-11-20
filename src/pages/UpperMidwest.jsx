/**
 * Upper Midwest watch pack: Minnesota, Wisconsin, Iowa, North Dakota, South Dakota.
 *
 * What Vigil already holds about organizations in the five states, by lane,
 * each lane placing an organization by its own field (ideas#51, scope A).
 * The lanes are never added together, and nothing totals people affected.
 * Leak-site claims are criminals' claims; the two ways they are placed here
 * are both unverified, and the page says so beside them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { upperMidwest, UPPER_MIDWEST, DISCLOSURE_SOURCES, COUNT_SCOPES } from '../lib/supabase'
import { figure } from '../lib/format'
import { fmt, fmtDate } from '../lib/time'

const PAGE_SIZE = 50

const LANES = {
  'hhs-ocr': {
    title: 'HIPAA breach reports to HHS',
    placed: "Placed by the covered entity's state, HHS's own field.",
  },
  'sec-edgar': {
    title: 'SEC 8-K Item 1.05 filings',
    placed: "Placed by the company's business address on EDGAR.",
  },
}

function day(value) {
  return value ? fmtDate(value, { year: true }) : '—'
}

function Affected({ value, scope }) {
  if (value === null || value === undefined) return <span className="text-gray-600">—</span>
  const meta = COUNT_SCOPES[scope]
  return (
    <span className="text-gray-300" title={meta?.note || undefined}>
      {value.toLocaleString()}
      {meta && <span className="block text-xs text-gray-500">{meta.label}</span>}
    </span>
  )
}

function StateCards({ rows, since, selected, onSelect }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((r) => {
        const active = selected === r.state
        return (
          <button
            key={r.state}
            type="button"
            onClick={() => onSelect(active ? '' : r.state)}
            aria-pressed={active}
            className={`cyber-card p-3 text-left transition-colors ${
              active ? 'border-cyber-accent' : 'hover:border-gray-600'
            }`}
          >
            <h3 className="text-white font-medium">{r.name}</h3>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">HHS reports</dt>
                <dd className="text-white">{figure(r.hhs)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">filed since {day(since)}</dt>
                <dd className="text-gray-300">{figure(r.hhsYear)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">SEC 8-K filings</dt>
                <dd className="text-white">{figure(r.sec)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">claims whose text names it</dt>
                <dd className="text-amber-400/90">{figure(r.claimsText)}</dd>
              </div>
            </dl>
          </button>
        )
      })}
    </div>
  )
}

function FilingLane({ lane, state }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => setPage(0), [state])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await upperMidwest.getFilings({
      lane,
      state: state || null,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
    if (res.error) {
      setError(res.error.message)
      setRows([])
      setTotal(null)
    } else {
      setRows(res.data)
      setTotal(res.count)
    }
    setLoading(false)
  }, [lane, state, page])

  useEffect(() => {
    load()
  }, [load])

  const lastPage = useMemo(
    () => (typeof total === 'number' ? Math.max(0, Math.ceil(total / PAGE_SIZE) - 1) : 0),
    [total]
  )

  const meta = LANES[lane]
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium text-white">{meta.title}</h2>
        <p className="text-xs text-gray-500">
          {meta.placed} {loading ? 'Loading…' : `${figure(total)} filings.`} Filed by the
          organization itself, to {DISCLOSURE_SOURCES[lane]?.authority}.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-4 font-medium">Organization</th>
              <th className="py-2 pr-4 font-medium">State</th>
              <th className="py-2 pr-4 font-medium">Filed</th>
              {lane === 'hhs-ocr' ? (
                <>
                  <th className="py-2 pr-4 font-medium">Type of breach</th>
                  <th className="py-2 pr-4 font-medium">People affected</th>
                </>
              ) : (
                <th className="py-2 pr-4 font-medium">Address</th>
              )}
              <th className="py-2 font-medium">Filing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-900 hover:bg-gray-900/40">
                <td className="py-2 pr-4 text-white">
                  {row.company_name}
                  {row.covered_entity_type && (
                    <span className="block text-xs text-gray-500">{row.covered_entity_type}</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-gray-400">{row.placed_in || '—'}</td>
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{day(row.filed_date)}</td>
                {lane === 'hhs-ocr' ? (
                  <>
                    <td className="py-2 pr-4 text-gray-400">{row.breach_cause || '—'}</td>
                    <td className="py-2 pr-4">
                      <Affected value={row.persons_affected} scope={row.persons_affected_scope} />
                    </td>
                  </>
                ) : (
                  <td className="py-2 pr-4 text-gray-400">{row.business_location || '—'}</td>
                )}
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
        <p className="text-gray-500 text-sm py-4">No filing in this lane for that state.</p>
      )}

      {typeof total === 'number' && total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
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
  )
}

function ClaimTable({ rows, why }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
            <th className="py-2 pr-4 font-medium">Claimed victim</th>
            <th className="py-2 pr-4 font-medium">Group claiming it</th>
            <th className="py-2 pr-4 font-medium">Claim seen</th>
            <th className="py-2 font-medium">Why it is here</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-gray-900">
              <td className="py-2 pr-4 text-white">
                {c.victim_name}
                {c.victim_sector && (
                  <span className="block text-xs text-gray-500">{c.victim_sector}</span>
                )}
              </td>
              <td className="py-2 pr-4 text-gray-400">{c.threat_actor?.name || '—'}</td>
              <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">
                {fmt(c.discovered_date, { year: true })}
              </td>
              <td className="py-2 text-xs text-amber-400/90">{why(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ClaimsLane({ state }) {
  const [sameName, setSameName] = useState(null)
  const [naming, setNaming] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setSameName(null)
    setNaming(null)
    setError(null)
    Promise.all([
      upperMidwest.getClaimsSameName({ state: state || null }),
      upperMidwest.getClaimsNamingState({ state: state || null }),
    ]).then(([a, b]) => {
      if (cancelled) return
      if (a.error || b.error) setError((a.error || b.error).message)
      setSameName(a.data || [])
      setNaming(b.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [state])

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-white">Leak-site claims</h2>
        <p className="text-xs text-amber-500/90 max-w-3xl">
          These are criminals&apos; claims, not confirmed attacks. Leak sites record no state, so
          nothing here is placed by a field. Each claim below is in one of two marked groups, and
          neither placement has been verified by Vigil.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-white font-medium">Same name as a filing placed here</h3>
        <p className="text-xs text-gray-500 max-w-3xl">
          The claimed victim&apos;s name matches, letter for letter, an organization in the HHS or
          SEC lane above. A shared name is a lead for a person to check, not a ruling that the two
          are one organization or one event.
        </p>
        {sameName === null ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : sameName.length === 0 ? (
          <p className="text-gray-500 text-sm">No claim shares a name with a filing here.</p>
        ) : (
          <ClaimTable
            rows={sameName}
            why={(c) =>
              `Same name as ${c.matched
                .map((m) => `${DISCLOSURE_SOURCES[m.source]?.short || m.source} filing, ${m.state}`)
                .join('; ')}`
            }
          />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-white font-medium">The claim&apos;s text names the state</h3>
        <p className="text-xs text-gray-500 max-w-3xl">
          The group&apos;s own description of the victim mentions the state by name. Unverified: the
          text may name a branch, a customer or a place unrelated to the victim. Only some claims
          carry a description at all.
        </p>
        {naming === null ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : naming.length === 0 ? (
          <p className="text-gray-500 text-sm">No claim&apos;s text names the state.</p>
        ) : (
          <ClaimTable
            rows={naming}
            why={(c) =>
              `Text names ${c.states_named
                .map((s) => UPPER_MIDWEST.find((u) => u.code === s)?.name || s)
                .join(' and ')}`
            }
          />
        )}
      </div>
    </section>
  )
}

export default function UpperMidwest() {
  const [counts, setCounts] = useState([])
  const [since, setSince] = useState(null)
  const [state, setState] = useState('')

  useEffect(() => {
    let cancelled = false
    upperMidwest.getCounts().then((res) => {
      if (cancelled || !res.data) return
      setCounts(res.data)
      setSince(res.since)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stateLabel = state ? UPPER_MIDWEST.find((s) => s.code === state)?.name : 'all five states'

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Upper Midwest watch</h1>
        <p className="text-gray-400 mt-1 max-w-3xl">
          What Vigil holds about organizations in Minnesota, Wisconsin, Iowa, North Dakota and South
          Dakota. Each lane places an organization by its own field, so the lanes are shown apart
          and never added together.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium text-white">By state</h2>
          <p className="text-xs text-gray-500">
            Showing {stateLabel}. Pick a state to filter every lane; pick it again for all five.
          </p>
        </div>
        {counts.length > 0 ? (
          <StateCards rows={counts} since={since} selected={state} onSelect={setState} />
        ) : (
          <p className="text-xs text-gray-500">Loading…</p>
        )}
        <p className="text-xs text-gray-500 max-w-3xl">
          Database counts. No state attorney general registry for these five states is held:
          Minnesota, North Dakota and South Dakota publish no list, and Iowa&apos;s and
          Wisconsin&apos;s would name organizations that notified residents there, not organizations
          located there. The registries Vigil does hold (California, Washington, Oregon and others)
          are not used here, because their state is the registry&apos;s, not the
          organization&apos;s. Dates are calendar days; claim times are in your time zone, named.
        </p>
      </section>

      <FilingLane lane="hhs-ocr" state={state} />
      <FilingLane lane="sec-edgar" state={state} />
      <ClaimsLane state={state} />
    </div>
  )
}
