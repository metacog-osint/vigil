/**
 * Subscription Section Component
 */
import { useState } from 'react'
import { getSubscriptionDisplayInfo, createBillingPortalSession } from '../../lib/stripe'

export default function SubscriptionSection({ subscription, userId, onError }) {
  const [isLoading, setIsLoading] = useState(false)
  const displayInfo = getSubscriptionDisplayInfo(subscription)

  const handleManageSubscription = async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const { url } = await createBillingPortalSession(userId)
      window.location.href = url
    } catch (err) {
      onError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold text-white">{displayInfo.tierName}</span>
            <span className={`text-sm capitalize ${displayInfo.statusColor}`}>
              {displayInfo.statusLabel}
            </span>
          </div>
          {displayInfo.renewalInfo && (
            <p className="text-sm text-gray-500 mt-1">{displayInfo.renewalInfo}</p>
          )}
        </div>
        <div className="flex gap-2">
          {subscription?.tier !== 'free' && subscription?.stripe_subscription_id && (
            <button
              onClick={handleManageSubscription}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
          {(subscription?.tier === 'free' || !subscription) && (
            <a
              href="/pricing"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
            >
              Upgrade Plan
            </a>
          )}
        </div>
      </div>

      <TierBenefits tier={subscription?.tier} />
    </div>
  )
}

function TierBenefits({ tier }) {
  const CheckIcon = () => (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-300 mb-2">Your plan includes:</h4>
      <ul className="text-sm text-gray-400 space-y-1">
        {tier === 'enterprise' && (
          <>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Everything in Team, plus:
            </li>
            <li className="flex items-center gap-2 ml-6">SSO/SAML authentication</li>
            <li className="flex items-center gap-2 ml-6">Dedicated support</li>
            <li className="flex items-center gap-2 ml-6">Custom integrations</li>
          </>
        )}
        {tier === 'team' && (
          <>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Everything in Professional, plus:
            </li>
            <li className="flex items-center gap-2 ml-6">REST API access</li>
            <li className="flex items-center gap-2 ml-6">Team collaboration features</li>
            <li className="flex items-center gap-2 ml-6">Custom reports</li>
          </>
        )}
        {tier === 'professional' && (
          <>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Full threat actor database
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Advanced search & filters
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Unlimited watchlists
            </li>
          </>
        )}
        {(!tier || tier === 'free') && (
          <>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Basic threat intelligence
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              Up to 3 watchlists
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon />
              7-day data retention
            </li>
          </>
        )}
      </ul>
    </div>
  )
}
