// Comprehensive Sector Classification for Ransomware Victims
// Used by ingestion scripts to classify victims by industry sector

// Standard sector names (normalized)
export const SECTORS = {
  HEALTHCARE: 'healthcare',
  FINANCE: 'finance',
  TECHNOLOGY: 'technology',
  MANUFACTURING: 'manufacturing',
  RETAIL: 'retail',
  EDUCATION: 'education',
  ENERGY: 'energy',
  GOVERNMENT: 'government',
  LEGAL: 'legal',
  CONSTRUCTION: 'construction',
  TRANSPORTATION: 'transportation',
  REAL_ESTATE: 'real_estate',
  TELECOMMUNICATIONS: 'telecommunications',
  HOSPITALITY: 'hospitality',
  MEDIA: 'media',
  AGRICULTURE: 'agriculture',
  NONPROFIT: 'nonprofit',
  PROFESSIONAL_SERVICES: 'professional_services',
  DEFENSE: 'defense',
  PHARMACEUTICALS: 'pharmaceuticals',
  OTHER: 'Other',
  UNKNOWN: 'Unknown',
}

// Map API-provided sectors to our standard names
const SECTOR_ALIASES = {
  // Healthcare variations
  'healthcare': SECTORS.HEALTHCARE,
  'health care': SECTORS.HEALTHCARE,
  'health': SECTORS.HEALTHCARE,
  'medical': SECTORS.HEALTHCARE,
  'hospital': SECTORS.HEALTHCARE,
  'pharmaceutical': SECTORS.PHARMACEUTICALS,
  'pharma': SECTORS.PHARMACEUTICALS,
  'biotech': SECTORS.PHARMACEUTICALS,
  'biotechnology': SECTORS.PHARMACEUTICALS,
  'life sciences': SECTORS.PHARMACEUTICALS,

  // Finance variations
  'finance': SECTORS.FINANCE,
  'financial': SECTORS.FINANCE,
  'financial services': SECTORS.FINANCE,
  'banking': SECTORS.FINANCE,
  'bank': SECTORS.FINANCE,
  'insurance': SECTORS.FINANCE,
  'investment': SECTORS.FINANCE,
  'accounting': SECTORS.FINANCE,
  'fintech': SECTORS.FINANCE,

  // Technology variations
  'technology': SECTORS.TECHNOLOGY,
  'tech': SECTORS.TECHNOLOGY,
  'it': SECTORS.TECHNOLOGY,
  'it services': SECTORS.TECHNOLOGY,
  'information technology': SECTORS.TECHNOLOGY,
  'software': SECTORS.TECHNOLOGY,
  'saas': SECTORS.TECHNOLOGY,
  'cloud': SECTORS.TECHNOLOGY,
  'cybersecurity': SECTORS.TECHNOLOGY,
  'data': SECTORS.TECHNOLOGY,
  'internet': SECTORS.TECHNOLOGY,
  'electronics': SECTORS.TECHNOLOGY,

  // Manufacturing variations
  'manufacturing': SECTORS.MANUFACTURING,
  'industrial': SECTORS.MANUFACTURING,
  'automotive': SECTORS.MANUFACTURING,
  'machinery': SECTORS.MANUFACTURING,
  'chemicals': SECTORS.MANUFACTURING,
  'plastics': SECTORS.MANUFACTURING,
  'metals': SECTORS.MANUFACTURING,
  'aerospace': SECTORS.MANUFACTURING,
  'food processing': SECTORS.MANUFACTURING,
  'consumer goods': SECTORS.MANUFACTURING,
  'textiles': SECTORS.MANUFACTURING,

  // Retail variations
  'retail': SECTORS.RETAIL,
  'e-commerce': SECTORS.RETAIL,
  'ecommerce': SECTORS.RETAIL,
  'consumer': SECTORS.RETAIL,
  'wholesale': SECTORS.RETAIL,
  'distribution': SECTORS.RETAIL,
  'food & beverage': SECTORS.RETAIL,
  'food and beverage': SECTORS.RETAIL,
  'supermarket': SECTORS.RETAIL,
  'grocery': SECTORS.RETAIL,

  // Education variations
  'education': SECTORS.EDUCATION,
  'higher education': SECTORS.EDUCATION,
  'k-12': SECTORS.EDUCATION,
  'school': SECTORS.EDUCATION,
  'university': SECTORS.EDUCATION,
  'college': SECTORS.EDUCATION,
  'academic': SECTORS.EDUCATION,
  'research': SECTORS.EDUCATION,

  // Energy variations
  'energy': SECTORS.ENERGY,
  'oil & gas': SECTORS.ENERGY,
  'oil and gas': SECTORS.ENERGY,
  'utilities': SECTORS.ENERGY,
  'power': SECTORS.ENERGY,
  'electricity': SECTORS.ENERGY,
  'renewable': SECTORS.ENERGY,
  'mining': SECTORS.ENERGY,
  'natural resources': SECTORS.ENERGY,

  // Government variations
  'government': SECTORS.GOVERNMENT,
  'public sector': SECTORS.GOVERNMENT,
  'public administration': SECTORS.GOVERNMENT,
  'federal': SECTORS.GOVERNMENT,
  'state': SECTORS.GOVERNMENT,
  'municipal': SECTORS.GOVERNMENT,
  'local government': SECTORS.GOVERNMENT,
  'military': SECTORS.DEFENSE,
  'defense': SECTORS.DEFENSE,
  'defence': SECTORS.DEFENSE,

  // Legal variations
  'legal': SECTORS.LEGAL,
  'legal services': SECTORS.LEGAL,
  'law': SECTORS.LEGAL,
  'law firm': SECTORS.LEGAL,

  // Construction variations
  'construction': SECTORS.CONSTRUCTION,
  'building': SECTORS.CONSTRUCTION,
  'engineering': SECTORS.CONSTRUCTION,
  'architecture': SECTORS.CONSTRUCTION,
  'infrastructure': SECTORS.CONSTRUCTION,
  'real estate': SECTORS.REAL_ESTATE,
  'property': SECTORS.REAL_ESTATE,
  'housing': SECTORS.REAL_ESTATE,

  // Transportation variations
  'transportation': SECTORS.TRANSPORTATION,
  'transport': SECTORS.TRANSPORTATION,
  'logistics': SECTORS.TRANSPORTATION,
  'shipping': SECTORS.TRANSPORTATION,
  'freight': SECTORS.TRANSPORTATION,
  'aviation': SECTORS.TRANSPORTATION,
  'airline': SECTORS.TRANSPORTATION,
  'maritime': SECTORS.TRANSPORTATION,
  'trucking': SECTORS.TRANSPORTATION,
  'rail': SECTORS.TRANSPORTATION,

  // Telecommunications variations
  'telecommunications': SECTORS.TELECOMMUNICATIONS,
  'telecom': SECTORS.TELECOMMUNICATIONS,
  'communications': SECTORS.TELECOMMUNICATIONS,
  'media': SECTORS.MEDIA,
  'broadcasting': SECTORS.MEDIA,
  'publishing': SECTORS.MEDIA,
  'entertainment': SECTORS.MEDIA,
  'gaming': SECTORS.MEDIA,

  // Hospitality variations
  'hospitality': SECTORS.HOSPITALITY,
  'hotel': SECTORS.HOSPITALITY,
  'travel': SECTORS.HOSPITALITY,
  'tourism': SECTORS.HOSPITALITY,
  'leisure': SECTORS.HOSPITALITY,
  'restaurant': SECTORS.HOSPITALITY,
  'food service': SECTORS.HOSPITALITY,

  // Other sectors
  'agriculture': SECTORS.AGRICULTURE,
  'farming': SECTORS.AGRICULTURE,
  'nonprofit': SECTORS.NONPROFIT,
  'non-profit': SECTORS.NONPROFIT,
  'ngo': SECTORS.NONPROFIT,
  'charity': SECTORS.NONPROFIT,
  'religious': SECTORS.NONPROFIT,
  'consulting': SECTORS.PROFESSIONAL_SERVICES,
  'professional services': SECTORS.PROFESSIONAL_SERVICES,
  'staffing': SECTORS.PROFESSIONAL_SERVICES,
  'hr': SECTORS.PROFESSIONAL_SERVICES,
  'human resources': SECTORS.PROFESSIONAL_SERVICES,
  'marketing': SECTORS.PROFESSIONAL_SERVICES,
  'advertising': SECTORS.PROFESSIONAL_SERVICES,
}

