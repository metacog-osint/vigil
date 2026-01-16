#!/usr/bin/env node

/**
 * Alert Processing Script
 * Processes the alert queue and sends notifications via email, push, and webhooks
 */

import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Configure web-push if VAPID keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:alerts@vigil.theintelligence.company',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
  console.log('Web Push configured with VAPID keys')
}

// Email templates
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@vigil.theintelligence.company'

async function main() {
  console.log('Starting alert processing...')
  console.log(`Time: ${new Date().toISOString()}`)

  try {
    // Get pending alerts from queue
    const { data: alerts, error: fetchError } = await supabase
      .rpc('get_pending_alerts', { p_limit: 50 })

    if (fetchError) {
      console.error('Failed to fetch pending alerts:', fetchError)
      return
    }

    if (!alerts || alerts.length === 0) {
      console.log('No pending alerts to process')
      return
    }

    console.log(`Processing ${alerts.length} alerts...`)

    for (const alert of alerts) {
      console.log(`\nProcessing alert: ${alert.event_type} - ${alert.event_id}`)

      try {
        await processAlert(alert)
        await markAlertComplete(alert.id)
        console.log(`  ✓ Alert processed successfully`)
      } catch (err) {
        console.error(`  ✗ Failed to process alert:`, err.message)
        await markAlertFailed(alert.id, err.message)
      }
    }

    console.log('\nAlert processing complete')

  } catch (err) {
    console.error('Alert processing failed:', err)
    process.exit(1)
  }
}

async function processAlert(alert) {
  const { event_type, event_data } = alert

  // Get users who should receive this alert
  const { data: users, error: usersError } = await supabase
    .rpc('get_users_for_alert', {
      p_event_type: event_type,
      p_event_data: event_data
    })

  if (usersError) {
    throw new Error(`Failed to get users for alert: ${usersError.message}`)
  }

  if (!users || users.length === 0) {
    console.log('  No users to notify for this alert')
    return
  }

  console.log(`  Found ${users.length} users to notify`)

  // Process each user
  for (const user of users) {
    // Skip if in quiet hours (unless critical)
    if (user.in_quiet_hours && alert.priority > 2) {
      console.log(`  Skipping ${user.user_id} (quiet hours)`)
      continue
    }

    // Send email if enabled
    if (user.email_enabled && user.email && RESEND_API_KEY) {
      await sendEmailAlert(user.email, event_type, event_data)
    }

    // Send push notification if enabled
    if (user.push_enabled && VAPID_PRIVATE_KEY) {
      await sendPushAlert(user.user_id, event_type, event_data)
    }

    // Send webhook notifications
    await sendWebhookAlerts(user.user_id, event_type, event_data)

    // Create in-app notification
    await createInAppNotification(user.user_id, event_type, event_data)
  }
}

