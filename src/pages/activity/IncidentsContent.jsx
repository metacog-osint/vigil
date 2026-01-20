/**
 * Incidents Content - Wrapper for Incidents page within Activity
 */
import { lazy, Suspense } from 'react'

const IncidentsPage = lazy(() => import('../Incidents'))

export default function IncidentsContent() {
  return (
    <Suspense
      fallback={<div className="animate-pulse text-gray-400">Loading ransomware data...</div>}
    >
      <div className="activity-content-wrapper -mt-6">
        <IncidentsPage />
      </div>
    </Suspense>
  )
}
