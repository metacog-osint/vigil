/**
 * Personalization Wizard
 * Guides users through setting up their personalized threat intelligence feed
 * Addresses Jake's feedback: "Simplify to someone's stack and preference"
 */

import { useState, useEffect } from 'react'
import { orgProfile as orgProfileApi, alertRules, userPreferences } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { SECTORS_WITH_DETAILS as SECTORS } from '../lib/constants'

const POPULAR_VENDORS = [
  { name: 'Microsoft', category: 'OS & Cloud' },
  { name: 'Cisco', category: 'Networking' },
  { name: 'Palo Alto', category: 'Security' },
  { name: 'Fortinet', category: 'Security' },
  { name: 'VMware', category: 'Virtualization' },
  { name: 'Adobe', category: 'Software' },
  { name: 'Oracle', category: 'Database' },
  { name: 'SAP', category: 'Enterprise' },
  { name: 'Citrix', category: 'Remote Access' },
  { name: 'F5', category: 'Networking' },
  { name: 'Ivanti', category: 'IT Management' },
  { name: 'SonicWall', category: 'Security' },
]

const DIGEST_OPTIONS = [
  { value: 'daily', label: 'Daily', description: 'Get a summary every morning' },
  { value: 'weekly', label: 'Weekly', description: 'Get a summary every Monday' },
  { value: 'none', label: 'None', description: 'I\'ll check the dashboard myself' },
]