async function sendEmailAlert(email, eventType, eventData) {
  if (!RESEND_API_KEY) {
    console.log('  Skipping email (no API key)')
    return
  }

  try {
    const { subject, html, text } = generateEmailContent(eventType, eventData)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Vigil Alerts <${FROM_EMAIL}>`,
        to: [email],
        subject,
        html,
        text
      })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || 'Email send failed')
    }

    console.log(`  ✓ Email sent to ${email}`)
  } catch (err) {
    console.error(`  ✗ Email failed for ${email}:`, err.message)
  }
}

async function sendPushAlert(userId, eventType, eventData) {
  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    return
  }

  try {
    // Get user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error || !subscriptions?.length) {
      return
    }

    const payload = JSON.stringify({
      title: getNotificationTitle(eventType, eventData),
      body: getNotificationBody(eventType, eventData),
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `${eventType}-${eventData.id || Date.now()}`,
      data: {
        url: getNotificationUrl(eventType, eventData)
      }
    })

    let successCount = 0
    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }

        await webpush.sendNotification(pushSubscription, payload)
        successCount++

        // Update last_used_at
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)

      } catch (pushError) {
        // Handle expired/invalid subscriptions
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          console.log(`  Removing expired subscription: ${sub.id}`)
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', sub.id)
        } else {
          console.error(`  Push to ${sub.id} failed:`, pushError.message)
        }
      }
    }

    if (successCount > 0) {
      console.log(`  ✓ Push notifications sent to ${successCount} devices`)
    }

  } catch (err) {
    console.error(`  ✗ Push notification failed:`, err.message)
  }
}

async function sendWebhookAlerts(userId, eventType, eventData) {
  try {
    // Get user's active webhooks that match this event type
    const { data: webhooks, error } = await supabase
      .from('alert_webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .contains('event_types', [eventType])

    if (error || !webhooks?.length) {
      return
    }

    for (const webhook of webhooks) {
      try {
        const payload = formatWebhookPayload(webhook.webhook_type, eventType, eventData)

        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (response.ok) {
          console.log(`  ✓ Webhook sent to ${webhook.name}`)

          // Update webhook stats
          await supabase
            .from('alert_webhooks')
            .update({
              last_sent_at: new Date().toISOString(),
              send_count: webhook.send_count + 1
            })
            .eq('id', webhook.id)
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (err) {
        console.error(`  ✗ Webhook ${webhook.name} failed:`, err.message)

        // Update error count
        await supabase
          .from('alert_webhooks')
          .update({
            error_count: webhook.error_count + 1,
            last_error: err.message
          })
          .eq('id', webhook.id)
      }
    }
  } catch (err) {
    console.error(`  ✗ Webhook processing failed:`, err.message)
  }
}

async function createInAppNotification(userId, eventType, eventData) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        notification_type: mapEventTypeToNotificationType(eventType),
        title: getNotificationTitle(eventType, eventData),
        message: getNotificationBody(eventType, eventData),
        severity: getSeverity(eventType, eventData),
        link: getNotificationUrl(eventType, eventData),
        related_id: eventData.id || eventData.cve_id || eventData.alert_id,
        related_type: eventType
      })

    if (error) {
      throw error
    }
  } catch (err) {
    console.error(`  ✗ In-app notification failed:`, err.message)
  }
}

// Helper functions
function generateEmailContent(eventType, eventData) {
  switch (eventType) {
    case 'ransomware':
      return generateRansomwareEmail(eventData)
    case 'kev':
      return generateKEVEmail(eventData)
    case 'cisa_alert':
      return generateCISAEmail(eventData)
    default:
      return generateGenericEmail(eventType, eventData)
  }
}

function generateRansomwareEmail(data) {
  const subject = `Ransomware Alert: ${data.victim_name} claimed by ${data.threat_actor || 'unknown actor'}`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 16px; text-align: center;">
        <h1 style="margin: 0; font-size: 18px;">Ransomware Incident Alert</h1>
      </div>
      <div style="padding: 24px; background: #1a1a1a; color: #e5e5e5;">
        <p style="color: #888; margin: 0 0 8px 0;">NEW VICTIM CLAIM</p>
        <h2 style="margin: 0 0 8px 0; color: white;">${escapeHtml(data.victim_name)}</h2>
        <p style="color: #888; margin: 0 0 16px 0;">
          Claimed by <strong style="color: #00ff9d;">${escapeHtml(data.threat_actor || 'Unknown')}</strong>
        </p>
        <table style="width: 100%; background: #222; border-radius: 4px;">
          <tr><td style="padding: 8px; color: #888;">Sector</td><td style="padding: 8px; color: #e5e5e5;">${escapeHtml(data.sector || 'Unknown')}</td></tr>
          <tr><td style="padding: 8px; color: #888;">Country</td><td style="padding: 8px; color: #e5e5e5;">${escapeHtml(data.country || 'Unknown')}</td></tr>
          <tr><td style="padding: 8px; color: #888;">Discovered</td><td style="padding: 8px; color: #e5e5e5;">${data.discovered_date || 'Unknown'}</td></tr>
        </table>
        <a href="https://vigil.theintelligence.company/ransomware" style="display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin-top: 16px; font-weight: bold;">
          View in Vigil
        </a>
      </div>
    </div>
  `

  const text = `RANSOMWARE ALERT\n\nVictim: ${data.victim_name}\nThreat Actor: ${data.threat_actor || 'Unknown'}\nSector: ${data.sector || 'Unknown'}\nCountry: ${data.country || 'Unknown'}\n\nView: https://vigil.theintelligence.company/ransomware`

  return { subject, html, text }
}

function generateKEVEmail(data) {
  const subject = `KEV Alert: ${data.cve_id} added to Known Exploited Vulnerabilities`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f97316; color: white; padding: 16px; text-align: center;">
        <h1 style="margin: 0; font-size: 18px;">CISA KEV Alert</h1>
      </div>
      <div style="padding: 24px; background: #1a1a1a; color: #e5e5e5;">
        <p style="color: #f97316; margin: 0 0 8px 0; font-weight: bold;">ACTIVELY EXPLOITED</p>
        <h2 style="margin: 0 0 8px 0; color: #f97316;">${escapeHtml(data.cve_id)}</h2>
        <p style="color: #e5e5e5; margin: 0 0 16px 0;">${escapeHtml(data.title || '')}</p>
        <div style="background: #7f1d1d; border: 1px solid #dc2626; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
          <p style="color: #fca5a5; margin: 0;">This vulnerability is being actively exploited in the wild.</p>
        </div>
        <table style="width: 100%; background: #222; border-radius: 4px;">
          <tr><td style="padding: 8px; color: #888;">Vendor</td><td style="padding: 8px; color: #e5e5e5;">${escapeHtml(data.vendor || 'Unknown')}</td></tr>
          <tr><td style="padding: 8px; color: #888;">Product</td><td style="padding: 8px; color: #e5e5e5;">${escapeHtml(data.product || 'Unknown')}</td></tr>
          <tr><td style="padding: 8px; color: #888;">CVSS</td><td style="padding: 8px; color: #e5e5e5;">${data.cvss_score || 'N/A'}</td></tr>
        </table>
        <a href="https://vigil.theintelligence.company/vulnerabilities?kev=true" style="display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin-top: 16px; font-weight: bold;">
          View in Vigil
        </a>
      </div>
    </div>
  `

  const text = `KEV ALERT\n\n${data.cve_id}\n${data.title || ''}\n\nVendor: ${data.vendor || 'Unknown'}\nProduct: ${data.product || 'Unknown'}\nCVSS: ${data.cvss_score || 'N/A'}\n\nThis vulnerability is being actively exploited.\n\nView: https://vigil.theintelligence.company/vulnerabilities?kev=true`

  return { subject, html, text }
}

function generateCISAEmail(data) {
  const subject = `CISA Alert: ${data.title}`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #3b82f6; color: white; padding: 16px; text-align: center;">
        <h1 style="margin: 0; font-size: 18px;">CISA Security Alert</h1>
      </div>
      <div style="padding: 24px; background: #1a1a1a; color: #e5e5e5;">
        <p style="color: #888; margin: 0 0 8px 0;">${escapeHtml(data.alert_id || '')}</p>
        <h2 style="margin: 0 0 16px 0; color: white;">${escapeHtml(data.title)}</h2>
        <table style="width: 100%; background: #222; border-radius: 4px;">
          <tr><td style="padding: 8px; color: #888;">Severity</td><td style="padding: 8px; color: #e5e5e5;">${escapeHtml(data.severity || 'Not specified')}</td></tr>
          <tr><td style="padding: 8px; color: #888;">Published</td><td style="padding: 8px; color: #e5e5e5;">${data.published_date || 'Unknown'}</td></tr>
        </table>
        <a href="https://vigil.theintelligence.company/alerts" style="display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 4px; text-decoration: none; margin-top: 16px; font-weight: bold;">
          View in Vigil
        </a>
      </div>
    </div>
  `

  const text = `CISA ALERT\n\n${data.title}\n\nSeverity: ${data.severity || 'Not specified'}\nPublished: ${data.published_date || 'Unknown'}\n\nView: https://vigil.theintelligence.company/alerts`

  return { subject, html, text }
}

function generateGenericEmail(eventType, data) {
  return {
    subject: `Vigil Alert: ${eventType}`,
    html: `<p>New ${eventType} event detected. Check Vigil for details.</p>`,
    text: `New ${eventType} event detected. Check Vigil for details.`
  }
}

function formatWebhookPayload(webhookType, eventType, eventData) {
  switch (webhookType) {
    case 'slack':
      return formatSlackPayload(eventType, eventData)
    case 'discord':
      return formatDiscordPayload(eventType, eventData)
    case 'teams':
      return formatTeamsPayload(eventType, eventData)
    default:
      return { event_type: eventType, data: eventData, timestamp: new Date().toISOString() }
  }
}

function formatSlackPayload(eventType, data) {
  const color = {
    ransomware: '#dc2626',
    kev: '#f97316',
    cisa_alert: '#3b82f6'
  }[eventType] || '#6b7280'

  return {
    attachments: [{
      color,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: getNotificationTitle(eventType, data)
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: getNotificationBody(eventType, data)
          }
        },
        {
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: 'View in Vigil' },
            url: getNotificationUrl(eventType, data)
          }]
        }
      ]
    }]
  }
}

