/**
 * Chat Integrations Module
 * API for managing Slack/Teams bot integrations
 */

import { supabase } from './supabase'

// Platform configurations
export const PLATFORMS = {
  slack: {
    name: 'Slack',
    icon: 'slack',
    color: '#4A154B',
    oauthUrl: 'https://slack.com/oauth/v2/authorize',
    scopes: [
      'commands',
      'chat:write',
      'chat:write.public',
      'users:read',
      'channels:read',
    ],
  },
  teams: {
    name: 'Microsoft Teams',
    icon: 'teams',
    color: '#6264A7',
    oauthUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: [
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Team.ReadBasic.All',
    ],
  },
  discord: {
    name: 'Discord',
    icon: 'discord',
    color: '#5865F2',
    oauthUrl: 'https://discord.com/api/oauth2/authorize',
    scopes: ['bot', 'applications.commands'],
  },
}

// Command definitions
export const COMMANDS = {
  search: {
    name: 'search',
    description: 'Search for IOCs, actors, or vulnerabilities',
    usage: '/vigil search <query>',
    examples: ['/vigil search 192.168.1.1', '/vigil search LockBit', '/vigil search CVE-2024-1234'],
  },
  actor: {
    name: 'actor',
    description: 'Get threat actor summary and recent activity',
    usage: '/vigil actor <name>',
    examples: ['/vigil actor LockBit', '/vigil actor APT29'],
  },
  alerts: {
    name: 'alerts',
    description: 'List recent alerts for your watchlists',
    usage: '/vigil alerts [count]',
    examples: ['/vigil alerts', '/vigil alerts 10'],
  },
  stats: {
    name: 'stats',
    description: 'Get current threat landscape statistics',
    usage: '/vigil stats',
    examples: ['/vigil stats'],
  },
  subscribe: {
    name: 'subscribe',
    description: 'Subscribe this channel to alert notifications',
    usage: '/vigil subscribe <type>',
    examples: ['/vigil subscribe alerts', '/vigil subscribe digest'],
  },
  unsubscribe: {
    name: 'unsubscribe',
    description: 'Unsubscribe this channel from notifications',
    usage: '/vigil unsubscribe <type>',
    examples: ['/vigil unsubscribe alerts'],
  },
  help: {
    name: 'help',
    description: 'Show available commands and usage',
    usage: '/vigil help',
    examples: ['/vigil help'],
  },
}

