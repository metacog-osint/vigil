/**
 * API Docs Content - Wrapper for ApiDocs page within Settings
 */
import { lazy, Suspense } from 'react'

const ApiDocsPage = lazy(() => import('../ApiDocs'))

export default function ApiDocsContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <ApiDocsPage />
      </div>
    </Suspense>
  )
}
