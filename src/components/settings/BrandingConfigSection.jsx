/**
 * BrandingConfigSection - White-label branding configuration
 * Allows enterprise tenants to customize appearance
 */

import { useState, useEffect } from 'react'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { useTenant } from '../../contexts/TenantContext'
import { tenantBranding, DEFAULT_BRANDING } from '../../lib/tenants'
import { UpgradePrompt } from '../UpgradePrompt'

const COLOR_PRESETS = [
  { name: 'Cyber (Default)', primary: '#00ff9d', dark: '#00cc7d' },
  { name: 'Blue', primary: '#3b82f6', dark: '#2563eb' },
  { name: 'Purple', primary: '#8b5cf6', dark: '#7c3aed' },
  { name: 'Red', primary: '#ef4444', dark: '#dc2626' },
  { name: 'Orange', primary: '#f97316', dark: '#ea580c' },
  { name: 'Pink', primary: '#ec4899', dark: '#db2777' },
]

export default function BrandingConfigSection() {
  const { canAccess, tier } = useSubscription()
  const { currentTenant, refreshBranding, isAdmin } = useTenant()

  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const hasBrandingAccess = canAccess('white_label')

  useEffect(() => {
    if (currentTenant?.id && hasBrandingAccess) {
      loadBranding()
    }
  }, [currentTenant?.id, hasBrandingAccess])

  async function loadBranding() {
    setLoading(true)
    try {
      const data = await tenantBranding.getWithDefaults(currentTenant.id)
      setBranding({
        companyName: data.company_name || data.companyName || '',
        tagline: data.tagline || '',
        logoUrl: data.logo_url || data.logoUrl || '',
        logoDarkUrl: data.logo_dark_url || data.logoDarkUrl || '',
        faviconUrl: data.favicon_url || data.faviconUrl || '',
        primaryColor: data.primary_color || data.primaryColor || DEFAULT_BRANDING.primaryColor,
        primaryDark: data.primary_dark || data.primaryDark || DEFAULT_BRANDING.primaryDark,
        backgroundColor:
          data.background_color || data.backgroundColor || DEFAULT_BRANDING.backgroundColor,
        surfaceColor: data.surface_color || data.surfaceColor || DEFAULT_BRANDING.surfaceColor,
        fontFamily: data.font_family || data.fontFamily || DEFAULT_BRANDING.fontFamily,
        copyrightText: data.copyright_text || data.copyrightText || '',
        supportUrl: data.support_url || data.supportUrl || '',
        documentationUrl: data.documentation_url || data.documentationUrl || '',
        hidePoweredBy: data.hide_powered_by ?? data.hidePoweredBy ?? false,
      })
    } catch (err) {
      setError('Failed to load branding settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!currentTenant?.id) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await tenantBranding.update(currentTenant.id, branding)
      refreshBranding?.()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function applyPreset(preset) {
    setBranding((prev) => ({
      ...prev,
      primaryColor: preset.primary,
      primaryDark: preset.dark,
    }))
  }

  function handleChange(field, value) {
    setBranding((prev) => ({ ...prev, [field]: value }))
  }

  // Not enterprise
  if (!hasBrandingAccess) {
    return (
      <UpgradePrompt
        feature="White-Label Branding"
        description="Customize logos, colors, and branding for your organization with white-label support."
        requiredTier="enterprise"
      />
    )
  }

  // No tenant context
  if (!currentTenant) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 text-center">
        <p className="text-gray-400">White-label branding is configured per organization.</p>
        <p className="text-gray-500 text-sm mt-2">
          Contact support to set up your organization tenant.
        </p>
      </div>
    )
  }

  // Not an admin
  if (!isAdmin) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 text-center">
        <p className="text-gray-400">Only organization admins can modify branding settings.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-800 rounded w-1/3"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
          Branding settings saved successfully!
        </div>
      )}

      {/* Identity */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Brand Identity</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Company Name</label>
            <input
              type="text"
              value={branding.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="Your Company"
              className="cyber-input w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Replaces "Vigil" in the UI</p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Tagline</label>
            <input
              type="text"
              value={branding.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              placeholder="Cyber Threat Intelligence"
              className="cyber-input w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Logo URL</label>
            <input
              type="url"
              value={branding.logoUrl}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              placeholder="https://..."
              className="cyber-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Dark Logo URL</label>
            <input
              type="url"
              value={branding.logoDarkUrl}
              onChange={(e) => handleChange('logoDarkUrl', e.target.value)}
              placeholder="https://..."
              className="cyber-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Favicon URL</label>
            <input
              type="url"
              value={branding.faviconUrl}
              onChange={(e) => handleChange('faviconUrl', e.target.value)}
              placeholder="https://..."
              className="cyber-input w-full"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Colors</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Color Preset</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: preset.primary }}
                />
                <span className="text-sm text-gray-300">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Primary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={branding.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="cyber-input flex-1"
                placeholder="#00ff9d"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Primary Dark</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={branding.primaryDark}
                onChange={(e) => handleChange('primaryDark', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={branding.primaryDark}
                onChange={(e) => handleChange('primaryDark', e.target.value)}
                className="cyber-input flex-1"
                placeholder="#00cc7d"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-3">Color Preview</p>
          <div className="flex gap-4 items-center">
            <button
              className="px-4 py-2 rounded-lg text-black font-medium"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Primary Button
            </button>
            <button
              className="px-4 py-2 rounded-lg border-2 font-medium"
              style={{
                borderColor: branding.primaryColor,
                color: branding.primaryColor,
              }}
            >
              Secondary Button
            </button>
            <span className="text-sm font-medium" style={{ color: branding.primaryColor }}>
              Accent Text
            </span>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Typography</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Font Family</label>
          <select
            value={branding.fontFamily}
            onChange={(e) => handleChange('fontFamily', e.target.value)}
            className="cyber-input w-full"
          >
            <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
            <option value="system-ui, sans-serif">System UI</option>
            <option value="'Roboto', sans-serif">Roboto</option>
            <option value="'Open Sans', sans-serif">Open Sans</option>
            <option value="'Lato', sans-serif">Lato</option>
            <option value="'Poppins', sans-serif">Poppins</option>
            <option value="'Nunito', sans-serif">Nunito</option>
          </select>
        </div>
      </div>

      {/* Footer & Links */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white">Footer & Links</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Copyright Text</label>
            <input
              type="text"
              value={branding.copyrightText}
              onChange={(e) => handleChange('copyrightText', e.target.value)}
              placeholder="2024 Your Company"
              className="cyber-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Support URL</label>
            <input
              type="url"
              value={branding.supportUrl}
              onChange={(e) => handleChange('supportUrl', e.target.value)}
              placeholder="https://support.yourcompany.com"
              className="cyber-input w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Documentation URL</label>
          <input
            type="url"
            value={branding.documentationUrl}
            onChange={(e) => handleChange('documentationUrl', e.target.value)}
            placeholder="https://docs.yourcompany.com"
            className="cyber-input w-full"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={branding.hidePoweredBy}
            onChange={(e) => handleChange('hidePoweredBy', e.target.checked)}
            className="rounded border-gray-600"
          />
          <span className="text-sm text-gray-300">Hide "Powered by Vigil" branding</span>
        </label>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-gray-800">
        <button onClick={handleSave} disabled={saving} className="cyber-button-primary">
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  )
}
