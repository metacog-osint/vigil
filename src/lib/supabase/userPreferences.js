/**
 * User Preferences Module
 * Database queries for user preference management
 *
 * SECURITY: Requires authenticated user ID for all operations.
 * Anonymous users get default preferences without database access.
 */

import { supabase } from './client'

// Default preferences for unauthenticated users or new users
const DEFAULT_PREFERENCES = {
  defaultTimeRange: '30d',
  defaultSeverity: 'all',
  itemsPerPage: 25,
  darkMode: true,
  compactView: false,
  showNewIndicators: true,
  sidebarCollapsed: false,
  dashboardLayout: 'default',
}

/**
 * Get default preferences object (for unauthenticated users)
 * @returns {Object}
 */
export function getDefaultPreferences() {
  return { ...DEFAULT_PREFERENCES }
}

export const userPreferences = {
  /**
   * Get user preferences
   * @param {string} userId - Required authenticated user ID
   * @returns {Promise<{data: Object, error: Error|null}>}
   */
  async get(userId) {
    // Return defaults for unauthenticated users without database access
    if (!userId) {
      return {
        data: {
          user_id: null,
          preferences: getDefaultPreferences(),
          last_visit: null,
          isDefault: true, // Flag indicating these are default preferences
        },
        error: null,
      }
    }

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
          preferences: getDefaultPreferences(),
          last_visit: null,
          isDefault: true, // Flag indicating these are default preferences
        },
        error: null,
      }
    }

    return { data: { ...data, isDefault: false }, error }
  },

  /**
   * Update user preferences
   * @param {string} userId - Required authenticated user ID
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async update(userId, preferences) {
    // Require authenticated user for preference updates
    if (!userId) {
      return {
        data: null,
        error: new Error('Authenticated user ID required to update preferences'),
      }
    }

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

  /**
   * Update last visit timestamp
   * @param {string} userId - Required authenticated user ID
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  async updateLastVisit(userId) {
    // Require authenticated user for last visit tracking
    if (!userId) {
      return { data: null, error: null } // Silently skip for unauthenticated users
    }

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
