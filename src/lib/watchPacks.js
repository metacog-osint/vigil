/**
 * Watch packs: a set of alert rules and watchlists in one file, to import in
 * one step. Stock packs live in `catalog/packs/*.json`.
 *
 * Format, schema_version 1:
 *
 *   {
 *     "schema_version": 1,
 *     "pack_version": "1.0.0",            // semver; raise it when the pack changes
 *     "id": "healthcare",                 // the file's name without .json
 *     "name": "Healthcare",
 *     "description": "What the pack watches and what it cannot",
 *     "sectors": ["healthcare"],          // the pack's sector filter (see below)
 *     "rules": [
 *       { "rule_type": "sector_incident", "rule_name": "...", "conditions": { ... } }
 *     ],
 *     "watch": [
 *       { "watchlist": "...", "entity_type": "actor", "entities": [
 *           { "name": "Rhysida", "note": "Why it is here, with a source" } ] }
 *     ]
 *   }
 *
 * `rules[].rule_type` must be one the alert engine evaluates (RULE_TYPES in
 * AlertRulesSection.jsx), and each condition key one the engine reads for that
 * type (RULE_CONDITIONS below; a test checks them against the engine's SQL).
 * `sectors` uses Vigil's sector names, the keys of `doctrine/ncf_map.json`.
 * The sector filter is applied to the pack's sector_incident rules: one
 * without its own `sectors` gets the pack's.
 *
 * A watch entity is an actor (by name or alias, matched on import) or a
 * vulnerability (by CVE id).
 *
 * validatePack() is strict and is what CI runs on the stock packs.
 * planImport() is forgiving: an unknown rule type, condition key, entity type
 * or sector is left out, the rest imports, and every omission is listed so
 * the import dialog can show it. A pack from a newer schema imports what this
 * version understands.
 */
import ncfMap from '../../doctrine/ncf_map.json'

export const PACK_SCHEMA_VERSION = 1

/** Vigil's sector names. */
export const SECTORS = Object.keys(ncfMap.sector_map)

const SEVERITIES = ['critical', 'high', 'medium', 'low']

const stringList = (value) =>
  Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string' && v.trim())

const CONDITION_CHECKS = {
  vendors: { check: stringList, expect: 'a non-empty list of names' },
  actor_names: { check: stringList, expect: 'a non-empty list of names' },
  sectors: {
    check: (v) => stringList(v) && v.every((s) => SECTORS.includes(s)),
    expect: `a non-empty list of sectors from: ${SECTORS.join(', ')}`,
  },
  min_severity: { check: (v) => SEVERITIES.includes(v), expect: SEVERITIES.join(', ') },
  min_cvss: { check: (v) => typeof v === 'number' && v >= 0 && v <= 10, expect: 'a number 0-10' },
  kev_only: { check: (v) => typeof v === 'boolean', expect: 'true or false' },
  ransomware_only: { check: (v) => typeof v === 'boolean', expect: 'true or false' },
  claim_keys: { check: stringList, expect: 'a non-empty list of claim keys' },
}

/**
 * The condition keys evaluate_alert_rules() reads for each rule type
 * (migrations 159 and 201). Rule types the engine does not evaluate are not here.
 */
export const RULE_CONDITIONS = {
  vendor_cve: ['vendors', 'kev_only', 'min_severity', 'min_cvss', 'ransomware_only'],
  kev_added: ['vendors', 'kev_only', 'min_severity', 'min_cvss', 'ransomware_only'],
  actor_activity: ['actor_names'],
  sector_incident: ['sectors'],
  kev_epss_p1: ['vendors'],
  contested_claim: ['claim_keys'],
}

/** Conditions a rule cannot work without. */
const REQUIRED_CONDITIONS = {
  actor_activity: ['actor_names'],
  sector_incident: ['sectors'],
}

export const WATCH_ENTITY_TYPES = ['actor', 'vulnerability']

const CVE_ID = /^CVE-\d{4}-\d{4,}$/
const SEMVER = /^\d+\.\d+\.\d+$/
const TOP_LEVEL = [
  'schema_version',
  'pack_version',
  'id',
  'name',
  'description',
  'sectors',
  'rules',
  'watch',
]

const entityName = (entity) => (typeof entity === 'string' ? entity : entity?.name)

/** A sector_incident rule without sectors of its own takes the pack's. */
function withPackSectors(rule, packSectors) {
  if (rule.rule_type !== 'sector_incident' || rule.conditions?.sectors) return rule
  if (!packSectors?.length) return rule
  return { ...rule, conditions: { ...(rule.conditions || {}), sectors: packSectors } }
}

/**
 * Every problem with a pack, as strings; an empty list means it is valid.
 * Strict: anything planImport() would skip is an error here.
 */
