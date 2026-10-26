/**
 * Where ransom money went, by family, from the Ransomwhere deposit.
 *
 * 136 families and 21,790 payments have been in the database since 4 October
 * and nothing rendered them. This is the one ransom-payment source Vigil holds
 * under a licence that allows selling it (CC BY 4.0), and the most direct
 * answer it has to "follow the money".
 *
 * Three things this page is careful about, in the order a reader meets them:
 *
 *   The age of the data comes before any figure. The snapshot was published in
 *   October 2024 and its last payment is August 2024. The import checks Zenodo
 *   every week and the feed reads fresh; the payments are two years old.
 *
 *   There is no headline total. Two thirds of the money sits under
 *   "Unlabeled", addresses the dataset could not attribute. The page shows
 *   attributed and unlabeled side by side with the share, and the query layer
 *   has no method that adds them (src/lib/supabase/ransomPayments.js).
 *
 *   The family names are the dataset's labels, not Vigil's attribution, and
 *   they are not linked to actor pages. Deciding that a payment family is a
 *   tracked group is a judgment for the review queue, not a string match.
 */
import { useEffect, useMemo, useState } from 'react'
import { ransomPayments, RANSOMWHERE_CITATION } from '../lib/supabase'
import { figure, usd } from '../lib/format'

/**
 * The dataset's dates are calendar days. Parsed as local time, "2024-08-19"
 * would render as 18 August anywhere west of UTC.
 */
function formatDay(value) {
  if (!value) return 'an unknown date'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value)
  if (Number.isNaN(d.getTime())) return 'an unknown date'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function percent(share) {
  return typeof share === 'number' ? `${Math.round(share * 100)}%` : '—'
}

const SORTS = {
  usd: { label: 'Most money', compare: (a, b) => (b.usd ?? 0) - (a.usd ?? 0) },
  payments: { label: 'Most payments', compare: (a, b) => (b.payments ?? 0) - (a.payments ?? 0) },
  recent: {
    label: 'Most recent payment',
    compare: (a, b) => String(b.lastPayment ?? '').localeCompare(String(a.lastPayment ?? '')),
  },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
}

function Snapshot({ snapshot }) {
  if (!snapshot) return null

  // Said before the numbers, because the numbers invite reading them as current.
  return (
    <div className="cyber-card p-4 border-amber-800/50 space-y-2">
      <p className="text-sm text-amber-200/90">
        <strong className="font-medium">This is a snapshot, not a feed.</strong>{' '}
        {snapshot.mixed ? (
          <>
            The rows come from more than one version of the deposit ({snapshot.versions.join(', ')}
            ), so the figures below mix them.
          </>
        ) : (
          <>
            Version {snapshot.version ?? 'unknown'}, published {formatDay(snapshot.published)}.
          </>
        )}{' '}
        The last payment it records is {formatDay(snapshot.lastPayment)}. Nothing paid after that
        date is here, and re-running the import will not add it.
      </p>
      <p className="text-xs text-amber-200/60">
        Vigil checks Zenodo weekly for a new version. A check that finds none is a working feed
        serving old data, which is why the age is stated here rather than inferred from the
        feed&apos;s freshness.
      </p>
    </div>
  )
}

function Counts({ summary }) {
  if (!summary) return null

  const cells = [
    {
      value: usd(summary.attributedUsd, { compact: true }),
      label: 'paid to addresses attributed to a named family',
    },
    {
      value: usd(summary.unlabeledUsd, { compact: true }),
      label: `paid to addresses the dataset could not attribute (${percent(summary.unlabeledShare)} of the money)`,
      muted: true,
    },
    { value: figure(summary.namedFamilies), label: 'named families' },
    { value: figure(summary.attributedPayments), label: 'payments to named families' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="cyber-card p-4">
          <div className={`text-2xl font-semibold ${cell.muted ? 'text-gray-300' : 'text-white'}`}>
            {cell.value}
          </div>
          <div className="text-xs text-gray-500 mt-1">{cell.label}</div>
        </div>
      ))}
    </div>
  )
}

function Unlabeled({ unlabeled, share }) {
  if (!unlabeled) return null

  return (
    <div className="cyber-card p-4 space-y-1">
      <h2 className="text-lg font-medium text-white">Unlabeled</h2>
      <p className="text-sm text-gray-300">
        {usd(unlabeled.usd)} across {figure(unlabeled.payments)} payments to{' '}
        {figure(unlabeled.addresses)} addresses, {percent(share)} of the money in the deposit.
      </p>
      <p className="text-sm text-gray-400">
        These are addresses someone reported as ransom addresses without a family the dataset could
        confirm. They are kept, because they were collected as ransom addresses, and shown on their
        own: never added to a family, and never added to the attributed figure to make a larger one.
      </p>
    </div>
  )
}

