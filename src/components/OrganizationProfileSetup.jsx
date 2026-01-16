// Organization Profile Setup - Wizard for collecting org profile data
import { useState } from 'react'
import { clsx } from 'clsx'
import { SECTORS_TITLE_CASE as SECTORS, REGIONS } from '../lib/constants'

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Germany', 'France',
  'Australia', 'Japan', 'South Korea', 'India', 'Brazil',
  'Mexico', 'Italy', 'Spain', 'Netherlands', 'Switzerland',
  'Singapore', 'Israel', 'UAE', 'Saudi Arabia', 'South Africa',
]

const TECH_VENDORS = [
  'Microsoft', 'Cisco', 'VMware', 'AWS', 'Google Cloud', 'Azure',
  'Oracle', 'SAP', 'Salesforce', 'Adobe', 'IBM', 'Dell',
  'Fortinet', 'Palo Alto Networks', 'CrowdStrike', 'Citrix',
  'Juniper', 'F5', 'Splunk', 'ServiceNow', 'Okta', 'Zscaler',
]

const TECH_PRODUCTS = [
  'Windows Server', 'Active Directory', 'Exchange Server', 'Office 365',
  'Linux', 'Apache', 'Nginx', 'IIS', 'Docker', 'Kubernetes',
  'MySQL', 'PostgreSQL', 'MongoDB', 'SQL Server', 'Oracle DB',
  'VPN', 'Firewall', 'Load Balancer', 'WAF', 'SIEM',
  'Endpoint Protection', 'Email Gateway', 'Backup Solution',
]

function StepIndicator({ currentStep, totalSteps }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'w-2 h-2 rounded-full transition-colors',
            i <= currentStep ? 'bg-cyber-accent' : 'bg-gray-700'
          )}
        />
      ))}
    </div>
  )
}

function MultiSelect({ options, selected, onChange, columns = 3 }) {
  const toggle = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-2`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => toggle(option)}
          className={clsx(
            'px-3 py-2 text-sm rounded border transition-colors text-left',
            selected.includes(option)
              ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent'
              : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
          )}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function SingleSelect({ options, selected, onChange }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {options.map((option) => {
        const value = typeof option === 'object' ? option.value : option
        const label = typeof option === 'object' ? option.label : option
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={clsx(
              'px-3 py-2 text-sm rounded border transition-colors',
              selected === value
                ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function OrganizationProfileSetup({ profile, onSave, onCancel }) {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState({
    sector: profile?.sector || '',
    secondary_sectors: profile?.secondary_sectors || [],
    region: profile?.region || '',
    country: profile?.country || '',
    tech_vendors: profile?.tech_vendors || [],
    tech_stack: profile?.tech_stack || [],
  })

  const totalSteps = 4

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const nextStep = () => {
    if (step < totalSteps - 1) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleSave = () => {
    onSave(formData)
  }

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.sector !== ''
      case 1:
        return formData.region !== ''
      case 2:
        return true // Tech vendors optional
      case 3:
        return true // Tech stack optional
      default:
        return true
    }
  }

  return (
    <div className="bg-cyber-dark border border-gray-700 rounded-lg p-6 max-w-2xl mx-auto">
      <StepIndicator currentStep={step} totalSteps={totalSteps} />

      {/* Step 0: Primary Sector */}
      {step === 0 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-2">What's your primary sector?</h3>
          <p className="text-sm text-gray-500 mb-4">
            This helps us prioritize threats targeting your industry.
          </p>
          <SingleSelect
            options={SECTORS}
            selected={formData.sector}
            onChange={(v) => updateField('sector', v)}
          />
          {formData.sector && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">Any secondary sectors? (optional)</p>
              <MultiSelect
                options={SECTORS.filter((s) => s !== formData.sector)}
                selected={formData.secondary_sectors}
                onChange={(v) => updateField('secondary_sectors', v)}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 1: Geography */}
      {step === 1 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-2">Where is your organization based?</h3>
          <p className="text-sm text-gray-500 mb-4">
            Geographic targeting is common among threat actors.
          </p>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Region</label>
            <SingleSelect
              options={REGIONS}
              selected={formData.region}
              onChange={(v) => updateField('region', v)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Country</label>
            <SingleSelect
              options={COUNTRIES}
              selected={formData.country}
              onChange={(v) => updateField('country', v)}
            />
          </div>
        </div>
      )}

      {/* Step 2: Tech Vendors */}
      {step === 2 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-2">Which vendors do you use?</h3>
          <p className="text-sm text-gray-500 mb-4">
            We'll highlight vulnerabilities in your vendor products. Select all that apply.
          </p>
          <MultiSelect
            options={TECH_VENDORS}
            selected={formData.tech_vendors}
            onChange={(v) => updateField('tech_vendors', v)}
          />
        </div>
      )}

      {/* Step 3: Tech Stack */}
      {step === 3 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-2">What's in your tech stack?</h3>
          <p className="text-sm text-gray-500 mb-4">
            Select the technologies you actively use. We'll prioritize relevant CVEs.
          </p>
          <MultiSelect
            options={TECH_PRODUCTS}
            selected={formData.tech_stack}
            onChange={(v) => updateField('tech_stack', v)}
            columns={2}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={step === 0 ? onCancel : prevStep}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Step {step + 1} of {totalSteps}
          </span>
          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canProceed()}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 transition-colors"
            >
              Save Profile
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function OrganizationProfileSummary({ profile, onEdit }) {
  if (!profile || !profile.sector) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">🏢</div>
        <p className="text-gray-400 mb-4">
          Set up your organization profile to get personalized threat intelligence.
        </p>
        <button
          onClick={onEdit}
          className="px-4 py-2 bg-cyber-accent text-white rounded hover:bg-cyber-accent/80 transition-colors"
        >
          Setup Profile
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Primary Sector</div>
          <div className="text-white font-medium">{profile.sector}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Region</div>
          <div className="text-white font-medium">{profile.region || 'Not set'}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Country</div>
          <div className="text-white font-medium">{profile.country || 'Not set'}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Tech Vendors</div>
          <div className="text-white font-medium">{profile.tech_vendors?.length || 0} selected</div>
        </div>
      </div>

      {profile.tech_vendors?.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Monitored Vendors</div>
          <div className="flex flex-wrap gap-1">
            {profile.tech_vendors.slice(0, 8).map((vendor) => (
              <span
                key={vendor}
                className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
              >
                {vendor}
              </span>
            ))}
            {profile.tech_vendors.length > 8 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">
                +{profile.tech_vendors.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {profile.tech_stack?.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Tech Stack</div>
          <div className="flex flex-wrap gap-1">
            {profile.tech_stack.slice(0, 6).map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 bg-cyber-accent/10 text-cyber-accent text-xs rounded"
              >
                {tech}
              </span>
            ))}
            {profile.tech_stack.length > 6 && (
              <span className="px-2 py-0.5 text-gray-500 text-xs">
                +{profile.tech_stack.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onEdit}
        className="text-sm text-cyber-accent hover:text-cyber-accent/80 transition-colors"
      >
        Edit Profile
      </button>
    </div>
  )
}

export default OrganizationProfileSetup