function formatDiscordPayload(eventType, data) {
  const color = {
    ransomware: 0xdc2626,
    kev: 0xf97316,
    cisa_alert: 0x3b82f6
  }[eventType] || 0x6b7280

  return {
    embeds: [{
      title: getNotificationTitle(eventType, data),
      description: getNotificationBody(eventType, data),
      color,
      url: getNotificationUrl(eventType, data),
      timestamp: new Date().toISOString(),
      footer: { text: 'Vigil - Cyber Threat Intelligence' }
    }]
  }
}

function formatTeamsPayload(eventType, data) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: {
      ransomware: 'dc2626',
      kev: 'f97316',
      cisa_alert: '3b82f6'
    }[eventType] || '6b7280',
    summary: getNotificationTitle(eventType, data),
    sections: [{
      activityTitle: getNotificationTitle(eventType, data),
      text: getNotificationBody(eventType, data)
    }],
    potentialAction: [{
      '@type': 'OpenUri',
      name: 'View in Vigil',
      targets: [{ os: 'default', uri: getNotificationUrl(eventType, data) }]
    }]
  }
}

function getNotificationTitle(eventType, data) {
  switch (eventType) {
    case 'ransomware':
      return `Ransomware: ${data.victim_name}`
    case 'kev':
      return `KEV: ${data.cve_id}`
    case 'cisa_alert':
      return `CISA Alert: ${data.title?.substring(0, 50) || 'New Advisory'}`
    default:
      return `Alert: ${eventType}`
  }
}

