/**
 * Vigil's one-line daily summary lives in workers/src/lib/publicSummary.js, because the worker builds
 * it each hour (175) and is deployed from an export of workers/ alone. Re-exported here for
 * api/summary.js and the tests. What it counts, and why, is in that file.
 */
export * from '../../workers/src/lib/publicSummary.js'
