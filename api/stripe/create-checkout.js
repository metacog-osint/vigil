/**
 * Stripe Checkout Session Creation
 * POST /api/stripe/create-checkout
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, userEmail, priceId, tier, billingPeriod, successUrl, cancelUrl } = req.body

    if (!userId || !userEmail || !priceId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if user already has a Stripe customer
    const { data: existingSub } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    let customerId = existingSub?.stripe_customer_id

    // Create or retrieve customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebase_uid: userId
        }
      })
      customerId = customer.id
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        firebase_uid: userId,
        tier,
        billing_period: billingPeriod
      },
      subscription_data: {
        metadata: {
          firebase_uid: userId,
          tier
        }
      },
      allow_promotion_codes: true
    })

    return res.status(200).json({
      sessionId: session.id,
      url: session.url
    })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message })
  }
}