export const chatIntegrations = {
  /**
   * Get all integrations for a user
   */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get integration by ID
   */
  async getById(integrationId) {
    const { data, error } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get integration by platform and workspace
   */
  async getByWorkspace(userId, platform, workspaceId) {
    const { data, error } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('workspace_id', workspaceId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create or update integration from OAuth callback
   */
  async createFromOAuth(userId, platform, oauthData) {
    const { data, error } = await supabase
      .from('chat_integrations')
      .upsert({
        user_id: userId,
        platform,
        workspace_id: oauthData.workspaceId,
        workspace_name: oauthData.workspaceName,
        access_token: oauthData.accessToken,
        refresh_token: oauthData.refreshToken,
        token_expires_at: oauthData.expiresAt,
        bot_user_id: oauthData.botUserId,
        bot_access_token: oauthData.botAccessToken,
        scopes: oauthData.scopes,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform,workspace_id',
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update integration
   */
  async update(integrationId, updates) {
    const { data, error } = await supabase
      .from('chat_integrations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Set default channel
   */
  async setDefaultChannel(integrationId, channelId, channelName) {
    return this.update(integrationId, {
      default_channel_id: channelId,
      default_channel_name: channelName,
    })
  },

  /**
   * Disconnect integration
   */
  async disconnect(integrationId) {
    const { error } = await supabase
      .from('chat_integrations')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        bot_access_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId)

    if (error) throw error
  },

  /**
   * Delete integration completely
   */
  async delete(integrationId) {
    const { error } = await supabase
      .from('chat_integrations')
      .delete()
      .eq('id', integrationId)

    if (error) throw error
  },

  /**
   * Get integration statistics
   */
  async getStats(integrationId) {
    const { data, error } = await supabase
      .from('v_chat_integration_stats')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },
}

export const channelSubscriptions = {
  /**
   * Get subscriptions for an integration
   */
  async getForIntegration(integrationId) {
    const { data, error } = await supabase
      .from('chat_channel_subscriptions')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get subscription by channel
   */
  async getByChannel(integrationId, channelId, subscriptionType) {
    const { data, error } = await supabase
      .from('chat_channel_subscriptions')
      .select('*')
      .eq('integration_id', integrationId)
      .eq('channel_id', channelId)
      .eq('subscription_type', subscriptionType)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create subscription
   */
  async create(integrationId, subscriptionData) {
    const { data, error } = await supabase
      .from('chat_channel_subscriptions')
      .insert({
        integration_id: integrationId,
        channel_id: subscriptionData.channelId,
        channel_name: subscriptionData.channelName,
        subscription_type: subscriptionData.type,
        alert_severities: subscriptionData.severities || ['critical', 'high'],
        alert_types: subscriptionData.alertTypes || ['incident', 'vulnerability', 'ioc'],
        sectors: subscriptionData.sectors || [],
        actors: subscriptionData.actors || [],
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update subscription
   */
  async update(subscriptionId, updates) {
    const { data, error } = await supabase
      .from('chat_channel_subscriptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Toggle subscription active state
   */
  async toggle(subscriptionId, isActive) {
    return this.update(subscriptionId, { is_active: isActive })
  },

  /**
   * Delete subscription
   */
  async delete(subscriptionId) {
    const { error } = await supabase
      .from('chat_channel_subscriptions')
      .delete()
      .eq('id', subscriptionId)

    if (error) throw error
  },
}

export const commandLogs = {
  /**
   * Get recent commands for integration
   */
  async getRecent(integrationId, limit = 50) {
    const { data, error } = await supabase
      .from('chat_command_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('executed_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get command statistics
   */
  async getStats(integrationId, days = 7) {
    const { data, error } = await supabase
      .from('chat_command_logs')
      .select('command, response_status')
      .eq('integration_id', integrationId)
      .gte('executed_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())

    if (error) throw error

    const stats = {
      total: data?.length || 0,
      byCommand: {},
      successRate: 0,
    }

    let successCount = 0
    for (const log of data || []) {
      stats.byCommand[log.command] = (stats.byCommand[log.command] || 0) + 1
      if (log.response_status === 'success') successCount++
    }

    stats.successRate = stats.total > 0 ? Math.round((successCount / stats.total) * 100) : 100

    return stats
  },
}

export const messageQueue = {
  /**
   * Queue a message for sending
   */
  async enqueue(integrationId, channelId, messageType, payload, subscriptionId = null) {
    const { data, error } = await supabase
      .from('chat_message_queue')
      .insert({
        integration_id: integrationId,
        subscription_id: subscriptionId,
        channel_id: channelId,
        message_type: messageType,
        payload,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get pending messages
   */
  async getPending(limit = 100) {
    const { data, error } = await supabase
      .from('chat_message_queue')
      .select('*, chat_integrations(*)')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Mark message as sent
   */
  async markSent(messageId) {
    const { error } = await supabase
      .from('chat_message_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', messageId)

    if (error) throw error
  },

  /**
   * Mark message as failed
   */
  async markFailed(messageId, errorMessage) {
    const { data, error } = await supabase
      .from('chat_message_queue')
      .select('retry_count, max_retries')
      .eq('id', messageId)
      .single()

    if (error) throw error

    const newStatus = data.retry_count >= data.max_retries ? 'failed' : 'pending'

    await supabase
      .from('chat_message_queue')
      .update({
        status: newStatus,
        retry_count: data.retry_count + 1,
        last_error: errorMessage,
        scheduled_at: newStatus === 'pending'
          ? new Date(Date.now() + Math.pow(2, data.retry_count) * 60000).toISOString()
          : undefined,
      })
      .eq('id', messageId)
  },
}

// Helper: Generate OAuth URL
export function getOAuthUrl(platform, redirectUri, state) {
  const config = PLATFORMS[platform]
  if (!config) throw new Error(`Unknown platform: ${platform}`)

  const params = new URLSearchParams({
    client_id: import.meta.env[`VITE_${platform.toUpperCase()}_CLIENT_ID`] || '',
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state,
    response_type: 'code',
  })

  return `${config.oauthUrl}?${params.toString()}`
}

// Helper: Format Slack Block Kit message
export function formatSlackMessage(type, data) {
  switch (type) {
    case 'search_results':
      return {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `Search Results: ${data.query}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Found *${data.results.length}* results`,
            },
          },
          ...data.results.slice(0, 5).map((result) => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${result.type}*: ${result.value}\n${result.context || ''}`,
            },
            accessory: {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View',
              },
              url: result.url,
              action_id: `view_${result.id}`,
            },
          })),
        ],
      }

    case 'actor_summary':
      return {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `Threat Actor: ${data.name}`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Status*\n${data.trend_status || 'Unknown'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Incidents (7d)*\n${data.incidents_7d || 0}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: data.description || 'No description available.',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View Full Profile',
                },
                url: data.profileUrl,
                style: 'primary',
              },
            ],
          },
        ],
      }

    case 'alert':
      return {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `Alert: ${data.title}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Severity*\n:${data.severity === 'critical' ? 'red_circle' : data.severity === 'high' ? 'large_orange_circle' : 'large_yellow_circle'}: ${data.severity.toUpperCase()}`,
              },
              {
                type: 'mrkdwn',
                text: `*Type*\n${data.type}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: data.description,
            },
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
                url: data.url,
              },
            ],
          },
        ],
      }

    case 'help':
      return {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Vigil Commands',
            },
          },
          ...Object.values(COMMANDS).map((cmd) => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${cmd.usage}*\n${cmd.description}`,
            },
          })),
        ],
      }

    default:
      return { text: JSON.stringify(data) }
  }
}

// Helper: Format Teams Adaptive Card
export function formatTeamsCard(type, data) {
  const card = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [],
    actions: [],
  }

  switch (type) {
    case 'search_results':
      card.body = [
        {
          type: 'TextBlock',
          text: `Search Results: ${data.query}`,
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'TextBlock',
          text: `Found ${data.results.length} results`,
          isSubtle: true,
        },
        ...data.results.slice(0, 5).map((result) => ({
          type: 'ColumnSet',
          columns: [
            {
              type: 'Column',
              width: 'stretch',
              items: [
                {
                  type: 'TextBlock',
                  text: result.value,
                  weight: 'bolder',
                },
                {
                  type: 'TextBlock',
                  text: result.context || '',
                  isSubtle: true,
                  wrap: true,
                },
              ],
            },
          ],
        })),
      ]
      break

    case 'alert':
      card.body = [
        {
          type: 'TextBlock',
          text: data.title,
          weight: 'bolder',
          size: 'large',
          color: data.severity === 'critical' ? 'attention' : 'warning',
        },
        {
          type: 'ColumnSet',
          columns: [
            {
              type: 'Column',
              items: [
                { type: 'TextBlock', text: 'Severity', weight: 'bolder' },
                { type: 'TextBlock', text: data.severity.toUpperCase() },
              ],
            },
            {
              type: 'Column',
              items: [
                { type: 'TextBlock', text: 'Type', weight: 'bolder' },
                { type: 'TextBlock', text: data.type },
              ],
            },
          ],
        },
        {
          type: 'TextBlock',
          text: data.description,
          wrap: true,
        },
      ]
      card.actions = [
        {
          type: 'Action.OpenUrl',
          title: 'View in Vigil',
          url: data.url,
        },
      ]
      break

    default:
      card.body = [{ type: 'TextBlock', text: JSON.stringify(data) }]
  }

  return { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] }
}

export default {
  chatIntegrations,
  channelSubscriptions,
  commandLogs,
  messageQueue,
  PLATFORMS,
  COMMANDS,
}
