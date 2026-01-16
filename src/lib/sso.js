/**
 * SSO/SAML Integration Module
 * API for configuring and managing enterprise SSO
 */

import { supabase } from './supabase'

// Supported SSO providers
export const SSO_PROVIDERS = {
  okta: {
    name: 'Okta',
    logo: '/logos/okta.svg',
    type: 'saml',
    docsUrl: 'https://developer.okta.com/docs/guides/build-sso-integration/saml2/main/',
    features: ['SAML 2.0', 'SCIM Provisioning', 'Single Logout'],
  },
  azure_ad: {
    name: 'Azure AD',
    logo: '/logos/azure-ad.svg',
    type: 'both', // SAML and OIDC
    docsUrl: 'https://docs.microsoft.com/en-us/azure/active-directory/saas-apps/',
    features: ['SAML 2.0', 'OIDC', 'SCIM Provisioning'],
  },
  google_workspace: {
    name: 'Google Workspace',
    logo: '/logos/google.svg',
    type: 'saml',
    docsUrl: 'https://support.google.com/a/answer/6087519',
    features: ['SAML 2.0', 'Auto-provisioning'],
  },
  onelogin: {
    name: 'OneLogin',
    logo: '/logos/onelogin.svg',
    type: 'saml',
    docsUrl: 'https://developers.onelogin.com/saml',
    features: ['SAML 2.0', 'SCIM Provisioning'],
  },
  generic_saml: {
    name: 'Other SAML Provider',
    logo: null,
    type: 'saml',
    features: ['SAML 2.0'],
  },
}

// Generate SP metadata for a tenant
export function generateSpMetadata(tenantSlug) {
  const baseUrl = window.location.origin
  return {
    entityId: `${baseUrl}/sso/${tenantSlug}`,
    acsUrl: `${baseUrl}/api/sso/${tenantSlug}/acs`,
    sloUrl: `${baseUrl}/api/sso/${tenantSlug}/slo`,
    metadataUrl: `${baseUrl}/api/sso/${tenantSlug}/metadata`,
  }
}

