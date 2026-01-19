/**
 * Audit Logs Content - Wrapper for AuditLogs page within Settings
 */
import { lazy, Suspense } from 'react'

const AuditLogsPage = lazy(() => import('../AuditLogs'))

export default function AuditLogsContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <AuditLogsPage />
      </div>
    </Suspense>
  )
}
