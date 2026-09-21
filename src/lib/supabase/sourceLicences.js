/**
 * What each source permits, and what that costs the product.
 *
 * Two of Vigil's sources are NonCommercial. ransomware.live supplies every
 * group profile and 11,256 victim countries; ETDA supplies 186 actor origin
 * countries. Both are lawful to use today, because Vigil is not sold, and both
 * have to come out of anything that is.
 *
 * That used to live in a markdown table and in people's heads. It lives in
 * `source_licences` now (migration 136), which means the question "what would
 * we lose if we charged for this" has an answer a query can give.
 *
 * `actor_origins_commercial` is the switch itself: the same actors, with the
 * origin blanked wherever the source that supplied it may not be sold. Nothing
 * uses it yet, deliberately - hiding data that is lawfully usable today would
 * make the product worse now for a sale that has not happened.
 */

import { supabase } from './client'

export const sourceLicences = {
  /** Every registered source and its terms, most restrictive first. */
  async getAll() {
    return supabase
      .from('source_licences')
      .select('*')
      .order('commercial_use', { ascending: true })
      .order('source_id')
  },

  /**
   * The sources that would have to be removed from a paid tier.
   *
   * Includes sources whose licence has never been read: `checked_on` null
   * means nobody has looked, and an unchecked licence is not a permissive one.
   */
  async getNonCommercial() {
    return supabase
      .from('source_licences')
      .select('source_id, display_name, licence, licence_url, checked_on, notes')
      .eq('commercial_use', false)
      .order('source_id')
  },

  /**
   * How much attribution a paid tier would lose, counted rather than estimated.
   *
   * Returns `{ total, sellable, withheld }` for actor origin countries. On
   * 21 September that was 669 held, 483 sellable, 186 withheld - the 186 being
   * exactly what ETDA added.
   */
  async getCommercialImpact() {
    const { data, error } = await supabase
      .from('actor_origins_commercial')
      .select('origin_country, origin_withheld_for_licence')

    if (error) return { data: null, error }

    const rows = data || []
    const withheld = rows.filter((r) => r.origin_withheld_for_licence).length
    const sellable = rows.filter((r) => r.origin_country).length

    return {
      data: { total: sellable + withheld, sellable, withheld },
      error: null,
    }
  },
}

export default sourceLicences
