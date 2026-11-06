import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { SCHEDULED_JOBS } from '../../feeds/registry.js'
import { SUBREQUEST_LIMIT, SUBREQUEST_RESERVE } from '../limits.js'

/**
 * The cron trigger only wakes the scheduler; the registry decides what runs. If
 * the jobs' declared costs add up to more than the ticks can admit, feeds fall
 * behind their cadence with no error anywhere: the scheduler just defers them,
 * run after run.
 *
 * It was nearly so on 6 Nov 2026. Four triggers gave about 29 ticks a day, room
 * for about 930 subrequests, against roughly 900 declared by the registry. One
 * hourly trigger alone (768) would have been over. Hence one trigger, twice an
 * hour, and this check that the registry still fits it.
 */
const WRANGLER = resolve(__dirname, '../../../wrangler.toml')
const PER_TICK = SUBREQUEST_LIMIT - SUBREQUEST_RESERVE
const HEADROOM = 0.75

function crons() {
  const toml = readFileSync(WRANGLER, 'utf8')
  const block = toml.match(/^crons\s*=\s*\[([^\]]*)\]/m)
  return block ? [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : []
}

// Ticks a day for "<minutes> * * * *": every hour, at each listed minute.
function ticksPerDay(expr) {
  const m = /^(\d{1,2}(?:,\d{1,2})*) \* \* \* \*$/.exec(expr)
  return m ? m[1].split(',').length * 24 : null
}

function dailyDemand(jobs) {
  return jobs.reduce((sum, job) => sum + ((24 * 60) / job.intervalMinutes) * job.cost, 0)
}

describe('schedule capacity', () => {
  it('uses one cron trigger, so the account has the rest free', () => {
    expect(crons()).toHaveLength(1)
  })

  it('wakes the worker every hour at fixed minutes', () => {
    expect(ticksPerDay(crons()[0])).toBeGreaterThanOrEqual(24)
  })

  it('fits every job inside a single tick', () => {
    const tooBig = SCHEDULED_JOBS.filter((job) => job.cost > PER_TICK).map((job) => job.id)
    expect(tooBig).toEqual([])
  })

  it('has room for every job at its declared cadence, with headroom', () => {
    const capacity = ticksPerDay(crons()[0]) * PER_TICK
    expect(dailyDemand(SCHEDULED_JOBS)).toBeLessThanOrEqual(capacity * HEADROOM)
  })
})
