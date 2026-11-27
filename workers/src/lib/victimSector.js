/**
 * A victim's sector, guessed from the words of the name a leak site posted. It is a guess from the
 * name alone: most names carry no sector word and get none.
 *
 * Until migration 201 the RansomLook feed matched each keyword anywhere in the name, so a keyword
 * inside another word set the sector: "Soils" and "Gastroenterologists" were filed as energy ("oil",
 * "gas"), "Magasin" as energy, "Biotechnology" as technology, "eMarketer" as retail, "Aimbridge
 * Hospitality" as healthcare. Over the 60 days to 23 Nov 2026 about a quarter of the tags in five
 * sectors rested on such a match.
 *
 * A keyword now counts only as a whole word: not preceded or followed by a letter or digit in any
 * script, so "Großbank" is not a bank either. A word also matches its plural ("hospitals",
 * "counties"), and the extra forms below are words the old rule caught on purpose through a shorter
 * keyword ("technology" through "tech"); each contains its sector's own keyword.
 *
 * The one exception is INSIDE_WORDS: keywords that do not occur inside unrelated words, so they may
 * still be found within a longer one. Leak sites often post a domain or a run-together name
 * ("shannonhealth.com", "UCHealth", "risingpharma.com", "Clinica Suiza", "SoftwareOne"), and whole
 * words alone dropped those correct tags. Each sector's words are tried in order and the first sector
 * with a match wins, as before.
 */

/** Recorded with each tag this rule replaces (victim_sector_history, migration 201). */
export const SECTOR_RULE = 'name-whole-word-1'
/** The rule before 201, for tags it wrote. */
export const SUBSTRING_RULE = 'name-substring'

/** The keywords the feed used before 201, in its order. Unchanged: only how they match is. */
export const SECTOR_KEYWORDS = {
  healthcare: ['hospital', 'medical', 'health', 'clinic', 'pharma', 'healthcare'],
  finance: ['bank', 'financial', 'insurance', 'credit', 'investment'],
  education: ['university', 'college', 'school', 'academy', 'education'],
  government: ['city of', 'county', 'government', 'municipal', 'federal'],
  manufacturing: ['manufacturing', 'industrial', 'factory', 'automotive'],
  technology: ['tech', 'software', 'digital', 'cyber', 'cloud'],
  retail: ['retail', 'store', 'shop', 'market', 'commerce'],
  energy: ['energy', 'oil', 'gas', 'utility', 'power'],
}

/** Whole words the old rule caught through a shorter keyword, kept as their own words. */
export const EXTRA_FORMS = {
  finance: ['banking'],
  technology: ['technology', 'cybersecurity'],
  retail: ['supermarket', 'ecommerce', 'shopping'],
}

/**
 * Keywords found anywhere in the name, as before 201, because no unrelated word contains them.
 * Not here, with the word that showed why: hospital ("Hospitality"), credit ("Accredited"), gas
 * ("Gastro", "Magasin", "Vegas"), oil ("Soils"), tech ("Biotech", "Polytechnic"), bank
 * ("Bankruptcy"), shop ("Workshop"), market ("eMarketer"), power ("Powersonic"), school
 * ("Schooley"), store ("Restore").
 */
export const INSIDE_WORDS = new Set([
  'health',
  'healthcare',
  'pharma',
  'medical',
  'clinic',
  'financial',
  'insurance',
  'investment',
  'university',
  'college',
  'academy',
  'education',
  'government',
  'municipal',
  'manufacturing',
  'industrial',
  'automotive',
  'software',
  'retail',
  'energy',
])

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "county" -> county|counties, "bank" -> banks?, "city of" -> city\s+of. */
function wordPattern(word) {
  const parts = word.split(/\s+/).map(escape)
  const last = parts.pop()
  const plural = /[^aeiou]y$/.test(last) ? `${last.slice(0, -1)}(?:y|ies)` : `${last}(?:e?s)?`
  return [...parts, plural].join('\\s+')
}

const NOT_WORD = '[\\p{L}\\p{N}]'
const RULES = Object.entries(SECTOR_KEYWORDS).map(([sector, keywords]) => {
  const words = [...keywords, ...(EXTRA_FORMS[sector] || [])]
  const whole = words.filter((w) => !INSIDE_WORDS.has(w)).map(wordPattern)
  const inside = words.filter((w) => INSIDE_WORDS.has(w)).map(escape)
  const alternatives = [`(?<!${NOT_WORD})(?:${whole.join('|')})(?!${NOT_WORD})`]
  if (inside.length) alternatives.push(`(?:${inside.join('|')})`)
  return [sector, new RegExp(alternatives.join('|'), 'iu')]
})

/** The sector the name's words name, or null. */
export function inferSector(victimName) {
  if (!victimName) return null
  const name = String(victimName)
  for (const [sector, rule] of RULES) {
    if (rule.test(name)) return sector
  }
  return null
}

/**
 * The rule before 201: a keyword anywhere in the lowercased name. Kept only to recognise the tags it
 * wrote, so a re-tag changes those and no tag that came from anywhere else.
 */
export function inferSectorBySubstring(victimName) {
  if (!victimName) return null
  const name = String(victimName).toLowerCase()
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => name.includes(kw))) return sector
  }
  return null
}
