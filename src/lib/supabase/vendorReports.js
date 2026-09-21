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
 */

import { supabase } from './client'

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
}

export default vendorReports
