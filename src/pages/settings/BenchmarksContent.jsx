/**
 * Benchmarks Content - Wrapper for Benchmarks page within Settings
 */
import { lazy, Suspense } from 'react'

const BenchmarksPage = lazy(() => import('../Benchmarks'))

export default function BenchmarksContent() {
  return (
    <Suspense fallback={<div className="animate-pulse text-gray-400">Loading...</div>}>
      <div className="settings-content-wrapper">
        <BenchmarksPage />
      </div>
    </Suspense>
  )
}
