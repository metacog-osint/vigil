// What a build of the site says about itself: its version, the commit it was
// built from, and the feed registry it was built beside.
//
// Read by vite.config.js and vitest.config.js, which pass the result to the
// app as __VIGIL_BUILD__ (src/lib/buildInfo.js reads it).
//
// The feed registry is workers/src/feeds/registry.js. The worker that runs it
// is deployed separately from the site, so the registry in a site build is the
// one on the branch that was built, not necessarily the one running now. The
// pages that show it say so.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * The registry reduced to what decides what runs and how often: each job's
 * id, interval, priority and whether it is paused, sorted by id. The
 * fingerprint is the first 8 hex digits of the SHA-256 of that list, so it
 * changes when a job is added, removed, paused or re-timed, and not when a
 * comment or a cost estimate changes.
 */
export function summarizeRegistry(jobs) {
  const list = jobs
    .map((job) => ({
      id: job.id,
      intervalMinutes: job.intervalMinutes,
      priority: job.priority,
      paused: Boolean(job.paused),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const fingerprint = createHash('sha256').update(JSON.stringify(list)).digest('hex').slice(0, 8)
  return {
    fingerprint,
    jobCount: list.length,
    scheduledCount: list.filter((job) => !job.paused).length,
    jobs: list,
  }
}

/** The feed registry's summary, or null if the registry could not be loaded. */
export async function loadRegistrySummary(root = ROOT) {
  try {
    const url = pathToFileURL(resolve(root, 'workers', 'src', 'feeds', 'registry.js')).href
    const { JOBS } = await import(url)
    return summarizeRegistry(JOBS)
  } catch (error) {
    // A site build must not fail because the worker's code would not load in
    // Node; the pages say the registry is not available in this build instead.
    console.warn(`buildInfo: feed registry not loaded (${error.message})`)
    return null
  }
}

/** Everything __VIGIL_BUILD__ carries. */
export async function loadBuildInfo(root = ROOT, env = process.env) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  // Vercel sets VERCEL_GIT_COMMIT_SHA on its builds; a local build has none.
  const sha = env.VERCEL_GIT_COMMIT_SHA || null
  return {
    version: pkg.version,
    commit: sha ? sha.slice(0, 7) : null,
    registry: await loadRegistrySummary(root),
  }
}
