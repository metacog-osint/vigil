/**
 * Financial crime advisories.
 *
 * The register of what FinCEN has told financial institutions to look for:
 * 183 documents back to 2007, including the pig-butchering alert and the 2026
 * alert on digital-asset investment scam centres.
 *
 * Two things this page says that a register normally does not:
 *
 *   Vigil does not hold the red flags. They are inside the PDFs and reading one
 *   is a person's job, not a regular expression's. The page says so above the
 *   list and links each document to where the indicators actually are.
 *
 *   A rescinded advisory is shown, marked. It was issued and institutions acted
 *   on it; a register that quietly drops it rewrites what they were told.
 */
import { useEffect, useState } from 'react'
import { advisoryRegister, ADVISORY_KINDS, ADVISORY_SOURCES } from '../lib/supabase'
import { figure } from '../lib/format'

const PAGE_SIZE = 50

function formatDate(value) {
  if (!value) return 'undated'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? 'undated'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function KindBadge({ kind }) {
  const meta = ADVISORY_KINDS[kind]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs border border-gray-700 bg-gray-800/60 text-gray-300 whitespace-nowrap"
      title={meta?.note}
    >
      {meta?.label || kind}
    </span>
  )
}

function DocumentRow({ row }) {
  // The PDF where the indicators are, if the register linked one. A landing
  // page is not the document and is not labelled as one.
  const target = row.document_url || row.url

  return (
    <tr className="border-t border-gray-800 align-top">
      <td className="py-3 pr-3 whitespace-nowrap">
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:underline"
        >
          {row.advisory_id}
        </a>
        {row.language !== 'en' && (
          <span className="block text-xs text-gray-600" title="Republished by FinCEN in Spanish">
            Spanish edition
          </span>
        )}
      </td>
      <td className="py-3 pr-3 whitespace-nowrap text-gray-400 text-sm">
        {formatDate(row.published)}
      </td>
      <td className="py-3 pr-3">
        <KindBadge kind={row.kind} />
      </td>
      <td className="py-3 pr-3 text-gray-200">
        {row.title}
        {row.rescinded && (
          <span className="block text-xs text-amber-400/90 mt-1">
            {row.rescinded_note || 'Rescinded'} — kept, because it was issued and acted on
          </span>
        )}
        {!row.document_url && (
          <span className="block text-xs text-gray-600 mt-1">
            Register links a landing page, not the document
          </span>
        )}
      </td>
      <td className="py-3 text-xs whitespace-nowrap">
        {row.indicators_read ? (
          <span className="text-gray-400">read</span>
        ) : (
          <span
            className="text-gray-600"
            title="Nobody has read this document's red-flag indicators into Vigil."
          >
            not read
          </span>
        )}
      </td>
    </tr>
  )
}

function CoverageStrip({ coverage, queued }) {
  if (!coverage) return null

  const cells = [
    { label: 'documents held', value: coverage.documents },
    { label: 'indicators read into Vigil', value: coverage.indicatorsRead, warn: true },
    { label: 'queued for a person to read', value: queued },
    { label: 'rescinded, and kept', value: coverage.rescinded },
    { label: 'Spanish republications', value: coverage.spanish },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

export default function FinancialCrime() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(null)
  const [coverage, setCoverage] = useState(null)
  const [queued, setQueued] = useState(null)
  const [kinds, setKinds] = useState([])
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [list, cov, counts, queue] = await Promise.all([
        advisoryRegister.getAll({
          kind: kind || null,
          search: search.trim() || null,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        advisoryRegister.getCoverage(),
        advisoryRegister.countsByKind(),
        advisoryRegister.getQueuedForReading(),
      ])

      if (cancelled) return

      if (list.error) {
        setError(list.error.message || 'Could not read the register.')
        setLoading(false)
        return
      }

      setRows(list.data || [])
      setTotal(list.count)
      setCoverage(cov.data || null)
      setKinds(counts.data || [])
      setQueued(queue.count)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [kind, search, page])

  const source = ADVISORY_SOURCES.fincen

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Financial crime advisories</h1>
        <p className="text-gray-400 mt-2 max-w-3xl">
          What {source.authority} has told financial institutions to look for. Unlike everything
          else in Vigil, these documents are not a record of what happened — they are instructions
          written to be acted on by institutions with a legal obligation to act.
          {coverage?.earliest && coverage?.latest && (
            <>
              {' '}
              {formatDate(coverage.earliest)} to {formatDate(coverage.latest)}.
            </>
          )}
        </p>
      </div>

      {/* Said before the list, because the list looks like more than it is. */}
      <div className="cyber-card p-4 border-amber-800/50">
        <p className="text-sm text-amber-200/90">
          <strong className="font-medium">Vigil holds the register, not the red flags.</strong> The
          indicators are inside each document, and turning a paragraph of prose into a structured
          indicator is a judgment rather than a parse. Every row links to the document; the ones
          worth reading first are in the review queue.
        </p>
      </div>

      <CoverageStrip coverage={coverage} queued={queued} />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setPage(0)
            setSearch(e.target.value)
          }}
          placeholder="Search title or identifier"
          className="cyber-input flex-1 min-w-[16rem]"
        />
        <select
          value={kind}
          onChange={(e) => {
            setPage(0)
            setKind(e.target.value)
          }}
          className="cyber-input"
        >
          <option value="">All kinds</option>
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>
              {ADVISORY_KINDS[k.kind]?.label || k.kind} ({k.documents})
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-gray-500">Reading the register…</p>}

      {error && (
        <div className="cyber-card p-4 border-red-800/50">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-xs text-gray-600">
            {figure(total)} matching {total === 1 ? 'document' : 'documents'}
            {typeof total === 'number' && total > PAGE_SIZE && (
              <>
                {' '}
                · showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}
              </>
            )}
          </p>

          <div className="cyber-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-2 px-3 font-normal">Identifier</th>
                  <th className="py-2 pr-3 font-normal">Published</th>
                  <th className="py-2 pr-3 font-normal">Kind</th>
                  <th className="py-2 pr-3 font-normal">Title, as FinCEN wrote it</th>
                  <th className="py-2 pr-3 font-normal">Indicators</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <DocumentRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && <p className="text-gray-500">Nothing matches that.</p>}

          {typeof total === 'number' && total > PAGE_SIZE && (
            <div className="flex items-center gap-3">
              <button
                className="cyber-button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                className="cyber-button"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-600">
        {source.label} · {source.licence}. Rescinded documents are shown rather than removed.
      </p>
    </div>
  )
}
