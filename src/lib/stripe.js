/**
 * Stripe Integration Module
 * Handles subscription checkout, management, and webhook processing
 *
 * Environment variables required:
 * - VITE_STRIPE_PUBLISHABLE_KEY: Public key for frontend
 * - STRIPE_SECRET_KEY: Secret key for server-side (in scripts)
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret
 */

import { supabase } from './supabase'
import { TIER_INFO } from './features'

// Stripe price IDs (configure in Stripe Dashboard)
export const STRIPE_PRICES = {
  professional: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || 'price_professional_monthly',
    annual: import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL || 'price_professional_annual',
  },
  team: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY || 'price_team_monthly',
    annual: import.meta.env.VITE_STRIPE_PRICE_TEAM_ANNUAL || 'price_team_annual',
  },
}

// App URL for redirects
const APP_URL = import.meta.env.VITE_APP_URL || 'https://vigil.theintelligence.company'

/**
 * Load Stripe.js dynamically
 */
let stripePromise = null
export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn('Stripe publishable key not configured')
      return null
    }
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) => loadStripe(key))
  }
  return stripePromise
}

/**
 * Create a checkout session for subscription
 * @param {string} userId - Firebase user ID
 * @param {string} userEmail - User's email
 * @param {string} tier - Subscription tier (professional, team)
 * @param {string} billingPeriod - 'monthly' or 'annual'
 */
export async function createCheckoutSession(userId, userEmail, tier, billingPeriod = 'monthly') {
  if (!STRIPE_PRICES[tier]) {
    throw new Error(`Invalid tier: ${tier}`)
  }

  const priceId = STRIPE_PRICES[tier][billingPeriod]
  if (!priceId) {
    throw new Error(`Price not configured for ${tier} ${billingPeriod}`)
  }

  // Call our API endpoint to create the session
  const response = await fetch('/api/stripe/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      userEmail,
      priceId,
      tier,
      billingPeriod,
      successUrl: `${APP_URL}/settings?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancelUrl: `${APP_URL}/pricing?canceled=true`,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create checkout session')
  }

  return response.json()
}

/**
 * Redirect to Stripe checkout
 * @param {string} sessionId - Checkout session ID
 */
export async function redirectToCheckout(sessionId) {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe not initialized')
  }

  const { error } = await stripe.redirectToCheckout({ sessionId })
  if (error) {
    throw error
  }
}

/**
 * Create a billing portal session for subscription management
 * @param {string} userId - Firebase user ID
 */
export async function createBillingPortalSession(userId) {
  const response = await fetch('/api/stripe/create-portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      returnUrl: `${APP_URL}/settings`,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create portal session')
  }

  return response.json()
}

/**
 * Get user's subscription status from database
 * @param {string} userId - Firebase user ID
 */
export async function getUserSubscription(userId) {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Gracefully handle missing table (404/406) or no rows (PGRST116)
    if (error) {
      // Table doesn't exist or access denied - return free tier
      if (error.message?.includes('does not exist') ||
          error.code === '42P01' ||  // PostgreSQL: undefined_table
          error.code === 'PGRST204' ||  // PostgREST: no rows
          error.code === 'PGRST116' ||  // PostgREST: single row expected
          String(error.code) === '406' ||
          String(error.code) === '404') {
        return {
          tier: 'free',
          status: 'active',
          billingPeriod: null,
          currentPeriodEnd: null,
        }
      }
      console.error('Error fetching subscription:', error)
    }

    return (
      data || {
        tier: 'free',
        status: 'active',
        billingPeriod: null,
        currentPeriodEnd: null,
      }
    )
  } catch (err) {
    // Network errors or other issues - return free tier
    console.error('Subscription fetch failed:', err)
    return {
      tier: 'free',
      status: 'active',
      billingPeriod: null,
      currentPeriodEnd: null,
    }
  }
}

/**
 * Check if user's subscription is active
 * @param {object} subscription - Subscription object
 */
export function isSubscriptionActive(subscription) {
  if (!subscription) return false
  return ['active', 'trialing'].includes(subscription.status)
}

/**
 * Get subscription display info
 * @param {object} subscription - Subscription object
 */
export function getSubscriptionDisplayInfo(subscription) {
  if (!subscription || subscription.tier === 'free') {
    return {
      tierName: 'Free',
      statusLabel: 'Active',
      statusColor: 'text-green-400',
      renewalInfo: null,
    }
  }

  const tierInfo = TIER_INFO[subscription.tier]
  const statusColors = {
    active: 'text-green-400',
    trialing: 'text-blue-400',
    past_due: 'text-yellow-400',
    canceled: 'text-red-400',
  }

  let renewalInfo = null
  if (subscription.current_period_end) {
    const endDate = new Date(subscription.current_period_end)
    if (subscription.cancel_at_period_end) {
      renewalInfo = `Cancels on ${endDate.toLocaleDateString()}`
    } else {
      renewalInfo = `Renews on ${endDate.toLocaleDateString()}`
    }
  }

  return {
    tierName: tierInfo?.name || subscription.tier,
    statusLabel: subscription.status.replace('_', ' '),
    statusColor: statusColors[subscription.status] || 'text-gray-400',
    renewalInfo,
  }
}

/**
 * Format price for display
 * @param {string} tier - Subscription tier
 * @param {string} billingPeriod - 'monthly' or 'annual'
 */
export function formatPrice(tier, billingPeriod = 'monthly') {
  const tierInfo = TIER_INFO[tier]
  if (!tierInfo || !tierInfo.price) return 'Contact us'

  if (billingPeriod === 'annual') {
    const annualPrice = Math.round(tierInfo.price * 12 * 0.8) // 20% discount
    return `$${annualPrice}/year`
  }

  return `$${tierInfo.price}/month`
}

export default {
  STRIPE_PRICES,
  getStripe,
  createCheckoutSession,
  redirectToCheckout,
  createBillingPortalSession,
  getUserSubscription,
  isSubscriptionActive,
  getSubscriptionDisplayInfo,
  formatPrice,
}
