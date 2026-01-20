/**
 * Integrations Module
 * Handles external service integrations (Slack, Teams, Jira, etc.)
 */

import { supabase } from './supabase'

/**
 * Integration types and their configurations
 */
export const INTEGRATION_TYPES = {
  slack: {
    name: 'Slack',
    description: 'Send alerts to Slack channels',
    icon: 'slack',
    requiredFields: ['webhook_url'],
    optionalFields: ['channel_name'],
    docsUrl: 'https://api.slack.com/messaging/webhooks',
  },
  teams: {
    name: 'Microsoft Teams',
    description: 'Send alerts to Teams channels',
    icon: 'teams',
    requiredFields: ['webhook_url'],
    optionalFields: ['channel_name'],
    docsUrl:
      'https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
  },
  jira: {
    name: 'Jira',
    description: 'Create tickets from incidents',
    icon: 'jira',
    requiredFields: ['site_url', 'email', 'api_token', 'project_key'],
    optionalFields: ['issue_type', 'priority_mapping'],
    docsUrl:
      'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/',
  },
  servicenow: {
    name: 'ServiceNow',
    description: 'Create incidents in ServiceNow',
    icon: 'servicenow',
    requiredFields: ['instance_url', 'username', 'password'],
    optionalFields: ['assignment_group', 'category'],
    docsUrl:
      'https://docs.servicenow.com/bundle/rome-application-development/page/integrate/inbound-rest/concept/c_RESTAPI.html',
  },
  pagerduty: {
    name: 'PagerDuty',
    description: 'Trigger PagerDuty incidents',
    icon: 'pagerduty',
    requiredFields: ['routing_key'],
    optionalFields: ['service_id'],
    docsUrl: 'https://support.pagerduty.com/docs/services-and-integrations',
  },
  webhook: {
    name: 'Custom Webhook',
    description: 'Send events to a custom endpoint',
    icon: 'webhook',
    requiredFields: ['url'],
    optionalFields: ['secret', 'headers'],
    docsUrl: null,
  },
  splunk: {
    name: 'Splunk',
    description: 'Send data to Splunk HEC',
    icon: 'splunk',
    requiredFields: ['hec_url', 'hec_token'],
    optionalFields: ['index', 'source', 'sourcetype'],
    docsUrl: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector',
  },
  elastic: {
    name: 'Elastic SIEM',
    description: 'Send data to Elasticsearch',
    icon: 'elastic',
    requiredFields: ['elasticsearch_url', 'api_key'],
    optionalFields: ['index_pattern'],
    docsUrl:
      'https://www.elastic.co/guide/en/elasticsearch/reference/current/security-api-create-api-key.html',
  },
  sentinel: {
    name: 'Microsoft Sentinel',
    description: 'Send data to Azure Sentinel',
    icon: 'sentinel',
    requiredFields: ['workspace_id', 'shared_key'],
    optionalFields: ['log_type'],
    docsUrl: 'https://docs.microsoft.com/en-us/azure/azure-monitor/logs/data-collector-api',
  },
}

/**
 * Notification event types
 */
export const NOTIFICATION_EVENTS = {
  critical_incidents: 'Critical severity incidents',
  high_incidents: 'High severity incidents',
  watchlist_updates: 'Watchlist item updates',
  new_kevs: 'New CISA KEV entries',
  actor_escalations: 'Actor status changes to ESCALATING',
}

/**
 * Integrations CRUD operations
 */
