/**
 * Organization Profile Module
 * For personalized threat relevance
 */

import { supabase } from './client'
import { userPreferences } from './userPreferences'

export const orgProfile = {
  async get(userId = 'anonymous') {
    const { data: prefs } = await userPreferences.get(userId)
    return prefs?.preferences?.org_profile || null
  },

  async update(userId = 'anonymous', profile) {
    const { data: current } = await userPreferences.get(userId)
    const preferences = {
      ...(current?.preferences || {}),
      org_profile: profile
    }
    return userPreferences.update(userId, preferences)
  },

  async hasProfile(userId = 'anonymous') {
    const profile = await this.get(userId)
    return profile && (profile.sector || profile.tech_stack?.length > 0)
  }
}

export default orgProfile
