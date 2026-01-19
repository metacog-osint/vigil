/**
 * Events Content - Wrapper for Events page within Activity
 */
import { lazy, Suspense } from 'react'

const EventsPage = lazy(() => import('../Events'))

export default function EventsContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading timeline...</div>}>
      <div className="activity-content-wrapper -mt-6">
        <EventsPage />
      </div>
    </Suspense>
  )
}