// Keywords to detect sector from victim name or description
const SECTOR_KEYWORDS = {
  [SECTORS.HEALTHCARE]: [
    'hospital', 'health', 'medical', 'clinic', 'dental', 'care', 'surgery',
    'patient', 'doctor', 'physician', 'nursing', 'hospice', 'therapy',
    'diagnostic', 'laboratory', 'lab', 'imaging', 'radiology', 'oncology',
    'cardiology', 'orthopedic', 'pediatric', 'mental health', 'behavioral',
    'rehabilitation', 'rehab', 'wellness', 'healthcare', 'healthsystem',
    'medic', 'surgical', 'ambulance', 'emergency', 'urgent care',
    'klinik', 'krankenhaus', 'hopital', 'clinica', 'ospedale', // International
  ],
  [SECTORS.PHARMACEUTICALS]: [
    'pharma', 'pharmaceutical', 'biotech', 'drug', 'medication', 'rx',
    'therapeutics', 'bioscience', 'lifescience', 'vaccine', 'clinical trial',
  ],
  [SECTORS.FINANCE]: [
    'bank', 'financial', 'finance', 'insurance', 'credit', 'capital',
    'invest', 'loan', 'wealth', 'asset', 'mortgage', 'securities',
    'trading', 'brokerage', 'hedge', 'fund', 'equity', 'leasing',
    'accounting', 'audit', 'tax', 'cpa', 'payroll', 'fintech',
    'banque', 'banco', 'banca', 'versicherung', 'assurance', // International
  ],
  [SECTORS.TECHNOLOGY]: [
    'tech', 'software', 'it', 'cyber', 'data', 'cloud', 'digital',
    'computer', 'network', 'system', 'solution', 'platform', 'app',
    'saas', 'hosting', 'server', 'database', 'analytics', 'ai',
    'automation', 'integration', 'development', 'programming', 'code',
    'semiconductor', 'chip', 'electronics', 'hardware', 'device',
    'internet', 'web', 'online', 'ecommerce', 'startup', 'infotech',
    'infosec', 'security', 'encrypt', 'firewall', 'antivirus',
    'informatique', 'informatica', 'technologie', // International
  ],
  [SECTORS.MANUFACTURING]: [
    'manufacturing', 'industrial', 'factory', 'production', 'auto',
    'automotive', 'steel', 'metal', 'plastic', 'chemical', 'machinery',
    'equipment', 'component', 'assembly', 'fabricat', 'tool', 'die',
    'precision', 'cnc', 'aerospace', 'defense contractor', 'oem',
    'textile', 'apparel', 'furniture', 'packaging', 'paper', 'wood',
    'glass', 'ceramic', 'rubber', 'polymer', 'composite', 'alloy',
    'foundry', 'forge', 'mill', 'plant', 'works', 'industrie', // International
  ],
  [SECTORS.RETAIL]: [
    'retail', 'store', 'shop', 'commerce', 'market', 'consumer',
    'grocery', 'supermarket', 'mall', 'outlet', 'wholesale', 'distributor',
    'merchant', 'trade', 'supply', 'vendor', 'dealer', 'reseller',
    'boutique', 'fashion', 'clothing', 'apparel', 'shoes', 'jewelry',
    'electronics', 'appliance', 'furniture', 'home goods', 'sporting',
    'pet', 'toy', 'book', 'music', 'pharmacy', 'drugstore', 'convenience',
    'tienda', 'magasin', 'negozio', 'laden', 'butik', // International
  ],
  [SECTORS.EDUCATION]: [
    'school', 'university', 'college', 'education', 'academy', 'institute',
    'student', 'campus', 'learning', 'teaching', 'academic', 'faculty',
    'elementary', 'middle', 'high school', 'k-12', 'k12', 'kindergarten',
    'preschool', 'daycare', 'childcare', 'montessori', 'charter',
    'district', 'superintendent', 'principal', 'dean', 'professor',
    'graduate', 'undergraduate', 'phd', 'mba', 'vocational', 'technical',
    'community college', 'junior college', 'seminary', 'theological',
    'universidad', 'universite', 'universita', 'hochschule', 'ecole', 'escola', // International
    'schule', 'colegio', 'liceo', 'gymnasium', 'polytechnic',
  ],
  [SECTORS.ENERGY]: [
    'energy', 'oil', 'gas', 'petroleum', 'power', 'utility', 'electric',
    'solar', 'wind', 'nuclear', 'hydro', 'renewable', 'generation',
    'transmission', 'distribution', 'grid', 'fuel', 'refinery', 'pipeline',
    'drilling', 'exploration', 'mining', 'coal', 'natural gas', 'lng',
    'biomass', 'geothermal', 'turbine', 'generator', 'substation',
    'energie', 'energia', 'petroleo', 'elektrik', // International
  ],
  [SECTORS.GOVERNMENT]: [
    'gov', 'government', 'city', 'county', 'municipal', 'state', 'federal',
    'public', 'council', 'ministry', 'department', 'agency', 'bureau',
    'commission', 'authority', 'administration', 'civic', 'town', 'village',
    'borough', 'parish', 'district', 'region', 'province', 'territory',
    'senate', 'congress', 'parliament', 'legislature', 'judiciary', 'court',
    'police', 'fire', 'emergency', 'sheriff', 'marshal', 'corrections',
    'prison', 'jail', 'probation', 'parole', 'dmv', 'irs', 'fbi', 'cia',
    'ayuntamiento', 'mairie', 'comune', 'gemeente', 'kommune', // International
    'regierung', 'gobierno', 'gouvernement', 'amministrazione',
  ],
  [SECTORS.DEFENSE]: [
    'defense', 'defence', 'military', 'army', 'navy', 'air force',
    'marine', 'coast guard', 'national guard', 'veteran', 'armed forces',
    'pentagon', 'nato', 'contractor', 'weapon', 'munition', 'arsenal',
    'tactical', 'strategic', 'intelligence', 'surveillance', 'reconnaissance',
  ],
  [SECTORS.LEGAL]: [
    'law', 'legal', 'attorney', 'lawyer', 'solicitor', 'barrister',
    'court', 'judge', 'paralegal', 'litigation', 'advocate', 'counsel',
    'notary', 'patent', 'trademark', 'intellectual property', 'ip',
    'llp', 'esquire', 'esq', 'jd', 'juris', 'juridical',
    'abogado', 'avocat', 'avvocato', 'rechtsanwalt', 'advocaat', // International
  ],
  [SECTORS.CONSTRUCTION]: [
    'construction', 'building', 'contractor', 'architect', 'engineering',
    'civil', 'structural', 'mechanical', 'electrical', 'plumbing', 'hvac',
    'roofing', 'paving', 'concrete', 'masonry', 'carpentry', 'framing',
    'demolition', 'excavation', 'grading', 'surveying', 'development',
    'builder', 'homebuilder', 'general contractor', 'subcontractor',
    'renovation', 'remodel', 'restoration', 'maintenance', 'facility',
    'bau', 'construccion', 'edilizia', 'batiment', // International
  ],
  [SECTORS.REAL_ESTATE]: [
    'real estate', 'realty', 'property', 'properties', 'housing', 'mortgage',
    'apartment', 'condo', 'residential', 'commercial', 'industrial',
    'broker', 'agent', 'realtor', 'landlord', 'tenant', 'lease',
    'immobilien', 'inmobiliaria', 'immobilier', 'imobiliaria', // International
  ],
  [SECTORS.TRANSPORTATION]: [
    'transport', 'logistics', 'shipping', 'freight', 'cargo', 'carrier',
    'airline', 'aviation', 'airport', 'rail', 'railroad', 'railway',
    'trucking', 'truck', 'fleet', 'delivery', 'courier', 'express',
    'maritime', 'marine', 'port', 'harbor', 'vessel', 'ship', 'boat',
    'bus', 'transit', 'metro', 'subway', 'taxi', 'rideshare', 'uber', 'lyft',
    'warehouse', 'distribution', 'fulfillment', '3pl', 'supply chain',
    'transporte', 'logistik', 'spedition', 'trasporti', // International
  ],
  [SECTORS.TELECOMMUNICATIONS]: [
    'telecom', 'telecommunication', 'mobile', 'wireless', 'cellular',
    'broadband', 'internet service', 'isp', 'fiber', 'cable', 'satellite',
    'phone', 'voip', 'network operator', 'carrier', '5g', '4g', 'lte',
    'telefon', 'telekommunikation', 'telecomunicaciones', // International
  ],
  [SECTORS.MEDIA]: [
    'media', 'broadcast', 'television', 'tv', 'radio', 'news', 'press',
    'publish', 'magazine', 'newspaper', 'journal', 'print', 'digital media',
    'entertainment', 'film', 'movie', 'studio', 'production', 'streaming',
    'music', 'record', 'gaming', 'game', 'esports', 'advertising', 'marketing',
    'medien', 'medios', 'editore', 'verlag', // International
  ],
  [SECTORS.HOSPITALITY]: [
    'hotel', 'resort', 'motel', 'inn', 'lodge', 'hospitality', 'accommodation',
    'restaurant', 'cafe', 'bar', 'pub', 'dining', 'catering', 'food service',
    'travel', 'tourism', 'vacation', 'cruise', 'casino', 'entertainment',
    'event', 'conference', 'convention', 'banquet', 'wedding',
    'hoteles', 'ristorante', 'gastronomie', 'restaurante', // International
  ],
  [SECTORS.AGRICULTURE]: [
    'farm', 'agriculture', 'agricultural', 'crop', 'livestock', 'dairy',
    'poultry', 'cattle', 'grain', 'seed', 'fertilizer', 'pesticide',
    'irrigation', 'harvest', 'vineyard', 'winery', 'orchard', 'greenhouse',
    'aquaculture', 'fishery', 'forestry', 'timber', 'lumber',
    'agri', 'agro', 'landwirtschaft', 'agricultura', // International
  ],
  [SECTORS.NONPROFIT]: [
    'nonprofit', 'non-profit', 'ngo', 'charity', 'foundation', 'association',
    'society', 'federation', 'alliance', 'coalition', 'institute',
    'church', 'temple', 'mosque', 'synagogue', 'religious', 'faith',
    'humanitarian', 'relief', 'aid', 'volunteer', 'donation',
    'museum', 'library', 'archive', 'cultural', 'arts', 'theater', 'theatre',
    'zoo', 'aquarium', 'botanical', 'conservation', 'environmental',
  ],
  [SECTORS.PROFESSIONAL_SERVICES]: [
    'consulting', 'consultant', 'advisory', 'professional', 'services',
    'staffing', 'recruiting', 'headhunter', 'hr', 'human resources',
    'management', 'strategy', 'operations', 'transformation',
    'marketing', 'advertising', 'pr', 'public relations', 'communications',
    'design', 'creative', 'branding', 'agency',
    'beratung', 'consulenza', 'conseil', 'asesoria', // International
  ],
}

