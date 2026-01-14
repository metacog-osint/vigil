#!/usr/bin/env node
/**
 * Send Integration Notifications
 * Sends alerts to configured integrations (Slack, Teams, Jira, webhooks)
 *
 * Usage:
 *   node scripts/send-integration-notifications.mjs --type=incident --id=<uuid>
 *   node scripts/send-integration-notifications.mjs --type=kev --id=<uuid>
 *   node scripts/send-integration-notifications.mjs --type=actor --id=<uuid>
 */

import './env.mjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=')
  acc[key] = value
  return acc
}, {})

/**
 * Send Slack notification
 */
async function sendSlackNotification(webhookUrl, message) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
  return response.ok
}

/**
 * Send Teams notification
 */
async function sendTeamsNotification(webhookUrl, card) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  })
  return response.ok
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(webhook, event, data) {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Vigil-Event': event,
  }

  // Add HMAC signature if secret configured
  if (webhook.secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhook.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(payload))
    )
    headers['X-Vigil-Signature'] = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const response = await fetch(webhook.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  return response.ok
}

/**
 * Format incident for Slack
 */
function formatIncidentSlack(incident) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 New Ransomware Incident: ${incident.victim_name}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Actor:*\n${incident.threat_actor?.name || 'Unknown'}` },
          { type: 'mrkdwn', text: `*Sector:*\n${incident.victim_sector || 'Unknown'}` },
          { type: 'mrkdwn', text: `*Country:*\n${incident.victim_country || 'Unknown'}` },
          { type: 'mrkdwn', text: `*Status:*\n${incident.status || 'Claimed'}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in Vigil' },
            url: `https://vigil.theintelligence.company/ransomware?id=${incident.id}`,
            style: 'primary',
          },
        ],
      },
    ],
  }
}

/**
 * Format incident for Teams
 */
function formatIncidentTeams(incident) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: 'dc2626',
    summary: `New Incident: ${incident.victim_name}`,
    sections: [
      {
        activityTitle: `🚨 New Ransomware Incident: ${incident.victim_name}`,
        facts: [
          { name: 'Actor', value: incident.threat_actor?.name || 'Unknown' },
          { name: 'Sector', value: incident.victim_sector || 'Unknown' },
          { name: 'Country', value: incident.victim_country || 'Unknown' },
          { name: 'Status', value: incident.status || 'Claimed' },
        ],
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'View in Vigil',
        targets: [{ os: 'default', uri: `https://vigil.theintelligence.company/ransomware?id=${incident.id}` }],
      },
    ],
  }
}

/**
 * Format KEV for Slack
 */
function formatKEVSlack(vuln) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `⚠️ New KEV: ${vuln.cve_id}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: vuln.description?.substring(0, 500) || 'No description' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*CVSS:*\n${vuln.cvss_score || 'N/A'}` },
          { type: 'mrkdwn', text: `*Vendor:*\n${vuln.vendor || 'Unknown'}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Details' },
            url: `https://vigil.theintelligence.company/vulnerabilities?cve=${vuln.cve_id}`,
            style: 'danger',
          },
        ],
      },
    ],
  }
}

/**
 * Format KEV for Teams
 */
function formatKEVTeams(vuln) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: 'f97316',
    summary: `New KEV: ${vuln.cve_id}`,
    sections: [
      {
        activityTitle: `⚠️ New KEV: ${vuln.cve_id}`,
        activitySubtitle: vuln.description?.substring(0, 200) || '',
        facts: [
          { name: 'CVSS', value: String(vuln.cvss_score || 'N/A') },
          { name: 'Vendor', value: vuln.vendor || 'Unknown' },
        ],
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'View Details',
        targets: [{ os: 'default', uri: `https://vigil.theintelligence.company/vulnerabilities?cve=${vuln.cve_id}` }],
      },
    ],
  }
}

/**
 * Format actor escalation for Slack
 */
function formatActorSlack(actor) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📈 Actor Escalating: ${actor.name}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${actor.name}* has changed status to *ESCALATING*\nIncident velocity: ${actor.incident_velocity?.toFixed(1) || 'N/A'} per day`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Incidents (7d):*\n${actor.incidents_7d || 0}` },
          { type: 'mrkdwn', text: `*Targets:*\n${actor.target_sectors?.slice(0, 3).join(', ') || 'Various'}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Actor' },
            url: `https://vigil.theintelligence.company/actors?id=${actor.id}`,
            style: 'primary',
          },
        ],
      },
    ],
  }
}

/**
 * Format actor escalation for Teams
 */
function formatActorTeams(actor) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '22c55e',
    summary: `Actor Escalating: ${actor.name}`,
    sections: [
      {
        activityTitle: `📈 Actor Escalating: ${actor.name}`,
        facts: [
          { name: 'Status', value: 'ESCALATING' },
          { name: 'Velocity', value: `${actor.incident_velocity?.toFixed(1) || 'N/A'} incidents/day` },
          { name: 'Incidents (7d)', value: String(actor.incidents_7d || 0) },
        ],
      },
    ],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'View Actor',
        targets: [{ os: 'default', uri: `https://vigil.theintelligence.company/actors?id=${actor.id}` }],
      },
    ],
  }
}