export function validatePack(pack, ruleTypes = Object.keys(RULE_CONDITIONS)) {
  const errors = []
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return ['a pack is a JSON object']

  if (pack.schema_version !== PACK_SCHEMA_VERSION)
    errors.push(`schema_version must be ${PACK_SCHEMA_VERSION}`)
  if (typeof pack.pack_version !== 'string' || !SEMVER.test(pack.pack_version))
    errors.push('pack_version must be a version like 1.0.0')
  for (const key of ['id', 'name', 'description']) {
    if (typeof pack[key] !== 'string' || !pack[key].trim()) errors.push(`${key} is required`)
  }
  for (const key of Object.keys(pack)) {
    if (!TOP_LEVEL.includes(key)) errors.push(`unknown field "${key}"`)
  }
  if (pack.sectors !== undefined && !CONDITION_CHECKS.sectors.check(pack.sectors))
    errors.push(`sectors must be ${CONDITION_CHECKS.sectors.expect}`)

  const rules = pack.rules ?? []
  const watch = pack.watch ?? []
  if (!Array.isArray(rules)) errors.push('rules must be a list')
  if (!Array.isArray(watch)) errors.push('watch must be a list')
  if (Array.isArray(rules) && Array.isArray(watch) && rules.length + watch.length === 0)
    errors.push('a pack needs at least one rule or watchlist')

  ;(Array.isArray(rules) ? rules : []).forEach((raw, i) => {
    const where = `rules[${i}]`
    const rule = withPackSectors(raw || {}, pack.sectors)
    if (!ruleTypes.includes(rule.rule_type)) {
      errors.push(`${where}: rule_type "${rule.rule_type}" is not one the alert engine evaluates`)
      return
    }
    if (typeof rule.rule_name !== 'string' || !rule.rule_name.trim())
      errors.push(`${where}: rule_name is required`)
    const conditions = rule.conditions ?? {}
    if (typeof conditions !== 'object' || Array.isArray(conditions)) {
      errors.push(`${where}: conditions must be an object`)
      return
    }
    const allowed = RULE_CONDITIONS[rule.rule_type]
    for (const [key, value] of Object.entries(conditions)) {
      if (!allowed.includes(key)) {
        errors.push(`${where}: condition "${key}" is not read for ${rule.rule_type}`)
      } else if (!CONDITION_CHECKS[key].check(value)) {
        errors.push(`${where}: ${key} must be ${CONDITION_CHECKS[key].expect}`)
      }
    }
    for (const key of REQUIRED_CONDITIONS[rule.rule_type] || []) {
      if (conditions[key] === undefined) errors.push(`${where}: ${rule.rule_type} needs ${key}`)
    }
  })

  ;(Array.isArray(watch) ? watch : []).forEach((list, i) => {
    const where = `watch[${i}]`
    if (typeof list?.watchlist !== 'string' || !list.watchlist.trim())
      errors.push(`${where}: watchlist (its name) is required`)
    if (!WATCH_ENTITY_TYPES.includes(list?.entity_type)) {
      errors.push(`${where}: entity_type must be one of ${WATCH_ENTITY_TYPES.join(', ')}`)
      return
    }
    if (!Array.isArray(list.entities) || list.entities.length === 0) {
      errors.push(`${where}: entities must be a non-empty list`)
      return
    }
    list.entities.forEach((entity, j) => {
      const name = entityName(entity)
      if (typeof name !== 'string' || !name.trim()) {
        errors.push(`${where}.entities[${j}]: a name is required`)
      } else if (list.entity_type === 'vulnerability' && !CVE_ID.test(name)) {
        errors.push(`${where}.entities[${j}]: "${name}" is not a CVE id`)
      }
      if (
        typeof entity === 'object' &&
        entity.note !== undefined &&
        typeof entity.note !== 'string'
      )
        errors.push(`${where}.entities[${j}]: note must be text`)
    })
  })

  return errors
}

/**
 * What an import would create, and what it would leave out and why.
 * Never throws on a malformed pack: what cannot be read is skipped.
 */
