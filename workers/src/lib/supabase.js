/**
 * Lightweight Supabase client for Cloudflare Workers
 * Uses REST API directly with fetch (no npm dependencies)
 *
 * Workers Free allows 50 subrequests per invocation. A run that exceeds it is
 * killed without running its catch block, which is how ingestion failures went
 * unrecorded for months: the feeds spent the whole budget, and the sync_log
 * write at the end of the run was the request that got refused. Pass a budget
 * (createSubrequestBudget) and the client refuses its own calls first, leaving
 * room for the run to record what happened.
 */

/** Thrown when a budgeted client is asked for more subrequests than remain. */
export class SubrequestBudgetError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SubrequestBudgetError'
  }
}

/**
 * @param limit    platform cap per invocation (50 on Workers Free)
 * @param reserve  subrequests held back for logging and the feeds' own fetch()
 *                 calls, which this client cannot see
 */
export function createSubrequestBudget({ limit = 50, reserve = 12 } = {}) {
  let used = 0
  const ceiling = limit - reserve

  return {
    get used() { return used },
    get remaining() { return Math.max(0, ceiling - used) },
    spend() {
      if (used >= ceiling) {
        throw new SubrequestBudgetError(
          `subrequest budget exhausted (${used}/${ceiling}, ${reserve} reserved)`
        )
      }
      used++
    }
  }
}

/**
 * How many rows of an upsert were inserted rather than updated, from the rows
 * PostgREST returns with `select=created_at`.
 *
 * Why this works: `created_at` defaults to now(), which is the transaction's
 * start time, so every row one statement inserts carries the same timestamp,
 * and it is later than any row that already existed. The feeds never send
 * created_at, so an update leaves it alone. The rows inserted are therefore
 * the ones whose created_at equals the newest in the response.
 *
 * The newest is only counted when it is no older than the request, less
 * INSERT_CLOCK_SLACK_MS. Without that, a batch that inserted nothing would
 * count its most recent existing row as new. The slack absorbs clock
 * difference between the worker and the database. It leaves one known
 * overcount: a batch that inserts nothing, but repeats a row another statement
 * inserted within the slack (the same indicator from two feeds in one tick),
 * counts the rows sharing that timestamp. It never undercounts a real insert
 * unless the clocks differ by more than the slack.
 *
 * @param rows       the response body: [{ created_at }, ...]
 * @param sentAtMs   Date.now() taken just before the request
 * @returns          the count, or null when the response has no created_at to read
 */
export const INSERT_CLOCK_SLACK_MS = 10_000

export function countInsertedRows(rows, sentAtMs) {
  if (!Array.isArray(rows)) return null
  if (rows.length === 0) return 0
  const stamps = rows.map((r) => r?.created_at)
  if (stamps.some((s) => typeof s !== 'string')) return null

  let newest = stamps[0]
  let newestMs = Date.parse(newest)
  for (const s of stamps) {
    const ms = Date.parse(s)
    if (ms > newestMs) {
      newest = s
      newestMs = ms
    }
  }
  if (!Number.isFinite(newestMs) || newestMs < sentAtMs - INSERT_CLOCK_SLACK_MS) return 0
  return stamps.filter((s) => Date.parse(s) === newestMs).length
}

export function createSupabaseClient(env, { budget = null } = {}) {
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  }

  // Every call the client makes goes through here so the budget, if there is
  // one, is spent before the subrequest is.
  const request = (url, init) => {
    if (budget) budget.spend()
    return fetch(url, init)
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
        // `query` is an optional PostgREST filter string, e.g. 'name=in.("a","b")'.
        // Pages through results, since PostgREST caps each response (1000 rows by default).
        // `maxRows` stops after that many rows, so a job that wants "the next N" costs
        // one subrequest instead of a page for every row in the table.
        async select(columns = '*', query = '', { maxRows = Infinity } = {}) {
          const pageSize = Math.min(1000, maxRows)
          const rows = []

          for (let offset = 0; ; offset += pageSize) {
            const url =
              `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(columns)}` +
              (query ? `&${query}` : '') +
              `&limit=${pageSize}&offset=${offset}`
            const response = await request(url, {
              headers: { ...baseHeaders, 'Prefer': 'return=representation' }
            })

            if (!response.ok) {
              const error = await response.text()
              console.error(`SELECT ${table} failed:`, error)
              return { data: null, error: { message: error } }
            }

            const page = await response.json()
            rows.push(...page)
            if (page.length < pageSize || rows.length >= maxRows) break
          }

          return { data: rows, error: null }
        },

        // INSERT
        async insert(records) {
          const url = `${supabaseUrl}/rest/v1/${table}`
          const body = Array.isArray(records) ? records : [records]

          const response = await request(url, {
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
        // `countInserted: true` asks for each row's created_at back and returns
        // `inserted`, how many rows were new (see countInsertedRows). Same one
        // subrequest; the response carries a timestamp per row. Only for tables
        // whose created_at defaults to now() and is not in the payload.
        async upsert(records, { onConflict = 'id', ignoreDuplicates = false, countInserted = false } = {}) {
          const body = Array.isArray(records) ? records : [records]

          // PostgREST upsert: POST with Prefer header and on_conflict param
          const resolution = ignoreDuplicates ? 'ignore-duplicates' : 'merge-duplicates'
          const url =
            `${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}` +
            (countInserted ? '&select=created_at' : '')

          const sentAtMs = Date.now()
          const response = await request(url, {
            method: 'POST',
            headers: {
              ...baseHeaders,
              'Prefer': `resolution=${resolution},return=${countInserted ? 'representation' : 'minimal'}`
            },
            body: JSON.stringify(body)
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`UPSERT ${table} failed (${response.status}):`, errorText)
            return { data: null, error: { message: errorText, status: response.status } }
          }

          if (!countInserted) return { data: null, error: null }
          const rows = await response.json().catch(() => null)
          return { data: null, error: null, inserted: countInsertedRows(rows, sentAtMs) }
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

              const response = await request(url, {
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

      const response = await request(url, {
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
