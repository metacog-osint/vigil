/**
 * Threat research published by eight vendors, and the questions it raises.
 *
 * 377 reports have been in the database since migration 139 and nothing
 * rendered them. 27 actor links were proposed against them by name matching,
 * and there was no way for a person to say whether any of them was right.
 * SESSION_HANDOFF §2b named this the largest gap left.
 *
 * What this page is careful about:
 *
 *   A blank attribution is "not yet read", never "names nobody". Vendor
 *   attribution lives in prose; nothing parses it, and nobody at Vigil has
 *   ruled on any report yet. The two answers render differently.
 *
 *   A proposed link is a name match, shown as one. The matcher has proposed a
 *   descriptive phrase ("China nexus") and a malware family as actors, and
 *   one name that matches two actor records. Ruling is how those get caught,
 *   and a ruling needs its reasoning (rule_vendor_actor_link, migration 156).
 *
 *   The research is the vendor's. Vigil holds the title, link, date and the
 *   vendor's own summary, links to the article, and registers all eight
 *   sources as not sellable.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { vendorReports, VENDOR_SOURCES, LINK_VERDICTS } from '../lib/supabase'
import { figure, calendarDay } from '../lib/format'

const PAGE_SIZE = 25

function vendorName(source) {
  return VENDOR_SOURCES[source] ?? source
}

function Counts({ overview }) {
  if (!overview) return null

  const cells = [
    { value: figure(overview.reports), label: 'reports held' },
    {
      value: figure(overview.links),
      label: `actor links proposed by name match, ${figure(overview.linksUnruled)} not yet ruled on`,
    },
    {
      value: figure(overview.attributionRuled),
      label: 'reports whose attribution a person has ruled on',
      muted: true,
    },
    {
      value: figure(overview.questionsOpen),
      label: 'attribution questions open in the review queue',
      to: '/review',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="cyber-card p-4">
          <div className={`text-2xl font-semibold ${cell.muted ? 'text-gray-300' : 'text-white'}`}>
            {cell.value}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {cell.to ? (
              <Link to={cell.to} className="hover:underline">
                {cell.label}
              </Link>
            ) : (
              cell.label
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Attribution({ report, question }) {
  if (report.attribution_decided_at) {
    return (
      <p className="text-sm text-gray-300">
        <span className="text-gray-500">Attribution, ruled: </span>
        {report.attributed_country
          ? `${report.attributed_country} (${report.attribution_strength ?? 'strength not recorded'})`
          : 'names no country'}
        {report.attribution_phrase && (
          <span className="text-gray-400"> — “{report.attribution_phrase}”</span>
        )}
      </p>
    )
  }

  return (
    <div className="text-sm">
      <p className="text-gray-400">
        <span className="text-gray-500">Attribution: </span>
        not yet read by anyone at Vigil. That is not the same as naming no one.
      </p>
      {question && (
        <p className="text-amber-200/80 mt-1">
          A question is queued
          {question.phrase && <> on the wording “{question.phrase}”</>}.{' '}
          <Link to="/review" className="text-cyber-accent hover:underline">
            Answer it in the review queue
          </Link>
          .
        </p>
      )}
    </div>
  )
}

function linkState(link, ruling) {
  if (link.confirmed === true) return { label: 'Confirmed', className: 'badge-low' }
  if (link.confirmed === false) return { label: 'Rejected', className: 'badge-medium' }
  if (ruling?.verdict === 'deferred') return { label: 'Deferred', className: 'badge-info' }
  return { label: 'Proposed, not ruled on', className: 'badge-info' }
}

function RuleForm({ report, link, onRuled }) {
  const [verdict, setVerdict] = useState('')
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ready = verdict && rationale.trim().length >= 10

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    const { error: err } = await vendorReports.ruleLink({
      reportId: report.id,
      actorId: link.actor_id,
      verdict,
      rationale: rationale.trim(),
    })
    setBusy(false)
    if (err) setError(err.message)
    else onRuled()
  }

  const actor = link.threat_actors?.name ?? link.matched_name

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 border border-gray-800 rounded p-3">
      <fieldset className="space-y-1">
        <legend className="text-xs text-gray-500">Is this report about {actor}?</legend>
        {Object.entries(LINK_VERDICTS).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="radio"
              name={`verdict-${report.id}-${link.actor_id}`}
              value={key}
              checked={verdict === key}
              onChange={() => setVerdict(key)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <textarea
        className="cyber-input w-full text-sm"
        rows={2}
        placeholder="Why - at least ten characters. This is kept with the ruling."
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        aria-label={`Reasoning for the ruling on ${actor}`}
      />
      {error && <p className="text-sm text-red-300">The ruling was not recorded: {error}</p>}
      <button type="submit" className="cyber-button text-sm" disabled={!ready || busy}>
        {busy ? 'Recording…' : 'Record ruling'}
      </button>
    </form>
  )
}

function LinkRow({ report, link, ruling, onRuled }) {
  const [open, setOpen] = useState(false)
  const actor = link.threat_actors
  const state = linkState(link, ruling)

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        {actor ? (
          <Link to={`/actors/${actor.id}`} className="text-white hover:underline">
            {actor.name}
          </Link>
        ) : (
          <span className="text-white">{link.matched_name}</span>
        )}
        <span className="text-gray-500">matched on “{link.matched_name}”</span>
        <span className="text-gray-400">
          {actor?.origin_country
            ? `origin ${actor.origin_country} per ${actor.origin_source ?? 'an unrecorded source'}`
            : 'no origin on record'}
        </span>
        <span className={state.className}>{state.label}</span>
        <button
          type="button"
          className="text-xs text-cyber-accent hover:underline"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Cancel' : link.confirmed === null ? 'Rule on this link' : 'Rule again'}
        </button>
      </div>
      {ruling && (
        <p className="text-xs text-gray-500 mt-1">
          Latest ruling ({ruling.verdict}, {calendarDay(ruling.decided_at?.slice(0, 10))}):{' '}
          {ruling.rationale}
        </p>
      )}
      {open && (
        <RuleForm
          report={report}
          link={link}
          onRuled={() => {
            setOpen(false)
            onRuled()
          }}
        />
      )}
    </li>
  )
}

function Report({ report, question, rulings, onRuled }) {
  const links = report.vendor_report_actors ?? []

  return (
    <article className="cyber-card p-4 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a
          href={report.url}
          target="_blank"
          rel="noreferrer"
          className="text-white font-medium hover:underline"
        >
          {report.title}
        </a>
        <span className="text-xs text-gray-500">
          {vendorName(report.source)} · {calendarDay(report.published)}
        </span>
      </div>
      {report.summary && <p className="text-sm text-gray-400 line-clamp-3">{report.summary}</p>}
      <Attribution report={report} question={question} />
      {links.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mt-2">
            Actors proposed by name match
          </h3>
          <ul className="divide-y divide-gray-800/60">
            {links.map((link) => (
              <LinkRow
                key={link.actor_id}
                report={report}
                link={link}
                ruling={rulings[`${report.id}:${link.actor_id}`]}
                onRuled={onRuled}
              />
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

export default function VendorResearch() {
  const [overview, setOverview] = useState(null)
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [linkedOnly, setLinkedOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [questions, setQuestions] = useState({})
  const [rulings, setRulings] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    vendorReports.getOverview().then(({ data }) => {
      if (!cancelled) setOverview(data ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: err } = await vendorReports.getReports({
        source,
        search,
        linkedOnly,
        page,
        pageSize: PAGE_SIZE,
      })
      if (cancelled) return
      if (err) {
        setError(err.message)
        setResult(null)
        setLoading(false)
        return
      }
      setError(null)
      setResult(data)

      const reports = data.reports
      const [q, r] = await Promise.all([
        vendorReports.getOpenQuestions(reports.map((x) => x.url)),
        vendorReports.getLatestRulings(reports.map((x) => x.id)),
      ])
      if (cancelled) return
      setQuestions(q.data ?? {})
      // Rulings are history, not the state of a link: if they cannot be read,
      // the badges still come from vendor_report_actors.confirmed.
      setRulings(r.data ?? {})
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [source, search, linkedOnly, page, reload])

  const onRuled = useCallback(() => setReload((n) => n + 1), [])
  const total = result?.total ?? null
  const from = total ? page * PAGE_SIZE + 1 : 0
  const to = result ? page * PAGE_SIZE + result.reports.length : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Vendor research</h1>
        <p className="text-gray-400 mt-2 max-w-3xl">
          Threat research published by {Object.keys(VENDOR_SOURCES).length} security vendors. The
          research is each vendor&apos;s and is registered as not sellable: Vigil holds the title,
          link, date and the vendor&apos;s own summary, and links to the article.
        </p>
      </div>

      {/* Said before any report, because a blank country reads as an answer. */}
      <div className="cyber-card p-4 border-amber-800/50">
        <p className="text-sm text-amber-200/90">
          <strong className="font-medium">Nothing here is parsed for attribution.</strong> Vendors
          attribute in prose, three paragraphs in and hedged, and a nationality in a title usually
          names a victim or a language. A report with no country means nobody at Vigil has read it
          and ruled, not that the vendor named nobody. The actor links below are name matches, and
          each one is a question until a person rules on it.
        </p>
      </div>

      <Counts overview={overview} />

      <div className="flex flex-wrap items-end gap-3">
        <select
          className="cyber-input"
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            setPage(0)
          }}
          aria-label="Vendor"
        >
          <option value="">All vendors ({figure(overview?.reports)})</option>
          {Object.entries(VENDOR_SOURCES).map(([key, name]) => (
            <option key={key} value={key}>
              {name} ({figure(overview?.bySource?.[key])})
            </option>
          ))}
        </select>
        <input
          className="cyber-input"
          placeholder="Search titles"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          aria-label="Search titles"
        />
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={linkedOnly}
            onChange={(e) => {
              setLinkedOnly(e.target.checked)
              setPage(0)
            }}
          />
          Only reports with a proposed actor link
        </label>
      </div>

      {error && (
        <div className="cyber-card p-4 border-red-800/50">
          <p className="text-sm text-red-200">The reports did not load: {error}</p>
        </div>
      )}

      {result && (
        <p className="text-xs text-gray-500">
          Showing {figure(from)}–{figure(to)} of {figure(total)} reports, newest first.
        </p>
      )}

      <div className="space-y-3">
        {(result?.reports ?? []).map((report) => (
          <Report
            key={report.id}
            report={report}
            question={questions[report.url]}
            rulings={rulings}
            onRuled={onRuled}
          />
        ))}
        {result && result.reports.length === 0 && (
          <p className="cyber-card p-4 text-sm text-gray-400">No report matches these filters.</p>
        )}
      </div>

      {result && total !== null && total > PAGE_SIZE && (
        <div className="flex gap-2">
          <button
            type="button"
            className="cyber-button text-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Newer
          </button>
          <button
            type="button"
            className="cyber-button text-sm"
            disabled={to >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
    </div>
  )
}
