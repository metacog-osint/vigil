/**
 * Supabase Client Configuration
 * Centralized client initialization for the Vigil application
 */

import { createClient } from '@supabase/supabase-js'

// Environment configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

/**
 * Subscribe to real-time changes on a table
 * @param {string} table - Table name to subscribe to
 * @param {function} callback - Callback function for changes
 * @param {string|null} filter - Optional filter string
 * @returns {function} Unsubscribe function
 */
export function subscribeToTable(table, callback, filter = null) {
  let channel = supabase.channel(`${table}-changes`)

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: table,
      ...(filter && { filter }),
    },
    (payload) => callback(payload)
  )

  channel.subscribe()

  return () => {
    channel.unsubscribe()
  }
}

export default supabase
