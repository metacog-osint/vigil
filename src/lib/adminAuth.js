/**
 * Admin Authentication Utility
 * Provides system-level admin checks for platform administration
 */

// Get admin emails from environment variable (comma-separated)
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

/**
 * Check if a user is a system admin
 * @param {Object} user - User object from useAuth()
 * @returns {boolean}
 */
export function isSystemAdmin(user) {
  if (!user?.email) return false
  return ADMIN_EMAILS.includes(user.email.toLowerCase())
}

/**
 * Hook-friendly admin check
 * @param {Object} user - User object from useAuth()
 * @returns {{ isAdmin: boolean, adminEmails: string[] }}
 */
export function checkAdminStatus(user) {
  return {
    isAdmin: isSystemAdmin(user),
    // Only show admin emails in development
    adminEmails: import.meta.env.DEV ? ADMIN_EMAILS : [],
  }
}

/**
 * Admin routes that should be restricted
 */
export const ADMIN_ROUTES = [
  '/ops',
  '/admin',
]

/**
 * Check if a path requires admin access
 * @param {string} path - Route path
 * @returns {boolean}
 */
export function isAdminRoute(path) {
  return ADMIN_ROUTES.some(route => path.startsWith(route))
}

/**
 * Admin feature flags
 * Can be extended to check specific admin capabilities
 */
export const ADMIN_FEATURES = {
  viewOps: 'view_ops_dashboard',
  manageUsers: 'manage_users',
  viewAuditLogs: 'view_audit_logs',
  manageSubscriptions: 'manage_subscriptions',
  impersonateUsers: 'impersonate_users',
}

/**
 * Check if admin has a specific capability
 * For now, all admins have all capabilities
 * @param {Object} user - User object
 * @param {string} feature - Feature from ADMIN_FEATURES
 * @returns {boolean}
 */
export function hasAdminCapability(user, feature) {
  // For now, all system admins have all capabilities
  return isSystemAdmin(user)
}

export default {
  isSystemAdmin,
  checkAdminStatus,
  isAdminRoute,
  hasAdminCapability,
  ADMIN_ROUTES,
  ADMIN_FEATURES,
}
