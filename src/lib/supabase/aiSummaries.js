/**
 * AI Summaries Module
 * Historical record of AI-generated intelligence
 */

import { supabase } from './client'

export const aiSummaries = {
  async save(summary, context = {}) {
    const { type = 'dashboard_bluf', model, incidents30d, actors, sectors } = context

    return supabase.from('ai_summaries').insert({
      summary_type: type,
      content: summary,
      context_data: context.rawData || null,
      model_used: model,
      incidents_30d: incidents30d,
      actors_mentioned: actors || [],
      sectors_mentioned: sectors || [],
    })
  },

  async getRecent(limit = 30) {
    return supabase
      .from('ai_summaries')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit)
  },

  async getByDateRange(startDate, endDate) {
    return supabase
      .from('ai_summaries')
      .select('*')
      .gte('generated_at', startDate.toISOString())
      .lte('generated_at', endDate.toISOString())
      .order('generated_at', { ascending: false })
  },

  async getLatest() {
    return supabase
      .from('ai_summaries')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
  },
}

export default aiSummaries
