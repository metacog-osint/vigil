/**
 * CISA joint advisories - activity a government attributed.
 *
 * Every incident Vigil holds comes from a ransomware leak-site tracker, which
 * means it can only record an attack the attacker chose to publish. Sixty
 * actors are attributed to Iran and fifty-nine have no incidents at all; the
 * only one with any is Moses Staff, because Moses Staff posts to leak sites.
 *
 * This feed is the other kind of evidence: CISA, FBI, NSA and partners naming
 * state-affiliated activity against named sectors, in public domain.
 *
 * The work happens in the cisa-advisories Edge Function, as with the other
 * three: one subrequest from here, and the parse where there is CPU for it.
 *
 * Attribution is read from the advisory title only. CISA is precise there and
 * loose in the body - reading both turned "Pro-Russia Hacktivists" into
 * "state-sponsored" on the first run, which is the conflation this project
 * exists to avoid.
 */

export async function ingestCisaAdvisories(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'cisa',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the cisa-advisories function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/cisa-advisories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`cisa-advisories function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('CISA advisory ingestion error:', error.message)
    return { success: false, source: 'cisa', error: error.message }
  }
}
