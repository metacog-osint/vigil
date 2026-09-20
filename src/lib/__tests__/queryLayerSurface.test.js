/**
 * The two query layers must expose the same surface.
 *
 * src/lib/supabase.js and src/lib/supabase/*.js both define the same query
 * objects. Most files import the monolith. Four times today a defect turned
 * out to be the same thing: the working code was in the module and the page
 * was holding the other copy.
 *
 *   threatActors   the actor page could not resolve a name from the url
 *   trendAnalysis  a dashboard fix changed the labels and not one number
 *   syncLog        the Operations page called four methods that did not
 *                  exist on its copy, caught the TypeError, and reported no
 *                  sync data beside a table of 15,068 rows
 *
 * A missing method is not a type error anyone sees. It is undefined, it
 * throws at the call site, a try/catch swallows it, and the page renders an
 * empty state that reads exactly like "there is nothing here". This test
 * makes that divergence fail out loud instead.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), auth: {} },
  subscribeToTable: vi.fn(),
}))

import * as monolith from '../supabase'

/** Every query object the modules define, by name. */
const MODULES = import.meta.glob('../supabase/*.js', { eager: true })

function methodsOf(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.keys(obj)
    .filter((k) => typeof obj[k] === 'function')
    .sort()
}

describe('the monolith and the modules agree', () => {
  const pairs = []

  for (const [path, mod] of Object.entries(MODULES)) {
    const name = path.replace('../supabase/', '').replace('.js', '')
    if (name === 'client' || name === 'index') continue

    const fromModule = mod[name]
    const fromMonolith = monolith[name]

    if (!fromModule || !fromMonolith) continue
    if (typeof fromModule !== 'object') continue

    pairs.push([name, fromMonolith, fromModule])
  }

  it('finds query objects defined in both places', () => {
    // If this ever reaches zero the test has stopped testing anything,
    // which is worse than it failing.
    expect(pairs.length).toBeGreaterThan(5)
  })

  it.each(pairs)('%s exposes every method its module defines', (name, mono, mod) => {
    const missing = methodsOf(mod).filter((m) => !methodsOf(mono).includes(m))

    expect(
      missing,
      `${name}: the copy imported from src/lib/supabase.js is missing ` +
        `${missing.join(', ')}. A page calling one of those gets undefined, ` +
        `not an error. Re-export the module instead of keeping a second copy.`
    ).toEqual([])
  })
})

describe('the Operations page can call what it calls', () => {
  // Named explicitly because this is the one that shipped: the page called
  // all four against a copy that had neither.
  it.each(['getStatusSummary', 'getDataFreshness', 'getErrorRates', 'getSourceHistory'])(
    'syncLog.%s exists on the object the page imports',
    (method) => {
      expect(typeof monolith.syncLog[method]).toBe('function')
    }
  )
})
