#!/usr/bin/env node
/**
 * Dunning Email Processor
 *
 * Processes subscriptions with failed payments and sends
 * escalating reminder emails based on grace period.
 *
 * Grace Period: 14 days
 * Email Schedule:
 *   - Day 0: Payment failure email (sent by webhook)
 *   - Day 3: First reminder
 *   - Day 7: Urgent reminder
 *   - Day 10: Final notice
 *   - Day 14: Subscription canceled
 *
 * Run daily via cron: 0 9 * * * (9 AM UTC)
 */

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const GRACE_PERIOD_DAYS = 14

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeKey = process.env.STRIPE_SECRET_KEY
const resendKey = process.env.RESEND_API_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const stripe = stripeKey ? new Stripe(stripeKey) : null

/**
 * Send email via Resend API
 */
async function sendEmail({ to, subject, html, text }) {
  if (!resendKey) {
    console.log(`[DRY RUN] Would send email to ${to}: ${subject}`)
    return { success: true, dryRun: true }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Vigil <alerts@vigil.theintelligence.company>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Failed to send email')
    return { success: true, id: data.id }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Generate dunning email based on days overdue
 */
function generateDunningEmail({ user_name, email, tier, days_overdue, grace_period_end }) {
  const urgencyLevel = days_overdue >= 10 ? 'critical' : days_overdue >= 7 ? 'high' : 'medium'
  const urgencyColor = urgencyLevel === 'critical' ? '#dc2626' : urgencyLevel === 'high' ? '#f97316' : '#f59e0b'
  const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - days_overdue)

  const subject = urgencyLevel === 'critical'
    ? `FINAL NOTICE: Your Vigil subscription will be suspended`
    : urgencyLevel === 'high'
    ? `Urgent: Your Vigil payment is ${days_overdue} days overdue`
    : `Reminder: Update your Vigil payment method`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}cc 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .badge { display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .countdown { background: #1a1a1a; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center; }
    .countdown-number { font-size: 48px; font-weight: 700; color: ${urgencyColor}; }
    .countdown-label { font-size: 14px; color: #888; }
    .warning { background: #7f1d1d; border: 1px solid #dc2626; border-radius: 6px; padding: 12px; margin: 16px 0; color: #fca5a5; }
    .cta { display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #0a0a0a; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Payment Reminder</h1></div>
    <div class="content">
      <span class="badge">${urgencyLevel === 'critical' ? 'FINAL NOTICE' : urgencyLevel === 'high' ? 'URGENT' : 'REMINDER'}</span>
      <p>Hi${user_name ? ` ${user_name}` : ''},</p>
      <p>Your Vigil ${tier || 'Professional'} subscription payment is ${days_overdue} days overdue.</p>

      <div class="countdown">
        <div class="countdown-number">${daysRemaining}</div>
        <div class="countdown-label">days until service suspension</div>
      </div>

      <div class="warning">
        ${urgencyLevel === 'critical'
          ? '<strong>FINAL NOTICE:</strong> Your access will be suspended if payment is not received within 24-48 hours.'
          : '<strong>Important:</strong> Please update your payment method to avoid losing access to Vigil.'}
      </div>

      <a href="https://vigil.theintelligence.company/settings" class="cta">Update Payment Method</a>
    </div>
    <div class="footer"><p>Questions? Contact support@theintelligence.company</p></div>
  </div>
</body>
</html>`

  const text = `
${urgencyLevel === 'critical' ? 'FINAL NOTICE' : 'PAYMENT REMINDER'}

Hi${user_name ? ` ${user_name}` : ''},

Your Vigil ${tier || 'Professional'} subscription payment is ${days_overdue} days overdue.

Days until service suspension: ${daysRemaining}

${urgencyLevel === 'critical'
  ? 'FINAL NOTICE: Your access will be suspended if payment is not received within 24-48 hours.'
  : 'Please update your payment method to avoid losing access to Vigil.'}

Update Payment: https://vigil.theintelligence.company/settings

---
Vigil - Cyber Threat Intelligence
`

  return { subject, html, text }
}

/**
 * Main dunning processor
 */
async function processDunning() {
  console.log(`[${new Date().toISOString()}] Starting dunning processor...`)

  // Get all past_due subscriptions
  const { data: pastDueSubscriptions, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('status', 'past_due')

  if (error) {
    console.error('Failed to fetch past_due subscriptions:', error)
    return
  }

  console.log(`Found ${pastDueSubscriptions?.length || 0} past_due subscriptions`)

  const stats = {
    processed: 0,
    emails_sent: 0,
    canceled: 0,
    errors: 0
  }

  for (const sub of pastDueSubscriptions || []) {
    try {
      // Calculate days since payment failure
      // We use the last failed payment event from subscription_events
      const { data: failedEvent } = await supabase
        .from('subscription_events')
        .select('created_at')
        .eq('user_id', sub.user_id)
        .eq('event_type', 'payment_failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const failedDate = failedEvent?.created_at ? new Date(failedEvent.created_at) : new Date(sub.updated_at)
      const daysOverdue = Math.floor((Date.now() - failedDate.getTime()) / (1000 * 60 * 60 * 24))

      console.log(`Processing ${sub.billing_email}: ${daysOverdue} days overdue`)

      // Check if we should cancel (past grace period)
      if (daysOverdue >= GRACE_PERIOD_DAYS) {
        console.log(`Canceling subscription for ${sub.billing_email} (${daysOverdue} days overdue)`)

        // Cancel in Stripe if we have access
        if (stripe && sub.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id)
          } catch (e) {
            console.error(`Failed to cancel Stripe subscription: ${e.message}`)
          }
        }

        // Update local status
        await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            tier: 'free',
            stripe_subscription_id: null,
            stripe_price_id: null
          })
          .eq('user_id', sub.user_id)

        // Log event
        await supabase.from('subscription_events').insert({
          user_id: sub.user_id,
          event_type: 'canceled',
          previous_tier: sub.tier,
          new_tier: 'free',
          metadata: { reason: 'grace_period_expired', days_overdue: daysOverdue }
        })

        // Send cancellation email
        const cancelEmail = {
          subject: 'Your Vigil subscription has been canceled',
          html: `<p>Hi, your Vigil ${sub.tier} subscription has been canceled due to non-payment after ${GRACE_PERIOD_DAYS} days. You've been moved to the Free plan. <a href="https://vigil.theintelligence.company/settings">Reactivate</a></p>`,
          text: `Your Vigil subscription has been canceled due to non-payment. Visit https://vigil.theintelligence.company/settings to reactivate.`
        }
        await sendEmail({ to: sub.billing_email, ...cancelEmail })

        stats.canceled++
        stats.processed++
        continue
      }

      // Determine if we should send a reminder
      // Send on days: 3, 7, 10
      const shouldSendReminder = [3, 7, 10].includes(daysOverdue)

      // Check if we already sent a reminder today
      const { data: recentReminder } = await supabase
        .from('subscription_events')
        .select('created_at')
        .eq('user_id', sub.user_id)
        .eq('event_type', 'dunning_reminder')
        .gte('created_at', new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()) // Last 23 hours
        .limit(1)

      if (shouldSendReminder && !recentReminder?.length) {
        const graceEnd = new Date(failedDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
        const email = generateDunningEmail({
          user_name: sub.billing_email?.split('@')[0],
          email: sub.billing_email,
          tier: sub.tier,
          days_overdue: daysOverdue,
          grace_period_end: graceEnd.toISOString()
        })

        const result = await sendEmail({ to: sub.billing_email, ...email })

        if (result.success) {
          // Log the reminder
          await supabase.from('subscription_events').insert({
            user_id: sub.user_id,
            event_type: 'dunning_reminder',
            metadata: { days_overdue: daysOverdue, email_sent: true }
          })
          stats.emails_sent++
        }
      }

      stats.processed++
    } catch (err) {
      console.error(`Error processing ${sub.billing_email}:`, err)
      stats.errors++
    }
  }

  console.log(`Dunning complete:`, stats)
  return stats
}

// Run the processor
processDunning()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