export default function PersonalizationWizard({ onComplete, onSkip }) {
  const { user } = useAuth()
  const userId = user?.uid || 'anonymous'

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: Sector
  const [selectedSector, setSelectedSector] = useState('')

  // Step 2: Vendors
  const [selectedVendors, setSelectedVendors] = useState([])
  const [customVendor, setCustomVendor] = useState('')

  // Step 3: Alerts
  const [createAlerts, setCreateAlerts] = useState(true)
  const [alertSeverity, setAlertSeverity] = useState('high')

  // Step 4: Digest
  const [digestFrequency, setDigestFrequency] = useState('daily')

  const totalSteps = 4

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const addCustomVendor = () => {
    if (customVendor.trim() && !selectedVendors.includes(customVendor.trim())) {
      setSelectedVendors([...selectedVendors, customVendor.trim()])
      setCustomVendor('')
    }
  }

  const toggleVendor = (vendor) => {
    if (selectedVendors.includes(vendor)) {
      setSelectedVendors(selectedVendors.filter(v => v !== vendor))
    } else {
      setSelectedVendors([...selectedVendors, vendor])
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      // 1. Save organization profile
      await orgProfileApi.update({
        sector: selectedSector,
        tech_vendors: selectedVendors,
      })

      // 2. Create alert rules for selected vendors
      if (createAlerts && selectedVendors.length > 0) {
        await alertRules.create({
          userId,
          ruleName: `${selectedVendors.slice(0, 2).join(' & ')} CVE Alerts`,
          ruleType: 'vendor_cve',
          conditions: {
            vendors: selectedVendors,
            min_severity: alertSeverity,
          },
          notifyEmail: true,
          notifyInApp: true,
        })
      }

      // 3. Create sector incident alerts
      if (createAlerts && selectedSector) {
        await alertRules.create({
          userId,
          ruleName: `${SECTORS.find(s => s.value === selectedSector)?.label || selectedSector} Incidents`,
          ruleType: 'sector_incident',
          conditions: {
            sectors: [selectedSector],
          },
          notifyEmail: digestFrequency !== 'none',
          notifyInApp: true,
        })
      }

      // 4. Save digest preference
      await userPreferences.update(userId, {
        digestFrequency,
        setupCompleted: true,
        setupCompletedAt: new Date().toISOString(),
      })

      // Mark wizard as complete
      localStorage.setItem('vigil_personalization_completed', 'true')

      onComplete?.()
    } catch (error) {
      console.error('Error saving personalization:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-cyber-dark border border-cyan-500/30 rounded-xl w-full max-w-2xl shadow-2xl shadow-cyan-500/10">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-white">Personalize Your Feed</h2>
            <button
              onClick={onSkip}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Skip for now
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Get threat intelligence tailored to your organization in just 2 minutes
          </p>

          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i < step ? 'bg-cyan-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {step === 1 && (
            <StepSector
              selected={selectedSector}
              onSelect={setSelectedSector}
            />
          )}
          {step === 2 && (
            <StepVendors
              selected={selectedVendors}
              onToggle={toggleVendor}
              customVendor={customVendor}
              setCustomVendor={setCustomVendor}
              onAddCustom={addCustomVendor}
            />
          )}
          {step === 3 && (
            <StepAlerts
              createAlerts={createAlerts}
              setCreateAlerts={setCreateAlerts}
              alertSeverity={alertSeverity}
              setAlertSeverity={setAlertSeverity}
              vendors={selectedVendors}
              sector={selectedSector}
            />
          )}
          {step === 4 && (
            <StepDigest
              frequency={digestFrequency}
              setFrequency={setDigestFrequency}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={saving || (step === 1 && !selectedSector)}
            className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : step === totalSteps ? 'Finish Setup' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepSector({ selected, onSelect }) {
  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-2">What industry are you in?</h3>
      <p className="text-sm text-gray-400 mb-4">
        We'll prioritize threats targeting your sector
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SECTORS.map(sector => (
          <button
            key={sector.value}
            onClick={() => onSelect(sector.value)}
            className={`p-3 rounded-lg border text-left transition-all ${
              selected === sector.value
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
            }`}
          >
            <div className="text-xl mb-1">{sector.icon}</div>
            <div className="text-sm text-white">{sector.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepVendors({ selected, onToggle, customVendor, setCustomVendor, onAddCustom }) {
  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-2">What products do you use?</h3>
      <p className="text-sm text-gray-400 mb-4">
        We'll alert you about critical vulnerabilities in your stack
      </p>

      {/* Custom vendor input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={customVendor}
          onChange={(e) => setCustomVendor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddCustom()}
          placeholder="Add a vendor..."
          className="flex-1 cyber-input"
        />
        <button
          onClick={onAddCustom}
          disabled={!customVendor.trim()}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Selected vendors */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selected.map(vendor => (
            <span
              key={vendor}
              className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm"
            >
              {vendor}
              <button
                onClick={() => onToggle(vendor)}
                className="hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Popular vendors */}
      <div className="text-xs text-gray-500 mb-2">Popular vendors:</div>
      <div className="flex flex-wrap gap-2">
        {POPULAR_VENDORS.map(vendor => (
          <button
            key={vendor.name}
            onClick={() => onToggle(vendor.name)}
            disabled={selected.includes(vendor.name)}
            className={`px-3 py-1.5 rounded border text-sm transition-colors ${
              selected.includes(vendor.name)
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 opacity-50'
                : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
            }`}
          >
            {vendor.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepAlerts({ createAlerts, setCreateAlerts, alertSeverity, setAlertSeverity, vendors, sector }) {
  const sectorLabel = SECTORS.find(s => s.value === sector)?.label || sector

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-2">Set up automatic alerts?</h3>
      <p className="text-sm text-gray-400 mb-4">
        Get notified before threats make the news
      </p>

      <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/30 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={createAlerts}
          onChange={(e) => setCreateAlerts(e.target.checked)}
          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
        />
        <div>
          <div className="text-white font-medium">Create alerts for me</div>
          <div className="text-sm text-gray-400">Based on your vendors and sector</div>
        </div>
      </label>

      {createAlerts && (
        <div className="space-y-4 p-4 rounded-lg bg-gray-800/20 border border-gray-700/50">
          <div className="text-sm text-gray-300">We'll create these alert rules:</div>

          {vendors.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-cyan-400">✓</span>
              <div>
                <div className="text-white text-sm">Vendor CVE Alerts</div>
                <div className="text-xs text-gray-500">
                  {vendors.slice(0, 3).join(', ')}{vendors.length > 3 ? ` +${vendors.length - 3} more` : ''}
                </div>
              </div>
            </div>
          )}

          {sector && (
            <div className="flex items-start gap-2">
              <span className="text-cyan-400">✓</span>
              <div>
                <div className="text-white text-sm">Sector Incident Alerts</div>
                <div className="text-xs text-gray-500">{sectorLabel} ransomware incidents</div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Minimum severity for CVE alerts:</label>
            <select
              value={alertSeverity}
              onChange={(e) => setAlertSeverity(e.target.value)}
              className="cyber-input w-full"
            >
              <option value="critical">Critical only</option>
              <option value="high">High and above</option>
              <option value="medium">Medium and above</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

function StepDigest({ frequency, setFrequency }) {
  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-2">How often should we email you?</h3>
      <p className="text-sm text-gray-400 mb-4">
        Get a TL;DR summary of threats relevant to you
      </p>

      <div className="space-y-3">
        {DIGEST_OPTIONS.map(option => (
          <label
            key={option.value}
            className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
              frequency === option.value
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="digest"
              value={option.value}
              checked={frequency === option.value}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-4 h-4 text-cyan-500 bg-gray-800 border-gray-600 focus:ring-cyan-500"
            />
            <div>
              <div className="text-white font-medium">{option.label}</div>
              <div className="text-sm text-gray-400">{option.description}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-cyan-400 text-lg">💡</span>
          <div className="text-sm text-gray-300">
            <strong className="text-white">Pro tip:</strong> Daily digests include a TL;DR summary
            of the most critical threats for your industry, so you're always informed before
            it hits the news.
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check if personalization wizard should be shown
 */
export function usePersonalizationWizard() {
  const [shouldShow, setShouldShow] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        // Check localStorage first
        const completed = localStorage.getItem('vigil_personalization_completed')
        if (completed === 'true') {
          setShouldShow(false)
          setLoading(false)
          return
        }

        // Check if org profile exists
        const profile = await orgProfileApi.get()
        const hasProfile = profile && profile.sector

        setShouldShow(!hasProfile)
      } catch (error) {
        console.error('Error checking personalization status:', error)
        setShouldShow(false)
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [])

  const dismiss = () => {
    localStorage.setItem('vigil_personalization_completed', 'true')
    setShouldShow(false)
  }

  return { shouldShow, loading, dismiss }
}

/**
 * Button to trigger personalization wizard from Settings
 */
export function PersonalizeButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/50 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <div className="text-white font-medium">Personalize Your Feed</div>
          <div className="text-sm text-gray-400">Set up alerts for your vendors and sector</div>
        </div>
        <svg className="w-5 h-5 text-gray-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
