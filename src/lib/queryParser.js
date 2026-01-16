// Advanced Query Language Parser
// Supports queries like:
//   type:ip country:RU first_seen:>2024-01-01
//   actor:lockbit AND sector:healthcare
//   cvss:>=9.0 AND kev:true

// ============================================================
// Query Syntax
// ============================================================
// field:value     - Exact match
// field:>value    - Greater than (for dates/numbers)
// field:<value    - Less than
// field:>=value   - Greater than or equal
// field:<=value   - Less than or equal
// field:*value*   - Contains (wildcards)
// AND / OR        - Boolean operators
// NOT field:value - Negation
// (...)           - Grouping

const OPERATORS = {
  ':': 'eq',
  ':>': 'gt',
  ':>=': 'gte',
  ':<': 'lt',
  ':<=': 'lte',
  ':!': 'neq',
}

// Field aliases for user-friendly queries
const FIELD_ALIASES = {
  // Common
  'type': 'type',
  'source': 'source',
  'tag': 'tags',
  'tags': 'tags',

  // IOCs
  'ip': 'value',
  'hash': 'value',
  'domain': 'value',
  'url': 'value',
  'confidence': 'confidence',
  'seen': 'last_seen',
  'first_seen': 'first_seen',
  'last_seen': 'last_seen',

  // Actors
  'actor': 'name',
  'name': 'name',
  'country': 'origin_country',
  'sector': 'target_sectors',
  'motivation': 'motivation',
  'trend': 'trend_status',

  // Vulnerabilities
  'cve': 'cve_id',
  'cvss': 'cvss_score',
  'severity': 'severity',
  'kev': 'kev_date',
  'exploited': 'exploited_in_wild',
  'vendor': 'affected_vendors',
  'product': 'affected_products',

  // Incidents
  'victim': 'victim_name',
  'date': 'discovered_date',
}

// Parse a query string into an AST
export function parseQuery(queryString) {
  if (!queryString || !queryString.trim()) {
    return null
  }

  const tokens = tokenize(queryString)
  return parseTokens(tokens)
}

function tokenize(query) {
  const tokens = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < query.length; i++) {
    const char = query[i]

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === ' ') {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

function parseTokens(tokens) {
  const conditions = []
  let currentBoolOp = 'AND'

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Boolean operators
    if (token.toUpperCase() === 'AND') {
      currentBoolOp = 'AND'
      continue
    }
    if (token.toUpperCase() === 'OR') {
      currentBoolOp = 'OR'
      continue
    }
    if (token.toUpperCase() === 'NOT') {
      // Next condition should be negated
      if (i + 1 < tokens.length) {
        const nextCondition = parseCondition(tokens[++i])
        if (nextCondition) {
          nextCondition.negate = true
          conditions.push({ ...nextCondition, booleanOp: currentBoolOp })
        }
      }
      continue
    }

    // Parse condition
    const condition = parseCondition(token)
    if (condition) {
      conditions.push({ ...condition, booleanOp: currentBoolOp })
    }
  }

  return conditions.length > 0 ? conditions : null
}

function parseCondition(token) {
  // Match field:operator:value patterns
  // NOTE: Longer operators must come first in alternation to match correctly
  const match = token.match(/^([a-zA-Z_]+)(:>=|:<=|:>|:<|:!|:)(.+)$/)

  if (!match) {
    // Free text search
    return {
      type: 'freetext',
      value: token,
    }
  }

  const [, field, op, value] = match
  const normalizedField = FIELD_ALIASES[field.toLowerCase()] || field

  return {
    type: 'condition',
    field: normalizedField,
    operator: OPERATORS[op],
    value: parseValue(value),
    originalField: field,
  }
}

function parseValue(value) {
  // Boolean
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false

  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value)
  }

  // Date (ISO format)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value).toISOString()
  }

  // Remove surrounding wildcards for contains queries
  if (value.startsWith('*') && value.endsWith('*')) {
    return { type: 'contains', value: value.slice(1, -1) }
  }
  if (value.startsWith('*')) {
    return { type: 'endsWith', value: value.slice(1) }
  }
  if (value.endsWith('*')) {
    return { type: 'startsWith', value: value.slice(0, -1) }
  }

  return value
}

// ============================================================
// Query Builder - Convert AST to Supabase query
// ============================================================

