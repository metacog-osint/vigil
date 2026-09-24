/**
 * Contested claims.
 *
 * Every other page in Vigil shows a figure. This one shows the figures that
 * disagree, and refuses to choose between them.
 *
 * Three things this page will not do:
 *
 *   It never prints one number for a contested claim. `resolution` and
 *   `handling` say what a person decided — present both, give the range, quote
 *   nothing — and the page renders that instruction rather than resolving the
 *   claim itself.
 *
 *   It never lets a repetition look like a second source. Each value carries
 *   the tier of the body that produced it, and a row that repeats another says
 *   so. "3 values · 1 origin" is the headline of the whole page.
 *
 *   It never presents a carried-forward figure as an established one. Nothing
 *   here has been read against its primary source, and the banner says so
 *   before the first number.
 */
import { useEffect, useState } from 'react'
import {
  contestedClaims,
  EVIDENCE_TIERS,
  UNCLASSIFIED_TIER,
  MEASUREMENTS,
  RESOLUTIONS,
  VERIFICATION_STATES,
} from '../lib/supabase'
import { figure } from '../lib/format'

const TIER_STYLES = {
  1: 'border-emerald-700/60 bg-emerald-900/30 text-emerald-300',
  2: 'border-amber-700/60 bg-amber-900/30 text-amber-300',
  3: 'border-red-800/60 bg-red-900/30 text-red-300',
}

const UNCLASSIFIED_STYLE = 'border-gray-700 bg-gray-800/60 text-gray-400'

function formatPeriod(start, end) {
  if (!start && !end) return null
  const year = (v) => (v ? new Date(v).getUTCFullYear() : '?')
  const a = year(start)
  const b = year(end)
  return a === b ? String(a) : `${a}–${b}`
}

/** A tier, with the reason it licenses what it licenses on hover. */
function TierBadge({ tier }) {
  const meta = EVIDENCE_TIERS[tier] || UNCLASSIFIED_TIER
  const style = TIER_STYLES[tier] || UNCLASSIFIED_STYLE

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border whitespace-nowrap ${style}`}
      title={meta.note}
    >
      {meta.label}
    </span>
  )
}

function MeasurementBadge({ measurement }) {
  const meta = MEASUREMENTS[measurement]
  if (!meta) return null

  // A projection reading as a measurement is the error this page exists for,
  // so it is the one badge that is allowed to shout.
  const loud = measurement === 'projected' || measurement === 'claimed'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border whitespace-nowrap ${
        loud
          ? 'border-red-800/60 bg-red-900/30 text-red-300'
          : 'border-gray-700 bg-gray-800/60 text-gray-400'
      }`}
      title={meta.note}
    >
      {meta.label}
    </span>
  )
}

/**
 * Values against origins.
 *
 * The only number on this page that is an argument rather than a fact.
 */
function OriginCount({ values, origins }) {
  const echo = typeof values === 'number' && typeof origins === 'number' && origins < values

  return (
    <span className={echo ? 'text-amber-300' : 'text-gray-400'}>
      {figure(values)} {values === 1 ? 'value' : 'values'} · {figure(origins)}{' '}
      {origins === 1 ? 'origin' : 'origins'}
      {echo && (
        <span className="block text-xs text-amber-500/80">
          fewer bodies than figures — some of these repeat each other
        </span>
      )}
    </span>
  )
}

function ValueRow({ value }) {
  const shown =
    value.value_text ||
    (value.value_numeric !== null && value.value_numeric !== undefined
      ? Number(value.value_numeric).toLocaleString()
      : '—')

  const verification = VERIFICATION_STATES[value.verification]

  return (
    <tr className="border-t border-gray-800 align-top">
      <td className="py-2 pr-3">
        <div className="text-gray-200">{value.publisher_name}</div>
        {value.is_repetition && (
          <div className="text-xs text-amber-500/80">
            repeats {value.origin_publisher_name}
            {value.repetition_depth > 1 ? ` (${value.repetition_depth} hops)` : ''}
          </div>
        )}
        {value.citation && <div className="text-xs text-gray-600">{value.citation}</div>}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {/* The originator's tier, not the repeater's. */}
        <TierBadge tier={value.effective_tier} />
      </td>
      <td className="py-2 pr-3 text-gray-100 font-medium">{shown}</td>
      <td className="py-2 pr-3">
        <MeasurementBadge measurement={value.measurement} />
      </td>
      <td className="py-2 text-xs text-gray-500" title={verification?.note}>
        {verification?.label || value.verification}
        {value.verified_on ? ` ${value.verified_on}` : ''}
      </td>
    </tr>
  )
}

