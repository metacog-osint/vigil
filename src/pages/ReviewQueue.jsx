import { fmt, fmtDate } from '../lib/time'
/**
 * Review Queue
 *
 * Vigil's claim is that a judgment call is recorded with its evidence rather
 * than guessed. Until now the queue existed and the verdicts did not: the
 * only way one had ever been recorded was a hand-written migration.
 *
 * The page is deliberately evidence-first. A reviewer sees the question the
 * check asked and everything it found, and cannot record a verdict without
 * writing down why. There is no bulk confirm, reject or "clear all", because
 * clearing a queue quickly is the failure this mechanism exists to prevent.
 * The one bulk action is "defer with this reason": it leaves every item open
 * and puts the reason on the record.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewQueue, VERDICTS } from '../lib/supabase/reviewQueue'
import { daysApart, kindCounts, orderForKind, sameCompanyCount } from '../lib/reviewQueueView'
import { figure } from '../lib/format'
import { useAuth } from '../hooks/useAuth'

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Confirmed' },
  { value: 'dismissed', label: 'Not a problem' },
  { value: 'auto_closed', label: 'Closed by a rule' },
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

function BulkDefer({ findings, onDone }) {
  const [rationale, setRationale] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const tooShort = rationale.trim().length < 10

  async function submit(e) {
    e.preventDefault()
    if (tooShort || saving) return
    if (
      !window.confirm(
        `Defer all ${findings.length} shown? They stay open, each with this reason recorded.`
      )
    )
      return
    setSaving(true)
    const out = await reviewQueue.deferMany({
      findingIds: findings.map((f) => f.id),
      rationale,
    })
    setSaving(false)
    setResult(out)
    if (out.failed.length === 0) setRationale('')
    onDone()
  }

  return (
    <form onSubmit={submit} className="cyber-card p-4 space-y-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        Defer all {figure(findings.length)} shown, with one reason
      </div>
      <p className="text-xs text-gray-500">
        Deferring leaves each item open and puts the reason on the record. Confirming or rejecting
        is only ever done one item at a time.
      </p>
      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        className="cyber-input w-full"
        placeholder="Why these cannot be decided yet."
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={tooShort || saving}
          className="cyber-button disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Recording…' : 'Defer all shown'}
        </button>
        {result && (
          <span className={`text-xs ${result.failed.length ? 'text-red-400' : 'text-gray-400'}`}>
            {figure(result.recorded)} deferred
            {result.failed.length > 0 &&
              `; ${result.failed.length} not recorded: ${result.failed[0].message}`}
          </span>
        )}
      </div>
    </form>
  )
}

const GAP_KINDS = new Set(['sec_disclosure_candidate', 'breach_notice_candidate'])

function CountryEvidence({ evidence }) {
  if (!evidence) return null
  const side =
    evidence.domain_agrees_with === 'held'
      ? `agrees with the held value (${evidence.held})`
      : evidence.domain_agrees_with === 'offered'
        ? `agrees with the offered value (${evidence.offered})`
        : evidence.domain_agrees_with === 'neither'
          ? 'is a country code that matches neither'
          : 'is not a country code, so it says nothing either way'

  return (
    <div className="mt-4 p-3 rounded bg-gray-800/50 text-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        What Vigil already holds about this victim
      </div>
      {evidence.website ? (
        <p className="text-gray-300">
          Website <span className="font-mono break-all">{evidence.website}</span>. Its domain (
          <span className="font-mono">.{(evidence.tld || '?').toLowerCase()}</span>) {side}.
        </p>
      ) : (
        <p className="text-gray-400">No website is recorded for this victim.</p>
      )}
      <p className="text-xs text-gray-500 mt-2">
        {figure(evidence.incidents)} claims name this victim. A domain is evidence, not an answer: a
        .de brand can be a US company.
      </p>
    </div>
  )
}

const READING_KINDS = new Set([
  'vendor_attribution_candidate',
  'leak_site_notice_candidate',
  'claim_value_unverified',
  'advisory_indicators_unread',
])

function ExternalLink({ href, children }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-400 hover:text-cyan-300 underline break-all"
    >
      {children || href}
    </a>
  )
}

/**
 * The thing a reading finding asks a person to read, as Vigil holds it (172).
 * Every string here came from a source, a leak site included, and is rendered
 * as text. An absent field is said to be absent, never filled in.
 */
