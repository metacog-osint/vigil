/**
 * Vendors Content - Wrapper for Vendors page within Settings
 */
import { lazy, Suspense } from 'react'

const VendorsPage = lazy(() => import('../Vendors'))

export default function VendorsContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <VendorsPage />
      </div>
    </Suspense>
  )
}