function Caveats() {
  return (
    <div className="cyber-card p-4 space-y-2">
      <h2 className="text-lg font-medium text-white">What these figures are not</h2>
      <ul className="text-sm text-gray-400 space-y-1 list-disc pl-5">
        <li>
          <strong className="text-gray-300">Not all ransom paid.</strong> The deposit holds the
          addresses people submitted. A payment to an address nobody reported is not here, so every
          figure is a floor.
        </li>
        <li>
          <strong className="text-gray-300">Not today&apos;s value.</strong> Dollars are the value
          at the time of each payment, as the dataset records it. Converting at today&apos;s price
          would invent a number.
        </li>
        <li>
          <strong className="text-gray-300">Not Vigil&apos;s attribution.</strong> Family names are
          the dataset&apos;s labels. They are not linked to Vigil&apos;s actor pages, because
          deciding that a payment family is a tracked group is a judgment, and judgments go through
          the review queue.
        </li>
        <li>
          <strong className="text-gray-300">Not a sanctions finding.</strong> None of the wallets
          Vigil holds is on OFAC&apos;s list, which is expected; see{' '}
          <a href="/sanctions" className="text-cyber-accent hover:underline">
            Sanctions
          </a>{' '}
          for why.
        </li>
      </ul>
    </div>
  )
}

function Families({ families }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('usd')

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return families
      .filter((f) => !term || f.name.toLowerCase().includes(term))
      .slice()
      .sort(SORTS[sort].compare)
  }, [families, search, sort])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white">By family</h2>
          <p className="text-xs text-gray-500">
            Showing {figure(shown.length)} of {figure(families.length)} named families.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="cyber-input"
            placeholder="Find a family"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Find a family"
          />
          <select
            className="cyber-input"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort families"
          >
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cyber-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="px-4 py-2">Family</th>
              <th className="px-4 py-2 text-right">USD at time of payment</th>
              <th className="px-4 py-2 text-right">Payments</th>
              <th className="px-4 py-2 text-right">Addresses</th>
              <th className="px-4 py-2">First payment</th>
              <th className="px-4 py-2">Last payment</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.name} className="border-b border-gray-800/60">
                <td className="px-4 py-2 text-white">{f.name}</td>
                <td className="px-4 py-2 text-gray-300 text-right tabular-nums">{usd(f.usd)}</td>
                <td className="px-4 py-2 text-gray-300 text-right tabular-nums">
                  {figure(f.payments)}
                </td>
                <td className="px-4 py-2 text-gray-400 text-right tabular-nums">
                  {figure(f.addresses)}
                </td>
                <td className="px-4 py-2 text-gray-400">{formatDay(f.firstPayment)}</td>
                <td className="px-4 py-2 text-gray-400">{formatDay(f.lastPayment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <p className="p-4 text-sm text-gray-400">No named family matches that search.</p>
        )}
      </div>
    </div>
  )
}

function Citation() {
  const c = RANSOMWHERE_CITATION
  return (
    <p className="text-xs text-gray-500 max-w-3xl">
      Data: {c.author}, <em>{c.title}</em>, {c.publisher},{' '}
      <a
        href={c.url}
        className="text-cyber-accent hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        doi:{c.doi}
      </a>
      . Licensed{' '}
      <a
        href={c.licenceUrl}
        className="text-cyber-accent hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        {c.licence}
      </a>
      . {c.changes}
    </p>
  )
}

export default function RansomPayments() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: d, error: e } = await ransomPayments.getPayments()
      if (cancelled) return
      if (e) setError(e.message)
      setData(d ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const summary = data?.summary ?? null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Ransom payments</h1>
        <p className="text-gray-400 mt-2 max-w-3xl">
          Payments to addresses reported as ransomware addresses, grouped by the family the dataset
          names, from the Ransomwhere deposit on Zenodo. Licensed CC BY 4.0, which makes it the one
          ransom-payment source Vigil holds that can be used commercially, with attribution.
        </p>
      </div>

      {error && (
        <div className="cyber-card p-4 border-red-800/50">
          <p className="text-sm text-red-200">The payments did not load: {error}</p>
        </div>
      )}

      {summary && !summary.complete && (
        <div className="cyber-card p-4 border-red-800/50">
          <p className="text-sm text-red-200">
            Not every family row came back, so the figures that add rows together are withheld
            rather than shown short.
          </p>
        </div>
      )}

      <Snapshot snapshot={summary?.snapshot} />
      <Counts summary={summary} />
      <Unlabeled unlabeled={data?.unlabeled} share={summary?.unlabeledShare} />
      <Caveats />
      {data && <Families families={data.families} />}
      <Citation />

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
    </div>
  )
}
