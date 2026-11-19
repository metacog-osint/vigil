/**
 * HHS Office for Civil Rights breach portal: HIPAA breach reports affecting
 * 500 or more people, both the Under Investigation and Archive lists
 * (migration 192). One subrequest from here; the portal's form posts, the CSV
 * parsing and the writes happen in the hhs-ocr-breaches Edge Function.
 *
 * A US government list published by statute, so there is no licence
 * constraint. HHS's own fields are stored as given; nothing calls a report
 * ransomware.
 */

export async function ingestHhsOcrBreaches(_db, env) {
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_KEY

  if (!url || !key) {
    return {
      success: false,
      source: 'hhs-ocr-breaches',
      error: 'missing SUPABASE_URL or SUPABASE_KEY, cannot reach the hhs-ocr-breaches function',
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/hhs-ocr-breaches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`hhs-ocr-breaches function HTTP ${response.status}: ${body.slice(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    console.error('HHS OCR breach report ingestion error:', error.message)
    return { success: false, source: 'hhs-ocr-breaches', error: error.message }
  }
}