export function planImport(pack, ruleTypes = Object.keys(RULE_CONDITIONS)) {
  const skipped = []
  const rules = []
  const watch = []
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return { name: null, rules, watch, skipped: [{ item: 'the file', reason: 'not a pack' }] }
  }
  if (typeof pack.schema_version === 'number' && pack.schema_version > PACK_SCHEMA_VERSION) {
    skipped.push({
      item: `schema_version ${pack.schema_version}`,
      reason: `this version of Vigil reads version ${PACK_SCHEMA_VERSION}; anything newer in the pack is left out`,
    })
  }

  const packSectors = Array.isArray(pack.sectors)
    ? pack.sectors.filter((s) => {
        if (SECTORS.includes(s)) return true
        skipped.push({ item: `sector "${s}"`, reason: 'not one of Vigil’s sectors' })
        return false
      })
    : []

  ;(Array.isArray(pack.rules) ? pack.rules : []).forEach((raw, i) => {
    const label = raw?.rule_name || `rule ${i + 1}`
    if (!raw || !ruleTypes.includes(raw.rule_type)) {
      skipped.push({
        item: `rule "${label}"`,
        reason: `rule type "${raw?.rule_type}" is not one Vigil evaluates`,
      })
      return
    }
    const rule = withPackSectors(raw, packSectors)
    const conditions = {}
    for (const [key, value] of Object.entries(rule.conditions || {})) {
      if (!RULE_CONDITIONS[rule.rule_type].includes(key)) {
        skipped.push({
          item: `condition "${key}" on rule "${label}"`,
          reason: `not read for ${rule.rule_type}`,
        })
      } else if (key === 'sectors' && stringList(value)) {
        const known = value.filter((s) => SECTORS.includes(s))
        for (const s of value.filter((s) => !SECTORS.includes(s))) {
          skipped.push({
            item: `sector "${s}" on rule "${label}"`,
            reason: 'not one of Vigil’s sectors',
          })
        }
        if (known.length) conditions.sectors = known
      } else if (!CONDITION_CHECKS[key].check(value)) {
        skipped.push({
          item: `condition "${key}" on rule "${label}"`,
          reason: `must be ${CONDITION_CHECKS[key].expect}`,
        })
      } else {
        conditions[key] = value
      }
    }
    const missing = (REQUIRED_CONDITIONS[rule.rule_type] || []).filter((k) => !conditions[k])
    if (missing.length) {
      skipped.push({
        item: `rule "${label}"`,
        reason: `${rule.rule_type} needs ${missing.join(', ')}`,
      })
      return
    }
    rules.push({
      ruleName: String(rule.rule_name || label).trim(),
      ruleType: rule.rule_type,
      conditions,
    })
  })

  ;(Array.isArray(pack.watch) ? pack.watch : []).forEach((list, i) => {
    const label = list?.watchlist || `watchlist ${i + 1}`
    if (!WATCH_ENTITY_TYPES.includes(list?.entity_type)) {
      skipped.push({
        item: `watchlist "${label}"`,
        reason: `entity type "${list?.entity_type}" cannot be imported`,
      })
      return
    }
    const entities = []
    for (const entity of Array.isArray(list.entities) ? list.entities : []) {
      const name = entityName(entity)
      if (typeof name !== 'string' || !name.trim()) {
        skipped.push({ item: `an entry in "${label}"`, reason: 'it has no name' })
      } else if (list.entity_type === 'vulnerability' && !CVE_ID.test(name.trim())) {
        skipped.push({ item: `"${name}" in "${label}"`, reason: 'not a CVE id' })
      } else {
        entities.push({
          name: name.trim(),
          note: typeof entity === 'object' ? entity.note || null : null,
        })
      }
    }
    if (entities.length === 0) {
      skipped.push({ item: `watchlist "${label}"`, reason: 'nothing in it could be read' })
      return
    }
    watch.push({ name: String(label).trim(), entityType: list.entity_type, entities })
  })

  return { name: pack.name || null, version: pack.pack_version || null, rules, watch, skipped }
}

/**
 * Carries out a plan. `api` holds the query functions (alertRules,
 * watchlists, threatActors from src/lib/supabase), so tests can pass fakes.
 * An actor name nothing matches, or a write that fails, is skipped and
 * listed, and the rest goes ahead.
 */
export async function importPack(plan, { userId, api, packLabel }) {
  const created = { rules: [], watchlists: [] }
  const skipped = [...plan.skipped]
  const source = packLabel ? ` (from the ${packLabel} pack)` : ''

  for (const rule of plan.rules) {
    const { data, error } = await api.alertRules.create({ ...rule, userId })
    if (error || !data) {
      skipped.push({ item: `rule "${rule.ruleName}"`, reason: error?.message || 'not saved' })
    } else {
      created.rules.push(data)
    }
  }

  for (const list of plan.watch) {
    const ids = []
    for (const entity of list.entities) {
      if (list.entityType === 'actor') {
        const { data } = await api.threatActors.getByIdOrName(entity.name)
        if (data?.id) ids.push({ id: data.id, note: entity.note })
        else
          skipped.push({ item: `actor "${entity.name}"`, reason: 'no group of that name in Vigil' })
      } else {
        ids.push({ id: entity.name, note: entity.note })
      }
    }
    if (ids.length === 0) {
      skipped.push({ item: `watchlist "${list.name}"`, reason: 'none of its entries matched' })
      continue
    }
    const { data: watchlist, error } = await api.watchlists.create({
      user_id: userId,
      name: list.name,
      description: `Imported${source}`,
      entity_type: list.entityType,
    })
    if (error || !watchlist) {
      skipped.push({ item: `watchlist "${list.name}"`, reason: error?.message || 'not saved' })
      continue
    }
    let added = 0
    for (const { id, note } of ids) {
      const result = await api.watchlists.addItem(watchlist.id, id, userId, note)
      if (result.error)
        skipped.push({ item: `"${id}" in "${list.name}"`, reason: result.error.message })
      else added += 1
    }
    created.watchlists.push({ ...watchlist, added })
  }

  return { created, skipped }
}
