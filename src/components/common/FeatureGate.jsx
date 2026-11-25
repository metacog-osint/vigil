import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

/**
 * True when a Supabase error means the table or view does not exist in the
 * live database (PostgREST schema-cache miss, or Postgres undefined_table).
 * A permissions or network error is NOT this: those must still show as errors.
 */
export function isMissingTableError(error) {
  if (!error) return false
  const code = String(error.code || '')
  if (code === 'PGRST205' || code === '42P01') return true
  return /could not find the table|does not exist/i.test(String(error.message || ''))
}

/**
 * Checks once that `table` exists before showing `children`. If it does not,
 * says so plainly and offers nothing that could not be saved. Any other
 * outcome (including a failed probe) shows the page as before.
 */
export default function FeatureGate({ table, title, what, children }) {
  const [state, setState] = useState('checking') // checking | ready | missing

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { error } = await supabase
          .from(table)
          .select('*', { head: true, count: 'exact' })
          .limit(1)
        if (!cancelled) setState(isMissingTableError(error) ? 'missing' : 'ready')
      } catch {
        if (!cancelled) setState('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [table])

  if (state === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400" role="status">
        Loading...
      </div>
    )
  }
  if (state === 'missing') {
    return (
      <div className="space-y-6" data-testid="not-set-up">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <div className="cyber-card p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-white mb-2">Not set up yet</h2>
          <p className="text-gray-300 text-sm">
            {what} is not set up in this deployment, so there is nothing to show and nothing to
            create here. This is not an empty list: the feature&apos;s database tables have not been
            created.
          </p>
        </div>
      </div>
    )
  }
  return children
}