// TLD patterns for sector detection
const TLD_SECTORS = {
  '.edu': SECTORS.EDUCATION,
  '.edu.': SECTORS.EDUCATION,
  '.ac.': SECTORS.EDUCATION,
  '.sch.': SECTORS.EDUCATION,
  '.school': SECTORS.EDUCATION,
  '.university': SECTORS.EDUCATION,
  '.college': SECTORS.EDUCATION,
  '.gov': SECTORS.GOVERNMENT,
  '.gov.': SECTORS.GOVERNMENT,
  '.gob.': SECTORS.GOVERNMENT,
  '.gouv.': SECTORS.GOVERNMENT,
  '.govt.': SECTORS.GOVERNMENT,
  '.mil': SECTORS.DEFENSE,
  '.mil.': SECTORS.DEFENSE,
  '.org': null, // Could be nonprofit, but too generic
  '.health': SECTORS.HEALTHCARE,
  '.hospital': SECTORS.HEALTHCARE,
  '.clinic': SECTORS.HEALTHCARE,
  '.med': SECTORS.HEALTHCARE,
  '.law': SECTORS.LEGAL,
  '.legal': SECTORS.LEGAL,
  '.bank': SECTORS.FINANCE,
  '.insurance': SECTORS.FINANCE,
  '.church': SECTORS.NONPROFIT,
  '.charity': SECTORS.NONPROFIT,
  '.museum': SECTORS.NONPROFIT,
  '.coop': SECTORS.AGRICULTURE, // Often agricultural cooperatives
}

