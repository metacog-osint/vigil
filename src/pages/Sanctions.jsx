/**
 * OFAC-designated digital currency addresses, and the actors that are them.
 *
 * 1,050 addresses across 99 entities have been in the database since 20
 * September and nothing rendered them. That is the §2b pattern again, on the
 * one corpus Vigil holds that carries no commercial restriction - SDN.XML is US
 * public domain.
 *
 * Three things this page is careful about:
 *
 *   It states the wallet overlap rather than leaving it to inference. Putting
 *   "9,900 wallets held" and "1,050 sanctioned addresses" on one screen without
 *   it invites the reader to conclude a victim paid a sanctioned address.
 *   Nothing here supports that, and the overlap is measured on load.
 *
 *   A lookup miss does not say clean. Vigil holds the SDN list, not the truth
 *   about an address. "Not on this list as of <date>" is the only claim the data
 *   supports, and a delisted address is a third answer rather than a no.
 *
 *   The rejected verdict is shown as prominently as the confirmed ones. Hydra
 *   matches HYDRA MARKET by name and a name-matching script would assert it;
 *   the reason that link does not exist is the product.
 */
import { useEffect, useState } from 'react'
import { sanctions, SANCTIONS_PROGRAMS, SANCTIONS_VERDICTS } from '../lib/supabase'
import { figure } from '../lib/format'

