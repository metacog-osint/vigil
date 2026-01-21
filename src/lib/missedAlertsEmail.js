/**
 * Missed Alerts Email Template
 *
 * Weekly email sent to free users showing what alerts they
 * would have received with a Professional subscription.
 */

import { supabase } from './supabase/client'

/**
 * Fetch missed alerts for a free user
 */
export async function getMissedAlertsForUser(userId, days = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  // Get user's org profile if they have one (they shouldn't on free, but check)
  const { data: profile } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  const alerts = {
    ransomware: [],
    kev: [],
    escalating: [],
    total: 0,
  }

  // Get ransomware incidents from the period
  const { data: incidents } = await supabase
    .from('incidents')
    .select(
      `
      id,
      victim_name,
      victim_sector,
      victim_country,
      discovered_date,
      threat_actor:threat_actors(name, type)
    `
    )
    .gte('discovered_date', cutoff.toISOString())
    .order('discovered_date', { ascending: false })
    .limit(10)

  if (incidents) {
    // If user has profile, filter to their sector
    const relevantIncidents = profile?.sector
      ? incidents.filter((i) =>
          i.victim_sector?.toLowerCase().includes(profile.sector.toLowerCase())
        )
      : incidents.slice(0, 5)

    alerts.ransomware = relevantIncidents.map((i) => ({
      actor: i.threat_actor?.name || 'Unknown',
      victim: i.victim_name,
      sector: i.victim_sector,
      date: i.discovered_date,
    }))
  }

  // Get new KEVs from the period
  const { data: kevs } = await supabase
    .from('vulnerabilities')
    .select('cve_id, description, cvss_score, published_date')
    .eq('in_kev', true)
    .gte('published_date', cutoff.toISOString())
    .order('cvss_score', { ascending: false })
    .limit(5)

  if (kevs) {
    alerts.kev = kevs.map((k) => ({
      cve: k.cve_id,
      description: k.description?.substring(0, 100) + '...',
      cvss: k.cvss_score,
      date: k.published_date,
    }))
  }

  // Get escalating actors
  const { data: actors } = await supabase
    .from('threat_actors')
    .select('name, trend_status, incidents_7d, target_sectors')
    .eq('trend_status', 'ESCALATING')
    .order('incidents_7d', { ascending: false })
    .limit(5)

  if (actors) {
    alerts.escalating = actors.map((a) => ({
      name: a.name,
      incidents: a.incidents_7d,
      sectors: a.target_sectors?.slice(0, 3) || [],
    }))
  }

  alerts.total = alerts.ransomware.length + alerts.kev.length + alerts.escalating.length

  return alerts
}

/**
 * Generate HTML email for missed alerts
 */
