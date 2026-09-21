/**
 * ETDA / ThaiCERT "Threat Group Cards" - where a threat actor is from.
 *
 * WHY
 *
 * 483 of Vigil's 4,504 threat actors have an origin country. Ten point seven
 * per cent, all of it from MISP Galaxy and MITRE ATT&CK, neither of which sets
 * out to be an attribution register. The map's Attackers layer draws a tenth
 * of the corpus and says nothing about the rest.
 *
 * ETDA publishes 503 actors with 1,788 names between them, and every name
 * records who gave it - CrowdStrike, Microsoft, MITRE, SecureWorks, Kaspersky.
 * Measured against Vigil before this was written: 188 nulls filled, 253
 * agreements, 1 disagreement.
 *
 * LICENCE - READ THIS BEFORE EXTENDING
 *
 * CC BY-NC-SA 4.0. NonCommercial, taken from the `license` field of the API
 * response itself rather than from a web page that might have moved on. It is
 * registered in source_licences with commercial_use = false, so every row this
 * writes is excluded from actor_origins_commercial automatically.
 *
 * This is the second NonCommercial source in the project, after
 * ransomware.live. It was accepted on the explicit condition that it can be
 * cut from paid access, which migration 136 is.
 *
 * WHAT IS NOT WRITTEN
 *
 * ETDA records 137 of its 503 actors as country "[Unknown]", and a further
 * handful as bracketed regions like "[Middle East]". Those are the source
 * declining to name a country, not a country called Unknown. They are dropped
 * here so the actor's origin stays null, because null already means exactly
 * that and converting someone's honest refusal into a value would be the one
 * thing this project refuses.
 *
 * No confidence is sent either. origin_confidence means "confidence as
 * published by the source" and ETDA publishes none.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const FEED = 'https://apt.etda.or.th/cgi-bin/getcard.cgi?g=all&o=json'
const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'
const SOURCE = 'etda'

/**
 * ETDA writes country names; Vigil stores ISO-3166 alpha-2.
 *
 * Deliberately a fixed table rather than a library: an unrecognised name is
 * dropped rather than guessed at, and a new one showing up should be a visible
 * decision rather than a silent best match. "Korea" alone is not here for that
 * reason - North and South are different answers.
 */
const ISO2: Record<string, string> = {
  China: 'CN',
  Russia: 'RU',
  Iran: 'IR',
  'North Korea': 'KP',
  'South Korea': 'KR',
  USA: 'US',
  'United States': 'US',
  Pakistan: 'PK',
  India: 'IN',
  Vietnam: 'VN',
  Turkey: 'TR',
  Lebanon: 'LB',
  Israel: 'IL',
  Ukraine: 'UA',
  Syria: 'SY',
  Belarus: 'BY',
  Nigeria: 'NG',
  Brazil: 'BR',
  Singapore: 'SG',
  Taiwan: 'TW',
  Japan: 'JP',
  Germany: 'DE',
  France: 'FR',
  'United Kingdom': 'GB',
  Spain: 'ES',
  Italy: 'IT',
  Netherlands: 'NL',
  Romania: 'RO',
  Poland: 'PL',
  Egypt: 'EG',
  'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE',
  Morocco: 'MA',
  Indonesia: 'ID',
  Malaysia: 'MY',
  Thailand: 'TH',
  Bangladesh: 'BD',
  Colombia: 'CO',
  Mexico: 'MX',
  Kazakhstan: 'KZ',
  Uzbekistan: 'UZ',
  Georgia: 'GE',
  Armenia: 'AM',
  Azerbaijan: 'AZ',
  Serbia: 'RS',
  Sudan: 'SD',
  Ethiopia: 'ET',
  Afghanistan: 'AF',
  Palestine: 'PS',
  'Palestinian Territories': 'PS',
  // Added 21 September after the first run reported them as unmapped. ETDA
  // uses the short forms, and dropping them silently is precisely what
  // `unmapped_countries` exists to prevent.
  UK: 'GB',
  UAE: 'AE',
  Canada: 'CA',
  Tunisia: 'TN',
  Libya: 'LY',
  Yemen: 'YE',
}

