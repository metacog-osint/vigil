/**
 * Notifications Module
 * In-app user notifications
 */

import { supabase } from './client'

export const notifications = {
  // Get notifications for a user
  async getForUser(userId = 'anonymous', options = {}) {
    const { limit = 20, unreadOnly = false, includeExpired = false } = options

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    if (!includeExpired) {
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    }

    return query
  },

  // Get unread count
  async getUnreadCount(userId = 'anonymous') {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    return { count: count || 0, error }
  },

  // Mark a notification as read
  async markAsRead(notificationId) {
    return supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null)
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId = 'anonymous') {
    return supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
  },

  // Create a notification
  async create(notification) {
    const {
      userId = 'anonymous',
      type,
      title,
      message,
      severity = 'info',
      link = null,
      relatedId = null,
      relatedType = null,
    } = notification

    return supabase.from('notifications').insert({
      user_id: userId,
      notification_type: type,
      title,
      message,
      severity,
      link,
      related_id: relatedId,
      related_type: relatedType,
    })
  },

  // Delete old notifications (cleanup)
  async deleteExpired() {
    return supabase.from('notifications').delete().lt('expires_at', new Date().toISOString())
  },

  // Subscribe to new notifications for a user
  subscribeToUser(userId, callback) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe()

    return () => channel.unsubscribe()
  },
}

export default notifications