function formatDate(value) {
  if (!value) return 'an unknown date'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? 'an unknown date'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Counts({ overview }) {
  if (!overview) return null

  const cells = [
    { label: 'designated addresses', value: overview.currentlyDesignated },
    { label: 'delisted, and kept', value: overview.delisted },
    {
      label: overview.entitiesCapped ? 'entities (at least)' : 'designated entities',
      value: overview.entitiesAtLeast,
    },
    { label: 'wallets Vigil holds', value: overview.walletsHeld },
    {
      label: 'of those on the SDN list',
      value: overview.walletsOnSdnList,
      // Zero here is the expected answer, so it is not flagged as a problem.
      muted: true,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((cell) => (
        <div key={cell.label} className="cyber-card p-4">
          <div className={`text-2xl font-semibold ${cell.muted ? 'text-gray-300' : 'text-white'}`}>
            {figure(cell.value)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{cell.label}</div>
        </div>
      ))}
    </div>
  )
}

function Lookup() {
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run(e) {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    const { data, error } = await sanctions.lookupAddress(value)
    setResult(error ? { error: error.message } : data)
    setBusy(false)
  }

  return (
    <div className="cyber-card p-4 space-y-3">
      <div>
        <h2 className="text-lg font-medium text-white">Is this address designated?</h2>
        <p className="text-sm text-gray-400 mt-1">
          Matched case-insensitively, because Bitcoin addresses are case-sensitive and
          Ethereum&apos;s are not, and people paste either.
        </p>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input
          className="cyber-input flex-1"
          placeholder="Paste a wallet address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Wallet address"
        />
        <button type="submit" className="cyber-button" disabled={busy}>
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>

      {result?.error && <p className="text-sm text-red-300">Lookup failed: {result.error}</p>}

      {result && !result.error && !result.found && (
        <div className="border border-gray-700 rounded p-3">
          <p className="text-sm text-gray-200">
            <strong className="font-medium">Not on the SDN list</strong> as held on{' '}
            {formatDate(result.asOf)}.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            That is not the same as clean. Vigil holds OFAC&apos;s list of designated digital
            currency addresses, which is one authority among several and covers designation only.
          </p>
        </div>
      )}

      {result?.found && (
        <div
          className={`border rounded p-3 ${
            result.currentlyDesignated ? 'border-red-800/60' : 'border-amber-800/60'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              result.currentlyDesignated ? 'text-red-200' : 'text-amber-200'
            }`}
          >
            {result.currentlyDesignated
              ? 'Currently designated'
              : `Was designated, delisted ${formatDate(result.match.delisted_at)}`}
          </p>
          <dl className="mt-2 text-sm text-gray-300 space-y-1">
            <div>
              <dt className="inline text-gray-500">Entity: </dt>
              <dd className="inline">{result.match.entity_name}</dd>
            </div>
            <div>
              <dt className="inline text-gray-500">Currency: </dt>
              <dd className="inline">{result.match.currency}</dd>
            </div>
            <div>
              <dt className="inline text-gray-500">Programmes: </dt>
              <dd className="inline">
                {(result.match.programs ?? []).join(', ') || 'none recorded'}
              </dd>
            </div>
            <div>
              <dt className="inline text-gray-500">First seen on the list: </dt>
              <dd className="inline">{formatDate(result.match.first_seen)}</dd>
            </div>
          </dl>
          {!result.currentlyDesignated && (
            <p className="text-xs text-amber-200/70 mt-2">
              Delisted addresses are kept. Tornado Cash was delisted in 2025, and &quot;was
              designated until March&quot; is a different answer from both yes and no.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ActorLinks({ links }) {
  // The section renders even with no rows. The explanation of what match_basis
  // claims is worth as much as the rows, and "no actor is a designated entity"
  // is a finding rather than nothing to show.
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium text-white">
        Tracked actors that are designated entities
      </h2>
      <p className="text-sm text-gray-400">
        <code className="text-gray-300">match_basis</code> is the claim. <strong>name</strong> is an
        exact match on the designated name; <strong>alias_reviewed</strong> means a person confirmed
        it. Nothing is linked on an alias without a recorded verdict.
      </p>
      {!links?.length && (
        <p className="cyber-card p-4 text-sm text-gray-400">
          No tracked actor is currently linked to a designated entity. That is a statement about the
          links, not about the actors.
        </p>
      )}
      {links?.length > 0 && (
        <div className="cyber-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-4 py-2">Vigil actor</th>
                <th className="px-4 py-2">OFAC entity</th>
                <th className="px-4 py-2">Programmes</th>
                <th className="px-4 py-2">Basis</th>
              </tr>
            </thead>
            <tbody>
              {links.map((row) => (
                <tr
                  key={`${row.actor_id}-${row.entity_uid}`}
                  className="border-b border-gray-800/60"
                >
                  <td className="px-4 py-2 text-white">{row.threat_actors?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-300">{row.entity_name}</td>
                  <td className="px-4 py-2 text-gray-400">
                    {(row.programs ?? []).map((p) => (
                      <span key={p} title={SANCTIONS_PROGRAMS[p] ?? p} className="mr-2">
                        {p}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-2">
                    {/* An exact name match states itself; an alias match rests on a
                      recorded verdict, so it is marked differently. */}
                    <span className={row.match_basis === 'name' ? 'badge-info' : 'badge-medium'}>
                      {row.match_basis}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Decisions({ decisions }) {
  // Also renders when empty: no verdicts recorded is exactly the state worth
  // seeing, because it means the review step has not been used.
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium text-white">The verdicts, including the refusals</h2>
      <p className="text-sm text-gray-400">
        A rejection is the most useful row here: it is a link that a name match would have asserted
        and a person declined.
      </p>
      {!decisions?.length && (
        <p className="cyber-card p-4 text-sm text-gray-400">
          No verdict has been recorded yet. The alias matches that need one are queued in the review
          queue.
        </p>
      )}
      <div className="space-y-2">
        {(decisions ?? []).map((d) => (
          <div
            key={`${d.actor_key}-${d.entity_uid}`}
            className={`cyber-card p-4 ${d.verdict === 'rejected' ? 'border-amber-800/50' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-white font-mono text-sm">{d.actor_key}</span>
              <span className={d.verdict === 'confirmed' ? 'badge-low' : 'badge-medium'}>
                {SANCTIONS_VERDICTS[d.verdict] ?? d.verdict}
              </span>
            </div>
            {d.rationale && <p className="text-sm text-gray-300 mt-2">{d.rationale}</p>}
            <p className="text-xs text-gray-500 mt-2">
              {d.decided_by ? `Decided by ${d.decided_by}` : 'No decider recorded'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Entities({ entities }) {
  if (!entities?.length) return null

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium text-white">Designated entities</h2>
      <div className="cyber-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Addresses</th>
              <th className="px-4 py-2">Currencies</th>
              <th className="px-4 py-2">Programmes</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <tr key={e.entityUid ?? e.entityName} className="border-b border-gray-800/60">
                <td className="px-4 py-2 text-white">{e.entityName}</td>
                <td className="px-4 py-2 text-gray-300">
                  {figure(e.addresses)}
                  {e.delisted > 0 && (
                    <span className="text-xs text-amber-300/80 ml-2">
                      {figure(e.delisted)} delisted
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-400">{e.currencies.join(', ')}</td>
                <td className="px-4 py-2 text-gray-400">
                  {e.programs.map((p) => (
                    <span key={p} title={SANCTIONS_PROGRAMS[p] ?? p} className="mr-2">
                      {p}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Sanctions() {
  const [overview, setOverview] = useState(null)
  const [entities, setEntities] = useState([])
  const [links, setLinks] = useState([])
  const [decisions, setDecisions] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [o, e, l, d] = await Promise.all([
        sanctions.getOverview(),
        sanctions.getEntities({ limit: 100 }),
        sanctions.getActorLinks(),
        sanctions.getDecisions(),
      ])
      if (cancelled) return

      const failure = o.error || e.error || l.error || d.error
      if (failure) setError(failure.message)

      setOverview(o.data ?? null)
      setEntities(e.data ?? [])
      setLinks(l.data ?? [])
      setDecisions(d.data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Sanctions</h1>
        <p className="text-gray-400 mt-2 max-w-3xl">
          Every digital currency address OFAC has designated, from SDN.XML, with the programme it
          was designated under. US public domain — unlike most of what Vigil holds, this carries no
          licence restriction. Held as of {formatDate(overview?.asOf)}.
        </p>
      </div>

      {error && (
        <div className="cyber-card p-4 border-red-800/50">
          <p className="text-sm text-red-200">Some of this page did not load: {error}</p>
        </div>
      )}

      {/* Said before the numbers, because the numbers invite a wrong inference. */}
      <div className="cyber-card p-4 border-amber-800/50">
        <p className="text-sm text-amber-200/90">
          <strong className="font-medium">
            None of the wallets Vigil holds are on this list, and that is the expected answer.
          </strong>{' '}
          Ransom addresses are generated per victim; OFAC designates exchange deposit and
          actor-controlled addresses. The two sets are not supposed to meet, so an overlap of{' '}
          {figure(overview?.walletsOnSdnList)} out of {figure(overview?.walletsHeld)} says nothing
          about whether any victim paid a sanctioned entity. It is measured on every load rather
          than asserted, so it cannot quietly stop being true.
        </p>
      </div>

      <Counts overview={overview} />
      <Lookup />
      <ActorLinks links={links} />
      <Decisions decisions={decisions} />
      <Entities entities={entities} />

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
    </div>
  )
}
