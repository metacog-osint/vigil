/**
 * Multi-Tenancy / White-Label Module
 * API for managing tenants, branding, and membership
 */

import { supabase } from './supabase'

// Default branding (Vigil defaults)
export const DEFAULT_BRANDING = {
  primaryColor: '#00ff9d',
  primaryDark: '#00cc7d',
  backgroundColor: '#0a0f1a',
  surfaceColor: '#111827',
  textColor: '#ffffff',
  textMuted: '#9ca3af',
  fontFamily: 'Inter, system-ui, sans-serif',
  companyName: 'Vigil',
  tagline: 'Cyber Threat Intelligence',
  copyrightText: '2024 The Intelligence Company',
  hidePoweredBy: false,
}

// Tenant roles
export const TENANT_ROLES = {
  owner: { label: 'Owner', level: 100, permissions: ['*'] },
  admin: { label: 'Admin', level: 75, permissions: ['manage_members', 'manage_branding', 'manage_settings'] },
  member: { label: 'Member', level: 50, permissions: ['view', 'edit'] },
  viewer: { label: 'Viewer', level: 25, permissions: ['view'] },
}

export const tenants = {
  /**
   * Get tenant by slug or custom domain
   */
  async getByIdentifier(identifier) {
    const { data, error } = await supabase
      .rpc('get_tenant', { p_identifier: identifier })

    if (error) throw error
    return data?.[0] || null
  },

  /**
   * Get tenant by ID
   */
  async getById(tenantId) {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get current user's tenants
   */
  async getUserTenants(userId) {
    const { data, error } = await supabase
      .rpc('get_user_tenants', { p_user_id: userId })

    if (error) throw error
    return data || []
  },

  /**
   * Create a new tenant
   */
  async create(tenantData) {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        slug: tenantData.slug,
        name: tenantData.name,
        description: tenantData.description,
        admin_email: tenantData.adminEmail,
        support_email: tenantData.supportEmail,
        billing_email: tenantData.billingEmail,
        custom_domain: tenantData.customDomain,
        subscription_tier: tenantData.subscriptionTier || 'team',
        max_users: tenantData.maxUsers || 10,
        features: tenantData.features || {},
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update tenant settings
   */
  async update(tenantId, updates) {
    const updateData = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.adminEmail !== undefined) updateData.admin_email = updates.adminEmail
    if (updates.supportEmail !== undefined) updateData.support_email = updates.supportEmail
    if (updates.billingEmail !== undefined) updateData.billing_email = updates.billingEmail
    if (updates.customDomain !== undefined) updateData.custom_domain = updates.customDomain
    if (updates.maxUsers !== undefined) updateData.max_users = updates.maxUsers
    if (updates.features !== undefined) updateData.features = updates.features
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a tenant (soft delete by setting is_active = false)
   */
  async deactivate(tenantId) {
    const { error } = await supabase
      .from('tenants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', tenantId)

    if (error) throw error
  },

  /**
   * Verify custom domain
   */
  async verifyDomain(tenantId, verificationToken) {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        domain_verified: true,
        domain_verification_token: verificationToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

export const tenantBranding = {
  /**
   * Get branding for a tenant
   */
  async get(tenantId) {
    const { data, error } = await supabase
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get branding with defaults filled in
   */
  async getWithDefaults(tenantId) {
    const branding = await this.get(tenantId)
    return { ...DEFAULT_BRANDING, ...branding }
  },

  /**
   * Update branding
   */
  async update(tenantId, updates) {
    const { data, error } = await supabase
      .from('tenant_branding')
      .upsert({
        tenant_id: tenantId,
        logo_url: updates.logoUrl,
        logo_dark_url: updates.logoDarkUrl,
        favicon_url: updates.faviconUrl,
        primary_color: updates.primaryColor,
        primary_dark: updates.primaryDark,
        background_color: updates.backgroundColor,
        surface_color: updates.surfaceColor,
        text_color: updates.textColor,
        text_muted: updates.textMuted,
        font_family: updates.fontFamily,
        font_heading: updates.fontHeading,
        company_name: updates.companyName,
        tagline: updates.tagline,
        copyright_text: updates.copyrightText,
        support_url: updates.supportUrl,
        documentation_url: updates.documentationUrl,
        terms_url: updates.termsUrl,
        privacy_url: updates.privacyUrl,
        email_logo_url: updates.emailLogoUrl,
        email_footer_text: updates.emailFooterText,
        hide_powered_by: updates.hidePoweredBy,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Generate CSS custom properties from branding
   */
  generateCssVariables(branding) {
    const b = { ...DEFAULT_BRANDING, ...branding }
    return {
      '--color-primary': b.primaryColor || b.primary_color,
      '--color-primary-dark': b.primaryDark || b.primary_dark,
      '--color-background': b.backgroundColor || b.background_color,
      '--color-surface': b.surfaceColor || b.surface_color,
      '--color-text': b.textColor || b.text_color,
      '--color-text-muted': b.textMuted || b.text_muted,
      '--font-family': b.fontFamily || b.font_family,
      '--font-heading': b.fontHeading || b.font_heading || b.fontFamily || b.font_family,
    }
  },

  /**
   * Apply branding to document
   */
  applyToDocument(branding) {
    const variables = this.generateCssVariables(branding)
    const root = document.documentElement

    Object.entries(variables).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(key, value)
      }
    })

    // Update favicon if provided
    const faviconUrl = branding.faviconUrl || branding.favicon_url
    if (faviconUrl) {
      let link = document.querySelector("link[rel*='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = faviconUrl
    }

    // Update page title if provided
    const companyName = branding.companyName || branding.company_name
    if (companyName) {
      document.title = document.title.replace('Vigil', companyName)
    }
  },
}

export const tenantMembers = {
  /**
   * Get all members of a tenant
   */
  async getAll(tenantId) {
    const { data, error } = await supabase
      .from('tenant_members')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('role')
      .order('joined_at')

    if (error) throw error
    return data || []
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

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Add member to tenant
   */
  async add(tenantId, userId, role = 'member', invitedBy = null) {
    const { data, error } = await supabase
      .from('tenant_members')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role,
        invited_by: invitedBy,
        invited_at: invitedBy ? new Date().toISOString() : null,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update member role
   */
  async updateRole(tenantId, userId, newRole) {
    const { data, error } = await supabase
      .from('tenant_members')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Remove member from tenant
   */
  async remove(tenantId, userId) {
    const { error } = await supabase
      .from('tenant_members')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Check if user is admin of tenant
   */
  async isAdmin(tenantId, userId) {
    const { data } = await supabase
      .rpc('is_tenant_admin', { p_user_id: userId, p_tenant_id: tenantId })

    return data === true
  },

  /**
   * Check if user can access tenant
   */
  async canAccess(tenantId, userId) {
    const { data } = await supabase
      .rpc('can_access_tenant', { p_user_id: userId, p_tenant_id: tenantId })

    return data === true
  },
}

export const tenantInvitations = {
  /**
   * Get pending invitations for a tenant
   */
  async getAll(tenantId) {
    const { data, error } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Create invitation
   */
  async create(tenantId, email, role, invitedBy) {
    // Generate secure token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')

    // Expires in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from('tenant_invitations')
      .insert({
        tenant_id: tenantId,
        email,
        role,
        invited_by: invitedBy,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get invitation by token
   */
  async getByToken(token) {
    const { data, error } = await supabase
      .from('tenant_invitations')
      .select('*, tenants(*)')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Accept invitation
   */
  async accept(token, userId) {
    // Get invitation
    const invitation = await this.getByToken(token)
    if (!invitation) {
      throw new Error('Invalid or expired invitation')
    }

    // Add user to tenant
    await tenantMembers.add(
      invitation.tenant_id,
      userId,
      invitation.role,
      invitation.invited_by
    )

    // Mark invitation as accepted
    await supabase
      .from('tenant_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    return invitation
  },

  /**
   * Cancel invitation
   */
  async cancel(invitationId) {
    const { error } = await supabase
      .from('tenant_invitations')
      .delete()
      .eq('id', invitationId)

    if (error) throw error
  },

  /**
   * Resend invitation (creates new token)
   */
  async resend(invitationId, invitedBy) {
    // Get existing invitation
    const { data: existing, error: getError } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('id', invitationId)
      .single()

    if (getError) throw getError

    // Delete old and create new
    await this.cancel(invitationId)
    return this.create(existing.tenant_id, existing.email, existing.role, invitedBy)
  },
}

// Utility: Generate URL-safe slug from name
export function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

// Utility: Validate slug format
export function isValidSlug(slug) {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 50
}

// Utility: Validate custom domain format
export function isValidDomain(domain) {
  return /^[a-z0-9][a-z0-9-.]*\.[a-z]{2,}$/i.test(domain)
}

// Utility: Check if slug is reserved
export function isReservedSlug(slug) {
  const reserved = [
    'admin', 'api', 'app', 'auth', 'billing', 'blog', 'dashboard',
    'docs', 'help', 'login', 'logout', 'mail', 'pricing', 'settings',
    'status', 'support', 'vigil', 'www',
  ]
  return reserved.includes(slug.toLowerCase())
}

export default { tenants, tenantBranding, tenantMembers, tenantInvitations }
