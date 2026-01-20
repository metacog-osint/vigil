/**
 * Webhooks Module
 * API for managing webhook endpoints and event delivery
 */

import { supabase } from './supabase'

// Available webhook events
export const WEBHOOK_EVENTS = {
  // Incidents
  'incident.created': {
    category: 'incidents',
    name: 'Incident Created',
    description: 'New ransomware incident discovered',
  },
  'incident.updated': {
    category: 'incidents',
    name: 'Incident Updated',
    description: 'Existing incident was updated',
  },

  // Actors
  'actor.created': {
    category: 'actors',
    name: 'Actor Created',
    description: 'New threat actor added',
  },
  'actor.trend_changed': {
    category: 'actors',
    name: 'Actor Trend Changed',
    description: 'Threat actor trend status changed (escalating/declining)',
  },
  'actor.activity_spike': {
    category: 'actors',
    name: 'Actor Activity Spike',
    description: 'Unusual increase in actor activity',
  },

  // Vulnerabilities
  'vulnerability.created': {
    category: 'vulnerabilities',
    name: 'Vulnerability Created',
    description: 'New CVE added',
  },
  'vulnerability.kev_added': {
    category: 'vulnerabilities',
    name: 'KEV Added',
    description: 'CVE added to CISA KEV list',
  },
  'vulnerability.exploited': {
    category: 'vulnerabilities',
    name: 'Vulnerability Exploited',
    description: 'Evidence of active exploitation',
  },

  // IOCs
  'ioc.created': {
    category: 'iocs',
    name: 'IOC Created',
    description: 'New indicator of compromise added',
  },
  'ioc.matched': {
    category: 'iocs',
    name: 'IOC Matched',
    description: 'IOC matched against your assets',
  },

  // Alerts
  'alert.triggered': {
    category: 'alerts',
    name: 'Alert Triggered',
    description: 'Custom alert rule triggered',
  },
  'alert.resolved': {
    category: 'alerts',
    name: 'Alert Resolved',
    description: 'Alert was resolved',
  },

  // Reports
  'report.generated': {
    category: 'reports',
    name: 'Report Generated',
    description: 'Scheduled report was generated',
  },

  // Watchlist
  'watchlist.match': {
    category: 'watchlist',
    name: 'Watchlist Match',
    description: 'New activity on watched item',
  },

  // Assets
  'asset.match': {
    category: 'assets',
    name: 'Asset Match',
    description: 'Your asset matched threat intelligence',
  },
}

// Event categories for grouping
export const EVENT_CATEGORIES = {
  incidents: { label: 'Incidents', icon: 'lock-closed' },
  actors: { label: 'Threat Actors', icon: 'user-group' },
  vulnerabilities: { label: 'Vulnerabilities', icon: 'shield-exclamation' },
  iocs: { label: 'IOCs', icon: 'search' },
  alerts: { label: 'Alerts', icon: 'bell' },
  reports: { label: 'Reports', icon: 'document-text' },
  watchlist: { label: 'Watchlist', icon: 'star' },
  assets: { label: 'Assets', icon: 'server' },
}

// Authentication types
export const AUTH_TYPES = {
  signature: { label: 'HMAC Signature', description: 'Sign payload with shared secret' },
  bearer: { label: 'Bearer Token', description: 'Include Authorization header' },
  basic: { label: 'Basic Auth', description: 'Username/password authentication' },
  none: { label: 'None', description: 'No authentication' },
}

