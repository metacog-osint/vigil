/**
 * Every rule type the settings page offers must be one the alert engine
 * evaluates.
 *
 * Until migration 159 the page offered severity_threshold, which
 * evaluate_alert_rules() never handled: a rule saved, showed as active, and
 * never fired. This reads the engine from the newest migration that defines
 * it, so adding a type to the page without teaching the engine fails here.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../../../lib/supabase', () => ({ alertRules: {} }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))

import { RULE_TYPES } from '../AlertRulesSection'

const migrations = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations'
)

function latestEngine() {
  const file = readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) =>
      /create or replace function public\.evaluate_alert_rules/i.test(
        readFileSync(join(migrations, f), 'utf8')
      )
    )
    .pop()
  return readFileSync(join(migrations, file), 'utf8')
}

/** The rule_type values the engine's IF/ELSIF branches name. */
function evaluatedTypes(sql) {
  const types = new Set()
  for (const m of sql.matchAll(/r\.rule_type\s*=\s*'([a-z_0-9]+)'/gi)) types.add(m[1])
  for (const m of sql.matchAll(/r\.rule_type\s+IN\s*\(([^)]*)\)/gi)) {
    for (const t of m[1].matchAll(/'([a-z_0-9]+)'/g)) types.add(t[1])
  }
  return types
}

describe('rule types', () => {
  it('offers only types the engine evaluates', () => {
    const engine = evaluatedTypes(latestEngine())
    const offered = RULE_TYPES.map((t) => t.value)
    expect(offered.filter((t) => !engine.has(t))).toEqual([])
  })

  it('offers the KEV + EPSS rule and no longer offers severity_threshold', () => {
    const offered = RULE_TYPES.map((t) => t.value)
    expect(offered).toContain('kev_epss_p1')
    expect(offered).not.toContain('severity_threshold')
  })
})