/**
 * Classify a victim's sector based on available information
 * @param {Object} options Classification options
 * @param {string} options.victimName - Name of the victim organization
 * @param {string} options.website - Website URL (optional)
 * @param {string} options.description - Description text (optional)
 * @param {string} options.apiSector - Sector provided by API (optional)
 * @param {string} options.activity - Activity/industry from API (optional)
 * @returns {string} Normalized sector name
 */
export function classifySector({
  victimName = '',
  website = '',
  description = '',
  apiSector = '',
  activity = '',
} = {}) {
  // 1. First, try to use API-provided sector if valid
  const normalizedApiSector = normalizeApiSector(apiSector || activity)
  if (normalizedApiSector && normalizedApiSector !== SECTORS.OTHER && normalizedApiSector !== SECTORS.UNKNOWN) {
    return normalizedApiSector
  }

  // 2. Try to detect from website TLD
  const tldSector = detectFromTLD(website)
  if (tldSector) {
    return tldSector
  }

  // 3. Try to detect from victim name
  const nameSector = detectFromKeywords(victimName)
  if (nameSector) {
    return nameSector
  }

  // 4. Try to detect from description
  if (description) {
    const descSector = detectFromKeywords(description)
    if (descSector) {
      return descSector
    }
  }

  // 5. Try to detect from website URL itself
  if (website) {
    const urlSector = detectFromKeywords(website)
    if (urlSector) {
      return urlSector
    }
  }

  // 6. Default to Other (at least we tried)
  return SECTORS.OTHER
}