export const webhooks = {
  /**
   * Get all webhooks for a user
   */
  async getAll(userId, teamId = null) {
    let query = supabase.from('webhooks').select('*').eq('user_id', userId)

    if (teamId) {
      query = query.or(`team_id.eq.${teamId}`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Get webhook by ID
   */
  async getById(webhookId) {
    const { data, error } = await supabase.from('webhooks').select('*').eq('id', webhookId).single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Create a new webhook
   */
  async create(userId, webhookData) {
    // Generate secret for signature auth
    const secret = webhookData.authType === 'signature' ? generateSecret() : null

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        user_id: userId,
        team_id: webhookData.teamId,
        name: webhookData.name,
        description: webhookData.description,
        url: webhookData.url,
        secret,
        auth_type: webhookData.authType || 'signature',
        auth_header: webhookData.authHeader,
        events: webhookData.events || [],
        filters: webhookData.filters || {},
        is_enabled: true,
        rate_limit: webhookData.rateLimit || 100,
        max_retries: webhookData.maxRetries || 5,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a webhook
   */
  async update(webhookId, updates) {
    const updateData = {}

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.url !== undefined) updateData.url = updates.url
    if (updates.authType !== undefined) updateData.auth_type = updates.authType
    if (updates.authHeader !== undefined) updateData.auth_header = updates.authHeader
    if (updates.events !== undefined) updateData.events = updates.events
    if (updates.filters !== undefined) updateData.filters = updates.filters
    if (updates.isEnabled !== undefined) updateData.is_enabled = updates.isEnabled
    if (updates.rateLimit !== undefined) updateData.rate_limit = updates.rateLimit
    if (updates.maxRetries !== undefined) updateData.max_retries = updates.maxRetries

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('webhooks')
      .update(updateData)
      .eq('id', webhookId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a webhook
   */
  async delete(webhookId) {
    const { error } = await supabase.from('webhooks').delete().eq('id', webhookId)

    if (error) throw error
  },

  /**
   * Toggle webhook enabled status
   */
  async toggle(webhookId, isEnabled) {
    const { data, error } = await supabase
      .from('webhooks')
      .update({
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId) {
    const secret = generateSecret()

    const { data, error } = await supabase
      .from('webhooks')
      .update({
        secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Test webhook by sending a test event
   * Actually sends an HTTP POST to the webhook URL via server endpoint
   */
  async test(webhookId) {
    const webhook = await this.getById(webhookId)
    if (!webhook) throw new Error('Webhook not found')

    // Determine webhook type for appropriate payload format
    let webhookType = 'generic'
    const url = webhook.url?.toLowerCase() || ''
    if (url.includes('hooks.slack.com') || url.includes('slack')) {
      webhookType = 'slack'
    } else if (url.includes('discord.com/api/webhooks') || url.includes('discord')) {
      webhookType = 'discord'
    } else if (url.includes('webhook.office.com') || url.includes('teams')) {
      webhookType = 'teams'
    }

    // Get session for authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Authentication required to test webhooks')
    }

    // Call the server endpoint to actually send the webhook
    const response = await fetch('/api/webhooks/test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhook.url,
        type: webhookType,
        headers: webhook.auth_header ? { [webhook.auth_header]: webhook.auth_value_encrypted } : {},
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `Test failed: ${response.status}`)
    }

    return response.json()
  },
}

export const webhookDeliveries = {
  /**
   * Get recent deliveries for a webhook
   */
  async getForWebhook(webhookId, limit = 50) {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  /**
   * Get delivery by ID
   */
  async getById(deliveryId) {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Retry a failed delivery
   */
  async retry(deliveryId) {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        next_retry_at: null,
      })
      .eq('id', deliveryId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Get delivery statistics
   */
  async getStats(webhookId, days = 7) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('status, created_at')
      .eq('webhook_id', webhookId)
      .gte('created_at', since.toISOString())

    if (error) throw error

    const stats = {
      total: data?.length || 0,
      success: 0,
      failed: 0,
      pending: 0,
      retrying: 0,
      byDay: {},
    }

    for (const delivery of data || []) {
      stats[delivery.status] = (stats[delivery.status] || 0) + 1

      const day = delivery.created_at.split('T')[0]
      stats.byDay[day] = (stats.byDay[day] || 0) + 1
    }

    return stats
  },
}

// Utility: Generate webhook secret
function generateSecret() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Utility: Build headers for webhook request
function buildHeaders(webhook, payload) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Vigil-Webhook/1.0',
    'X-Vigil-Event': payload.event,
    'X-Vigil-Delivery': crypto.randomUUID(),
    'X-Vigil-Timestamp': new Date().toISOString(),
  }

  switch (webhook.auth_type) {
    case 'signature':
      if (webhook.secret) {
        headers['X-Vigil-Signature'] = computeSignature(payload, webhook.secret)
      }
      break
    case 'bearer':
      if (webhook.auth_value_encrypted) {
        headers['Authorization'] = `Bearer ${webhook.auth_value_encrypted}`
      }
      break
    case 'basic':
      if (webhook.auth_value_encrypted) {
        headers['Authorization'] = `Basic ${webhook.auth_value_encrypted}`
      }
      break
  }

  if (webhook.auth_header && webhook.auth_type !== 'none') {
    headers[webhook.auth_header] = headers['Authorization'] || headers['X-Vigil-Signature']
  }

  return headers
}

// Utility: Compute HMAC signature
async function computeSignature(payload, secret) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)))

  return (
    'sha256=' +
    Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('')
  )
}

// Utility: Get events by category
export function getEventsByCategory() {
  const grouped = {}

  for (const [eventId, event] of Object.entries(WEBHOOK_EVENTS)) {
    const category = event.category
    if (!grouped[category]) {
      grouped[category] = {
        ...EVENT_CATEGORIES[category],
        events: [],
      }
    }
    grouped[category].events.push({
      id: eventId,
      ...event,
    })
  }

  return grouped
}

/**
 * SSRF-safe URL validation for webhooks
 * Blocks internal/private networks to prevent Server-Side Request Forgery
 */
export function validateWebhookUrl(url) {
  try {
    const parsed = new URL(url)

    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' }
    }

    const hostname = parsed.hostname.toLowerCase()

    // Block localhost and loopback
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('127.') ||
      hostname === '::1' ||
      hostname === '[::1]'
    ) {
      return { valid: false, error: 'Localhost URLs are not allowed' }
    }

    // Block internal hostnames
    if (
      hostname === 'internal' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    ) {
      return { valid: false, error: 'Internal hostnames are not allowed' }
    }

    // Block cloud metadata endpoints (AWS, GCP, Azure)
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata.azure.internal' ||
      hostname.endsWith('.metadata.google.internal')
    ) {
      return { valid: false, error: 'Cloud metadata endpoints are not allowed' }
    }

    // Check for IP addresses
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const ipMatch = hostname.match(ipv4Pattern)

    if (ipMatch) {
      const octets = ipMatch.slice(1).map(Number)

      // Block private IP ranges (RFC 1918)
      // 10.0.0.0 - 10.255.255.255
      if (octets[0] === 10) {
        return { valid: false, error: 'Private IP addresses are not allowed' }
      }

      // 172.16.0.0 - 172.31.255.255
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
        return { valid: false, error: 'Private IP addresses are not allowed' }
      }

      // 192.168.0.0 - 192.168.255.255
      if (octets[0] === 192 && octets[1] === 168) {
        return { valid: false, error: 'Private IP addresses are not allowed' }
      }

      // Block loopback (127.0.0.0/8)
      if (octets[0] === 127) {
        return { valid: false, error: 'Loopback addresses are not allowed' }
      }

      // Block link-local (169.254.0.0/16)
      if (octets[0] === 169 && octets[1] === 254) {
        return { valid: false, error: 'Link-local addresses are not allowed' }
      }

      // Block multicast (224.0.0.0 - 239.255.255.255)
      if (octets[0] >= 224 && octets[0] <= 239) {
        return { valid: false, error: 'Multicast addresses are not allowed' }
      }

      // Block broadcast
      if (octets.every((o) => o === 255)) {
        return { valid: false, error: 'Broadcast addresses are not allowed' }
      }
    }

    // Block IPv6 private/internal addresses
    if (hostname.includes(':')) {
      const cleanHostname = hostname.replace(/^\[|\]$/g, '')
      if (
        cleanHostname.startsWith('fc') ||
        cleanHostname.startsWith('fd') ||
        cleanHostname.startsWith('fe80') ||
        cleanHostname === '::1'
      ) {
        return { valid: false, error: 'Private IPv6 addresses are not allowed' }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export default { webhooks, webhookDeliveries }
