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
   * Test SSO configuration (validates certificate, URLs, domains)
   */
  async test(tenantId) {
    const config = await this.get(tenantId)

    const errors = []
    const warnings = []

    if (!config) {
      return { valid: false, errors: ['No SSO configuration found'] }
    }

    // Validate SAML or OIDC is configured
    const hasSaml = config.saml_sso_url || config.saml_entity_id
    const hasOidc = config.oidc_discovery_url || config.oidc_client_id

    if (!hasSaml && !hasOidc) {
      errors.push('Either SAML or OIDC configuration is required')
    }

    // Validate SAML URLs if SAML is used
    if (hasSaml) {
      // Entity ID validation (must be a valid URL)
      if (config.saml_entity_id) {
        const entityIdValidation = validateUrl(config.saml_entity_id, 'SAML Entity ID')
        if (!entityIdValidation.valid) {
          errors.push(entityIdValidation.error)
        }
      } else {
        errors.push('SAML Entity ID is required')
      }

      // SSO URL validation (must be HTTPS)
      if (config.saml_sso_url) {
        const ssoUrlValidation = validateUrl(config.saml_sso_url, 'SAML SSO URL', { requireHttps: true })
        if (!ssoUrlValidation.valid) {
          errors.push(ssoUrlValidation.error)
        }
      } else {
        errors.push('SAML SSO URL is required')
      }

      // SLO URL validation (optional but must be valid if provided)
      if (config.saml_slo_url) {
        const sloUrlValidation = validateUrl(config.saml_slo_url, 'SAML SLO URL', { requireHttps: true })
        if (!sloUrlValidation.valid) {
          warnings.push(sloUrlValidation.error)
        }
      }

      // Certificate validation
      if (config.saml_certificate) {
        const certValidation = validateCertificate(config.saml_certificate)
        if (!certValidation.valid) {
          errors.push(`SAML Certificate: ${certValidation.error}`)
        }
      } else if (config.provider !== 'generic_saml') {
        errors.push('SAML Certificate is required')
      }
    }

    // Validate OIDC config if OIDC is used
    if (hasOidc) {
      // Discovery URL validation
      if (config.oidc_discovery_url) {
        const discoveryValidation = validateUrl(config.oidc_discovery_url, 'OIDC Discovery URL', { requireHttps: true })
        if (!discoveryValidation.valid) {
          errors.push(discoveryValidation.error)
        }
        // Check it ends with well-known path
        if (!config.oidc_discovery_url.includes('.well-known')) {
          warnings.push('OIDC Discovery URL should typically end with /.well-known/openid-configuration')
        }
      } else {
        errors.push('OIDC Discovery URL is required')
      }

      // Client ID validation
      if (!config.oidc_client_id) {
        errors.push('OIDC Client ID is required')
      }
    }

    // Validate allowed domains
    if (config.allowed_domains?.length > 0) {
      for (const domain of config.allowed_domains) {
        const domainValidation = validateDomain(domain)
        if (!domainValidation.valid) {
          errors.push(`Invalid domain "${domain}": ${domainValidation.error}`)
        }
      }
    } else {
      warnings.push('No allowed domains configured - any email domain can authenticate')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: {
        provider: config.provider,
        providerName: config.provider_name,
        isEnabled: config.is_enabled,
        isEnforced: config.is_enforced,
        hasSaml,
        hasOidc,
        allowedDomains: config.allowed_domains || [],
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

// Utility: Validate URL format
export function validateUrl(url, fieldName, options = {}) {
  const { requireHttps = false } = options

  if (!url || typeof url !== 'string') {
    return { valid: false, error: `${fieldName} is required` }
  }

  const trimmed = url.trim()
  if (!trimmed) {
    return { valid: false, error: `${fieldName} cannot be empty` }
  }

  try {
    const parsed = new URL(trimmed)

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: `${fieldName} must use HTTP or HTTPS protocol` }
    }

    // Check HTTPS requirement
    if (requireHttps && parsed.protocol !== 'https:') {
      return { valid: false, error: `${fieldName} must use HTTPS for security` }
    }

    // Check for localhost in production (warning - could be valid for testing)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return { valid: true, warning: `${fieldName} uses localhost - ensure this is intentional` }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: `${fieldName} is not a valid URL format` }
  }
}

// Utility: Validate domain format (for allowed domains)
export function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain is required' }
  }

  const trimmed = domain.trim().toLowerCase()
  if (!trimmed) {
    return { valid: false, error: 'Domain cannot be empty' }
  }

  // Domain format regex: allows subdomains, must have at least one dot
  // Examples: example.com, sub.example.com, my-company.co.uk
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

  if (!domainRegex.test(trimmed)) {
    // Check common issues
    if (trimmed.includes('@')) {
      return { valid: false, error: 'Domain should not include @ symbol (use "example.com" not "@example.com")' }
    }
    if (trimmed.includes('://')) {
      return { valid: false, error: 'Domain should not include protocol (use "example.com" not "https://example.com")' }
    }
    if (trimmed.includes('/')) {
      return { valid: false, error: 'Domain should not include path (use "example.com" not "example.com/path")' }
    }
    if (!trimmed.includes('.')) {
      return { valid: false, error: 'Domain must include at least one dot (e.g., "example.com")' }
    }
    return { valid: false, error: 'Invalid domain format' }
  }

  return { valid: true }
}

// Utility: Validate X.509 certificate format
export function validateCertificate(cert) {
  if (!cert) return { valid: false, error: 'Certificate is required' }

  // Clean up certificate (remove headers/footers and whitespace)
  const cleaned = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  if (!cleaned) {
    return { valid: false, error: 'Certificate content is empty' }
  }

  // Check minimum length (a real cert would be at least ~500 chars base64)
  if (cleaned.length < 100) {
    return { valid: false, error: 'Certificate appears to be truncated or incomplete' }
  }

  // Check if it's valid base64
  try {
    const decoded = atob(cleaned)
    // Check for DER/ASN.1 signature (certificates start with SEQUENCE tag)
    if (decoded.charCodeAt(0) !== 0x30) {
      return { valid: false, error: 'Certificate does not appear to be valid X.509 format' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Certificate is not valid base64 encoded' }
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