export function buildSupabaseQuery(supabaseQuery, conditions) {
  if (!conditions) return supabaseQuery

  for (const condition of conditions) {
    if (condition.type === 'freetext') {
      // Apply free text search to common fields
      supabaseQuery = supabaseQuery.or(
        `name.ilike.%${condition.value}%,value.ilike.%${condition.value}%,description.ilike.%${condition.value}%`
      )
      continue
    }

    const { field, operator, value, negate } = condition

    // Handle special value types
    if (typeof value === 'object' && value.type) {
      switch (value.type) {
        case 'contains':
          supabaseQuery = negate
            ? supabaseQuery.not(field, 'ilike', `%${value.value}%`)
            : supabaseQuery.ilike(field, `%${value.value}%`)
          break
        case 'startsWith':
          supabaseQuery = supabaseQuery.ilike(field, `${value.value}%`)
          break
        case 'endsWith':
          supabaseQuery = supabaseQuery.ilike(field, `%${value.value}`)
          break
      }
      continue
    }

    // Handle array fields (tags, sectors)
    if (field === 'tags' || field === 'target_sectors' || field.endsWith('_vendors') || field.endsWith('_products')) {
      supabaseQuery = supabaseQuery.contains(field, [value])
      continue
    }

    // Standard operators
    switch (operator) {
      case 'eq':
        if (typeof value === 'string') {
          supabaseQuery = negate
            ? supabaseQuery.not(field, 'ilike', value)
            : supabaseQuery.ilike(field, value)
        } else {
          supabaseQuery = negate
            ? supabaseQuery.not(field, 'eq', value)
            : supabaseQuery.eq(field, value)
        }
        break
      case 'gt':
        supabaseQuery = supabaseQuery.gt(field, value)
        break
      case 'gte':
        supabaseQuery = supabaseQuery.gte(field, value)
        break
      case 'lt':
        supabaseQuery = supabaseQuery.lt(field, value)
        break
      case 'lte':
        supabaseQuery = supabaseQuery.lte(field, value)
        break
      case 'neq':
        supabaseQuery = supabaseQuery.neq(field, value)
        break
    }
  }

  return supabaseQuery
}

// ============================================================
// Query Suggestions
// ============================================================

export function getQuerySuggestions(entityType, partialQuery) {
  const suggestions = []
  const lastToken = partialQuery.split(' ').pop()

  // Suggest fields
  if (!lastToken.includes(':')) {
    const relevantFields = getRelevantFields(entityType)
    for (const [alias, field] of Object.entries(relevantFields)) {
      if (alias.startsWith(lastToken.toLowerCase())) {
        suggestions.push({
          text: alias + ':',
          description: `Filter by ${alias}`,
        })
      }
    }
  }

  // Suggest values for known fields
  if (lastToken.includes(':') && !lastToken.split(':')[1]) {
    const field = lastToken.split(':')[0].toLowerCase()
    const valueSuggestions = getValueSuggestions(field, entityType)
    suggestions.push(...valueSuggestions)
  }

  return suggestions
}

function getRelevantFields(entityType) {
  const common = { type: 'type', source: 'source', tags: 'tags' }

  switch (entityType) {
    case 'iocs':
      return { ...common, confidence: 'confidence', first_seen: 'first_seen', last_seen: 'last_seen' }
    case 'actors':
      return { ...common, name: 'name', country: 'origin_country', sector: 'target_sectors', trend: 'trend_status' }
    case 'vulnerabilities':
      return { ...common, cve: 'cve_id', cvss: 'cvss_score', severity: 'severity', kev: 'kev_date' }
    case 'incidents':
      return { ...common, victim: 'victim_name', sector: 'victim_sector', date: 'discovered_date' }
    default:
      return common
  }
}

function getValueSuggestions(field) {
  const suggestions = {
    type: ['ip', 'domain', 'url', 'md5', 'sha256', 'sha1'],
    severity: ['critical', 'high', 'medium', 'low'],
    trend: ['ESCALATING', 'STABLE', 'DECLINING'],
    confidence: ['high', 'medium', 'low'],
    kev: ['true', 'false'],
    exploited: ['true', 'false'],
  }

  return (suggestions[field] || []).map(v => ({
    text: `${field}:${v}`,
    description: v,
  }))
}

// ============================================================
// Query Validation
// ============================================================

export function validateQuery(queryString) {
  try {
    const parsed = parseQuery(queryString)
    if (!parsed) {
      return { valid: true, message: 'Empty query matches all' }
    }

    // Check for unknown fields
    for (const condition of parsed) {
      if (condition.type === 'condition') {
        if (!Object.values(FIELD_ALIASES).includes(condition.field) &&
            !Object.keys(FIELD_ALIASES).includes(condition.originalField)) {
          return {
            valid: false,
            message: `Unknown field: ${condition.originalField}`,
          }
        }
      }
    }

    return { valid: true, parsed }
  } catch (error) {
    return { valid: false, message: error.message }
  }
}

export default {
  parseQuery,
  buildSupabaseQuery,
  getQuerySuggestions,
  validateQuery,
}