export interface OriginRow {
  etda_actor: string
  country: string
  url: string | null
  names: string[]
}

/**
 * A country ETDA actually named, as ISO-2, or null.
 *
 * Bracketed values - "[Unknown]", "[Middle East]", "[Africa]" - are ETDA
 * saying it does not know or that the answer is a region rather than a state.
 * Both are refusals to name a country and both return null.
 */
export function toIso2(country: string | undefined | null): string | null {
  if (!country) return null
  const name = country.trim()
  if (!name || name.startsWith('[')) return null
  return ISO2[name] ?? null
}

export function parseCards(payload: unknown): {
  rows: OriginRow[]
  licence: string | null
  unmapped: string[]
} {
  const doc = payload as Record<string, unknown>
  const licence = typeof doc?.license === 'string' ? doc.license : null
  const values = Array.isArray(doc?.values) ? (doc.values as Record<string, unknown>[]) : []

  const rows: OriginRow[] = []
  const unmapped = new Set<string>()

  for (const v of values) {
    const countries = Array.isArray(v.country) ? (v.country as string[]) : []

    // An actor ETDA gives two countries is an actor ETDA is not sure about.
    // Sending both would let the database pick one by sort order.
    const mapped = countries.map(toIso2).filter((c): c is string => c !== null)
    const distinct = [...new Set(mapped)]

    for (const c of countries) {
      if (c && !c.startsWith('[') && !ISO2[c.trim()]) unmapped.add(c.trim())
    }

    if (distinct.length !== 1) continue

    const names = (Array.isArray(v.names) ? (v.names as Record<string, unknown>[]) : [])
      .map((n) => (typeof n.name === 'string' ? n.name : null))
      .filter((n): n is string => !!n && n.trim() !== '')

    const actor = typeof v.actor === 'string' ? v.actor : null
    if (!actor || names.length === 0) continue

    const info = Array.isArray(v.information) ? (v.information as string[]) : []

    rows.push({
      etda_actor: actor,
      country: distinct[0],
      url: info[0] ?? null,
      // The actor's own name counts as a name to match on.
      names: [...new Set([actor, ...names])],
    })
  }

  return { rows, licence, unmapped: [...unmapped] }
}

Deno.serve(async () => {
  const started = Date.now()

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return json({ success: false, source: SOURCE, error: 'missing SUPABASE_URL or key' }, 500)
  }

  const supabase = createClient(url, key)

  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': UA } })
    if (!res.ok) throw new Error(`${FEED} returned HTTP ${res.status}`)

    const { rows, licence, unmapped } = parseCards(await res.json())

    if (rows.length === 0) {
      throw new Error('no actors with a named country parsed, which this feed never returns')
    }

    // The licence is checked against the response every run, not trusted from
    // a note written months ago. If ETDA relicenses, this is where it shows.
    if (licence && !/NonCommercial|NC/i.test(licence)) {
      await supabase.rpc('record_finding', {
        p_check: 'source_licence_changed',
        p_subject: SOURCE,
        p_severity: 'warning',
        p_status: 'open',
        p_details: {
          source: SOURCE,
          licence_now: licence,
          licence_registered: 'CC BY-NC-SA 4.0',
          question:
            'The licence in the feed no longer reads as NonCommercial. If that ' +
            'is right, source_licences.commercial_use can be set true and this ' +
            'data stops being excluded from paid access.',
        },
      })
    }

    const { data, error } = await supabase.rpc('apply_actor_origins', {
      p_rows: rows,
      p_source: SOURCE,
    })
    if (error) throw new Error(`apply_actor_origins failed: ${error.message}`)

    return json({
      success: true,
      source: SOURCE,
      parsed: rows.length,
      licence,
      // Surfaced rather than swallowed: a country name nobody has mapped is a
      // country Vigil is silently dropping.
      unmapped_countries: unmapped,
      ...(data ?? {}),
      ms: Date.now() - started,
    })
  } catch (error) {
    return json({
      success: false,
      source: SOURCE,
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
