/**
 * Country coverage, read from the database rather than written into a page.
 *
 * Every country field in Vigil is partial, and two are badly so. A number
 * typed into a component would be wrong within a week; country_coverage
 * (migration 128) is computed from the rows themselves.
 */

import { supabase } from './client'

export const countries = {
  /** One row per dataset and geography: how many carry a country, of how many. */
  async getCoverage() {
    return supabase
      .from('country_coverage')
      .select('dataset, geography, with_country, total, most_recent')
  },
}

export default countries
