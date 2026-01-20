/**
 * Multi-Tenancy / White-Label Module
 *
 * Manages tenant configuration, branding, custom domains, and member access.
 * Supports enterprise white-label deployments with custom branding.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

export const TENANT_PLANS = {
  STANDARD: 'standard',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
  WHITE_LABEL: 'white_label',
}

export const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
  TRIAL: 'trial',
}

export const MEMBER_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
}

export const MEMBER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
}

export const DOMAIN_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
  EXPIRED: 'expired',
}

// ============================================
// TENANT MANAGEMENT
// ============================================

export const tenants = {
  /**
   * Get current user's tenant
   */
  async getCurrent() {
    const { data: membership, error: memberError } = await supabase
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('status', 'active')
      .single()

    if (memberError || !membership) {
      return { data: null, error: memberError }
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', membership.tenant_id)
      .single()

    return { data: data ? { ...data, userRole: membership.role } : null, error }
  },

  /**
   * Get tenant by ID
   */
  async getById(id) {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single()

    return { data, error }
  },

  /**
   * Get tenant by slug
   */
  async getBySlug(slug) {
    const { data, error } = await supabase.from('tenants').select('*').eq('slug', slug).single()

    return { data, error }
  },

  /**
   * Create a new tenant
   */
  async create(tenantData) {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        name: tenantData.name,
        slug: tenantData.slug,
        owner_email: tenantData.ownerEmail,
        billing_email: tenantData.billingEmail,
        support_email: tenantData.supportEmail,
        plan: tenantData.plan || TENANT_PLANS.STANDARD,
        status: TENANT_STATUS.TRIAL,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        max_users: tenantData.maxUsers || 10,
        max_teams: tenantData.maxTeams || 3,
        max_api_calls_daily: tenantData.maxApiCalls || 10000,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update tenant details
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Check if a slug is available
   */
  async isSlugAvailable(slug) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    return { available: !data && !error, error }
  },

  /**
   * Get tenant usage stats
   */
  async getUsage(tenantId) {
    const [members, teams, apiCalls] = await Promise.all([
      supabase
        .from('tenant_members')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.rpc('get_tenant_api_usage', { p_tenant_id: tenantId }),
    ])

    return {
      data: {
        members: members.count || 0,
        teams: teams.count || 0,
        apiCalls: apiCalls.data || 0,
      },
      error: null,
    }
  },
}

// ============================================
// BRANDING
// ============================================

