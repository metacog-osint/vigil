/**
 * Terms & Privacy Acceptance Management
 *
 * Tracks terms versions and user acceptances.
 * When terms are updated, users must re-accept before continuing.
 */

import { supabase } from './supabase/client'

// Current terms version - UPDATE THIS when you modify Terms.jsx or Privacy.jsx
export const CURRENT_TERMS_VERSION = '1.0.0'
export const TERMS_UPDATED_DATE = '2026-01-19'
export const PRIVACY_UPDATED_DATE = '2026-01-19'

/**
 * Get the current terms version from the database
 */
export async function getCurrentTermsVersion() {
  const { data, error } = await supabase.rpc('get_current_terms_version')

  if (error) {
    console.error('Failed to get current terms version:', error)
    // Fallback to hardcoded version
    return {
      version: CURRENT_TERMS_VERSION,
      terms_updated_at: TERMS_UPDATED_DATE,
      privacy_updated_at: PRIVACY_UPDATED_DATE,
      summary: null,
    }
  }

  return (
    data?.[0] || {
      version: CURRENT_TERMS_VERSION,
      terms_updated_at: TERMS_UPDATED_DATE,
      privacy_updated_at: PRIVACY_UPDATED_DATE,
      summary: null,
    }
  )
}

/**
 * Check if the current user has accepted the latest terms
 */
export async function hasAcceptedCurrentTerms() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return true // Not logged in, no need to check

  const { data, error } = await supabase.rpc('has_accepted_current_terms', {
    check_user_id: user.id,
  })

  if (error) {
    console.error('Failed to check terms acceptance:', error)
    // If we can't check, try the direct query
    return checkAcceptanceDirectly(user.id)
  }

  return data === true
}

/**
 * Direct query fallback if RPC fails
 */
async function checkAcceptanceDirectly(userId) {
  // Get current version
  const { data: versions } = await supabase
    .from('terms_versions')
    .select('version')
    .eq('requires_reaccept', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!versions?.length) return true // No version requires reaccept

  const currentVersion = versions[0].version

  // Check if user has accepted
  const { data: acceptances } = await supabase
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('terms_version', currentVersion)
    .limit(1)

  return acceptances?.length > 0
}

/**
 * Record that the user has accepted the current terms
 */
export async function acceptTerms(version = CURRENT_TERMS_VERSION) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Must be logged in to accept terms')
  }

  // Try RPC first
  const { data, error } = await supabase.rpc('accept_terms', {
    p_version: version,
    p_user_agent: navigator.userAgent,
  })

  if (error) {
    console.error('RPC accept_terms failed, trying direct insert:', error)
    // Fallback to direct insert
    const { error: insertError } = await supabase.from('terms_acceptances').upsert(
      {
        user_id: user.id,
        terms_version: version,
        user_agent: navigator.userAgent,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,terms_version' }
    )

    if (insertError) throw insertError
    return true
  }

  return data
}

/**
 * Get user's acceptance history
 */
export async function getAcceptanceHistory() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('terms_acceptances')
    .select(
      `
      terms_version,
      accepted_at,
      terms_versions (
        terms_updated_at,
        privacy_updated_at,
        summary
      )
    `
    )
    .eq('user_id', user.id)
    .order('accepted_at', { ascending: false })

  if (error) {
    console.error('Failed to get acceptance history:', error)
    return []
  }

  return data || []
}

/**
 * For admins: Create a new terms version (requires service role)
 */
export async function createTermsVersion({
  version,
  termsUpdatedAt,
  privacyUpdatedAt,
  summary,
  requiresReaccept = true,
}) {
  const { data, error } = await supabase.from('terms_versions').insert({
    version,
    terms_updated_at: termsUpdatedAt,
    privacy_updated_at: privacyUpdatedAt,
    summary,
    requires_reaccept: requiresReaccept,
  })

  if (error) throw error
  return data
}
