/**
 * Watch packs. The first block is the CI check on the stock packs in
 * catalog/packs/: each must validate against the rule types and condition
 * keys the alert engine actually evaluates.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

vi.mock('../supabase', () => ({ alertRules: {}, watchlists: {}, threatActors: {} }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))

import { RULE_CONDITIONS, SECTORS, importPack, planImport, validatePack } from '../watchPacks'
import { RULE_TYPES } from '../../components/settings/AlertRulesSection'

const root = process.cwd()
const packDir = resolve(root, 'catalog', 'packs')
const packFiles = readdirSync(packDir).filter((f) => f.endsWith('.json'))
const readPack = (file) => JSON.parse(readFileSync(join(packDir, file), 'utf8'))

function latestEngine() {
  const dir = resolve(root, 'supabase', 'migrations')
  const file = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) =>
      /create or replace function public\.evaluate_alert_rules/i.test(
        readFileSync(join(dir, f), 'utf8')
      )
    )
    .pop()
  return readFileSync(join(dir, file), 'utf8')
}

describe('stock packs (catalog/packs)', () => {
  it('has at least three', () => {
    expect(packFiles.length).toBeGreaterThanOrEqual(3)
  })

  it.each(packFiles)('%s validates', (file) => {
    const pack = readPack(file)
    expect(validatePack(pack)).toEqual([])
    expect(pack.id).toBe(file.replace(/\.json$/, ''))
  })

  it.each(packFiles)('%s imports with nothing left out', (file) => {
    expect(planImport(readPack(file)).skipped).toEqual([])
  })
})

describe('the format follows the alert engine', () => {
  it('knows exactly the rule types the settings page offers', () => {
    expect(Object.keys(RULE_CONDITIONS).sort()).toEqual(RULE_TYPES.map((t) => t.value).sort())
  })

  it('allows only condition keys the engine reads', () => {
    const sql = latestEngine()
    const keys = new Set(Object.values(RULE_CONDITIONS).flat())
    for (const key of keys) {
      expect(sql, key).toMatch(new RegExp(`conditions\\s*->>?\\s*'${key}'`))
    }
  })

  it("uses Vigil's sector names", () => {
    expect(SECTORS).toContain('healthcare')
    expect(SECTORS).toContain('energy')
  })
})

const basePack = {
  schema_version: 1,
  pack_version: '1.0.0',
  id: 'test',
  name: 'Test',
  description: 'A test pack',
  sectors: ['healthcare'],
  rules: [
    { rule_type: 'sector_incident', rule_name: 'Sector' },
    { rule_type: 'vendor_cve', rule_name: 'Vendors', conditions: { vendors: ['Acme'] } },
  ],
  watch: [{ watchlist: 'Groups', entity_type: 'actor', entities: [{ name: 'Rhysida' }] }],
}

describe('validatePack (strict)', () => {
  it('passes a good pack', () => {
    expect(validatePack(basePack)).toEqual([])
  })

  it('fails an unknown rule type, condition key, sector or entity type', () => {
    const pack = {
      ...basePack,
      rules: [
        { rule_type: 'severity_threshold', rule_name: 'Old type' },
        { rule_type: 'vendor_cve', rule_name: 'Bad key', conditions: { products: ['x'] } },
        {
          rule_type: 'sector_incident',
          rule_name: 'Bad sector',
          conditions: { sectors: ['space'] },
        },
      ],
      watch: [{ watchlist: 'IPs', entity_type: 'ioc', entities: ['1.2.3.4'] }],
    }
    const errors = validatePack(pack).join('\n')
    expect(errors).toMatch(/severity_threshold" is not one the alert engine evaluates/)
    expect(errors).toMatch(/condition "products" is not read for vendor_cve/)
    expect(errors).toMatch(/sectors must be/)
    expect(errors).toMatch(/entity_type must be one of actor, vulnerability/)
  })

  it('needs a version, and a sector for a sector rule', () => {
    const { sectors: _drop, ...noSectors } = basePack
    const errors = validatePack({ ...noSectors, pack_version: 'one' }).join('\n')
    expect(errors).toMatch(/pack_version/)
    expect(errors).toMatch(/sector_incident needs sectors/)
  })
})

describe('planImport (forgiving)', () => {
  it("gives sector rules the pack's sectors", () => {
    const plan = planImport(basePack)
    expect(plan.rules[0]).toEqual({
      ruleName: 'Sector',
      ruleType: 'sector_incident',
      conditions: { sectors: ['healthcare'] },
    })
  })

  it('skips an unknown rule type, keeps the rest, and lists what it skipped', () => {
    const plan = planImport({
      ...basePack,
      rules: [...basePack.rules, { rule_type: 'dark_web_mention', rule_name: 'Future rule' }],
    })
    expect(plan.rules.map((r) => r.ruleName)).toEqual(['Sector', 'Vendors'])
    expect(plan.skipped).toEqual([
      {
        item: 'rule "Future rule"',
        reason: 'rule type "dark_web_mention" is not one Vigil evaluates',
      },
    ])
  })

  it('drops an unknown condition key but keeps the rule', () => {
    const plan = planImport({
      ...basePack,
      rules: [
        {
          rule_type: 'vendor_cve',
          rule_name: 'Vendors',
          conditions: { vendors: ['Acme'], epss_min: 0.2 },
        },
      ],
    })
    expect(plan.rules[0].conditions).toEqual({ vendors: ['Acme'] })
    expect(plan.skipped[0].item).toBe('condition "epss_min" on rule "Vendors"')
  })

  it('skips an unknown entity type, a bad CVE id and an unknown sector', () => {
    const plan = planImport({
      ...basePack,
      sectors: ['healthcare', 'space'],
      watch: [
        { watchlist: 'IPs', entity_type: 'ioc', entities: ['1.2.3.4'] },
        {
          watchlist: 'CVEs',
          entity_type: 'vulnerability',
          entities: ['CVE-2024-3400', 'log4shell'],
        },
      ],
    })
    expect(plan.watch).toEqual([
      {
        name: 'CVEs',
        entityType: 'vulnerability',
        entities: [{ name: 'CVE-2024-3400', note: null }],
      },
    ])
    const items = plan.skipped.map((s) => s.item)
    expect(items).toContain('sector "space"')
    expect(items).toContain('watchlist "IPs"')
    expect(items).toContain('"log4shell" in "CVEs"')
  })

  it('says when a pack is from a newer schema, and still imports what it can', () => {
    const plan = planImport({ ...basePack, schema_version: 2 })
    expect(plan.rules).toHaveLength(2)
    expect(plan.skipped[0].item).toBe('schema_version 2')
  })

  it('does not throw on something that is not a pack', () => {
    expect(planImport(null).skipped[0].reason).toBe('not a pack')
    expect(planImport([1, 2]).rules).toEqual([])
  })
})

describe('importPack', () => {
  function fakeApi({ knownActors = {} } = {}) {
    const calls = { rules: [], watchlists: [], items: [] }
    return {
      calls,
      api: {
        alertRules: {
          create: vi.fn(async (rule) => {
            calls.rules.push(rule)
            return { data: { id: `r${calls.rules.length}`, ...rule }, error: null }
          }),
        },
        threatActors: {
          getByIdOrName: vi.fn(async (name) => ({
            data: knownActors[name] ? { id: knownActors[name] } : null,
          })),
        },
        watchlists: {
          create: vi.fn(async (w) => {
            calls.watchlists.push(w)
            return { data: { id: `w${calls.watchlists.length}`, ...w }, error: null }
          }),
          addItem: vi.fn(async (watchlistId, entityId, userId, notes) => {
            calls.items.push({ watchlistId, entityId, userId, notes })
            return { data: {}, error: null }
          }),
        },
      },
    }
  }

  it('creates the rules and watchlists for the user, and resolves actors by name', async () => {
    const { api, calls } = fakeApi({ knownActors: { Rhysida: 'uuid-1' } })
    const plan = planImport(basePack)
    const result = await importPack(plan, { userId: 'u1', api, packLabel: 'Test' })
    expect(calls.rules.map((r) => [r.ruleName, r.userId])).toEqual([
      ['Sector', 'u1'],
      ['Vendors', 'u1'],
    ])
    expect(calls.watchlists[0]).toMatchObject({
      user_id: 'u1',
      name: 'Groups',
      entity_type: 'actor',
      description: 'Imported (from the Test pack)',
    })
    expect(calls.items).toEqual([
      { watchlistId: 'w1', entityId: 'uuid-1', userId: 'u1', notes: null },
    ])
    expect(result.created.rules).toHaveLength(2)
    expect(result.skipped).toEqual([])
  })

  it('lists an actor nothing matches, and creates no empty watchlist', async () => {
    const { api, calls } = fakeApi()
    const result = await importPack(planImport(basePack), { userId: 'u1', api })
    expect(calls.watchlists).toEqual([])
    expect(result.skipped.map((s) => s.item)).toEqual(['actor "Rhysida"', 'watchlist "Groups"'])
  })

  it('lists a rule the database refused and goes on', async () => {
    const { api } = fakeApi({ knownActors: { Rhysida: 'uuid-1' } })
    api.alertRules.create = vi.fn(async () => ({ data: null, error: { message: 'denied' } }))
    const result = await importPack(planImport(basePack), { userId: 'u1', api })
    expect(result.created.rules).toEqual([])
    expect(result.created.watchlists).toHaveLength(1)
    expect(result.skipped[0]).toEqual({ item: 'rule "Sector"', reason: 'denied' })
  })
})
