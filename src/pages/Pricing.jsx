import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TIERS, TIER_INFO, TIER_FEATURES, FEATURE_DESCRIPTIONS, canAccess } from '../lib/features'
import { createCheckoutSession, redirectToCheckout, getUserSubscription } from '../lib/stripe'

// Feature groups for display
const FEATURE_GROUPS = [
  {
    name: 'Core Access',
    features: [
      'view_dashboard',
      'view_actors',
      'view_incidents',
      'view_vulnerabilities',
      'view_iocs',
      'basic_search',
    ],
  },
  {
    name: 'Personalization',
    features: [
      'org_profile',
      'relevance_scoring',
      'watchlist',
      'saved_filters',
    ],
  },
  {
    name: 'Alerts & Notifications',
    features: [
      'email_digests',
      'vendor_alerts',
      'custom_alert_rules',
    ],
  },
  {
    name: 'Analysis & Export',
    features: [
      'correlation_panel',
      'threat_hunts',
      'csv_export',
      'stix_export',
      'bulk_search',
    ],
  },
  {
    name: 'API & Integrations',
    features: [
      'api_access',
      'api_keys',
      'siem_integration',
      'custom_integrations',
    ],
  },
  {
    name: 'Team & Enterprise',
    features: [
      'multiple_profiles',
      'team_sharing',
      'sso_saml',
      'audit_logs',
      'priority_support',
      'dedicated_support',
    ],
  },
]

