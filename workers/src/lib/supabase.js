/**
 * Lightweight Supabase client for Cloudflare Workers
 * Uses REST API directly with fetch (no npm dependencies)
 */

export function createSupabaseClient(env) {
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }

  const baseHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  }

  return {
    from(table) {
      return {
        // SELECT query
        async select(columns = '*') {
          const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(columns)}`
          const response = await fetch(url, {
            headers: { ...baseHeaders, 'Prefer': 'return=representation' }
          })

          if (!response.ok) {
            const error = await response.text()
            console.error(`SELECT ${table} failed:`, error)
            return { data: null, error: { message: error } }
          }

          const data = await response.json()
          return { data, error: null }
        },

        // INSERT
        async insert(records) {
          const url = `${supabaseUrl}/rest/v1/${table}`
          const body = Array.isArray(records) ? records : [records]

          const response = await fetch(url, {
            method: 'POST',
            headers: { ...baseHeaders, 'Prefer': 'return=minimal' },
            body: JSON.stringify(body)
          })

          if (!response.ok) {
            const error = await response.text()
            console.error(`INSERT ${table} failed:`, error)
            return { data: null, error: { message: error } }
          }

          return { data: null, error: null }
        },

        // UPSERT - using PostgREST syntax
        async upsert(records, { onConflict = 'id', ignoreDuplicates = false } = {}) {
          const body = Array.isArray(records) ? records : [records]

          // PostgREST upsert: POST with Prefer header and on_conflict param
          const resolution = ignoreDuplicates ? 'ignore-duplicates' : 'merge-duplicates'
          const url = `${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              ...baseHeaders,
              'Prefer': `resolution=${resolution},return=minimal`
            },
            body: JSON.stringify(body)
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`UPSERT ${table} failed (${response.status}):`, errorText)
            return { data: null, error: { message: errorText, status: response.status } }
          }

          return { data: null, error: null }
        },

        // UPDATE with filters
        update(record) {
          const state = {
            _record: record,
            _filters: [],
            _table: table,
            _supabaseUrl: supabaseUrl,
            _headers: baseHeaders
          }

          return {
            eq(column, value) {
              state._filters.push(`${column}=eq.${encodeURIComponent(value)}`)
              return this
            },

            in(column, values) {
              state._filters.push(`${column}=in.(${values.map(v => encodeURIComponent(v)).join(',')})`)
              return this
            },

            async execute() {
              const filterString = state._filters.join('&')
              const url = `${state._supabaseUrl}/rest/v1/${state._table}?${filterString}`

              const response = await fetch(url, {
                method: 'PATCH',
                headers: { ...state._headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify(state._record)
              })

              if (!response.ok) {
                const error = await response.text()
                console.error(`UPDATE ${state._table} failed:`, error)
                return { data: null, error: { message: error } }
              }

              return { data: null, error: null }
            },

            // Make it thenable for await compatibility
            then(resolve, reject) {
              this.execute().then(resolve, reject)
            }
          }
        }
      }
    },

    // RPC calls
    async rpc(functionName, params = {}) {
      const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...baseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`RPC ${functionName} failed:`, error)
        return { data: null, error: { message: error } }
      }

      try {
        const data = await response.json()
        return { data, error: null }
      } catch {
        return { data: null, error: null }
      }
    }
  }
}
