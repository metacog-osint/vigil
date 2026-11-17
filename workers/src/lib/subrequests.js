/**
 * Counts every subrequest an invocation makes, not just the ones the Supabase
 * client makes.
 *
 * Until 17 Nov 2026 the budget saw only the client's calls. A feed's own fetch()
 * (the source download, the call to its Edge Function) and the sync_log row each
 * job writes were covered by a fixed reserve of 18. That reserve did not grow
 * with the number of jobs, so a busy tick went past Workers Free's 50 with the
 * budget still showing room. At 03:15 UTC on 17 Nov a tick of 14 due jobs was
 * cut off during pulsedive: the platform refused the next call, the sync_log
 * write with it, and the summary row never came. Nothing recorded why.
 *
 * Now the worker's global fetch is wrapped once, and every call made inside
 * withSubrequestBudget() is spent against that invocation's budget. The budget
 * travels in AsyncLocalStorage (compatibility flag nodejs_als), so two
 * invocations sharing an isolate keep separate counts.
 *
 *   enforce: true   a feed's own work. Refused with SubrequestBudgetError at the
 *                   budget's ceiling, so the feed stops before the platform stops it.
 *   enforce: false  the run's bookkeeping (feed_health, sync_log). Counted, never
 *                   refused: the reserve exists so these always have room.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

const scope = new AsyncLocalStorage()
const METERED = Symbol.for('vigil.meteredFetch')

/**
 * Wraps `target.fetch` so calls inside withSubrequestBudget() are counted.
 * Idempotent. Returns a function that restores the original (for tests).
 */
export function installFetchMeter(target = globalThis) {
  const current = target.fetch
  if (typeof current !== 'function') throw new Error('installFetchMeter: no fetch to wrap')
  if (current[METERED]) return () => {}

  const original = current
  const metered = function fetch(input, init) {
    const store = scope.getStore()
    if (store) store.budget.spend({ enforce: store.enforce })
    return original.call(target, input, init)
  }
  metered[METERED] = true
  target.fetch = metered

  return () => {
    if (target.fetch === metered) target.fetch = original
  }
}

/** Runs `fn` with every fetch inside it spent against `budget`. */
export function withSubrequestBudget(budget, fn, { enforce = true } = {}) {
  return scope.run({ budget, enforce }, fn)
}