export function ReadingEvidence({ kind, evidence }) {
  if (!evidence || !READING_KINDS.has(kind)) return null
  const box = 'mt-4 p-3 rounded bg-gray-800/50 text-sm text-gray-300'
  const label = 'text-xs uppercase tracking-wide text-gray-500 mb-1'

  if (kind === 'vendor_attribution_candidate') {
    const sentences = evidence.sentences || []
    return (
      <div className={box}>
        <div className={label}>
          Where the report says “{evidence.phrase}” (from the summary Vigil stores)
        </div>
        {sentences.length > 0 ? (
          sentences.map((s, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-gray-600 pl-3 my-1 whitespace-pre-wrap"
            >
              {s}
            </blockquote>
          ))
        ) : (
          <p className="text-gray-400">
            The phrase is in the title, not the stored summary: “{evidence.title}”.
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          A summary is not the report. Read it whole before deciding:{' '}
          <ExternalLink href={evidence.url}>{evidence.title || evidence.url}</ExternalLink>
        </p>
      </div>
    )
  }

  if (kind === 'leak_site_notice_candidate') {
    const sources = (evidence.sources || []).join(', ')
    return (
      <div className={box}>
        <div className={label}>The post, as the source sent it</div>
        {evidence.body ? (
          <p className="whitespace-pre-wrap break-words font-mono text-xs">{evidence.body}</p>
        ) : (
          <p className="text-gray-400">
            No post body is stored{sources ? ` (${sources} send titles only)` : ''}. The title is
            all Vigil has; read the post on the leak site or a mirror before deciding.
          </p>
        )}
      </div>
    )
  }

  if (kind === 'claim_value_unverified') {
    const value =
      evidence.value_text ||
      (evidence.value_numeric != null
        ? `${figure(Number(evidence.value_numeric))} ${evidence.unit || ''}`
        : '—')
    return (
      <div className={box}>
        <div className={label}>The stored value</div>
        {evidence.question && <p className="text-gray-400 mb-1">{evidence.question}</p>}
        <p className="text-white">
          {value}
          {evidence.measurement && <span className="text-gray-400"> · {evidence.measurement}</span>}
          {evidence.as_of && <span className="text-gray-400"> · as of {evidence.as_of}</span>}
        </p>
        {evidence.window_note && <p className="text-gray-400">{evidence.window_note}</p>}
        <p className="mt-2">
          {evidence.publisher && (
            <>
              {evidence.publisher}
              {evidence.publisher_tier && ` (tier ${evidence.publisher_tier})`}
              {' · '}
            </>
          )}
          {evidence.citation && <>cited as {evidence.citation}</>}
          {evidence.entered_from && <> in {evidence.entered_from}</>}
        </p>
        <p className="text-xs mt-1">
          {evidence.source_url ? (
            <>
              Primary source: <ExternalLink href={evidence.source_url} />
            </>
          ) : (
            <span className="text-amber-400">
              No primary-source link is stored. Find the publisher’s own document before setting
              verified_on.
            </span>
          )}
        </p>
      </div>
    )
  }

  // advisory_indicators_unread
  return (
    <div className={box}>
      <div className={label}>The document to read</div>
      <p className="text-white">{evidence.title}</p>
      <p className="text-xs text-gray-500">
        {String(evidence.source || '').toUpperCase()} {evidence.advisory_id}
        {evidence.published && <> · published {evidence.published}</>}
      </p>
      <p className="mt-1">
        <ExternalLink href={evidence.document_url}>Open the document</ExternalLink>
        {' · '}
        <Link to="/review/reading" className="text-cyan-400 hover:text-cyan-300 underline">
          All advisories waiting to be read
        </Link>
      </p>
    </div>
  )
}

function FindingCard({ finding, onRecorded, siblings = 0, countryEvidence, readingEvidence }) {
  const ruled = Boolean(finding.latest_verdict)
  const gap = GAP_KINDS.has(finding.check_name) ? daysApart(finding) : null

  return (
    <article className="cyber-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-white font-semibold break-words">{finding.subject}</h2>
          <div className="text-xs text-gray-500 mt-1">
            <span className="font-mono">{finding.check_name}</span>
            {finding.first_seen && <> · first seen {fmtDate(finding.first_seen, { year: true })}</>}
          </div>
          {(gap !== null || siblings > 0) && (
            <div className="text-xs text-gray-400 mt-1">
              {gap !== null && <>{figure(gap)} days between the claim and the regulator record</>}
              {gap !== null && siblings > 0 && ' · '}
              {siblings > 0 && (
                <>
                  {figure(siblings)} other filing{siblings === 1 ? '' : 's'} from this company in
                  the queue, listed beside it
                </>
              )}
            </div>
          )}
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

      {finding.check_name === 'victim_country_disagreement' && (
        <CountryEvidence evidence={countryEvidence} />
      )}

      <ReadingEvidence kind={finding.check_name} evidence={readingEvidence} />

      {finding.auto_close_rule && (
        <div className="mt-4 p-3 rounded bg-gray-800/50 text-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            Closed by a rule, not a person
            <span className="ml-2 normal-case font-mono text-gray-600">
              {finding.auto_close_rule}
            </span>
          </div>
          <p className="text-gray-300">{finding.auto_close_reason}</p>
          <p className="text-xs text-gray-500 mt-2">
            {finding.auto_closed_at && fmt(finding.auto_closed_at, { year: true })}
          </p>
        </div>
      )}

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
            {finding.latest_decided_at && fmt(finding.latest_decided_at, { year: true })}
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
  const [kind, setKind] = useState('')
  const [countryEvidence, setCountryEvidence] = useState({})
  const [readingEvidence, setReadingEvidence] = useState({})

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

    if ((data || []).some((f) => f.check_name === 'victim_country_disagreement')) {
      // Help, not a gate: if this read fails the cards still show the finding.
      const { data: ev } = await reviewQueue.getCountryEvidence()
      setCountryEvidence(ev || {})
    }

    if ((data || []).some((f) => READING_KINDS.has(f.check_name))) {
      // Help, not a gate, as above.
      const { data: rev } = await reviewQueue.getReadingEvidence()
      setReadingEvidence(rev || {})
    }
  }, [status, user])

  useEffect(() => {
    load()
  }, [load])

  const openCount = useMemo(() => counts?.open, [counts])
  const kinds = useMemo(() => kindCounts(findings), [findings])
  const shown = useMemo(() => orderForKind(findings, kind), [findings, kind])

  // A kind that is no longer in the list (all ruled on) falls back to all.
  useEffect(() => {
    if (kind && findings && !findings.some((f) => f.check_name === kind)) setKind('')
  }, [findings, kind])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <p className="text-gray-400 mt-1">
          Judgment calls Vigil has refused to guess at. Each verdict is kept with the reasoning that
          supports it, and nothing here is applied to the data automatically. A few items are closed
          by a rule when they were raised in error or their condition has gone; each says which rule
          and why, and can be reopened.
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
          <div className="flex flex-wrap items-center gap-3">
            {status === 'open' && typeof openCount === 'number' && (
              <p className="text-sm text-gray-500">{figure(openCount)} waiting on a verdict.</p>
            )}
            <label className="text-sm text-gray-400 flex items-center gap-2">
              Kind
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="cyber-input py-1"
              >
                <option value="">All kinds ({figure(findings.length)})</option>
                {kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.kind} ({figure(k.count)})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {status === 'open' && kind && shown.length > 1 && (
            <BulkDefer findings={shown} onDone={load} />
          )}

          <div className="space-y-4">
            {shown.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onRecorded={load}
                siblings={
                  finding.check_name === 'sec_disclosure_candidate'
                    ? sameCompanyCount(finding, findings)
                    : 0
                }
                countryEvidence={countryEvidence[finding.id]}
                readingEvidence={readingEvidence[finding.id]}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
