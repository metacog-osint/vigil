/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles subscription lifecycle events from Stripe
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { buffer } from 'micro'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Disable body parsing for raw body access
export const config = {
  api: {
    bodyParser: false
  }
}

async function logSubscriptionEvent(userId, eventType, previousTier, newTier, stripeEventId, stripeEventType) {
  try {
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: eventType,
      previous_tier: previousTier,
      new_tier: newTier,
      stripe_event_id: stripeEventId,
      stripe_event_type: stripeEventType
    })
  } catch (err) {
    console.error('Error logging subscription event:', err)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    const rawBody = await buffer(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.firebase_uid
        const tier = session.metadata?.tier
        const customerId = session.customer
        const subscriptionId = session.subscription

        if (userId && tier) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)

          // Upsert subscription record
          await supabase
            .from('user_subscriptions')
            .upsert({
              user_id: userId,
              tier,
              status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: subscription.items.data[0]?.price?.id,
              billing_email: session.customer_email,
              billing_period: session.metadata?.billing_period || 'monthly',
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
            }, {
              onConflict: 'user_id'
            })

          await logSubscriptionEvent(userId, 'created', 'free', tier, event.id, event.type)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.firebase_uid

        if (userId) {
          // Get current tier to detect upgrades/downgrades
          const { data: currentSub } = await supabase
            .from('user_subscriptions')
            .select('tier')
            .eq('stripe_subscription_id', subscription.id)
            .single()

          const previousTier = currentSub?.tier
          const newTier = subscription.metadata?.tier || previousTier

          // Update subscription status
          await supabase
            .from('user_subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : subscription.status,
              tier: newTier,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end
            })
            .eq('stripe_subscription_id', subscription.id)

          // Log event type
          let eventType = 'updated'
          if (previousTier !== newTier) {
            const tiers = ['free', 'professional', 'team', 'enterprise']
            eventType = tiers.indexOf(newTier) > tiers.indexOf(previousTier) ? 'upgraded' : 'downgraded'
          } else if (subscription.cancel_at_period_end) {
            eventType = 'canceled'
          }

          await logSubscriptionEvent(userId, eventType, previousTier, newTier, event.id, event.type)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object

        // Update subscription to free tier
        await supabase
          .from('user_subscriptions')
          .update({
            tier: 'free',
            status: 'canceled',
            stripe_subscription_id: null,
            stripe_price_id: null,
            current_period_end: null,
            cancel_at_period_end: false
          })
          .eq('stripe_subscription_id', subscription.id)

        const userId = subscription.metadata?.firebase_uid
        if (userId) {
          await logSubscriptionEvent(userId, 'canceled', subscription.metadata?.tier, 'free', event.id, event.type)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription

        if (subscriptionId) {
          // Update subscription status
          await supabase
            .from('user_subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId)

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId = subscription.metadata?.firebase_uid

          // Get user info for email
          const { data: userSub } = await supabase
            .from('user_subscriptions')
            .select('billing_email, tier')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          // Send payment failure notification email
          if (userSub?.billing_email && process.env.RESEND_API_KEY) {
            try {
              const nextRetry = invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                : null

              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  from: 'Vigil <alerts@vigil.theintelligence.company>',
                  to: userSub.billing_email,
                  subject: 'Action Required: Payment failed for your Vigil subscription',
                  html: `<p>We were unable to process your payment for Vigil ${userSub.tier}. Please <a href="https://vigil.theintelligence.company/settings">update your payment method</a> to avoid service interruption.</p>`,
                  text: `We were unable to process your payment for Vigil ${userSub.tier}. Please update your payment method at https://vigil.theintelligence.company/settings to avoid service interruption.`
                })
              })
            } catch (emailErr) {
              console.error('Failed to send payment failure email:', emailErr)
            }
          }

          if (userId) {
            await logSubscriptionEvent(userId, 'payment_failed', null, null, event.id, event.type)
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription

        if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
          // Subscription renewed
          await supabase
            .from('user_subscriptions')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', subscriptionId)

          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId = subscription.metadata?.firebase_uid
          if (userId) {
            await logSubscriptionEvent(userId, 'renewed', null, null, event.id, event.type)
          }
        }
        break
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