export const ssoConfig = {
  /**
   * Get SSO configuration for a tenant
   */
  async get(tenantId) {
    const { data, error } = await supabase
      .from('sso_configurations')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create or update SSO configuration
   */
  async upsert(tenantId, config) {
    const { data, error } = await supabase
      .from('sso_configurations')
      .upsert({
        tenant_id: tenantId,
        provider: config.provider,
        provider_name: config.providerName,
        is_enabled: config.isEnabled || false,
        is_enforced: config.isEnforced || false,
        saml_entity_id: config.samlEntityId,
        saml_sso_url: config.samlSsoUrl,
        saml_slo_url: config.samlSloUrl,
        saml_certificate: config.samlCertificate,
        sp_entity_id: config.spEntityId,
        sp_acs_url: config.spAcsUrl,
        sp_slo_url: config.spSloUrl,
        sp_metadata_url: config.spMetadataUrl,
        oidc_client_id: config.oidcClientId,
        oidc_discovery_url: config.oidcDiscoveryUrl,
        oidc_scopes: config.oidcScopes,
        allowed_domains: config.allowedDomains || [],
        auto_provision_users: config.autoProvisionUsers !== false,
        attribute_mapping: config.attributeMapping || {},
        default_role: config.defaultRole || 'member',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Enable SSO
   */
  async enable(tenantId) {
    const { data, error } = await supabase
      .from('sso_configurations')
      .update({
        is_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Disable SSO
   */
  async disable(tenantId) {
    const { data, error } = await supabase
      .from('sso_configurations')
      .update({
        is_enabled: false,
        is_enforced: false,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Toggle enforce SSO for all users
   */
  async setEnforced(tenantId, enforced) {
    const { data, error } = await supabase
      .from('sso_configurations')
      .update({
        is_enforced: enforced,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete SSO configuration
   */
  async delete(tenantId) {
    const { error } = await supabase
      .from('sso_configurations')
      .delete()
      .eq('tenant_id', tenantId)

    if (error) throw error
  },

  /**
   * Test SSO configuration (validates certificate, URLs)
   */
  async test(tenantId) {
    // This would typically call a server endpoint to validate
    // For now, just check if config exists and has required fields
    const config = await this.get(tenantId)

    const errors = []

    if (!config) {
      return { valid: false, errors: ['No SSO configuration found'] }
    }

    if (!config.saml_sso_url && !config.oidc_discovery_url) {
      errors.push('Either SAML SSO URL or OIDC Discovery URL is required')
    }

    if (config.provider !== 'generic_saml' && !config.saml_certificate && !config.oidc_client_id) {
      errors.push('Certificate or OIDC client ID is required')
    }

    return {
      valid: errors.length === 0,
      errors,
      config: {
        provider: config.provider,
        isEnabled: config.is_enabled,
        isEnforced: config.is_enforced,
      },
    }
  },
}

export const ssoSessions = {
  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId) {
    const { data, error } = await supabase
      .from('sso_sessions')
      .select(`
        *,
        sso_config:sso_configurations(provider, provider_name)
      `)
      .eq('user_id', userId)
      .is('logged_out_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Create a session
   */
  async create(ssoConfigId, userId, sessionData) {
    const { data, error } = await supabase
      .from('sso_sessions')
      .insert({
        sso_config_id: ssoConfigId,
        user_id: userId,
        idp_session_id: sessionData.idpSessionId,
        name_id: sessionData.nameId,
        session_index: sessionData.sessionIndex,
        attributes: sessionData.attributes || {},
        expires_at: sessionData.expiresAt,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Log out a session
   */
  async logout(sessionId) {
    const { error } = await supabase
      .from('sso_sessions')
      .update({
        logged_out_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) throw error
  },

  /**
   * Log out all sessions for a user
   */
  async logoutAll(userId) {
    const { error } = await supabase
      .from('sso_sessions')
      .update({
        logged_out_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .is('logged_out_at', null)

    if (error) throw error
  },
}

export const ssoAttempts = {
  /**
   * Get recent login attempts for a tenant
   */
  async getRecent(tenantId, limit = 50) {
    const { data, error } = await supabase
      .from('sso_login_attempts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('attempted_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get attempts for a specific email
   */
  async getByEmail(email, days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('sso_login_attempts')
      .select('*')
      .eq('email', email)
      .gte('attempted_at', since.toISOString())
      .order('attempted_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get failed attempts count (for rate limiting)
   */
  async getFailedCount(email, minutes = 15) {
    const since = new Date()
    since.setMinutes(since.getMinutes() - minutes)

    const { data, error } = await supabase
      .from('sso_login_attempts')
      .select('id')
      .eq('email', email)
      .eq('status', 'failed')
      .gte('attempted_at', since.toISOString())

    if (error) throw error
    return data?.length || 0
  },
}

// Utility: Parse SAML metadata XML to extract IdP config
export function parseSamlMetadata(metadataXml) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(metadataXml, 'text/xml')

    // Extract entity ID
    const entityDescriptor = doc.querySelector('EntityDescriptor')
    const entityId = entityDescriptor?.getAttribute('entityID')

    // Extract SSO URL
    const ssoDescriptor = doc.querySelector('SingleSignOnService')
    const ssoUrl = ssoDescriptor?.getAttribute('Location')

    // Extract SLO URL
    const sloDescriptor = doc.querySelector('SingleLogoutService')
    const sloUrl = sloDescriptor?.getAttribute('Location')

    // Extract certificate
    const certElement = doc.querySelector('X509Certificate')
    const certificate = certElement?.textContent?.trim()

    return {
      entityId,
      ssoUrl,
      sloUrl,
      certificate,
      valid: !!(entityId && ssoUrl),
    }
  } catch (err) {
    console.error('Failed to parse SAML metadata:', err)
    return { valid: false, error: err.message }
  }
}

// Utility: Validate X.509 certificate format
export function validateCertificate(cert) {
  if (!cert) return { valid: false, error: 'Certificate is required' }

  // Clean up certificate
  const cleaned = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  // Check if it's valid base64
  try {
    atob(cleaned)
    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid certificate format' }
  }
}

// Utility: Generate a SAML AuthnRequest (for testing)
export function generateAuthnRequest(config) {
  const id = '_' + crypto.randomUUID()
  const issueInstant = new Date().toISOString()

  return {
    id,
    issueInstant,
    destination: config.samlSsoUrl,
    issuer: config.spEntityId,
    acsUrl: config.spAcsUrl,
  }
}

export default {
  ssoConfig,
  ssoSessions,
  ssoAttempts,
  SSO_PROVIDERS,
}