export const integrations = {
  /**
   * Get all integrations for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get a specific integration
   */
  async get(userId, integrationType) {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_type', integrationType)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create or update an integration
   */
  async upsert(userId, integrationType, config, notifyOn = null) {
    const payload = {
      user_id: userId,
      integration_type: integrationType,
      config,
      is_connected: true,
      error_message: null,
    }

    if (notifyOn) {
      payload.notify_on = notifyOn
    }

    const { data, error } = await supabase
      .from('user_integrations')
      .upsert(payload, { onConflict: 'user_id,integration_type' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update integration settings
   */
  async update(userId, integrationType, updates) {
    const { data, error } = await supabase
      .from('user_integrations')
      .update(updates)
      .eq('user_id', userId)
      .eq('integration_type', integrationType)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete an integration
   */
  async delete(userId, integrationType) {
    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('integration_type', integrationType)

    if (error) throw error
    return true
  },

  /**
   * Toggle integration enabled state
   */
  async toggle(userId, integrationType, enabled) {
    return this.update(userId, integrationType, { is_enabled: enabled })
  },

  /**
   * Test an integration connection
   */
  async test(integrationType, config) {
    try {
      switch (integrationType) {
        case 'slack':
          return await testSlackWebhook(config.webhook_url)
        case 'teams':
          return await testTeamsWebhook(config.webhook_url)
        case 'jira':
          return await testJiraConnection(config)
        case 'webhook':
          return await testCustomWebhook(config.url)
        default:
          return { success: true, message: 'Configuration saved' }
      }
    } catch (err) {
      return { success: false, message: err.message }
    }
  },

  /**
   * Log integration activity
   */
  async log(integrationId, userId, eventType, eventData, status = 'success', errorMessage = null) {
    const { error } = await supabase.from('integration_logs').insert({
      integration_id: integrationId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
      status,
      error_message: errorMessage,
    })

    if (error) console.error('Error logging integration activity:', error)
  },
}

/**
 * Slack integration
 */
export const slack = {
  /**
   * Send a message to Slack
   */
  async sendMessage(webhookUrl, message) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`)
    }

    return true
  },

  /**
   * Format an incident for Slack
   */
  formatIncident(incident) {
    const severityColors = {
      critical: '#dc2626',
      high: '#f97316',
      medium: '#eab308',
      low: '#22c55e',
    }

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 New Incident: ${incident.victim_name}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Actor:*\n${incident.threat_actor?.name || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Sector:*\n${incident.victim_sector || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Country:*\n${incident.victim_country || 'Unknown'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${incident.status || 'Claimed'}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in Vigil',
              },
              url: `https://vigil.theintelligence.company/ransomware?id=${incident.id}`,
              style: 'primary',
            },
          ],
        },
      ],
      attachments: [
        {
          color: severityColors[incident.severity] || '#6b7280',
          fallback: `New incident: ${incident.victim_name} - ${incident.threat_actor?.name}`,
        },
      ],
    }
  },

  /**
   * Format a KEV alert for Slack
   */
  formatKEV(vuln) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `⚠️ New KEV: ${vuln.cve_id}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: vuln.description?.substring(0, 500) || 'No description available',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*CVSS:*\n${vuln.cvss_score || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Vendor:*\n${vuln.vendor || 'Unknown'}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Details',
              },
              url: `https://vigil.theintelligence.company/vulnerabilities?cve=${vuln.cve_id}`,
              style: 'danger',
            },
          ],
        },
      ],
    }
  },

  /**
   * Format actor escalation alert
   */
  formatActorEscalation(actor) {
    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📈 Actor Escalating: ${actor.name}`,
          },
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
            {
              type: 'mrkdwn',
              text: `*Incidents (7d):*\n${actor.incidents_7d || 0}`,
            },
            {
              type: 'mrkdwn',
              text: `*Target Sectors:*\n${actor.target_sectors?.slice(0, 3).join(', ') || 'Various'}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Actor Profile',
              },
              url: `https://vigil.theintelligence.company/actors?id=${actor.id}`,
              style: 'primary',
            },
          ],
        },
      ],
    }
  },
}

/**
 * Microsoft Teams integration
 */
export const teams = {
  /**
   * Send a message to Teams
   */
  async sendMessage(webhookUrl, card) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    if (!response.ok) {
      throw new Error(`Teams API error: ${response.status}`)
    }

    return true
  },

  /**
   * Format an incident as Teams Adaptive Card
   */
  formatIncident(incident) {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'dc2626',
      summary: `New Incident: ${incident.victim_name}`,
      sections: [
        {
          activityTitle: `🚨 New Incident: ${incident.victim_name}`,
          facts: [
            { name: 'Actor', value: incident.threat_actor?.name || 'Unknown' },
            { name: 'Sector', value: incident.victim_sector || 'Unknown' },
            { name: 'Country', value: incident.victim_country || 'Unknown' },
            { name: 'Status', value: incident.status || 'Claimed' },
          ],
          markdown: true,
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View in Vigil',
          targets: [
            {
              os: 'default',
              uri: `https://vigil.theintelligence.company/ransomware?id=${incident.id}`,
            },
          ],
        },
      ],
    }
  },

  /**
   * Format KEV alert as Teams card
   */
  formatKEV(vuln) {
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
          markdown: true,
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View Details',
          targets: [
            {
              os: 'default',
              uri: `https://vigil.theintelligence.company/vulnerabilities?cve=${vuln.cve_id}`,
            },
          ],
        },
      ],
    }
  },
}

/**
 * Jira integration
 */
