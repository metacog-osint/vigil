/**
 * Status Content - Wrapper for Status page within Settings
 */
import { lazy, Suspense } from 'react'

const StatusPage = lazy(() => import('../Status'))

export default function StatusContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <StatusPage />
      </div>
    </Suspense>
  )
}
