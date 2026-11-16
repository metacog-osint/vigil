/**
 * Review: reading list (/review/reading)
 *
 * The regulator advisories whose red-flag indicators nobody has read yet
 * (advisory_indicators_unread findings, 172). One list, newest first, each with
 * its document, so a reviewer can work through them in a sitting. Reading is
 * recorded on the finding's card in /review; this page only gathers what is
 * waiting.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reviewQueue } from '../lib/supabase/reviewQueue'
import { figure } from '../lib/format'
import { useAuth } from '../hooks/useAuth'

export default function ReviewReading() {
  const { user, loading: authLoading } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    let live = true
    reviewQueue.getReadingList().then(({ data, error: err }) => {
      if (!live) return
      if (err) setError(err.message || 'The reading list could not be read.')
      else setRows(data)
    })
    return () => {
      live = false
    }
  }, [user])

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-white">Advisories to read</h1>
        <p className="text-sm text-gray-400 mt-1">
          Regulator advisories Vigil lists but has not read for their red-flag indicators. Read each
          document, then record what it tells an institution to look for on its card in{' '}
          <Link to="/review" className="text-cyan-400 hover:text-cyan-300 underline">
            the review queue
          </Link>
          .
        </p>
      </header>

      {!authLoading && !user && (
        <div className="cyber-card p-4">
          <p className="text-white">The reading list is for signed-in reviewers.</p>
          <p className="text-sm text-gray-400 mt-1">
            Signed out, Vigil cannot show you what is waiting. This is not an empty list.
          </p>
        </div>
      )}

      {error && <div className="cyber-card p-4 text-red-400">{error}</div>}

      {user && rows === null && !error && <p className="text-gray-400">Loading…</p>}

      {rows && (
        <>
          <p className="text-sm text-gray-400">{figure(rows.length)} waiting.</p>
          <ol className="space-y-3">
            {rows.map((r) => {
              const e = r.evidence || {}
              return (
                <li key={r.finding_id} className="cyber-card p-4">
                  <p className="text-white">{e.title || r.subject}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {String(e.source || '').toUpperCase()} {e.advisory_id}
                    {e.published && <> · published {e.published}</>}
                    {e.kind && <> · {e.kind}</>}
                  </p>
                  {e.document_url ? (
                    <a
                      href={e.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-400 hover:text-cyan-300 underline break-all"
                    >
                      Open the document
                    </a>
                  ) : (
                    <p className="text-sm text-amber-400">No document link is stored.</p>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
