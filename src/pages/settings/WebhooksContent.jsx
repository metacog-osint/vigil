/**
 * Webhooks Content - Wrapper for Webhooks page within Settings
 */
import { lazy, Suspense } from 'react'

const WebhooksPage = lazy(() => import('../Webhooks'))

export default function WebhooksContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <WebhooksPage />
      </div>
    </Suspense>
  )
}
