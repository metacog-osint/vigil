/**
 * Vendor threat research - eight feeds, and the questions they raise.
 *
 * Unlike the government advisories, nothing here is parsed for attribution.
 * Measured across 279 titles from these same eight feeds, zero carried an
 * attribution a parser could read, and every title that named a nationality
 * named a victim or a language. So this stores what was published, proposes
 * links to actors Vigil already knows, and queues the rest for a person.
 *
 * Every one of these sources is the vendor's copyright. Vigil stores the
 * title, the URL and a short RSS summary - never the article body - and all
 * eight are registered in source_licences as not sellable, because nobody has
 * read their terms against this use.
 *
 * Six hourly. These are blogs: a handful of posts a week between them, and the
 * Edge Function fetches all eight in one invocation.
 */

export async function ingestVendorResearch(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'vendor-research',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the vendor-research function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/vendor-research`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`vendor-research function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Vendor research ingestion error:', error.message)
    return { success: false, source: 'vendor-research', error: error.message }
  }
}
