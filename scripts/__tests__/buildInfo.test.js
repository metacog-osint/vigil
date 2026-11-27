import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JOBS } from '../../workers/src/feeds/registry.js'
import { loadBuildInfo, loadRegistrySummary, summarizeRegistry } from '../lib/buildInfo.mjs'

const jobs = [
  { id: 'b', intervalMinutes: 60, priority: 1, cost: 4 },
  { id: 'a', intervalMinutes: 1440, priority: 3, cost: 1 },
]

describe('summarizeRegistry', () => {
  it('lists jobs by id with the fields that decide what runs', () => {
    const summary = summarizeRegistry(jobs)
    expect(summary.jobs).toEqual([
      { id: 'a', intervalMinutes: 1440, priority: 3, paused: false },
      { id: 'b', intervalMinutes: 60, priority: 1, paused: false },
    ])
    expect(summary.jobCount).toBe(2)
    expect(summary.scheduledCount).toBe(2)
    expect(summary.fingerprint).toMatch(/^[0-9a-f]{8}$/)
  })

  it('keeps its fingerprint when only the order or a cost changes', () => {
    const base = summarizeRegistry(jobs).fingerprint
    expect(summarizeRegistry([...jobs].reverse()).fingerprint).toBe(base)
    expect(summarizeRegistry([{ ...jobs[0], cost: 99 }, jobs[1]]).fingerprint).toBe(base)
  })

  it('changes its fingerprint when a job is re-timed, paused, added or removed', () => {
    const base = summarizeRegistry(jobs).fingerprint
    expect(summarizeRegistry([{ ...jobs[0], intervalMinutes: 360 }, jobs[1]]).fingerprint).not.toBe(
      base
    )
    expect(summarizeRegistry([{ ...jobs[0], paused: true }, jobs[1]]).fingerprint).not.toBe(base)
    expect(
      summarizeRegistry([...jobs, { id: 'c', intervalMinutes: 60, priority: 2 }]).fingerprint
    ).not.toBe(base)
    expect(summarizeRegistry([jobs[0]]).fingerprint).not.toBe(base)
  })

  it('counts a paused job but not as scheduled', () => {
    const summary = summarizeRegistry([{ ...jobs[0], paused: true }, jobs[1]])
    expect(summary.jobCount).toBe(2)
    expect(summary.scheduledCount).toBe(1)
  })
})

describe('loadBuildInfo', () => {
  it("carries package.json's version and the real feed registry", async () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
    const info = await loadBuildInfo(process.cwd(), {})
    expect(info.version).toBe(pkg.version)
    expect(info.commit).toBeNull()
    expect(info.registry.jobCount).toBe(JOBS.length)
    expect(info.registry.fingerprint).toBe(summarizeRegistry(JOBS).fingerprint)
  })

  it('shortens the commit Vercel builds from', async () => {
    const info = await loadBuildInfo(process.cwd(), { VERCEL_GIT_COMMIT_SHA: '0123456789abcdef' })
    expect(info.commit).toBe('0123456')
  })

  it('gives a null registry rather than failing when the registry will not load', async () => {
    expect(await loadRegistrySummary(resolve(process.cwd(), 'no-such-root'))).toBeNull()
  })
})