/**
 * Normalize an API-provided sector string to our standard names
 */
function normalizeApiSector(sector) {
  if (!sector || typeof sector !== 'string') return null

  const lower = sector.toLowerCase().trim()

  // Direct match in aliases
  if (SECTOR_ALIASES[lower]) {
    return SECTOR_ALIASES[lower]
  }

  // Partial match in aliases
  for (const [alias, normalized] of Object.entries(SECTOR_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return normalized
    }
  }

  // Check if it's already a valid sector
  if (Object.values(SECTORS).includes(lower)) {
    return lower
  }

  return null
}

/**
 * Detect sector from website TLD
 */
function detectFromTLD(website) {
  if (!website) return null

  const lower = website.toLowerCase()

  for (const [tld, sector] of Object.entries(TLD_SECTORS)) {
    if (lower.includes(tld) && sector) {
      return sector
    }
  }

  return null
}

/**
 * Detect sector from text using keyword matching
 */
function detectFromKeywords(text) {
  if (!text) return null

  const lower = text.toLowerCase()

  // Check each sector's keywords
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    for (const keyword of keywords) {
      // Use word boundary matching for short keywords to avoid false positives
      if (keyword.length <= 3) {
        // For very short keywords, require word boundaries
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
        if (regex.test(lower)) {
          return sector
        }
      } else if (lower.includes(keyword)) {
        return sector
      }
    }
  }

  return null
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Batch reclassify incidents - useful for updating existing data
 * @param {Object} supabase - Supabase client
 * @param {number} batchSize - Number of records to process at once
 */
