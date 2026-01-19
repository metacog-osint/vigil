/**
 * Audit Logging Module
 *
 * Provides comprehensive audit logging for sensitive operations.
 * Logs are stored in Supabase and can be queried for compliance/security review.
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for audit logging
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabaseAdmin = null

function getSupabaseAdmin() {
  if (!supabaseAdmin && supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
  }
  return supabaseAdmin
}

/**
 * Audit action types for consistent logging
 */
export const AuditActions = {
  // API Key operations
  API_KEY_CREATED: 'api_key.created',
  API_KEY_DELETED: 'api_key.deleted',
  API_KEY_ROTATED: 'api_key.rotated',
  API_KEY_USED: 'api_key.used',

  // Authentication
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILURE: 'auth.login_failure',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password_changed',
  MFA_ENABLED: 'auth.mfa_enabled',
  MFA_DISABLED: 'auth.mfa_disabled',

  // Webhook operations
  WEBHOOK_CREATED: 'webhook.created',
  WEBHOOK_UPDATED: 'webhook.updated',
  WEBHOOK_DELETED: 'webhook.deleted',
  WEBHOOK_TESTED: 'webhook.tested',

  // SCIM operations
  SCIM_USER_CREATED: 'scim.user_created',
  SCIM_USER_UPDATED: 'scim.user_updated',
  SCIM_USER_DELETED: 'scim.user_deleted',

  // Subscription operations
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',

  // Data access
  DATA_EXPORTED: 'data.exported',
  BULK_SEARCH: 'data.bulk_search',

  // Settings changes
  SETTINGS_UPDATED: 'settings.updated',
  ORG_PROFILE_UPDATED: 'org_profile.updated',

  // Security events
  RATE_LIMIT_EXCEEDED: 'security.rate_limit_exceeded',
  INVALID_TOKEN: 'security.invalid_token',
  PERMISSION_DENIED: 'security.permission_denied',
}

/**
 * Resource types for audit logging
 */
export const ResourceTypes = {
  API_KEY: 'api_key',
  USER: 'user',
  WEBHOOK: 'webhook',
  SUBSCRIPTION: 'subscription',
  WATCHLIST: 'watchlist',
  SAVED_SEARCH: 'saved_search',
  ALERT_RULE: 'alert_rule',
  REPORT: 'report',
  INTEGRATION: 'integration',
  SETTINGS: 'settings',
  ORG_PROFILE: 'org_profile',
}

/**
 * Extract client info from request
 */
function getClientInfo(request) {
  const headers = request?.headers || {}

  // Handle both Request object and plain headers object
  const getHeader = (name) => {
    if (typeof headers.get === 'function') {
      return headers.get(name)
    }
    return headers[name] || headers[name.toLowerCase()]
  }

  return {
    ipAddress: getHeader('x-forwarded-for')?.split(',')[0]?.trim() ||
               getHeader('x-real-ip') ||
               getHeader('cf-connecting-ip') ||
               'unknown',
    userAgent: getHeader('user-agent') || 'unknown',
  }
}

/**
 * Log an audit event
 *
 * @param {Object} params - Audit event parameters
 * @param {string} params.userId - User ID performing the action
 * @param {string} params.userEmail - User email (optional)
 * @param {string} params.action - Action type (use AuditActions constants)
 * @param {string} params.resourceType - Resource type (use ResourceTypes constants)
 * @param {string} params.resourceId - Specific resource ID (optional)
 * @param {Object} params.details - Additional details (optional)
 * @param {Request} params.request - HTTP request object (for IP/user agent)
 * @param {string} params.status - 'success', 'failure', or 'blocked'
 * @param {string} params.errorMessage - Error message if status is failure
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function logAuditEvent({
  userId,
  userEmail,
  action,
  resourceType,
  resourceId = null,
  details = {},
  request = null,
  status = 'success',
  errorMessage = null,
}) {
  try {
    const supabase = getSupabaseAdmin()

    if (!supabase) {
      console.warn('[Audit] Supabase not configured, skipping audit log')
      return { success: false, error: 'Supabase not configured' }
    }

    const clientInfo = getClientInfo(request)

    const { data, error } = await supabase
      .from('audit_log')
      .insert({
        user_id: userId,
        user_email: userEmail,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: clientInfo.ipAddress,
        user_agent: clientInfo.userAgent,
        status,
        error_message: errorMessage,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Audit] Failed to log event:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (err) {
    console.error('[Audit] Exception logging event:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Log a successful action
 */
export async function logSuccess(params) {
  return logAuditEvent({ ...params, status: 'success' })
}

/**
 * Log a failed action
 */
export async function logFailure(params, errorMessage) {
  return logAuditEvent({ ...params, status: 'failure', errorMessage })
}

/**
 * Log a blocked action (e.g., rate limited, permission denied)
 */
export async function logBlocked(params, reason) {
  return logAuditEvent({ ...params, status: 'blocked', errorMessage: reason })
}

/**
 * Middleware helper to add audit logging to request handlers
 *
 * @param {Function} handler - Request handler function
 * @param {Object} auditConfig - Audit configuration
 * @returns {Function} Wrapped handler with audit logging
 */
export function withAuditLog(handler, auditConfig) {
  return async (request, ...args) => {
    const startTime = Date.now()
    let response
    let error = null

    try {
      response = await handler(request, ...args)
      return response
    } catch (err) {
      error = err
      throw err
    } finally {
      // Log the audit event
      const status = error ? 'failure' :
                     (response?.status >= 400 ? 'failure' : 'success')

      await logAuditEvent({
        ...auditConfig,
        request,
        status,
        errorMessage: error?.message,
        details: {
          ...auditConfig.details,
          duration_ms: Date.now() - startTime,
          response_status: response?.status,
        },
      })
    }
  }
}

export default {
  logAuditEvent,
  logSuccess,
  logFailure,
  logBlocked,
  withAuditLog,
  AuditActions,
  ResourceTypes,
}