function ClaimCard({ claim, values }) {
  const resolution = RESOLUTIONS[claim.resolution] || { label: claim.resolution }
  const period = formatPeriod(claim.period_start, claim.period_end)

  return (
    <div className="cyber-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-medium">{claim.question}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {period && <span>{period} · </span>}
            <OriginCount values={claim.values_recorded} origins={claim.distinct_origins} />
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs border whitespace-nowrap ${
            claim.resolution === 'unresolved'
              ? 'border-amber-700/60 bg-amber-900/30 text-amber-300'
              : 'border-gray-700 bg-gray-800/60 text-gray-300'
          }`}
          title={resolution.note}
        >
          {resolution.label}
        </span>
      </div>

      {claim.scope_note && <p className="text-sm text-gray-400 mt-3">{claim.scope_note}</p>}

      {values?.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2 pr-3 font-normal">Publisher</th>
                <th className="pb-2 pr-3 font-normal">Tier of origin</th>
                <th className="pb-2 pr-3 font-normal">Value</th>
                <th className="pb-2 pr-3 font-normal">Kind</th>
                <th className="pb-2 font-normal">Checked</th>
              </tr>
            </thead>
            <tbody>
              {values.map((v) => (
                <ValueRow key={v.id} value={v} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* What a person ruled, which is the only thing that resolves a claim. */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        {claim.handling ? (
          <>
            <p className="text-sm text-gray-200">{claim.handling}</p>
            <p className="text-xs text-gray-600 mt-1">
              Ruled by {claim.decided_by}
              {claim.decided_at ? ` on ${new Date(claim.decided_at).toLocaleDateString()}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-amber-300/90">
            Nobody has ruled on this. It is queued for review, and until it is ruled Vigil has no
            position on which figure is right.
          </p>
        )}
      </div>
    </div>
  )
}

function CoverageStrip({ coverage }) {
  if (!coverage) return null

  const cells = [
    { label: 'claims', value: coverage.claims },
    { label: 'values', value: coverage.values },
    { label: 'of those, repetitions', value: coverage.repetitions },
    { label: 'claims that only look corroborated', value: coverage.echoClaims },
    { label: 'values checked at source', value: coverage.verified, warn: coverage.verified === 0 },
    { label: 'publishers with no tier', value: coverage.untiered, warn: coverage.untiered > 0 },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div key={cell.label} className="cyber-card p-4">
          <div className={`text-2xl font-semibold ${cell.warn ? 'text-amber-300' : 'text-white'}`}>
            {figure(cell.value)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{cell.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function ContestedClaims() {
  const [claims, setClaims] = useState([])
  const [valuesByClaim, setValuesByClaim] = useState({})
  const [coverage, setCoverage] = useState(null)
  const [echoOnly, setEchoOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [claimsResult, valuesResult, coverageResult] = await Promise.all([
        contestedClaims.getAll({ echoOnly }),
        contestedClaims.getAllValues(),
        contestedClaims.getCoverage(),
      ])

      if (cancelled) return

      if (claimsResult.error) {
        setError(claimsResult.error.message || 'Could not read the claims.')
        setLoading(false)
        return
      }

      const grouped = {}
      for (const value of valuesResult.data || []) {
        ;(grouped[value.claim_key] ||= []).push(value)
      }

      setClaims(claimsResult.data || [])
      setValuesByClaim(grouped)
      setCoverage(coverageResult.data || null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [echoOnly])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Contested claims</h1>
        <p className="text-gray-400 mt-2 max-w-3xl">
          Where two bodies publish different numbers for the same thing. Vigil records both, names
          who produced each, and shows what a person decided to do about the difference. It does not
          pick one and print it.
        </p>
      </div>

      {/* Said before the first figure, deliberately. */}
      <div className="cyber-card p-4 border-amber-800/50">
        <p className="text-sm text-amber-200/90">
          <strong className="font-medium">Nothing on this page has been checked at source.</strong>{' '}
          Every figure was entered from a compilation and carries{' '}
          <span className="text-amber-300">carried forward</span> until someone reads it against the
          primary document. Each one is queued in the review queue as exactly that work.
        </p>
      </div>

      <CoverageStrip coverage={coverage} />

      <div className="cyber-card p-4">
        <h2 className="text-sm font-medium text-gray-200">How to read the tier column</h2>
        <p className="text-sm text-gray-400 mt-2">
          A figure&rsquo;s tier is the tier of the body that <em>produced</em> it, never of the body
          that repeated it. A commercial estimate carried by a wire service, an aggregator and a
          vendor blog is still one commercial estimate — so the counts above and the origin line on
          each claim count bodies rather than citations.
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          {[1, 2, 3].map((tier) => (
            <span key={tier} className="inline-flex items-center gap-2 text-xs text-gray-500">
              <TierBadge tier={tier} />
              {EVIDENCE_TIERS[tier].name}
            </span>
          ))}
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-400">
        <input
          type="checkbox"
          checked={echoOnly}
          onChange={(e) => setEchoOnly(e.target.checked)}
          className="rounded border-gray-700 bg-gray-800"
        />
        Show only claims where every figure traces to one body
      </label>

      {loading && <p className="text-gray-500">Reading the claims…</p>}

      {error && (
        <div className="cyber-card p-4 border-red-800/50">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && claims.length === 0 && (
        <p className="text-gray-500">No claims match that filter.</p>
      )}

      <div className="space-y-4">
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} values={valuesByClaim[claim.claim_key]} />
        ))}
      </div>
    </div>
  )
}
