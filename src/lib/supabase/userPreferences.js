/**
 * User Preferences Module
 * Database queries for user preference management
 */

import { supabase } from './client'

export const userPreferences = {
  async get(userId = 'anonymous') {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // maybeSingle() returns null data (no error) when no row exists
    if (!data) {
      return {
        data: {
          user_id: userId,
          preferences: {
            defaultTimeRange: '30d',
            defaultSeverity: 'all',
            itemsPerPage: 25,
            darkMode: true,
            compactView: false,
            showNewIndicators: true,
            sidebarCollapsed: false,
            dashboardLayout: 'default',
          },
          last_visit: null,
        },
      }
    }

    return { data, error }
  },

  async update(userId = 'anonymous', preferences) {
    return supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferences,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
  },

  async updateLastVisit(userId = 'anonymous') {
    return supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        last_visit: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
  },
}

export default userPreferences
