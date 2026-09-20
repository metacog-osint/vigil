/**
 * Landing Module
 *
 * The public landing page shows the live database rather than a scripted sample.
 * Everything here is readable by an anonymous visitor under the public-read
 * policies, and each section fails independently: a section that cannot load
 * renders nothing rather than falling back to invented figures.
 */

import { supabase } from './client'
import { dashboard } from './dashboard'

/** Best-effort: a failed section returns empty instead of taking the page down. */
async function rows(query) {
  try {
    const { data, error } = await query
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export const landing = {
  async getSnapshot() {
    const [stats, escalating, incidents, kev] = await Promise.all([
      dashboard.getOverview().catch(() => null),

      // Groups escalating right now, busiest first. Defunct groups are excluded:
      // a seized operation should never headline a live threat feed.
      rows(
        supabase
          .from('threat_actors')
          .select('id, name, actor_type, trend_status, incidents_7d, target_sectors')
          .eq('trend_status', 'ESCALATING')
          .eq('status', 'active')
          .order('incidents_7d', { ascending: false })
          .limit(5)
      ),

      rows(
        supabase
          .from('incidents')
          .select(
            'id, victim_name, victim_sector, victim_country, discovered_date, threat_actor:threat_actors(name)'
          )
          .order('discovered_date', { ascending: false })
          .limit(5)
      ),

      // KEV entries carry a description but no product column, so the label is
      // taken from the description's opening clause rather than invented.
      rows(
        supabase
          .from('vulnerabilities')
          .select(
            'cve_id, kev_date, epss_score, cvss_score, ransomware_use, ransomware_campaign_use, description'
          )
          .not('kev_date', 'is', null)
          .order('kev_date', { ascending: false })
          .limit(4)
      ),
    ])

    return {
      stats,
      escalating,
      incidents: incidents.map((i) => ({
        id: i.id,
        victim: i.victim_name,
        actor: i.threat_actor?.name || null,
        sector: i.victim_sector,
        country: i.victim_country,
        date: i.discovered_date,
      })),
      kev: kev.map((v) => ({
        cve: v.cve_id,
        subject: subjectOf(v.description),
        epss: v.epss_score,
        cvss: v.cvss_score,
        ransomware: Boolean(v.ransomware_use || v.ransomware_campaign_use),
        added: v.kev_date,
      })),
    }
  },
}

/**
 * CISA writes KEV descriptions as "<product> contains a <flaw>", so the words
 * before "contains" name the affected product. Falls back to a trimmed opening.
 */
function subjectOf(description) {
  if (!description) return null
  const [before] = description.split(/\s+contains?\s+/i)
  const subject = (before || description).trim()
  if (!subject || subject.length > 60) return subject.slice(0, 57).trimEnd() + '…'
  return subject
}

export default landing
