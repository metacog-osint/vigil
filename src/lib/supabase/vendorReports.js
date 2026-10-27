/**
 * Threat research published by vendors, and the questions it raises.
 *
 * Read the attribution columns carefully before using them. They are **never**
 * written by ingestion, and null is the normal state: vendor attribution lives
 * in prose three paragraphs into an article, and across 279 titles from eight
 * vendor feeds not one carried an attribution a parser could read.
 *
 * So a report with `attributed_country` null does not mean the vendor named
 * nobody. It means nobody at Vigil has read the article and ruled on it. Those
 * are different answers and a caller that renders them the same is repeating
 * the mistake this table exists to avoid.
 *
 * The useful join is the other one. Vendor titles name the *actor* reliably -
 * "Mustang Panda targets India's government and energy sectors" - and Vigil
 * already knows Mustang Panda is CN. Event from the vendor, country from the
 * actor record, with each half sourced to something that actually claimed it.
 * That is what `getWithActors` returns.
 *
 * A proposed link is a name match until a person rules on it. The module's two
 * writes are a person's rulings, each through a SECURITY DEFINER function
 * that takes the reviewer from the JWT and keeps every ruling:
 * `ruleLink` (rule_vendor_actor_link, migration 156) and `ruleAttribution`
 * (rule_vendor_attribution, 157). Nothing here parses, infers or guesses an
 * attribution; the only way one reaches a report is a person quoting it.
 */

import { supabase } from './client'

/** The eight feeds the vendor-research Edge Function reads, as they are named. */
export const VENDOR_SOURCES = {
  eset: 'ESET',
  greynoise: 'GreyNoise',
  talos: 'Cisco Talos',
  'microsoft-security': 'Microsoft Security',
  unit42: 'Unit 42',
  checkpoint: 'Check Point Research',
  acronis: 'Acronis TRU',
  securelist: 'Securelist',
}

/** The same three answers record_verdict gives a finding. */
export const LINK_VERDICTS = {
  confirmed: 'Confirmed: the report is about this actor',
  rejected: 'Rejected: the name matched, the actor is wrong',
  deferred: 'Deferred: not enough to say yet',
}

/** What a reading of a report's attribution can conclude (migration 157). */
export const ATTRIBUTION_VERDICTS = {
  attributes: 'It attributes the activity',
  names_no_country: 'Read it: it names no country',
  deferred: 'Deferred: not enough to say yet',
}

/**
 * The six strengths, strongest first, as a reviewer has to choose between
 * them. The examples are the wordings 131 and 139 recorded; the vendor's own
 * words go in the phrase, so a reader can check the choice.
 */
export const STRENGTH_MEANINGS = {
  state: 'State: state-sponsored or state-directed, in the vendor’s words',
  affiliated: 'Affiliated: tied to a state, short of directed by it',
  nexus: 'Nexus: a link to a country, such as “China-nexus”',
  aligned: 'Aligned: sympathetic to a country and explicitly not state, such as “pro-Russia”',
  criminal: 'Criminal: a criminal group the vendor places in a country',
  linguistic:
    'Linguistic: language or time zone only, such as “a suspected Chinese speaker”. Not a country claim',
}

const COUNT = { count: 'exact', head: true }

const REPORT_COLUMNS = `id, source, title, url, published, summary,
  attributed_country, attribution_strength, attribution_phrase, attribution_decided_at,
  vendor_report_actors{join} (
    actor_id, matched_name, confirmed, decided_at,
    threat_actors ( id, name, origin_country, origin_source, actor_type )
  )`