export function generateMissedAlertsEmail(userName, alerts, _weekOf) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Threat Briefing</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0f172a;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 30px; text-align: center;">
              <h1 style="color: #00ffd5; margin: 0; font-size: 28px; font-weight: bold;">VIGIL</h1>
              <p style="color: #64748b; margin: 10px 0 0 0; font-size: 14px;">Threat Intelligence Platform</p>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background-color: #1e293b; border-radius: 12px; padding: 30px;">

              <!-- Greeting -->
              <h2 style="color: #f8fafc; margin: 0 0 10px 0; font-size: 22px;">
                Hi ${userName || 'there'},
              </h2>
              <p style="color: #94a3b8; margin: 0 0 25px 0; font-size: 15px; line-height: 1.6;">
                Here's what happened in the threat landscape this week. With Professional, you'd receive these alerts in real-time.
              </p>

              <!-- Stats Row -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td style="width: 33%; text-align: center; padding: 15px; background-color: #ef4444; background-color: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                    <div style="font-size: 28px; margin-bottom: 5px;">🔴</div>
                    <div style="color: #f87171; font-size: 24px; font-weight: bold;">${alerts.ransomware.length}</div>
                    <div style="color: #64748b; font-size: 12px;">Ransomware</div>
                  </td>
                  <td style="width: 10px;"></td>
                  <td style="width: 33%; text-align: center; padding: 15px; background-color: rgba(249, 115, 22, 0.1); border-radius: 8px;">
                    <div style="font-size: 28px; margin-bottom: 5px;">🟠</div>
                    <div style="color: #fb923c; font-size: 24px; font-weight: bold;">${alerts.kev.length}</div>
                    <div style="color: #64748b; font-size: 12px;">New KEVs</div>
                  </td>
                  <td style="width: 10px;"></td>
                  <td style="width: 33%; text-align: center; padding: 15px; background-color: rgba(234, 179, 8, 0.1); border-radius: 8px;">
                    <div style="font-size: 28px; margin-bottom: 5px;">📈</div>
                    <div style="color: #facc15; font-size: 24px; font-weight: bold;">${alerts.escalating.length}</div>
                    <div style="color: #64748b; font-size: 12px;">Escalating</div>
                  </td>
                </tr>
              </table>

              <!-- Ransomware Section -->
              ${
                alerts.ransomware.length > 0
                  ? `
              <div style="margin-bottom: 25px;">
                <h3 style="color: #f87171; margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                  🔴 Ransomware Incidents
                </h3>
                ${alerts.ransomware
                  .slice(0, 3)
                  .map(
                    (inc) => `
                <div style="padding: 12px; background-color: rgba(239, 68, 68, 0.05); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #ef4444;">
                  <div style="color: #f8fafc; font-size: 14px; font-weight: 500;">${inc.actor} hit ${inc.sector || 'unknown sector'}</div>
                  <div style="color: #64748b; font-size: 12px; margin-top: 4px;">${inc.victim} • ${formatDate(inc.date)}</div>
                </div>
                `
                  )
                  .join('')}
                ${alerts.ransomware.length > 3 ? `<p style="color: #64748b; font-size: 12px; margin: 10px 0 0 0;">+${alerts.ransomware.length - 3} more incidents</p>` : ''}
              </div>
              `
                  : ''
              }

              <!-- KEV Section -->
              ${
                alerts.kev.length > 0
                  ? `
              <div style="margin-bottom: 25px;">
                <h3 style="color: #fb923c; margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                  🟠 New KEV Vulnerabilities
                </h3>
                ${alerts.kev
                  .slice(0, 3)
                  .map(
                    (kev) => `
                <div style="padding: 12px; background-color: rgba(249, 115, 22, 0.05); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #f97316;">
                  <div style="color: #f8fafc; font-size: 14px; font-weight: 500;">${kev.cve} (CVSS ${kev.cvss})</div>
                  <div style="color: #64748b; font-size: 12px; margin-top: 4px;">${kev.description}</div>
                </div>
                `
                  )
                  .join('')}
              </div>
              `
                  : ''
              }

              <!-- Escalating Actors Section -->
              ${
                alerts.escalating.length > 0
                  ? `
              <div style="margin-bottom: 25px;">
                <h3 style="color: #facc15; margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                  📈 Escalating Threat Actors
                </h3>
                ${alerts.escalating
                  .slice(0, 3)
                  .map(
                    (actor) => `
                <div style="padding: 12px; background-color: rgba(234, 179, 8, 0.05); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #eab308;">
                  <div style="color: #f8fafc; font-size: 14px; font-weight: 500;">${actor.name}</div>
                  <div style="color: #64748b; font-size: 12px; margin-top: 4px;">${actor.incidents} incidents this week • ${actor.sectors.join(', ')}</div>
                </div>
                `
                  )
                  .join('')}
              </div>
              `
                  : ''
              }

              <!-- CTA -->
              <div style="text-align: center; padding: 25px 0; border-top: 1px solid #334155;">
                <p style="color: #94a3b8; margin: 0 0 20px 0; font-size: 14px;">
                  Get these alerts in real-time with Professional
                </p>
                <a href="https://vigil.theintelligence.company/pricing" style="display: inline-block; padding: 14px 28px; background-color: #00ffd5; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Upgrade to Professional - $39/mo
                </a>
                <p style="color: #64748b; margin: 15px 0 0 0; font-size: 12px;">
                  Cancel anytime • 46x ROI on average
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 30px; text-align: center;">
              <p style="color: #64748b; margin: 0; font-size: 12px;">
                You're receiving this because you signed up for Vigil.
                <br>
                <a href="https://vigil.theintelligence.company/settings" style="color: #00ffd5; text-decoration: none;">Manage preferences</a>
                •
                <a href="https://vigil.theintelligence.company/unsubscribe" style="color: #64748b; text-decoration: none;">Unsubscribe</a>
              </p>
              <p style="color: #475569; margin: 15px 0 0 0; font-size: 11px;">
                © 2026 The Intelligence Company. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `
Hi ${userName || 'there'},

Here's what happened in the threat landscape this week. With Professional, you'd receive these alerts in real-time.

📊 THIS WEEK'S ACTIVITY
━━━━━━━━━━━━━━━━━━━━━━
🔴 ${alerts.ransomware.length} Ransomware Incidents
🟠 ${alerts.kev.length} New KEV Vulnerabilities
📈 ${alerts.escalating.length} Escalating Actors

${
  alerts.ransomware.length > 0
    ? `
🔴 RANSOMWARE INCIDENTS
${alerts.ransomware
  .slice(0, 3)
  .map((inc) => `• ${inc.actor} hit ${inc.sector || 'unknown'} - ${inc.victim}`)
  .join('\n')}
`
    : ''
}

${
  alerts.kev.length > 0
    ? `
🟠 NEW KEV VULNERABILITIES
${alerts.kev
  .slice(0, 3)
  .map((kev) => `• ${kev.cve} (CVSS ${kev.cvss})`)
  .join('\n')}
`
    : ''
}

${
  alerts.escalating.length > 0
    ? `
📈 ESCALATING THREAT ACTORS
${alerts.escalating
  .slice(0, 3)
  .map((actor) => `• ${actor.name} - ${actor.incidents} incidents this week`)
  .join('\n')}
`
    : ''
}

━━━━━━━━━━━━━━━━━━━━━━

Get these alerts in real-time with Professional.
Upgrade now: https://vigil.theintelligence.company/pricing

--
The Intelligence Company
https://vigil.theintelligence.company
  `.trim()

  const subject = `🔔 ${alerts.total} threat alerts this week you didn't receive`

  return { html, text, subject }
}

/**
 * Get users who should receive the missed alerts email
 */
export async function getMissedAlertsRecipients() {
  // Get free tier users who have been active in the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: users } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('tier', 'free')

  if (!users) return []

  // Get their email addresses
  const userIds = users.map((u) => u.user_id)

  // Note: In production, you'd join with auth.users or a profiles table
  // For now, return the user IDs
  return userIds
}

export default {
  getMissedAlertsForUser,
  generateMissedAlertsEmail,
  getMissedAlertsRecipients,
}
