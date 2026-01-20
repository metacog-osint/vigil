/**
 * SSO Configuration Section
 * Enterprise SSO/SAML setup UI for tenant admins
 */

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  ssoConfig,
  SSO_PROVIDERS,
  generateSpMetadata,
  parseSamlMetadata,
  validateCertificate,
} from '../../lib/sso'
import { useTenant } from '../../contexts/TenantContext'
import { useSubscription } from '../../contexts/SubscriptionContext'

// Provider icons (simplified inline SVGs)
const ProviderIcon = ({ provider, className = 'w-8 h-8' }) => {
  const icons = {
    okta: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.389 0 0 5.389 0 12s5.389 12 12 12 12-5.389 12-12S18.611 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z" />
      </svg>
    ),
    azure_ad: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
      </svg>
    ),
    google_workspace: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
    onelogin: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    generic_saml: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  }
  return icons[provider] || icons.generic_saml
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={copy} className="text-xs text-cyber-accent hover:text-cyan-300">
      {copied ? 'Copied!' : label || 'Copy'}
    </button>
  )
}

function MetadataDisplay({ metadata }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium text-gray-300">Service Provider Configuration</h4>
      <p className="text-xs text-gray-500">
        Use these values when configuring Vigil in your identity provider:
      </p>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Entity ID (Issuer):</span>
          <div className="flex items-center gap-2">
            <code className="text-cyber-accent text-xs">{metadata.entityId}</code>
            <CopyButton text={metadata.entityId} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">ACS URL:</span>
          <div className="flex items-center gap-2">
            <code className="text-cyber-accent text-xs">{metadata.acsUrl}</code>
            <CopyButton text={metadata.acsUrl} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">SLO URL:</span>
          <div className="flex items-center gap-2">
            <code className="text-cyber-accent text-xs">{metadata.sloUrl}</code>
            <CopyButton text={metadata.sloUrl} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Metadata URL:</span>
          <div className="flex items-center gap-2">
            <a
              href={metadata.metadataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyber-accent text-xs hover:underline"
            >
              {metadata.metadataUrl}
            </a>
            <CopyButton text={metadata.metadataUrl} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ProviderSelector({ selectedProvider, onSelect }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Object.entries(SSO_PROVIDERS).map(([key, provider]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={clsx(
            'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors',
            selectedProvider === key
              ? 'border-cyber-accent bg-cyber-accent/10'
              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
          )}
        >
          <ProviderIcon provider={key} className="w-10 h-10 text-gray-300" />
          <span className="text-sm text-white">{provider.name}</span>
        </button>
      ))}
    </div>
  )
}

