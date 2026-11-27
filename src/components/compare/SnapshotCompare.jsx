/**
 * Compare two frozen snapshots: what was added, removed and changed.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { snapshots, watchlists } from '../../lib/supabase/index'
import { SECTORS, SECTOR_LABELS } from '../../lib/constants/sectors'
import { diffSnapshots, diffActorIds, nameActors } from '../../lib/snapshotDiff'
import { checkNarration } from '../../lib/snapshotNarration'
import { generateSnapshotDiffSummary } from '../../lib/ai'
import { fmt } from '../../lib/time'

const day = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)

const SCOPES = [
  ['sector', 'Sector'],
  ['actor', 'Threat actor'],
  ['watchlist', 'Actor watchlist'],
]

function TakeSnapshot({ userId, onTaken }) {
  const [form, setForm] = useState({
    name: '',
    scopeType: 'sector',
    scopeValue: '',
    windowStart: day(30),
    windowEnd: day(0),
  })
  const [lists, setLists] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
      ...(key === 'scopeType' ? { scopeValue: '' } : {}),
    }))

  useEffect(() => {
    if (!userId) return
    watchlists
      .getAll(userId)
      .then(({ data }) => setLists((data || []).filter((w) => w.entity_type === 'actor')))
  }, [userId])

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      let scopeValue = form.scopeValue
      if (form.scopeType === 'actor') {
        const { data, error: findError } = await snapshots.findActor(scopeValue)
        if (findError) throw findError
        if (data?.length !== 1) {
          throw new Error(
            data?.length ? 'More than one actor has that name.' : 'No actor has that name.'
          )
        }
        scopeValue = data[0].id
      }
      const { error: takeError } = await snapshots.take({ ...form, scopeValue })
      if (takeError) throw takeError
      setForm((f) => ({ ...f, name: '' }))
      await onTaken()
    } catch (err) {
      setError(err.message || 'The snapshot could not be taken.')
    } finally {
      setBusy(false)
    }
  }

  const scopeLabel = SCOPES.find(([value]) => value === form.scopeType)[1]
  const options =
    form.scopeType === 'sector'
      ? SECTORS.map((s) => [s, SECTOR_LABELS[s]])
      : lists.map((w) => [w.id, w.name])

  return (
    <form onSubmit={submit} className="cyber-card p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Take a snapshot</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-gray-400">
        <label>
          Name
          <input
            className="cyber-input w-full mt-1"
            required
            maxLength={120}
            value={form.name}
            onChange={set('name')}
          />
        </label>
        <label>
          Scope
          <select
            className="cyber-input w-full mt-1"
            value={form.scopeType}
            onChange={set('scopeType')}
          >
            {SCOPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {scopeLabel}
          {form.scopeType === 'actor' ? (
            <input
              className="cyber-input w-full mt-1"
              required
              placeholder="Exact actor name"
              value={form.scopeValue}
              onChange={set('scopeValue')}
            />
          ) : (
            <select
              className="cyber-input w-full mt-1"
              required
              value={form.scopeValue}
              onChange={set('scopeValue')}
            >
              <option value="">Choose…</option>
              {options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          From (UTC date)
          <input
            type="date"
            className="cyber-input w-full mt-1"
            required
            max={form.windowEnd}
            value={form.windowStart}
            onChange={set('windowStart')}
          />
        </label>
        <label>
          To (UTC date)
          <input
            type="date"
            className="cyber-input w-full mt-1"
            required
            min={form.windowStart}
            value={form.windowEnd}
            onChange={set('windowEnd')}
          />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="cyber-button" disabled={busy}>
          {busy ? 'Taking…' : 'Take snapshot'}
        </button>
        <p className="text-xs text-gray-500">
          A snapshot is frozen. It cannot be edited or deleted.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </form>
  )
}

const shown = (v) => (v === null || v === undefined ? 'not computed' : v.toLocaleString())
const signed = (v) => (v === null ? 'not comparable' : v > 0 ? `+${v}` : String(v))

function CountTable({ title, rows, label }) {
  return (
    <div className="cyber-card p-4 overflow-x-auto">
      <h4 className="font-medium text-white mb-2">{title}</h4>
      {rows === null ? (
        <p className="text-sm text-gray-500">Not computed.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No change.</p>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="text-gray-500">
            <tr>
              <th className="py-1 font-normal">{label}</th>
              <th className="py-1 font-normal">Before</th>
              <th className="py-1 font-normal">After</th>
              <th className="py-1 font-normal">Change</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {rows.map((row, i) => (
              <tr key={`${row.name}:${i}`} className="border-t border-gray-800">
                <td className="py-1 pr-2">{row.name}</td>
                <td className="py-1">{shown(row.before)}</td>
                <td className="py-1">{shown(row.after)}</td>
                <td className="py-1">{signed(row.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SetList({ title, items }) {
  return (
    <div>
      <h5 className="text-sm text-gray-400">
        {title}
        {items ? ` (${items.length})` : ''}
      </h5>
      <p className="text-sm text-gray-300 break-words">
        {items === null ? 'Not computed.' : items.length ? items.join(', ') : 'None.'}
      </p>
    </div>
  )
}

function Narration({ named }) {
  const [state, setState] = useState({ status: 'idle', sentences: [] })

  async function summarize() {
    setState({ status: 'busy', sentences: [] })
    const [text, known] = await Promise.all([
      generateSnapshotDiffSummary(named),
      snapshots.allActorNames(),
    ])
    // Without the full name list a stray actor could pass, so nothing is shown
    if (!text || known.error) return setState({ status: 'failed', sentences: [] })
    setState({ status: 'done', sentences: checkNarration(text, named, known.data) })
  }

  return (
    <div className="cyber-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium text-white">Summary (AI-written)</h4>
        <button
          type="button"
          className="cyber-button"
          onClick={summarize}
          disabled={state.status === 'busy'}
        >
          {state.status === 'busy' ? 'Writing…' : 'Write summary'}
        </button>
      </div>
      {state.status === 'failed' && (
        <p role="alert" className="text-sm text-red-400">
          No summary could be written and checked.
        </p>
      )}
      {state.status === 'done' && (
        <>
          {state.sentences.map((s, i) =>
            s.ok ? (
              <p key={i} className="text-sm text-gray-300">
                {s.text}
              </p>
            ) : (
              <p key={i} className="text-sm">
                <del className="text-gray-500">{s.text}</del>{' '}
                <span className="text-yellow-400">Failed the check: {s.reasons.join('; ')}.</span>
              </p>
            )
          )}
          <p className="text-xs text-gray-500">
            The check confirms that numbers and names appear in the diff, not that a sentence uses
            them correctly. The tables are the record.
          </p>
        </>
      )}
    </div>
  )
}

const optionLabel = (s) =>
  `${s.name} (${s.scope_type}, ${s.window_start} to ${s.window_end}, taken ${fmt(s.taken_at)})`

export default function SnapshotCompare() {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState('')
  const [names, setNames] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await snapshots.list()
    setLoadError(error ? 'Snapshots could not be loaded.' : null)
    setList(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { diff, diffError } = useMemo(() => {
    const before = list.find((s) => s.id === beforeId)
    const after = list.find((s) => s.id === afterId)
    if (!before || !after) return { diff: null, diffError: null }
    try {
      return { diff: diffSnapshots(before, after), diffError: null }
    } catch (error) {
      return { diff: null, diffError: error.message }
    }
  }, [list, beforeId, afterId])

  useEffect(() => {
    let cancelled = false
    setNames(null)
    if (!diff) return undefined
    snapshots.actorNames(diffActorIds(diff)).then(({ data }) => {
      if (!cancelled) setNames({ diff, byId: data || {} })
    })
    return () => {
      cancelled = true
    }
  }, [diff])

  // Names belong to the diff they were fetched for
  const named = diff && names?.diff === diff ? nameActors(diff, names.byId) : null
  const picker = (label, value, onChange) => (
    <label className="text-sm text-gray-400 flex-1 min-w-0">
      {label}
      <select
        className="cyber-input w-full mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a snapshot…</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {optionLabel(s)}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-6">
      <TakeSnapshot userId={user?.id} onTaken={load} />

      {loadError && (
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      )}
      {!loading && !loadError && list.length < 2 && (
        <p className="text-sm text-gray-400">Take two snapshots to compare them.</p>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        {picker('Before', beforeId, setBeforeId)}
        {picker('After', afterId, setAfterId)}
      </div>

      {diffError && (
        <p role="alert" className="text-sm text-yellow-400">
          {diffError}
        </p>
      )}

      {named && (
        <div className="space-y-4">
          {!diff.same_scope && (
            <p className="text-sm text-yellow-400">
              These two snapshots cover different {diff.scope_type} scopes.
            </p>
          )}
          <CountTable
            title="Totals"
            label="Count"
            rows={[
              { name: 'Leak-site claims in scope', ...named.claims_total },
              { name: 'Open data-quality findings (whole database)', ...named.open_findings },
            ]}
          />
          <Narration key={`${beforeId}:${afterId}`} named={named} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CountTable
              title="Claims by actor (changed only)"
              label="Actor"
              rows={named.by_actor && named.by_actor.map((r) => ({ ...r, name: r.actor }))}
            />
            <CountTable
              title="Claims by sector (changed only)"
              label="Sector"
              rows={named.by_sector && named.by_sector.map((r) => ({ ...r, name: r.key }))}
            />
          </div>
          <div className="cyber-card p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <SetList title="Actors added" items={named.actors.added} />
            <SetList title="Actors removed" items={named.actors.removed} />
            <SetList title="KEV entries added" items={named.kev.added} />
            <SetList title="KEV entries removed" items={named.kev.removed} />
          </div>
          <p className="text-xs text-gray-500">
            KEV entries are those CISA added inside each window, whatever the scope. Evidence tiers
            are not computed in this version.
          </p>
        </div>
      )}
    </div>
  )
}
