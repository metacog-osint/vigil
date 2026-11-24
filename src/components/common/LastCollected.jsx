import { useEffect, useState } from 'react'
import { fmt } from '../../lib/time'
import { syncLog } from '../../lib/supabase/syncLog'

// When a feed last finished successfully, read from sync_log. Shows nothing
// when that can't be read: a guessed time would be worse than no time.
export default function LastCollected({ className = '' }) {
  const [at, setAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    syncLog
      .getLastCollected()
      .then((value) => {
        if (!cancelled) setAt(value)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!at) return null
  return <span className={className}>Last collected: {fmt(at)}</span>
}
