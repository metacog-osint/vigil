/**
 * Focus Filters Module
 *
 * Builds filter predicates from organization profile for Focus Mode.
 */

/**
 * Build Supabase filter conditions from org profile
 * @param {Object} profile - Organization profile
 * @returns {Object} Filter conditions for different entity types
 */
export function buildFocusFilters(profile) {
  if (!profile) return null

  const filters = {
    actors: [],
    incidents: [],
    vulnerabilities: [],
    iocs: [],
  }

  // Sector filter
  if (profile.sector) {
    filters.actors.push({
      field: 'target_sectors',
      operator: 'contains',
      value: [profile.sector],
    })
    filters.incidents.push({
      field: 'sector',
      operator: 'eq',
      value: profile.sector,
    })
  }

  // Region/Country filter
  if (profile.country) {
    filters.actors.push({
      field: 'target_countries',
      operator: 'contains',
      value: [profile.country],
    })
    filters.incidents.push({
      field: 'country',
      operator: 'eq',
      value: profile.country,
    })
  } else if (profile.region) {
    // Map region to countries
    const regionCountries = getRegionCountries(profile.region)
    if (regionCountries.length > 0) {
      filters.actors.push({
        field: 'target_countries',
        operator: 'overlaps',
        value: regionCountries,
      })
      filters.incidents.push({
        field: 'country',
        operator: 'in',
        value: regionCountries,
      })
    }
  }

  // Tech stack filter for vulnerabilities
  if (profile.tech_vendors?.length > 0) {
    filters.vulnerabilities.push({
      field: 'affected_vendors',
      operator: 'overlaps',
      value: profile.tech_vendors,
    })
  }

  if (profile.tech_stack?.length > 0) {
    filters.vulnerabilities.push({
      field: 'affected_products',
      operator: 'overlaps',
      value: profile.tech_stack,
    })
  }

  return filters
}

/**
 * Apply focus filters to a Supabase query
 * @param {Object} query - Supabase query builder
 * @param {Array} filters - Array of filter conditions
 * @returns {Object} Modified query
 */
export function applyFiltersToQuery(query, filters) {
  if (!filters || filters.length === 0) return query

  let q = query
  for (const filter of filters) {
    switch (filter.operator) {
      case 'eq':
        q = q.eq(filter.field, filter.value)
        break
      case 'in':
        q = q.in(filter.field, filter.value)
        break
      case 'contains':
        q = q.contains(filter.field, filter.value)
        break
      case 'overlaps':
        q = q.overlaps(filter.field, filter.value)
        break
      case 'ilike':
        q = q.ilike(filter.field, filter.value)
        break
      default:
        console.warn(`Unknown filter operator: ${filter.operator}`)
    }
  }
  return q
}

/**
 * Check if an item matches focus filters (client-side)
 * @param {Object} item - Item to check
 * @param {Object} profile - Organization profile
 * @param {string} entityType - Type of entity
 * @returns {boolean} True if item matches filters
 */
export function matchesFocusFilters(item, profile, entityType) {
  if (!profile || !item) return true

  switch (entityType) {
    case 'actor':
      return matchesActorFilters(item, profile)
    case 'incident':
      return matchesIncidentFilters(item, profile)
    case 'vulnerability':
      return matchesVulnerabilityFilters(item, profile)
    default:
      return true
  }
}

function matchesActorFilters(actor, profile) {
  // Check sector match
  if (profile.sector && actor.target_sectors) {
    const sectorMatch = actor.target_sectors.some(
      (s) => s.toLowerCase() === profile.sector.toLowerCase()
    )
    if (sectorMatch) return true
  }

  // Check country/region match
  if (profile.country && actor.target_countries) {
    const countryMatch = actor.target_countries.some(
      (c) => c.toLowerCase() === profile.country.toLowerCase()
    )
    if (countryMatch) return true
  }

  if (profile.region && actor.target_countries) {
    const regionCountries = getRegionCountries(profile.region)
    const regionMatch = actor.target_countries.some((c) => regionCountries.includes(c))
    if (regionMatch) return true
  }

  return false
}

function matchesIncidentFilters(incident, profile) {
  // Check sector match
  if (profile.sector && incident.sector) {
    if (incident.sector.toLowerCase() === profile.sector.toLowerCase()) {
      return true
    }
  }

  // Check country match
  if (profile.country && incident.country) {
    if (incident.country.toLowerCase() === profile.country.toLowerCase()) {
      return true
    }
  }

  return false
}

function matchesVulnerabilityFilters(vuln, profile) {
  // Check vendor match
  if (profile.tech_vendors?.length > 0 && vuln.affected_vendors) {
    const vendorMatch = vuln.affected_vendors.some((v) =>
      profile.tech_vendors.some((pv) => v.toLowerCase().includes(pv.toLowerCase()))
    )
    if (vendorMatch) return true
  }

  // Check product match
  if (profile.tech_stack?.length > 0 && vuln.affected_products) {
    const productMatch = vuln.affected_products.some((p) =>
      profile.tech_stack.some((pp) => p.toLowerCase().includes(pp.toLowerCase()))
    )
    if (productMatch) return true
  }

  return false
}

/**
 * Get countries in a region
 */
function getRegionCountries(region) {
  const regionMap = {
    north_america: ['United States', 'Canada', 'Mexico'],
    europe: [
      'United Kingdom',
      'Germany',
      'France',
      'Italy',
      'Spain',
      'Netherlands',
      'Belgium',
      'Switzerland',
      'Austria',
      'Poland',
      'Sweden',
      'Norway',
      'Denmark',
      'Finland',
      'Ireland',
    ],
    asia_pacific: [
      'Japan',
      'South Korea',
      'Australia',
      'New Zealand',
      'Singapore',
      'India',
      'China',
      'Taiwan',
      'Hong Kong',
      'Thailand',
      'Malaysia',
      'Indonesia',
      'Philippines',
      'Vietnam',
    ],
    latin_america: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Mexico'],
    middle_east: [
      'United Arab Emirates',
      'Saudi Arabia',
      'Israel',
      'Qatar',
      'Kuwait',
      'Bahrain',
      'Oman',
    ],
    africa: ['South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco'],
  }
  return regionMap[region] || []
}

/**
 * Get human-readable filter description
 */
export function getFilterDescription(profile) {
  if (!profile) return null

  const parts = []
  if (profile.sector) parts.push(profile.sector)
  if (profile.country) parts.push(profile.country)
  else if (profile.region) parts.push(formatRegion(profile.region))
  if (profile.tech_vendors?.length > 0) {
    parts.push(profile.tech_vendors.slice(0, 2).join(', '))
  }

  return parts.join(' | ')
}

function formatRegion(region) {
  const regionNames = {
    north_america: 'North America',
    europe: 'Europe',
    asia_pacific: 'Asia Pacific',
    latin_america: 'Latin America',
    middle_east: 'Middle East',
    africa: 'Africa',
  }
  return regionNames[region] || region
}

export default {
  buildFocusFilters,
  applyFiltersToQuery,
  matchesFocusFilters,
  getFilterDescription,
}
