/**
 * Real-Time Alerts System
 * Manages push subscriptions, webhooks, and alert preferences
 */

import { supabase } from './supabase'

// VAPID public key for Web Push (generate with: npx web-push generate-vapid-keys)
// This should be set in environment variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported')
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  // Register service worker if not already
  const registration = await navigator.serviceWorker.ready

  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  // Save subscription to database
  const subscriptionData = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys.p256dh,
      auth: subscriptionData.keys.auth,
      user_agent: navigator.userAgent,
      device_name: getDeviceName(),
      is_active: true,
      last_used_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,endpoint',
    }
  )

  if (error) throw error

  return subscription
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    await subscription.unsubscribe()

    // Mark as inactive in database
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)
  }
}

/**
 * Check if user is subscribed to push
 */
export async function isPushSubscribed() {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}

/**
 * Get user's push subscriptions
 */
export async function getPushSubscriptions(userId) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(subscriptionId) {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('id', subscriptionId)

  if (error) throw error
}

// ============================================
// Webhook Management
// ============================================

/**
 * Get user's webhooks
 */
export async function getWebhooks(userId) {
  const { data, error } = await supabase
    .from('alert_webhooks')
    .select(
      'id, user_id, name, webhook_type, webhook_url, is_active, event_types, severity_min, settings, last_sent_at, send_count, error_count, last_error, created_at, updated_at, secret, hmac_header'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Create a webhook
 */
export async function createWebhook(userId, webhook) {
  const { data, error } = await supabase
    .from('alert_webhooks')
    .insert({
      user_id: userId,
      name: webhook.name,
      webhook_type: webhook.type,
      webhook_url: webhook.url,
      event_types: webhook.eventTypes || ['ransomware', 'kev', 'cisa_alert'],
      severity_min: webhook.severityMin || 'medium',
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a webhook
 */
export async function updateWebhook(webhookId, updates) {
  const { data, error } = await supabase
    .from('alert_webhooks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId) {
  const { error } = await supabase.from('alert_webhooks').delete().eq('id', webhookId)

  if (error) throw error
}

/**
 * Test a webhook
 */
export async function testWebhook(webhookId) {
  // This would call an edge function to send a test message
  const { data, error } = await supabase.functions.invoke('test-webhook', {
    body: { webhookId },
  })

  if (error) throw error
  return data
}

/**
 * Regenerate webhook secret (for generic webhooks)
 */
export async function regenerateWebhookSecret(webhookId) {
  // Generate a new secret client-side
  const newSecret = generateSecret(64)

  const { data, error } = await supabase
    .from('alert_webhooks')
    .update({
      secret: newSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId)
    .select('secret')
    .single()

  if (error) throw error
  return data?.secret
}

/**
 * Generate a random secret string
 */
function generateSecret(length = 64) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  const randomValues = new Uint32Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}

// ============================================
// Alert Preferences
// ============================================

/**
 * Get alert preferences
 */
export async function getAlertPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select(
      `
      push_enabled,
      push_ransomware,
      push_kev,
      push_cisa_alerts,
      push_watchlist,
      push_vendor_cve,
      email_alerts,
      email_instant_alerts,
      digest_frequency,
      digest_time,
      quiet_hours_enabled,
      quiet_hours_start,
      quiet_hours_end,
      timezone,
      severity_threshold
    `
    )
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  // Return defaults if no preferences exist
  return (
    data || {
      push_enabled: true,
      push_ransomware: true,
      push_kev: true,
      push_cisa_alerts: true,
      push_watchlist: true,
      push_vendor_cve: true,
      email_alerts: true,
      email_instant_alerts: false,
      digest_frequency: 'daily',
      digest_time: '08:00',
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      timezone: 'UTC',
      severity_threshold: 'low',
    }
  )
}

/**
 * Update alert preferences
 */
export async function updateAlertPreferences(userId, preferences) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// Alert History
// ============================================

/**
 * Get alert history
 */
export async function getAlertHistory(userId, options = {}) {
  const { limit = 50, offset = 0, channel = null, status = null } = options

  let query = supabase
    .from('alert_deliveries')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('queued_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (channel) {
    query = query.eq('channel', channel)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: data || [], count }
}

// ============================================
// Notifications
// ============================================

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * Get all notifications
 */
export async function getNotifications(userId, options = {}) {
  const { limit = 50, offset = 0, unreadOnly = false } = options

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { data: data || [], count }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
  const { error } = await supabase.rpc('mark_notification_read', {
    notification_id: notificationId,
  })

  if (error) throw error
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId) {
  const { data, error } = await supabase.rpc('mark_all_notifications_read', { p_user_id: userId })

  if (error) throw error
  return data
}

/**
 * Get notification count
 */
export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) throw error
  return count || 0
}

/**
 * Subscribe to real-time notifications
 */
export function subscribeToNotifications(userId, callback) {
  const subscription = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Get device name from user agent
 */
function getDeviceName() {
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Unknown Device'
}

/**
 * Format webhook type for display
 */
export function formatWebhookType(type) {
  const types = {
    slack: 'Slack',
    discord: 'Discord',
    teams: 'Microsoft Teams',
    generic: 'Custom Webhook',
  }
  return types[type] || type
}

/**
 * Get webhook icon
 */
export function getWebhookIcon(type) {
  const icons = {
    slack: '#E01E5A',
    discord: '#5865F2',
    teams: '#6264A7',
    generic: '#6B7280',
  }
  return icons[type] || '#6B7280'
}

/**
 * Validate webhook URL
 */
export function validateWebhookUrl(type, url) {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS' }
    }

    switch (type) {
      case 'slack':
        if (!url.includes('hooks.slack.com')) {
          return { valid: false, error: 'Must be a Slack webhook URL' }
        }
        break
      case 'discord':
        if (!url.includes('discord.com/api/webhooks')) {
          return { valid: false, error: 'Must be a Discord webhook URL' }
        }
        break
      case 'teams':
        if (!url.includes('webhook.office.com')) {
          return { valid: false, error: 'Must be a Microsoft Teams webhook URL' }
        }
        break
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

export default {
  // Push notifications
  isPushSupported,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  getPushSubscriptions,
  removePushSubscription,
  // Webhooks
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  regenerateWebhookSecret,
  // Preferences
  getAlertPreferences,
  updateAlertPreferences,
  // History
  getAlertHistory,
  // Notifications
  getUnreadNotifications,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  subscribeToNotifications,
  // Utilities
  formatWebhookType,
  getWebhookIcon,
  validateWebhookUrl,
}