function SAMLConfigForm({ config, onChange, onMetadataUpload }) {
  const [metadataInput, setMetadataInput] = useState('')
  const [parseError, setParseError] = useState(null)

  const handleMetadataParse = () => {
    setParseError(null)
    const result = parseSamlMetadata(metadataInput)

    if (result.valid) {
      onChange({
        ...config,
        samlEntityId: result.entityId,
        samlSsoUrl: result.ssoUrl,
        samlSloUrl: result.sloUrl,
        samlCertificate: result.certificate,
      })
      setMetadataInput('')
    } else {
      setParseError(result.error || 'Failed to parse metadata')
    }
  }

  return (
    <div className="space-y-4">
      {/* Metadata Upload */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Import from IdP Metadata (optional)
        </label>
        <textarea
          value={metadataInput}
          onChange={(e) => setMetadataInput(e.target.value)}
          placeholder="Paste your IdP SAML metadata XML here..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm h-24 font-mono"
        />
        {parseError && <p className="text-red-400 text-xs mt-1">{parseError}</p>}
        <button
          onClick={handleMetadataParse}
          disabled={!metadataInput}
          className="mt-2 text-sm text-cyber-accent hover:text-cyan-300 disabled:opacity-50"
        >
          Parse Metadata
        </button>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <p className="text-xs text-gray-500 mb-4">Or configure manually:</p>

        {/* Entity ID */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">IdP Entity ID *</label>
          <input
            type="text"
            value={config.samlEntityId || ''}
            onChange={(e) => onChange({ ...config, samlEntityId: e.target.value })}
            placeholder="https://idp.example.com/saml2"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
        </div>

        {/* SSO URL */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">IdP SSO URL *</label>
          <input
            type="url"
            value={config.samlSsoUrl || ''}
            onChange={(e) => onChange({ ...config, samlSsoUrl: e.target.value })}
            placeholder="https://idp.example.com/sso/saml"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
        </div>

        {/* SLO URL */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">IdP SLO URL (optional)</label>
          <input
            type="url"
            value={config.samlSloUrl || ''}
            onChange={(e) => onChange({ ...config, samlSloUrl: e.target.value })}
            placeholder="https://idp.example.com/slo/saml"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
        </div>

        {/* Certificate */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">IdP X.509 Certificate *</label>
          <textarea
            value={config.samlCertificate || ''}
            onChange={(e) => onChange({ ...config, samlCertificate: e.target.value })}
            placeholder="-----BEGIN CERTIFICATE-----
MIIDxTCCA...
-----END CERTIFICATE-----"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm h-32 font-mono"
          />
          {config.samlCertificate && (
            <p
              className={clsx(
                'text-xs mt-1',
                validateCertificate(config.samlCertificate).valid
                  ? 'text-green-400'
                  : 'text-red-400'
              )}
            >
              {validateCertificate(config.samlCertificate).valid
                ? '✓ Certificate format valid'
                : '✗ Invalid certificate format'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function OIDCConfigForm({ config, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Discovery URL *</label>
        <input
          type="url"
          value={config.oidcDiscoveryUrl || ''}
          onChange={(e) => onChange({ ...config, oidcDiscoveryUrl: e.target.value })}
          placeholder="https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Client ID *</label>
        <input
          type="text"
          value={config.oidcClientId || ''}
          onChange={(e) => onChange({ ...config, oidcClientId: e.target.value })}
          placeholder="your-client-id"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Scopes</label>
        <input
          type="text"
          value={config.oidcScopes || 'openid email profile'}
          onChange={(e) => onChange({ ...config, oidcScopes: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
        />
      </div>
    </div>
  )
}

function AdvancedSettings({ config, onChange }) {
  const [domainInput, setDomainInput] = useState('')

  const addDomain = () => {
    if (domainInput && !config.allowedDomains?.includes(domainInput)) {
      onChange({
        ...config,
        allowedDomains: [...(config.allowedDomains || []), domainInput.toLowerCase()],
      })
      setDomainInput('')
    }
  }

  const removeDomain = (domain) => {
    onChange({
      ...config,
      allowedDomains: config.allowedDomains?.filter((d) => d !== domain) || [],
    })
  }

  return (
    <div className="space-y-4">
      {/* Domain Restrictions */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Allowed Email Domains</label>
        <p className="text-xs text-gray-500 mb-2">
          Restrict SSO to specific email domains (leave empty to allow all)
        </p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
          <button
            onClick={addDomain}
            disabled={!domainInput}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {config.allowedDomains?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {config.allowedDomains.map((domain) => (
              <span
                key={domain}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-sm"
              >
                {domain}
                <button
                  onClick={() => removeDomain(domain)}
                  className="text-gray-500 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Auto-provision */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-300">Auto-provision users</div>
          <div className="text-xs text-gray-500">
            Automatically create accounts for new SSO users
          </div>
        </div>
        <button
          onClick={() => onChange({ ...config, autoProvisionUsers: !config.autoProvisionUsers })}
          className={clsx(
            'relative w-11 h-6 rounded-full transition-colors',
            config.autoProvisionUsers !== false ? 'bg-cyber-accent' : 'bg-gray-700'
          )}
        >
          <span
            className={clsx(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              config.autoProvisionUsers !== false ? 'left-6' : 'left-1'
            )}
          />
        </button>
      </div>

      {/* Default Role */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Default Role for New Users</label>
        <select
          value={config.defaultRole || 'member'}
          onChange={(e) => onChange({ ...config, defaultRole: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
        >
          <option value="member">Member</option>
          <option value="analyst">Analyst</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Enforce SSO */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div>
          <div className="text-sm text-gray-300">Enforce SSO</div>
          <div className="text-xs text-gray-500">
            Require all users to sign in via SSO (password login disabled)
          </div>
        </div>
        <button
          onClick={() => onChange({ ...config, isEnforced: !config.isEnforced })}
          className={clsx(
            'relative w-11 h-6 rounded-full transition-colors',
            config.isEnforced ? 'bg-cyber-accent' : 'bg-gray-700'
          )}
        >
          <span
            className={clsx(
              'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
              config.isEnforced ? 'left-6' : 'left-1'
            )}
          />
        </button>
      </div>
    </div>
  )
}

export default function SSOConfigSection() {
  const { currentTenant, isAdmin } = useTenant()
  const { canAccess } = useSubscription()
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [step, setStep] = useState('provider') // provider, config, advanced
  const [testResult, setTestResult] = useState(null)

  const hasSSOAccess = canAccess('sso_saml')
  const tenantSlug = currentTenant?.slug || currentTenant?.identifier || 'default'
  const spMetadata = generateSpMetadata(tenantSlug)

  useEffect(() => {
    if (currentTenant?.id && hasSSOAccess) {
      loadConfig()
    } else {
      setLoading(false)
    }
  }, [currentTenant?.id, hasSSOAccess])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const existingConfig = await ssoConfig.get(currentTenant.id)
      if (existingConfig) {
        setConfig({
          provider: existingConfig.provider,
          providerName: existingConfig.provider_name,
          isEnabled: existingConfig.is_enabled,
          isEnforced: existingConfig.is_enforced,
          samlEntityId: existingConfig.saml_entity_id,
          samlSsoUrl: existingConfig.saml_sso_url,
          samlSloUrl: existingConfig.saml_slo_url,
          samlCertificate: existingConfig.saml_certificate,
          oidcClientId: existingConfig.oidc_client_id,
          oidcDiscoveryUrl: existingConfig.oidc_discovery_url,
          oidcScopes: existingConfig.oidc_scopes,
          allowedDomains: existingConfig.allowed_domains || [],
          autoProvisionUsers: existingConfig.auto_provision_users,
          defaultRole: existingConfig.default_role,
        })
        setStep('config')
      }
    } catch (err) {
      console.error('Failed to load SSO config:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await ssoConfig.upsert(currentTenant.id, {
        ...config,
        spEntityId: spMetadata.entityId,
        spAcsUrl: spMetadata.acsUrl,
        spSloUrl: spMetadata.sloUrl,
        spMetadataUrl: spMetadata.metadataUrl,
      })
      setSuccess('SSO configuration saved successfully')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestResult(null)
    try {
      const result = await ssoConfig.test(currentTenant.id)
      setTestResult(result)
    } catch (err) {
      setTestResult({ valid: false, errors: [err.message] })
    }
  }

  const handleEnable = async () => {
    setSaving(true)
    try {
      await ssoConfig.enable(currentTenant.id)
      setConfig({ ...config, isEnabled: true })
      setSuccess('SSO enabled')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDisable = async () => {
    setSaving(true)
    try {
      await ssoConfig.disable(currentTenant.id)
      setConfig({ ...config, isEnabled: false, isEnforced: false })
      setSuccess('SSO disabled')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Not on enterprise tier
  if (!hasSSOAccess) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Enterprise SSO</h3>
        <p className="text-gray-400 text-sm mb-4">
          Single Sign-On with Okta, Azure AD, Google Workspace, and more
        </p>
        <a href="/pricing" className="text-cyber-accent hover:underline text-sm">
          Upgrade to Enterprise →
        </a>
      </div>
    )
  }

  // No tenant context
  if (!currentTenant) {
    return (
      <div className="text-gray-400 text-sm">
        SSO configuration requires a tenant. Please set up your organization first.
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="text-gray-400 text-sm">Only tenant administrators can configure SSO.</div>
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-800 rounded w-1/3"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
      </div>
    )
  }

  const providerInfo = config.provider ? SSO_PROVIDERS[config.provider] : null

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {config.isEnabled && (
        <div
          className={clsx(
            'flex items-center justify-between p-4 rounded-lg',
            config.isEnforced
              ? 'bg-green-900/20 border border-green-800'
              : 'bg-blue-900/20 border border-blue-800'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-3 h-3 rounded-full',
                config.isEnforced ? 'bg-green-500' : 'bg-blue-500'
              )}
            />
            <div>
              <div className="text-white text-sm font-medium">
                SSO {config.isEnforced ? 'Enforced' : 'Enabled'}
              </div>
              <div className="text-gray-400 text-xs">
                {providerInfo?.name || config.provider}
                {config.isEnforced && ' - Password login disabled'}
              </div>
            </div>
          </div>
          <button
            onClick={handleDisable}
            disabled={saving}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Disable SSO
          </button>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-900/20 border border-green-800 rounded text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Step Navigation */}
      <div className="flex gap-4 border-b border-gray-700 pb-2">
        {['provider', 'config', 'advanced'].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            disabled={s !== 'provider' && !config.provider}
            className={clsx(
              'text-sm pb-2 border-b-2 transition-colors',
              step === s
                ? 'text-cyber-accent border-cyber-accent'
                : 'text-gray-400 border-transparent hover:text-white',
              s !== 'provider' && !config.provider && 'opacity-50 cursor-not-allowed'
            )}
          >
            {s === 'provider' && '1. Provider'}
            {s === 'config' && '2. Configuration'}
            {s === 'advanced' && '3. Advanced'}
          </button>
        ))}
      </div>

      {/* Step: Provider Selection */}
      {step === 'provider' && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Select your identity provider:</p>
          <ProviderSelector
            selectedProvider={config.provider}
            onSelect={(provider) => {
              setConfig({ ...config, provider })
              setStep('config')
            }}
          />
        </div>
      )}

      {/* Step: Configuration */}
      {step === 'config' && config.provider && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <ProviderIcon provider={config.provider} className="w-8 h-8 text-gray-300" />
            <div>
              <h3 className="text-white font-medium">{providerInfo?.name}</h3>
              {providerInfo?.docsUrl && (
                <a
                  href={providerInfo.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyber-accent hover:underline"
                >
                  Setup documentation →
                </a>
              )}
            </div>
          </div>

          {/* SP Metadata for IdP configuration */}
          <MetadataDisplay metadata={spMetadata} />

          {/* IdP Configuration */}
          <div className="border-t border-gray-700 pt-6">
            <h4 className="text-sm font-medium text-gray-300 mb-4">
              Identity Provider Configuration
            </h4>

            {providerInfo?.type === 'both' ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfig({ ...config, configType: 'saml' })}
                    className={clsx(
                      'px-4 py-2 rounded text-sm',
                      config.configType === 'saml' || !config.configType
                        ? 'bg-cyber-accent/20 text-cyber-accent'
                        : 'bg-gray-800 text-gray-400'
                    )}
                  >
                    SAML 2.0
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, configType: 'oidc' })}
                    className={clsx(
                      'px-4 py-2 rounded text-sm',
                      config.configType === 'oidc'
                        ? 'bg-cyber-accent/20 text-cyber-accent'
                        : 'bg-gray-800 text-gray-400'
                    )}
                  >
                    OIDC
                  </button>
                </div>
                {config.configType === 'oidc' ? (
                  <OIDCConfigForm config={config} onChange={setConfig} />
                ) : (
                  <SAMLConfigForm config={config} onChange={setConfig} />
                )}
              </div>
            ) : providerInfo?.type === 'saml' ? (
              <SAMLConfigForm config={config} onChange={setConfig} />
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={handleTest}
              disabled={saving}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Test Configuration
            </button>
            {!config.isEnabled && config.samlSsoUrl && (
              <button
                onClick={handleEnable}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500"
              >
                Enable SSO
              </button>
            )}
          </div>

          {/* Test Results */}
          {testResult && (
            <div
              className={clsx(
                'p-4 rounded-lg',
                testResult.valid
                  ? 'bg-green-900/20 border border-green-800'
                  : 'bg-red-900/20 border border-red-800'
              )}
            >
              <div
                className={clsx(
                  'font-medium text-sm mb-2',
                  testResult.valid ? 'text-green-400' : 'text-red-400'
                )}
              >
                {testResult.valid ? '✓ Configuration valid' : '✗ Configuration issues found'}
              </div>
              {testResult.errors?.length > 0 && (
                <ul className="text-sm text-red-300 list-disc list-inside">
                  {testResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step: Advanced Settings */}
      {step === 'advanced' && config.provider && (
        <div className="space-y-6">
          <AdvancedSettings config={config} onChange={setConfig} />

          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