export async function reclassifyIncidents(supabase, batchSize = 100) {
  console.log('Starting incident reclassification...')

  let offset = 0
  let updated = 0
  let unchanged = 0
  let total = 0

  while (true) {
    // Fetch batch of incidents
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, victim_name, victim_sector, victim_website, raw_data')
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('Error fetching incidents:', error)
      break
    }

    if (!incidents || incidents.length === 0) {
      break
    }

    total += incidents.length

    for (const incident of incidents) {
      const newSector = classifySector({
        victimName: incident.victim_name,
        website: incident.victim_website || incident.raw_data?.website,
        description: incident.raw_data?.description,
        apiSector: incident.raw_data?.activity || incident.raw_data?.sector,
        activity: incident.raw_data?.activity,
      })

      // Only update if sector changed and new sector is more specific
      if (newSector !== incident.victim_sector &&
          newSector !== SECTORS.OTHER &&
          newSector !== SECTORS.UNKNOWN) {
        const { error: updateError } = await supabase
          .from('incidents')
          .update({ victim_sector: newSector })
          .eq('id', incident.id)

        if (!updateError) {
          updated++
        }
      } else {
        unchanged++
      }
    }

    console.log(`  Processed ${total} incidents (${updated} updated, ${unchanged} unchanged)`)
    offset += batchSize
  }

  console.log(`\nReclassification complete: ${updated} updated, ${unchanged} unchanged out of ${total} total`)
  return { updated, unchanged, total }
}

export default { classifySector, reclassifyIncidents, SECTORS }
