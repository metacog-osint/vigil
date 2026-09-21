/**
 * Reading who a government blamed, out of the words it used.
 *
 * This file is deliberately free of Deno imports. It is loaded by the
 * cisa-advisories and ncsc-advisories Edge Functions at runtime, and by
 * vitest under Node at test time, because this is the logic in the whole
 * feature most worth testing and it used to live where nothing could reach it.
 *
 * It had already been wrong once. The first CISA parser read advisory
 * summaries as well as titles, and produced:
 *
 *   "Pro-Russia Hacktivists Conduct Opportunistic Attacks"  ->  RU, state
 *   "Defending Against China-Nexus Covert Networks"         ->  CN, state
 *
 * Both false. A pro-Russia hacktivist collective is not the Russian state, and
 * a "China-nexus" network is not one either. The governments that publish
 * these advisories choose between those formulations carefully, and the title
 * is where the care is, so the title is all that is read.
 *
 * `_shared` is not deployed as a function - Supabase skips directories whose
 * name begins with an underscore - but is importable by the functions beside
 * it.
 */

export type Strength = 'state' | 'affiliated' | 'nexus' | 'aligned' | 'criminal'

export interface AttributionRule {
  re: RegExp
  country: string | null
  strength: Strength
}

export interface AttributionResult {
  country: string | null
  phrase: string | null
  strength: Strength | null
  /** A country was named but its relationship to the actors was not stated. */
  unresolved: string | null
}

/**
 * CISA's phrasings.
 *
 * Order is load-bearing. "Pro-Russia" contains "Russia"; if a looser pattern
 * were reached first it would read a hacktivist collective as a state
 * apparatus, which is the exact error this table was rewritten to prevent.
 */
