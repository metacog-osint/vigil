/**
 * Tenant Context
 * Provides tenant and branding state throughout the app
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { tenants, tenantBranding, tenantMembers, DEFAULT_BRANDING } from '../lib/tenants'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const { user } = useAuth()
  const [currentTenant, setCurrentTenant] = useState(null)
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [userTenants, setUserTenants] = useState([])
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Detect tenant from URL
  const detectTenant = useCallback(async () => {
    const hostname = window.location.hostname

    // Skip for localhost/development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null
    }

    // Check if it's a custom domain
    if (!hostname.includes('vigil') && !hostname.includes('theintelligence.company')) {
      try {
        const tenant = await tenants.getByIdentifier(hostname)
        return tenant
      } catch {
        return null
      }
    }

    // Check for subdomain (e.g., acme.vigil.theintelligence.company)
    const subdomain = hostname.split('.')[0]
    if (subdomain && subdomain !== 'vigil' && subdomain !== 'www') {
      try {
        const tenant = await tenants.getByIdentifier(subdomain)
        return tenant
      } catch {
        return null
      }
    }

    return null
  }, [])

  // Load user's tenants
  const loadUserTenants = useCallback(async () => {
    if (!user?.uid) {
      setUserTenants([])
      return
    }

    try {
      const tenantList = await tenants.getUserTenants(user.uid)
      setUserTenants(tenantList)
    } catch (err) {
      console.error('Failed to load user tenants:', err)
    }
  }, [user?.uid])

  // Load tenant branding
  const loadBranding = useCallback(async (tenantId) => {
    if (!tenantId) {
      setBranding(DEFAULT_BRANDING)
      return
    }

    try {
      const brandingData = await tenantBranding.getWithDefaults(tenantId)
      setBranding(brandingData)

      // Apply branding to document
      tenantBranding.applyToDocument(brandingData)
    } catch (err) {
      console.error('Failed to load branding:', err)
      setBranding(DEFAULT_BRANDING)
    }
  }, [])

  // Load membership for current tenant
  const loadMembership = useCallback(async (tenantId, userId) => {
    if (!tenantId || !userId) {
      setMembership(null)
      return
    }

    try {
      const member = await tenantMembers.getByUserId(tenantId, userId)
      setMembership(member)
    } catch (err) {
      console.error('Failed to load membership:', err)
      setMembership(null)
    }
  }, [])

  // Initialize tenant context
  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)

      try {
        // Detect tenant from URL
        const detectedTenant = await detectTenant()

        if (detectedTenant) {
          setCurrentTenant(detectedTenant)
          await loadBranding(detectedTenant.id)
        } else {
          setBranding(DEFAULT_BRANDING)
        }

        // Load user's tenants if logged in
        if (user?.uid) {
          await loadUserTenants()

          // Load membership if we have a current tenant
          if (detectedTenant) {
            await loadMembership(detectedTenant.id, user.uid)
          }
        }
      } catch (err) {
        console.error('Failed to initialize tenant context:', err)
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [user?.uid, detectTenant, loadBranding, loadUserTenants, loadMembership])

  // Switch to a different tenant
  const switchTenant = useCallback(async (tenantId) => {
    setLoading(true)
    try {
      const tenant = await tenants.getById(tenantId)
      if (tenant) {
        setCurrentTenant(tenant)
        await loadBranding(tenant.id)
        await loadMembership(tenant.id, user?.uid)
      }
    } catch (err) {
      console.error('Failed to switch tenant:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [user?.uid, loadBranding, loadMembership])

  // Clear tenant (go back to default)
  const clearTenant = useCallback(() => {
    setCurrentTenant(null)
    setMembership(null)
    setBranding(DEFAULT_BRANDING)
  }, [])

  // Check permissions
  const hasPermission = useCallback((permission) => {
    if (!membership) return false
    if (membership.role === 'owner') return true

    const rolePermissions = membership.permissions || []
    return rolePermissions.includes('*') || rolePermissions.includes(permission)
  }, [membership])

  // Check if user is admin
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin'

  const value = {
    // State
    currentTenant,
    branding,
    userTenants,
    membership,
    loading,
    error,

    // Computed
    isAdmin,
    hasTenant: !!currentTenant,
    tenantName: currentTenant?.name || branding.companyName || 'Vigil',
    tenantLogo: branding.logoUrl || branding.logo_url,

    // Actions
    switchTenant,
    clearTenant,
    hasPermission,
    refreshTenants: loadUserTenants,
    refreshBranding: () => loadBranding(currentTenant?.id),
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}

// HOC for tenant-aware components
export function withTenant(Component) {
  return function TenantAwareComponent(props) {
    const tenant = useTenant()
    return <Component {...props} tenant={tenant} />
  }
}

export default TenantContext