export const jira = {
  /**
   * Create a Jira issue
   */
  async createIssue(config, issueData) {
    const auth = btoa(`${config.email}:${config.api_token}`)

    const response = await fetch(`${config.site_url}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: config.project_key },
          summary: issueData.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: issueData.description }],
              },
            ],
          },
          issuetype: { name: config.issue_type || 'Task' },
          priority: issueData.priority ? { name: issueData.priority } : undefined,
          labels: issueData.labels || ['vigil', 'threat-intelligence'],
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.errorMessages?.join(', ') || 'Jira API error')
    }

    return response.json()
  },

  /**
   * Format incident for Jira
   */
  formatIncident(incident) {
    const priorityMap = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    }

    return {
      summary: `[Vigil] Ransomware Incident: ${incident.victim_name}`,
      description: `
Threat Actor: ${incident.threat_actor?.name || 'Unknown'}
Victim: ${incident.victim_name}
Sector: ${incident.victim_sector || 'Unknown'}
Country: ${incident.victim_country || 'Unknown'}
Status: ${incident.status || 'Claimed'}
Discovered: ${incident.discovered_date}

Source: Vigil Threat Intelligence
Link: https://vigil.theintelligence.company/ransomware?id=${incident.id}
      `.trim(),
      priority: priorityMap[incident.severity] || 'Medium',
      labels: ['vigil', 'ransomware', incident.threat_actor?.name?.toLowerCase()].filter(Boolean),
    }
  },
}

/**
 * Custom webhook support
 */
export const webhooks = {
  /**
   * Get all webhooks for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('outbound_webhooks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Create a webhook
   */
  async create(userId, webhook) {
    const { data, error } = await supabase
      .from('outbound_webhooks')
      .insert({
        user_id: userId,
        ...webhook,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a webhook
   */
  async update(webhookId, userId, updates) {
    const { data, error } = await supabase
      .from('outbound_webhooks')
      .update(updates)
      .eq('id', webhookId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a webhook
   */
  async delete(webhookId, userId) {
    const { error } = await supabase
      .from('outbound_webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('user_id', userId)

    if (error) throw error
    return true
  },

  /**
   * Trigger a webhook
   */
  async trigger(webhook, event, data) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Vigil-Event': event,
    }

    // Add HMAC signature if secret is configured
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
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    return {
      success: response.ok,
      status: response.status,
    }
  },
}

/**
 * SIEM export formats
 */
export const siemFormats = {
  /**
   * Format IOCs for Splunk
   */
  splunkIOCs(iocs) {
    return iocs.map((ioc) => ({
      time: new Date(ioc.created_at).getTime() / 1000,
      event: {
        type: 'ioc',
        value: ioc.value,
        ioc_type: ioc.type,
        confidence: ioc.confidence,
        malware_family: ioc.malware_family,
        actor: ioc.threat_actor?.name,
        source: 'vigil',
      },
    }))
  },

  /**
   * Format IOCs for Elastic
   */
  elasticIOCs(iocs) {
    return iocs.map((ioc) => ({
      '@timestamp': ioc.created_at,
      event: { kind: 'enrichment', category: 'threat' },
      threat: {
        indicator: {
          type: ioc.type,
          [ioc.type]: ioc.value,
          confidence: ioc.confidence > 75 ? 'High' : ioc.confidence > 50 ? 'Medium' : 'Low',
          provider: 'vigil',
        },
        software: ioc.malware_family ? { name: ioc.malware_family } : undefined,
      },
    }))
  },

  /**
   * Format for Microsoft Sentinel (Log Analytics)
   */
  sentinelIOCs(iocs) {
    return iocs.map((ioc) => ({
      TimeGenerated: ioc.created_at,
      IndicatorType: ioc.type,
      IndicatorValue: ioc.value,
      Confidence: ioc.confidence,
      ThreatType: ioc.malware_family || 'Unknown',
      SourceSystem: 'Vigil',
      ExpirationDateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))
  },
}

// Test helpers
async function testSlackWebhook(webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '✅ Vigil integration test successful!',
    }),
  })

  if (!response.ok) {
    throw new Error('Invalid webhook URL or Slack returned an error')
  }

  return { success: true, message: 'Test message sent to Slack' }
}

async function testTeamsWebhook(webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: 'Vigil Test',
      sections: [{ activityTitle: '✅ Vigil integration test successful!' }],
    }),
  })

  if (!response.ok) {
    throw new Error('Invalid webhook URL or Teams returned an error')
  }

  return { success: true, message: 'Test message sent to Teams' }
}

async function testJiraConnection(config) {
  const auth = btoa(`${config.email}:${config.api_token}`)

  const response = await fetch(`${config.site_url}/rest/api/3/myself`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Invalid Jira credentials or site URL')
  }

  return { success: true, message: 'Jira connection successful' }
}

async function testCustomWebhook(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Vigil webhook test' },
    }),
  })

  if (!response.ok) {
    throw new Error(`Webhook returned status ${response.status}`)
  }

  return { success: true, message: 'Webhook test successful' }
}

export default {
  INTEGRATION_TYPES,
  NOTIFICATION_EVENTS,
  integrations,
  slack,
  teams,
  jira,
  webhooks,
  siemFormats,
}