export const CISA_ATTRIBUTION: AttributionRule[] = [
  {
    re: /\b(russian|russia)[- ]state[- ](sponsored|supported|affiliated)\b/i,
    country: 'RU',
    strength: 'state',
  },
  {
    re: /\b(chinese|china)[- ]state[- ](sponsored|supported|affiliated)\b/i,
    country: 'CN',
    strength: 'state',
  },
  {
    re: /\b(iranian|iran)[- ]state[- ](sponsored|supported|affiliated)\b/i,
    country: 'IR',
    strength: 'state',
  },
  {
    re: /\b(north korean|dprk)[- ]state[- ](sponsored|supported|affiliated)\b/i,
    country: 'KP',
    strength: 'state',
  },

  // Explicitly not the state. Tested before the affiliation patterns.
  { re: /\bpro[- ]russia[n]?\b/i, country: 'RU', strength: 'aligned' },
  { re: /\bpro[- ]iran(ian)?\b/i, country: 'IR', strength: 'aligned' },
  { re: /\bpro[- ](china|chinese)\b/i, country: 'CN', strength: 'aligned' },

  { re: /\biranian[- ]affiliated\b/i, country: 'IR', strength: 'affiliated' },
  { re: /\brussian[- ]affiliated\b/i, country: 'RU', strength: 'affiliated' },
  { re: /\bchinese[- ]affiliated\b/i, country: 'CN', strength: 'affiliated' },
  { re: /\b(north korean|dprk)[- ]affiliated\b/i, country: 'KP', strength: 'affiliated' },

  { re: /\bchina[- ]nexus\b/i, country: 'CN', strength: 'nexus' },
  { re: /\brussia[- ]nexus\b/i, country: 'RU', strength: 'nexus' },
  { re: /\biran[- ]nexus\b/i, country: 'IR', strength: 'nexus' },

  { re: /\biranian cyber actors\b/i, country: 'IR', strength: 'affiliated' },
  { re: /\brussian cyber actors\b/i, country: 'RU', strength: 'affiliated' },
  { re: /\bchinese cyber actors\b/i, country: 'CN', strength: 'affiliated' },
  { re: /\b(north korean|dprk) cyber actors\b/i, country: 'KP', strength: 'affiliated' },

  // Criminal, and CISA names no state. Country stays null on purpose.
  { re: /#StopRansomware/i, country: null, strength: 'criminal' },
]

/**
 * NCSC-UK's phrasings, which overlap CISA's without matching them.
 *
 * NCSC does not write "Iranian-Affiliated". It writes "Iranian state actors"
 * and "Russian intelligence targeting", neither of which CISA's table matches.
 */
export const NCSC_ATTRIBUTION: AttributionRule[] = [
  { re: /\bpro[- ]russia[n]?\b/i, country: 'RU', strength: 'aligned' },
  { re: /\bpro[- ]iran(ian)?\b/i, country: 'IR', strength: 'aligned' },
  { re: /\bpro[- ](china|chinese)\b/i, country: 'CN', strength: 'aligned' },

  {
    re: /\b(russian|russia)[- ]state[- ](sponsored|supported|affiliated|linked|actors?)\b/i,
    country: 'RU',
    strength: 'state',
  },
  {
    re: /\b(iranian|iran)[- ]state[- ](sponsored|supported|affiliated|linked|actors?)\b/i,
    country: 'IR',
    strength: 'state',
  },
  {
    re: /\b(chinese|china)[- ]state[- ](sponsored|supported|affiliated|linked|actors?)\b/i,
    country: 'CN',
    strength: 'state',
  },
  {
    re: /\b(north korean|dprk)[- ]state[- ](sponsored|supported|affiliated|linked|actors?)\b/i,
    country: 'KP',
    strength: 'state',
  },

  // An intelligence service is an organ of the state, and NCSC means SVR, GRU
  // or FSB when it writes this. The phrase is stored verbatim regardless, so a
  // reader sees NCSC's words and not this mapping.
  { re: /\brussian intelligence\b/i, country: 'RU', strength: 'state' },
  { re: /\biranian intelligence\b/i, country: 'IR', strength: 'state' },
  { re: /\bchinese intelligence\b/i, country: 'CN', strength: 'state' },
  { re: /\b(north korean|dprk) intelligence\b/i, country: 'KP', strength: 'state' },

  { re: /\biranian[- ]affiliated\b/i, country: 'IR', strength: 'affiliated' },
  { re: /\brussian[- ]affiliated\b/i, country: 'RU', strength: 'affiliated' },
  { re: /\bchinese[- ]affiliated\b/i, country: 'CN', strength: 'affiliated' },

  { re: /\bchina[- ]nexus\b/i, country: 'CN', strength: 'nexus' },
  { re: /\brussia[- ]nexus\b/i, country: 'RU', strength: 'nexus' },
  { re: /\biran[- ]nexus\b/i, country: 'IR', strength: 'nexus' },
]

/**
 * A nationality named with no statement of what it is responsible for.
 * Matching one of these and none of the rules above is what gets queued for a
 * person rather than resolved by this file.
 */
export const BARE_NATIONALITY: Array<{ re: RegExp; country: string }> = [
  { re: /\b(iranian|iran)\b/i, country: 'IR' },
  { re: /\b(russian|russia)\b/i, country: 'RU' },
  { re: /\b(chinese|china)\b/i, country: 'CN' },
  { re: /\b(north korean|north korea|dprk)\b/i, country: 'KP' },
]

/**
 * Read attribution out of a title.
 *
 * `queueBareNationality` decides what happens to a title that names a country
 * without saying what it did. CISA never does this - it always states the
 * relationship - so its caller leaves the flag off and an unmatched title is
 * simply unattributed. NCSC does ("Iranian cyber targeting of dissidents"),
 * so its caller turns it on and the question reaches the review queue.
 */
export function attributeFrom(
  title: string,
  rules: AttributionRule[],
  queueBareNationality = false
): AttributionResult {
  for (const rule of rules) {
    const m = title.match(rule.re)
    if (m) {
      return { country: rule.country, phrase: m[0], strength: rule.strength, unresolved: null }
    }
  }

  if (queueBareNationality) {
    for (const b of BARE_NATIONALITY) {
      if (b.re.test(title)) {
        return { country: null, phrase: null, strength: null, unresolved: b.country }
      }
    }
  }

  return { country: null, phrase: null, strength: null, unresolved: null }
}

/** CISA titles. */
export function attributeCisa(title: string): AttributionResult {
  return attributeFrom(title, CISA_ATTRIBUTION, false)
}

/** NCSC-UK titles, which queue a bare nationality rather than guessing. */
export function attributeNcsc(title: string): AttributionResult {
  return attributeFrom(title, NCSC_ATTRIBUTION, true)
}