export const vendorReports = {
  /** Recent research, newest first. */
  async getAll({ source = null, limit = 100 } = {}) {
    let query = supabase
      .from('vendor_reports')
      .select('*')
      .order('published', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (source) query = query.eq('source', source)

    return query
  },

  /**
   * Reports with the actors proposed for them, and those actors' countries.
   *
   * `confirmed` is null on every link until a person rules on it. A caller
   * showing these as established links would be presenting a name match as a
   * finding - one of them proposed an Iranian group's campaign as the work of
   * two Chinese actors before the matcher was tightened.
   */
  async getWithActors({ limit = 100 } = {}) {
    return supabase
      .from('vendor_reports')
      .select(
        `id, source, title, url, published, summary,
         attributed_country, attribution_strength, attribution_phrase,
         vendor_report_actors (
           matched_name, confirmed,
           threat_actors ( id, name, origin_country, origin_source, actor_type )
         )`
      )
      .order('published', { ascending: false, nullsFirst: false })
      .limit(limit)
  },

  /**
   * How much of the corpus a person has actually ruled on.
   *
   * Returns `{ total, ruled, unruled, linked }`. `unruled` is the honest
   * headline: reports Vigil holds but has said nothing about.
   */
  async getReviewProgress() {
    const { data, error } = await supabase
      .from('vendor_reports')
      .select('id, attribution_strength, attribution_decided_at')

    if (error) return { data: null, error }

    const rows = data || []
    const ruled = rows.filter((r) => r.attribution_decided_at).length

    return {
      data: { total: rows.length, ruled, unruled: rows.length - ruled },
      error: null,
    }
  },

  /**
   * Counts for the page header. Every one is a database count, never the
   * length of a returned array, and a count that failed is null rather than 0.
   */
  async getOverview() {
    const count = async (table, apply) => {
      const query = supabase.from(table).select('*', COUNT)
      const { count: n, error } = await (apply ? apply(query) : query)
      return error ? null : n
    }

    const [reports, attributionRuled, links, confirmed, rejected, questionsOpen, ...bySource] =
      await Promise.all([
        count('vendor_reports'),
        count('vendor_reports', (q) => q.not('attribution_decided_at', 'is', null)),
        count('vendor_report_actors'),
        count('vendor_report_actors', (q) => q.eq('confirmed', true)),
        count('vendor_report_actors', (q) => q.eq('confirmed', false)),
        count('data_quality_findings', (q) =>
          q.eq('check_name', 'vendor_attribution_candidate').eq('status', 'open')
        ),
        ...Object.keys(VENDOR_SOURCES).map((source) =>
          count('vendor_reports', (q) => q.eq('source', source))
        ),
      ])

    return {
      data: {
        reports,
        attributionRuled,
        links,
        linksConfirmed: confirmed,
        linksRejected: rejected,
        linksUnruled:
          links === null || confirmed === null || rejected === null
            ? null
            : links - confirmed - rejected,
        questionsOpen,
        bySource: Object.fromEntries(Object.keys(VENDOR_SOURCES).map((s, i) => [s, bySource[i]])),
      },
      error: null,
    }
  },

  /**
   * A page of reports, newest first, with their proposed actor links.
   *
   * `linkedOnly` keeps reports with at least one proposed link, through an
   * inner join on vendor_report_actors. `total` is the database's count for
   * the same filters, so "showing 25 of N" is never a tally of rows returned.
   */
  async getReports({ source = '', search = '', linkedOnly = false, page = 0, pageSize = 25 } = {}) {
    const columns = REPORT_COLUMNS.replace('{join}', linkedOnly ? '!inner' : '')
    let query = supabase
      .from('vendor_reports')
      .select(columns, { count: 'exact' })
      .order('published', { ascending: false, nullsFirst: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (source) query = query.eq('source', source)
    const term = String(search ?? '').trim()
    if (term) query = query.ilike('title', `%${term}%`)

    const { data, count, error } = await query
    if (error) return { data: null, error }
    return { data: { reports: data ?? [], total: count ?? null }, error: null }
  },

  /**
   * The open attribution question for each report, keyed by its url, which is
   * the finding's subject (migration 139). Answered in the review queue.
   */
  async getOpenQuestions(urls) {
    if (!urls?.length) return { data: {}, error: null }
    const { data, error } = await supabase
      .from('data_quality_findings')
      .select('id, subject, details')
      .eq('check_name', 'vendor_attribution_candidate')
      .eq('status', 'open')
      .in('subject', urls)

    if (error) return { data: null, error }
    return {
      data: Object.fromEntries(
        (data ?? []).map((f) => [f.subject, { id: f.id, phrase: f.details?.phrase ?? null }])
      ),
      error: null,
    }
  },

  /**
   * The most recent ruling on each link of these reports, keyed
   * `${report_id}:${actor_id}`. Deferrals are rulings too: they say a person
   * looked and could not yet decide, which is different from nobody looking.
   */
  async getLatestRulings(reportIds) {
    if (!reportIds?.length) return { data: {}, error: null }
    const { data, error } = await supabase
      .from('vendor_link_decisions')
      .select('report_id, actor_id, verdict, rationale, decided_at')
      .in('report_id', reportIds)
      .order('decided_at', { ascending: false })

    if (error) return { data: null, error }
    const latest = {}
    for (const d of data ?? []) {
      const key = `${d.report_id}:${d.actor_id}`
      if (!latest[key]) latest[key] = d
    }
    return { data: latest, error: null }
  },

  /** Rule on a proposed link. The reviewer is taken from the JWT, not sent. */
  async ruleLink({ reportId, actorId, verdict, rationale }) {
    return supabase.rpc('rule_vendor_actor_link', {
      p_report_id: reportId,
      p_actor_id: actorId,
      p_verdict: verdict,
      p_rationale: rationale,
    })
  },

  /**
   * Record and apply a reading of what a report attributes. Only an
   * `attributes` ruling carries a country, strength and phrase; the others
   * send nulls, which the function requires. It also answers the report's
   * open review-queue question. The reviewer is taken from the JWT.
   */
  async ruleAttribution({ reportId, verdict, country, strength, phrase, rationale }) {
    const attributes = verdict === 'attributes'
    return supabase.rpc('rule_vendor_attribution', {
      p_report_id: reportId,
      p_verdict: verdict,
      p_country: attributes && country ? String(country).trim().toUpperCase() : null,
      p_strength: attributes ? strength : null,
      p_phrase: attributes ? phrase : null,
      p_rationale: rationale,
    })
  },

  /**
   * The most recent attribution ruling per report. Needed for a deferral,
   * which changes nothing on the report but is still a person having looked.
   */
  async getLatestAttributionRulings(reportIds) {
    if (!reportIds?.length) return { data: {}, error: null }
    const { data, error } = await supabase
      .from('vendor_attribution_decisions')
      .select('report_id, verdict, rationale, decided_at')
      .in('report_id', reportIds)
      .order('decided_at', { ascending: false })

    if (error) return { data: null, error }
    const latest = {}
    for (const d of data ?? []) if (!latest[d.report_id]) latest[d.report_id] = d
    return { data: latest, error: null }
  },
}

export default vendorReports
