/**
 * Review Queue
 *
 * Vigil's claim is that a judgment call is recorded with its evidence rather
 * than guessed. Until now the queue existed and the verdicts did not: the
 * only way one had ever been recorded was a hand-written migration.
 *
 * The page is deliberately evidence-first. A reviewer sees the question the
 * check asked and everything it found, and cannot record a verdict without
 * writing down why. There is no bulk action and no "clear all", because
 * clearing a queue quickly is the failure this mechanism exists to prevent.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { reviewQueue, VERDICTS } from '../lib/supabase/reviewQueue'
import { figure } from '../lib/format'
import { useAuth } from '../hooks/useAuth'

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Confirmed' },
  { value: 'dismissed', label: 'Not a problem' },
  { value: 'all', label: 'Everything' },
]

const SEVERITY_STYLES = {
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
}

const VERDICT_STYLES = {
  confirmed: 'bg-red-500/10 text-red-400 border-red-500/30',
  rejected: 'bg-green-500/10 text-green-400 border-green-500/30',
  deferred: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
}

/** details keys that carry the reviewer's brief, in the order they help. */
const LEADING_KEYS = ['question', 'instruction', 'evidence', 'detail', 'note']

function humanKey(key) {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function DetailValue({ value }) {
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc list-inside space-y-0.5">
        {value.map((item, i) => (
          <li key={i} className="text-gray-300">
            {typeof item === 'object' ? JSON.stringify(item) : String(item)}
          </li>
        ))}
      </ul>
    )
  }

  if (value !== null && typeof value === 'object') {
    return (
      <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return <span className="text-gray-300">{String(value)}</span>
}

/**
 * Everything the check recorded, nothing summarised away. An unfamiliar key
 * still renders: a finding is evidence, and hiding part of it to keep the
 * layout tidy would defeat the page.
 */
function Evidence({ details }) {
  const entries = Object.entries(details || {})
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">The check recorded no further detail.</p>
  }

  const leading = LEADING_KEYS.filter((k) => k in (details || {}))
  const rest = entries.map(([k]) => k).filter((k) => !LEADING_KEYS.includes(k))

  return (
    <div className="space-y-3">
      {leading.map((key) => (
        <div key={key}>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{humanKey(key)}</div>
          <div className={key === 'question' ? 'text-white' : 'text-sm'}>
            <DetailValue value={details[key]} />
          </div>
        </div>
      ))}

      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          {rest.map((key) => (
            <div key={key}>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {humanKey(key)}
              </div>
              <div className="text-sm">
                <DetailValue value={details[key]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VerdictForm({ finding, onRecorded }) {
  const [verdict, setVerdict] = useState(null)
  const [rationale, setRationale] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const tooShort = rationale.trim().length < 10

  async function submit(e) {
    e.preventDefault()
    if (!verdict || tooShort || saving) return

    setSaving(true)
    setError(null)

    const { error: err } = await reviewQueue.recordVerdict({
      findingId: finding.id,
      verdict,
      rationale,
    })

    setSaving(false)

    if (err) {
      // Say what the database said. A verdict that silently failed to save
      // is worse than one that was never attempted.
      setError(err.message || 'The verdict was not recorded.')
      return
    }

    setRationale('')
    setVerdict(null)
    onRecorded()
  }

  return (
    <form onSubmit={submit} className="mt-4 pt-4 border-t border-gray-700 space-y-3">
      <div className="flex flex-wrap gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setVerdict(verdict === v.value ? null : v.value)}
            aria-pressed={verdict === v.value}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              verdict === v.value
                ? VERDICT_STYLES[v.value]
                : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
            title={v.summary}
          >
            {v.label}
          </button>
        ))}
      </div>

      {verdict && (
        <>
          <p className="text-xs text-gray-500">
            {VERDICTS.find((v) => v.value === verdict)?.summary}
          </p>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Why — this is kept with the verdict
            </span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              className="cyber-input w-full mt-1"
              placeholder="What you checked, and what it showed."
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={tooShort || saving}
              className="cyber-button disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Recording…' : 'Record verdict'}
            </button>
            {tooShort && (
              <span className="text-xs text-gray-500">
                A verdict needs its reasoning before it can be recorded.
              </span>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}

function FindingCard({ finding, onRecorded }) {
  const ruled = Boolean(finding.latest_verdict)

  return (
    <article className="cyber-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-white font-semibold break-words">{finding.subject}</h2>
          <div className="text-xs text-gray-500 mt-1">
            <span className="font-mono">{finding.check_name}</span>
            {finding.first_seen && (
              <> · first seen {new Date(finding.first_seen).toLocaleDateString()}</>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 text-xs rounded border ${
              SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info
            }`}
          >
            {finding.severity}
          </span>
          {ruled && (
            <span
              className={`px-2 py-0.5 text-xs rounded border ${
                VERDICT_STYLES[finding.latest_verdict]
              }`}
            >
              {finding.latest_verdict}
            </span>
          )}
        </div>
      </header>

      <Evidence details={finding.details} />

      {ruled && (
        <div className="mt-4 p-3 rounded bg-gray-800/50 text-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            Recorded verdict
            {finding.verdict_count > 1 && (
              <span className="ml-2 normal-case text-gray-600">
                {finding.verdict_count} rulings on this finding — the most recent
              </span>
            )}
          </div>
          <p className="text-gray-300">{finding.latest_rationale}</p>
          <p className="text-xs text-gray-500 mt-2">
            {finding.latest_decided_at && new Date(finding.latest_decided_at).toLocaleString()}
          </p>
        </div>
      )}

      <VerdictForm finding={finding} onRecorded={onRecorded} />
    </article>
  )
}

export default function ReviewQueue() {
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState('open')
  const [findings, setFindings] = useState(null)
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    const [{ data, error: err }, { data: countData }] = await Promise.all([
      reviewQueue.getFindings({ status }),
      reviewQueue.getCounts(),
    ])

    if (err) {
      // Not an empty queue. An empty queue is a claim that there is nothing
      // to decide, and this page must never make that claim by accident.
      setError(err.message || 'The review queue could not be read.')
      setFindings(null)
    } else {
      setFindings(data)
    }

    setCounts(countData || null)
    setLoading(false)
  }, [status, user])

  useEffect(() => {
    load()
  }, [load])

  const openCount = useMemo(() => counts?.open, [counts])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <p className="text-gray-400 mt-1">
          Judgment calls Vigil has refused to guess at. Each verdict is kept with the reasoning that
          supports it, and nothing here is applied to the data automatically.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              status === tab.value
                ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {counts && <span className="ml-2 text-gray-500">{figure(counts[tab.value])}</span>}
          </button>
        ))}
      </div>

      {/*
        Signed out, the policies return no rows rather than an error, which
        is indistinguishable from an empty queue. Saying "nothing is waiting"
        to someone who simply cannot see it would be the exact failure this
        page exists to prevent.
      */}
      {!authLoading && !user && (
        <div className="cyber-card p-6">
          <p className="text-white">The queue is readable by signed-in reviewers.</p>
          <p className="text-sm text-gray-500 mt-2">
            This is not an empty queue. Signed out, Vigil cannot show you what is in it.
          </p>
        </div>
      )}

      {user && loading && <div className="cyber-card p-6 text-gray-400">Reading the queue…</div>}

      {user && !loading && error && (
        <div className="cyber-card p-6">
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-gray-500 mt-2">
            This is a failure to read the queue, not an empty queue.
          </p>
          <button onClick={load} className="cyber-button mt-3">
            Try again
          </button>
        </div>
      )}

      {user && !loading && !error && findings?.length === 0 && (
        <div className="cyber-card p-6 text-gray-400">Nothing is waiting on a verdict here.</div>
      )}

      {user && !loading && !error && findings && findings.length > 0 && (
        <>
          {status === 'open' && typeof openCount === 'number' && (
            <p className="text-sm text-gray-500">{openCount} waiting on a verdict.</p>
          )}
          <div className="space-y-4">
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onRecorded={load} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