function getNotificationBody(eventType, data) {
  switch (eventType) {
    case 'ransomware':
      return `${data.victim_name} claimed by ${data.threat_actor || 'unknown actor'}. Sector: ${data.sector || 'Unknown'}`
    case 'kev':
      return `${data.cve_id} added to CISA KEV. ${data.vendor || ''} ${data.product || ''}. CVSS: ${data.cvss_score || 'N/A'}`
    case 'cisa_alert':
      return data.title || 'New CISA security advisory'
    default:
      return `New ${eventType} event detected`
  }
}

function getNotificationUrl(eventType, data) {
  switch (eventType) {
    case 'ransomware':
      return 'https://vigil.theintelligence.company/ransomware'
    case 'kev':
      return 'https://vigil.theintelligence.company/vulnerabilities?kev=true'
    case 'cisa_alert':
      return 'https://vigil.theintelligence.company/alerts'
    default:
      return 'https://vigil.theintelligence.company'
  }
}

function getSeverity(eventType, data) {
  switch (eventType) {
    case 'ransomware':
      return 'high'
    case 'kev':
      return data.cvss_score >= 9 ? 'critical' : 'high'
    case 'cisa_alert':
      return data.severity?.toLowerCase() || 'medium'
    default:
      return 'info'
  }
}

function mapEventTypeToNotificationType(eventType) {
  const mapping = {
    ransomware: 'sector_incident',
    kev: 'kev_added',
    cisa_alert: 'system'
  }
  return mapping[eventType] || 'system'
}

async function markAlertComplete(alertId) {
  await supabase.rpc('complete_alert', { p_alert_id: alertId })
}

async function markAlertFailed(alertId, error) {
  await supabase.rpc('fail_alert', { p_alert_id: alertId, p_error: error })
}

function escapeHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Run
main().catch(console.error)
