/**
 * Ops Content - Wrapper for OpsDashboard page within Settings
 */
import { lazy, Suspense } from 'react'

const OpsPage = lazy(() => import('../admin/OpsDashboard'))

export default function OpsContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <OpsPage />
      </div>
    </Suspense>
  )
}