export const branding = {
  /**
   * Get tenant branding
   */
  async get(tenantId) {
    const { data, error } = await supabase.rpc('get_tenant_branding', {
      p_tenant_id: tenantId,
    })

    return { data, error }
  },

  /**
   * Update branding settings
   */
  async update(tenantId, brandingData) {
    // Check if branding exists
    const { data: existing } = await supabase
      .from('tenant_branding')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('tenant_branding')
        .update({
          company_name: brandingData.companyName,
          logo_url: brandingData.logoUrl,
          logo_light_url: brandingData.logoLightUrl,
          favicon_url: brandingData.faviconUrl,
          primary_color: brandingData.primaryColor,
          secondary_color: brandingData.secondaryColor,
          accent_color: brandingData.accentColor,
          background_color: brandingData.backgroundColor,
          text_color: brandingData.textColor,
          font_family: brandingData.fontFamily,
          heading_font: brandingData.headingFont,
          email_logo_url: brandingData.emailLogoUrl,
          email_header_color: brandingData.emailHeaderColor,
          email_footer_text: brandingData.emailFooterText,
          report_logo_url: brandingData.reportLogoUrl,
          report_header_text: brandingData.reportHeaderText,
          report_footer_text: brandingData.reportFooterText,
          hide_powered_by: brandingData.hidePoweredBy,
          custom_css: brandingData.customCss,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .select()
        .single()

      return { data, error }
    } else {
      const { data, error } = await supabase
        .from('tenant_branding')
        .insert({
          tenant_id: tenantId,
          company_name: brandingData.companyName,
          logo_url: brandingData.logoUrl,
          logo_light_url: brandingData.logoLightUrl,
          favicon_url: brandingData.faviconUrl,
          primary_color: brandingData.primaryColor,
          secondary_color: brandingData.secondaryColor,
          accent_color: brandingData.accentColor,
          background_color: brandingData.backgroundColor,
          text_color: brandingData.textColor,
          font_family: brandingData.fontFamily,
          heading_font: brandingData.headingFont,
          email_logo_url: brandingData.emailLogoUrl,
          email_header_color: brandingData.emailHeaderColor,
          email_footer_text: brandingData.emailFooterText,
          report_logo_url: brandingData.reportLogoUrl,
          report_header_text: brandingData.reportHeaderText,
          report_footer_text: brandingData.reportFooterText,
          hide_powered_by: brandingData.hidePoweredBy,
          custom_css: brandingData.customCss,
        })
        .select()
        .single()

      return { data, error }
    }
  },

  /**
   * Generate CSS variables from branding
   */
  generateCssVariables(brandingData) {
    if (!brandingData) return ''

    const colors = brandingData.colors || {}
    const fonts = brandingData.fonts || {}

    return `
      :root {
        --brand-primary: ${colors.primary || '#00ff88'};
        --brand-secondary: ${colors.secondary || '#0a0a0f'};
        --brand-accent: ${colors.accent || '#00d4ff'};
        --brand-background: ${colors.background || '#0a0a0f'};
        --brand-text: ${colors.text || '#ffffff'};
        --brand-font-body: ${fonts.body || 'Inter, system-ui, sans-serif'};
        --brand-font-heading: ${fonts.heading || fonts.body || 'Inter, system-ui, sans-serif'};
      }
    `.trim()
  },

  /**
   * Apply branding to document
   */
  applyToDocument(brandingData) {
    if (!brandingData) return

    // Apply CSS variables
    const styleId = 'tenant-branding-styles'
    let styleEl = document.getElementById(styleId)

    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    styleEl.textContent = this.generateCssVariables(brandingData)

    // Apply custom CSS if provided
    if (brandingData.customCss) {
      const customStyleId = 'tenant-custom-styles'
      let customStyleEl = document.getElementById(customStyleId)

      if (!customStyleEl) {
        customStyleEl = document.createElement('style')
        customStyleEl.id = customStyleId
        document.head.appendChild(customStyleEl)
      }

      customStyleEl.textContent = brandingData.customCss
    }

    // Update favicon if provided
    if (brandingData.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = brandingData.faviconUrl
    }

    // Update document title if company name provided
    if (brandingData.companyName) {
      const baseTitle = document.title.split(' - ').pop() || 'Threat Intelligence'
      document.title = `${brandingData.companyName} - ${baseTitle}`
    }
  },
}

// ============================================
// CUSTOM DOMAINS
// ============================================

export const domains = {
  /**
   * Get all domains for a tenant
   */
  async getAll(tenantId) {
    const { data, error } = await supabase
      .from('tenant_domains')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    return { data, error }
  },

  /**
   * Add a custom domain
   */
  async add(tenantId, domain, subdomain = null) {
    const { data, error } = await supabase
      .from('tenant_domains')
      .insert({
        tenant_id: tenantId,
        domain: domain.toLowerCase(),
        subdomain,
        status: DOMAIN_STATUS.PENDING,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Remove a domain
   */
  async remove(id) {
    const { error } = await supabase.from('tenant_domains').delete().eq('id', id)

    return { error }
  },

  /**
   * Verify domain ownership
   */
  async verify(domainId, token) {
    const { data, error } = await supabase.rpc('verify_domain', {
      p_domain_id: domainId,
      p_token: token,
    })

    return { verified: data === true, error }
  },

  /**
   * Get verification instructions
   */
  getVerificationInstructions(domain) {
    return {
      method: 'TXT Record',
      instructions: [
        `1. Log in to your DNS provider's control panel`,
        `2. Create a new TXT record with the following values:`,
        `   - Host/Name: _vigil-verification.${domain.domain}`,
        `   - Value: ${domain.verification_token}`,
        `3. Wait for DNS propagation (usually 5-30 minutes)`,
        `4. Click "Verify" to complete domain verification`,
      ],
      alternative: {
        method: 'HTML File',
        instructions: [
          `1. Create a file named: vigil-verification.html`,
          `2. Add this content: ${domain.verification_token}`,
          `3. Upload to: https://${domain.domain}/.well-known/vigil-verification.html`,
          `4. Click "Verify" to complete domain verification`,
        ],
      },
    }
  },

  /**
   * Set primary domain
   */
  async setPrimary(tenantId, domainId) {
    // First, unset all primary flags
    await supabase.from('tenant_domains').update({ is_primary: false }).eq('tenant_id', tenantId)

    // Set the new primary
    const { data, error } = await supabase
      .from('tenant_domains')
      .update({ is_primary: true })
      .eq('id', domainId)
      .select()
      .single()

    return { data, error }
  },
}

// ============================================
// TENANT MEMBERS
// ============================================

export const members = {
  /**
   * Get all members for a tenant
   */
  async getAll(tenantId) {
    const { data, error } = await supabase
      .from('tenant_members')
      .select(
        `
        *,
        user:auth.users(email, raw_user_meta_data)
      `
      )
      .eq('tenant_id', tenantId)
      .order('joined_at', { ascending: false })

    return { data, error }
  },

  /**
   * Invite a new member
   */
  async invite(tenantId, email, role = MEMBER_ROLES.MEMBER) {
    // Check tenant limits first
    const { data: canAdd } = await supabase.rpc('check_tenant_limit', {
      p_tenant_id: tenantId,
      p_limit_type: 'users',
    })

    if (!canAdd) {
      return { data: null, error: { message: 'User limit reached for this tenant' } }
    }

    // Get or create user by email
    const { data: user, error: userError } = await supabase.auth.admin.getUserByEmail(email)

    if (userError) {
      // User doesn't exist - create invitation record
      const { data, error } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: tenantId,
          user_id: null, // Will be set when user signs up
          role,
          status: MEMBER_STATUS.PENDING,
        })
        .select()
        .single()

      return { data: { ...data, pendingEmail: email }, error }
    }

    // User exists - add them directly
    const { data, error } = await supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        role,
        status: MEMBER_STATUS.PENDING,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update member role
   */
  async updateRole(memberId, role) {
    const { data, error } = await supabase
      .from('tenant_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update member status
   */
  async updateStatus(memberId, status) {
    const updates = { status }

    if (status === MEMBER_STATUS.ACTIVE) {
      updates.joined_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('tenant_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Remove a member
   */
  async remove(memberId) {
    const { error } = await supabase.from('tenant_members').delete().eq('id', memberId)

    return { error }
  },

  /**
   * Get member by user ID
   */
  async getByUserId(tenantId, userId) {
    const { data, error } = await supabase
      .from('tenant_members')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single()

    return { data, error }
  },
}

// ============================================
// TENANT SETTINGS
// ============================================

export const settings = {
  /**
   * Get tenant settings
   */
  async get(tenantId) {
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    return { data, error }
  },

  /**
   * Update tenant settings
   */
  async update(tenantId, settingsData) {
    // Check if settings exist
    const { data: existing } = await supabase
      .from('tenant_settings')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) {
      const { data, error } = await supabase
        .from('tenant_settings')
        .update({
          features_enabled: settingsData.featuresEnabled,
          data_retention_days: settingsData.dataRetentionDays,
          audit_log_retention_days: settingsData.auditLogRetentionDays,
          require_2fa: settingsData.require2fa,
          allowed_ip_ranges: settingsData.allowedIpRanges,
          session_timeout_minutes: settingsData.sessionTimeoutMinutes,
          notification_email_from: settingsData.notificationEmailFrom,
          notification_email_name: settingsData.notificationEmailName,
          api_rate_limit_per_minute: settingsData.apiRateLimitPerMinute,
          api_rate_limit_per_day: settingsData.apiRateLimitPerDay,
          compliance_mode: settingsData.complianceMode,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .select()
        .single()

      return { data, error }
    } else {
      const { data, error } = await supabase
        .from('tenant_settings')
        .insert({
          tenant_id: tenantId,
          features_enabled: settingsData.featuresEnabled || {},
          data_retention_days: settingsData.dataRetentionDays || 365,
          audit_log_retention_days: settingsData.auditLogRetentionDays || 90,
          require_2fa: settingsData.require2fa || false,
          allowed_ip_ranges: settingsData.allowedIpRanges,
          session_timeout_minutes: settingsData.sessionTimeoutMinutes || 60,
          notification_email_from: settingsData.notificationEmailFrom,
          notification_email_name: settingsData.notificationEmailName,
          api_rate_limit_per_minute: settingsData.apiRateLimitPerMinute || 60,
          api_rate_limit_per_day: settingsData.apiRateLimitPerDay || 10000,
          compliance_mode: settingsData.complianceMode,
        })
        .select()
        .single()

      return { data, error }
    }
  },

  /**
   * Toggle a feature
   */
  async toggleFeature(tenantId, featureKey, enabled) {
    const { data: current } = await this.get(tenantId)
    const features = current?.features_enabled || {}
    features[featureKey] = enabled

    const { data, error } = await supabase
      .from('tenant_settings')
      .update({
        features_enabled: features,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    return { data, error }
  },
}

// ============================================
// AUDIT LOG
// ============================================

export const auditLog = {
  /**
   * Get audit log entries
   */
  async getAll(tenantId, options = {}) {
    const { action, resourceType, userId, limit = 100, offset = 0 } = options

    let query = supabase
      .from('tenant_audit_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (action) {
      query = query.eq('action', action)
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, count, error } = await query

    return { data, count, error }
  },

  /**
   * Log an action
   */
  async log(tenantId, action, details = {}) {
    const { data, error } = await supabase.rpc('log_tenant_action', {
      p_tenant_id: tenantId,
      p_user_id: details.userId,
      p_action: action,
      p_resource_type: details.resourceType,
      p_resource_id: details.resourceId,
      p_old_values: details.oldValues,
      p_new_values: details.newValues,
      p_ip_address: details.ipAddress,
      p_user_agent: details.userAgent,
    })

    return { data, error }
  },
}

// ============================================
// TENANT CONTEXT HOOK HELPERS
// ============================================

/**
 * Get tenant from current domain
 */
export async function getTenantFromDomain() {
  const hostname = window.location.hostname

  // Skip for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { data: null, error: null }
  }

  const { data, error } = await supabase.rpc('get_tenant_by_domain', {
    p_domain: hostname,
  })

  if (error || !data) {
    return { data: null, error }
  }

  // Get full tenant data
  return tenants.getById(data)
}

/**
 * Initialize tenant context
 */
export async function initializeTenantContext() {
  // First try to get from domain
  const { data: domainTenant } = await getTenantFromDomain()

  if (domainTenant) {
    const { data: brandingData } = await branding.get(domainTenant.id)
    branding.applyToDocument(brandingData)
    return { tenant: domainTenant, branding: brandingData }
  }

  // Fall back to user's tenant membership
  const { data: userTenant } = await tenants.getCurrent()

  if (userTenant) {
    const { data: brandingData } = await branding.get(userTenant.id)
    branding.applyToDocument(brandingData)
    return { tenant: userTenant, branding: brandingData }
  }

  return { tenant: null, branding: null }
}

export default {
  tenants,
  branding,
  domains,
  members,
  settings,
  auditLog,
  getTenantFromDomain,
  initializeTenantContext,
  TENANT_PLANS,
  TENANT_STATUS,
  MEMBER_ROLES,
  MEMBER_STATUS,
  DOMAIN_STATUS,
}