export default function Pricing() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [showAllFeatures, setShowAllFeatures] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Show cancellation message if redirected from Stripe
  const canceled = searchParams.get('canceled')

  // Fetch user subscription
  useEffect(() => {
    async function loadSubscription() {
      if (!user?.id) {
        setSubscription({ tier: 'free' })
        return
      }
      try {
        const sub = await getUserSubscription(user.id)
        setSubscription(sub)
      } catch (err) {
        console.error('Error loading subscription:', err)
        setSubscription({ tier: 'free' })
      }
    }
    loadSubscription()
  }, [user])

  // Calculate annual pricing (20% discount)
  const getPrice = (tier) => {
    const basePrice = TIER_INFO[tier].price
    if (!basePrice) return null
    if (billingPeriod === 'annual') {
      return Math.round(basePrice * 12 * 0.8) // 20% off
    }
    return basePrice
  }

  const getPriceLabel = (tier) => {
    const price = getPrice(tier)
    if (price === null) return 'Contact us'
    if (price === 0) return 'Free'
    if (billingPeriod === 'annual') {
      return `$${price}/year`
    }
    return `$${price}/mo`
  }

  const handleSubscribe = async (tier) => {
    if (!user) {
      // Redirect to login
      window.location.href = `/login?redirect=/pricing&tier=${tier}`
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create checkout session
      const { sessionId, url } = await createCheckoutSession(
        user.id,
        user.email,
        tier,
        billingPeriod
      )

      // If we have a direct URL, use it (Stripe Checkout)
      if (url) {
        window.location.href = url
      } else if (sessionId) {
        // Otherwise use Stripe.js redirect
        await redirectToCheckout(sessionId)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError(err.message || 'Failed to start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-4">
          Choose Your Plan
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Get the threat intelligence you need. Start free, upgrade when you're ready.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Annual
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Error/Cancel Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-center">
          {error}
        </div>
      )}
      {canceled && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-400 text-center">
          Checkout was canceled. No charges were made.
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {TIERS.map((tier) => {
          const info = TIER_INFO[tier]
          const isPopular = tier === 'professional'
          const isCurrentTier = subscription?.tier === tier

          return (
            <div
              key={tier}
              className={`relative rounded-xl border p-6 ${
                isPopular
                  ? 'border-cyan-500 bg-cyan-500/5'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-cyan-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              {/* Tier Info */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-1">{info.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{info.description}</p>
                <div className="text-3xl font-bold text-white">
                  {getPriceLabel(tier)}
                </div>
                {tier !== 'free' && tier !== 'enterprise' && billingPeriod === 'annual' && (
                  <div className="text-sm text-gray-500 mt-1">
                    ${Math.round(getPrice(tier) / 12)}/mo billed annually
                  </div>
                )}
              </div>

              {/* CTA Button */}
              {tier === 'enterprise' ? (
                <a
                  href="mailto:sales@theintelligence.company?subject=Vigil Enterprise Inquiry"
                  className="block w-full text-center px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                >
                  Contact Sales
                </a>
              ) : tier === 'free' ? (
                <Link
                  to={user ? '/dashboard' : '/login'}
                  className="block w-full text-center px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                >
                  {user ? 'Current Plan' : 'Get Started'}
                </Link>
              ) : isCurrentTier ? (
                <button
                  disabled
                  className="w-full px-4 py-3 rounded-lg font-medium bg-green-600/20 text-green-400 border border-green-500/50 cursor-default"
                >
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={loading}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isPopular
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  {loading ? 'Loading...' : 'Subscribe'}
                </button>
              )}

              {/* Limits */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Users</span>
                    <span className="text-white">
                      {info.limits.users === -1 ? 'Unlimited' : info.limits.users}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Org Profiles</span>
                    <span className="text-white">
                      {info.limits.orgProfiles === -1 ? 'Unlimited' : info.limits.orgProfiles || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">API Requests/mo</span>
                    <span className="text-white">
                      {info.limits.apiRequests === -1
                        ? 'Unlimited'
                        : info.limits.apiRequests
                        ? info.limits.apiRequests.toLocaleString()
                        : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Features */}
              <div className="mt-4">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Key Features
                </h4>
                <ul className="space-y-2">
                  {TIER_FEATURES[tier].slice(0, 5).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300">
                        {FEATURE_DESCRIPTIONS[feature] || feature}
                      </span>
                    </li>
                  ))}
                  {TIER_FEATURES[tier].length > 5 && (
                    <li className="text-xs text-gray-500 pl-6">
                      +{TIER_FEATURES[tier].length - 5} more features
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="cyber-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Feature Comparison</h2>
          <button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            {showAllFeatures ? 'Show Less' : 'Show All Features'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Feature</th>
                {TIERS.map((tier) => (
                  <th key={tier} className="text-center py-3 px-4 text-gray-400 font-medium">
                    {TIER_INFO[tier].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_GROUPS.map((group) => (
                <>
                  <tr key={group.name} className="bg-gray-800/30">
                    <td colSpan={5} className="py-2 px-4 text-sm font-medium text-cyan-400">
                      {group.name}
                    </td>
                  </tr>
                  {group.features
                    .filter((_, i) => showAllFeatures || i < 3)
                    .map((feature) => (
                      <tr key={feature} className="border-b border-gray-800">
                        <td className="py-3 px-4 text-sm text-gray-300">
                          {FEATURE_DESCRIPTIONS[feature] || feature}
                        </td>
                        {TIERS.map((tier) => (
                          <td key={tier} className="text-center py-3 px-4">
                            {canAccess(tier, feature) ? (
                              <svg className="w-5 h-5 text-green-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-white mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="cyber-card p-4">
            <h3 className="text-white font-medium mb-2">Can I upgrade or downgrade anytime?</h3>
            <p className="text-gray-400 text-sm">
              Yes, you can change your plan at any time. Upgrades take effect immediately,
              and downgrades take effect at the end of your billing period.
            </p>
          </div>
          <div className="cyber-card p-4">
            <h3 className="text-white font-medium mb-2">Is there a free trial?</h3>
            <p className="text-gray-400 text-sm">
              The Free tier gives you access to core features forever.
              For Professional and Team features, we offer a 14-day trial.
            </p>
          </div>
          <div className="cyber-card p-4">
            <h3 className="text-white font-medium mb-2">What payment methods do you accept?</h3>
            <p className="text-gray-400 text-sm">
              We accept all major credit cards (Visa, Mastercard, Amex) through Stripe.
              Enterprise customers can pay via invoice.
            </p>
          </div>
          <div className="cyber-card p-4">
            <h3 className="text-white font-medium mb-2">How does the API work?</h3>
            <p className="text-gray-400 text-sm">
              Team and Enterprise plans include API access. You can generate API keys
              in your settings and access our REST API with full documentation.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="text-gray-400 mb-4">
          Questions? Contact us at{' '}
          <a href="mailto:support@theintelligence.company" className="text-cyan-400 hover:underline">
            support@theintelligence.company
          </a>
        </p>
      </div>
    </div>
  )
}