/**
 * Log notification result
 */
async function logNotification(integrationId, userId, eventType, status, errorMessage = null) {
  await supabase.from('integration_logs').insert({
    integration_id: integrationId,
    user_id: userId,
    event_type: eventType,
    event_data: { type: args.type, id: args.id },
    status,
    error_message: errorMessage,
  })
}

/**
 * Main function
 */
async function main() {
  if (!args.type || !args.id) {
    console.error('Usage: node send-integration-notifications.mjs --type=<incident|kev|actor> --id=<uuid>')
    process.exit(1)
  }

  // Map event type to notification type
  const notificationTypeMap = {
    incident: 'critical_incidents',
    kev: 'new_kevs',
    actor: 'actor_escalations',
  }

  const notificationType = notificationTypeMap[args.type]
  if (!notificationType) {
    console.error('Invalid type. Use: incident, kev, actor')
    process.exit(1)
  }

  // Fetch the data
  let data
  if (args.type === 'incident') {
    const { data: incident } = await supabase
      .from('incidents')
      .select('*, threat_actor:threat_actors(id, name)')
      .eq('id', args.id)
      .single()
    data = incident
  } else if (args.type === 'kev') {
    const { data: vuln } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('id', args.id)
      .single()
    data = vuln
  } else if (args.type === 'actor') {
    const { data: actor } = await supabase
      .from('threat_actors')
      .select('*')
      .eq('id', args.id)
      .single()
    data = actor
  }

  if (!data) {
    console.error(`${args.type} not found: ${args.id}`)
    process.exit(1)
  }

  console.log(`Sending ${args.type} notification for: ${data.victim_name || data.cve_id || data.name}`)

  // Get all integrations that should receive this notification
  const { data: integrationsData } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('is_enabled', true)
    .eq('is_connected', true)

  if (!integrationsData || integrationsData.length === 0) {
    console.log('No configured integrations found')
    return
  }

  // Filter integrations by notification type preference
  const targetIntegrations = integrationsData.filter(
    i => i.notify_on && i.notify_on[notificationType]
  )

  console.log(`Found ${targetIntegrations.length} integrations to notify`)

  // Send notifications
  for (const integration of targetIntegrations) {
    try {
      let success = false

      if (integration.integration_type === 'slack') {
        const webhookUrl = integration.config?.webhook_url
        if (webhookUrl) {
          let message
          if (args.type === 'incident') message = formatIncidentSlack(data)
          else if (args.type === 'kev') message = formatKEVSlack(data)
          else if (args.type === 'actor') message = formatActorSlack(data)

          success = await sendSlackNotification(webhookUrl, message)
        }
      } else if (integration.integration_type === 'teams') {
        const webhookUrl = integration.config?.webhook_url
        if (webhookUrl) {
          let card
          if (args.type === 'incident') card = formatIncidentTeams(data)
          else if (args.type === 'kev') card = formatKEVTeams(data)
          else if (args.type === 'actor') card = formatActorTeams(data)

          success = await sendTeamsNotification(webhookUrl, card)
        }
      }

      if (success) {
        console.log(`✓ Sent to ${integration.integration_type} for user ${integration.user_id}`)
        await logNotification(integration.id, integration.user_id, 'notification_sent', 'success')
      } else {
        console.log(`✗ Failed to send to ${integration.integration_type}`)
        await logNotification(integration.id, integration.user_id, 'notification_sent', 'failed', 'Send failed')
      }
    } catch (error) {
      console.error(`Error sending to ${integration.integration_type}:`, error.message)
      await logNotification(integration.id, integration.user_id, 'notification_sent', 'failed', error.message)
    }
  }

  // Also send to webhooks
  const { data: webhooksData } = await supabase
    .from('outbound_webhooks')
    .select('*')
    .eq('is_enabled', true)
    .contains('events', [`${args.type}.new`])

  if (webhooksData && webhooksData.length > 0) {
    console.log(`Found ${webhooksData.length} webhooks to trigger`)

    for (const webhook of webhooksData) {
      try {
        const success = await sendWebhookNotification(webhook, `${args.type}.new`, data)
        if (success) {
          console.log(`✓ Triggered webhook: ${webhook.name}`)
          await supabase
            .from('outbound_webhooks')
            .update({ last_triggered_at: new Date().toISOString(), failure_count: 0 })
            .eq('id', webhook.id)
        } else {
          console.log(`✗ Webhook failed: ${webhook.name}`)
          await supabase
            .from('outbound_webhooks')
            .update({ failure_count: (webhook.failure_count || 0) + 1 })
            .eq('id', webhook.id)
        }
      } catch (error) {
        console.error(`Error triggering webhook ${webhook.name}:`, error.message)
      }
    }
  }

  console.log('Done!')
}

main().catch(console.error)
