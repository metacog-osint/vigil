#!/usr/bin/env node
/**
 * Send Missed Alerts Emails
 *
 * Weekly email campaign to free users showing what alerts they
 * would have received with a Professional subscription.
 *
 * Run weekly via GitHub Actions (Sundays).
 *
 * Usage:
 *   npm run send:missed-alerts
 *   node scripts/send-missed-alerts.mjs
 *   node scripts/send-missed-alerts.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const resendKey = process.env.RESEND_API_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const resend = resendKey ? new Resend(resendKey) : null

// Parse args
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT = args.find(a => a.startsWith('--limit='))?.split('=')[1] || 100

/**
 * Fetch missed alerts data for a user
 */
async function getMissedAlerts(userId, days = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const alerts = {
    ransomware: [],
    kev: [],
    escalating: [],
    total: 0,
  }

  // Get ransomware incidents
  const { data: incidents } = await supabase
    .from('incidents')
    .select(`
      id,
      victim_name,
      sector,
      discovered_at,
      threat_actor:threat_actors(name)
    `)
    .gte('discovered_at', cutoff.toISOString())
    .order('discovered_at', { ascending: false })
    .limit(10)

  if (incidents) {
    alerts.ransomware = incidents.map(i => ({
      actor: i.threat_actor?.name || 'Unknown',
      victim: i.victim_name,
      sector: i.sector,
      date: i.discovered_at,
    }))
  }

  // Get new KEVs
  const { data: kevs } = await supabase
    .from('vulnerabilities')
    .select('cve_id, description, cvss_score, published_date')
    .eq('in_kev', true)
    .gte('published_date', cutoff.toISOString())
    .order('cvss_score', { ascending: false })
    .limit(5)

  if (kevs) {
    alerts.kev = kevs.map(k => ({
      cve: k.cve_id,
      description: k.description?.substring(0, 100) + '...',
      cvss: k.cvss_score,
      date: k.published_date,
    }))
  }

  // Get escalating actors
  const { data: actors } = await supabase
    .from('threat_actors')
    .select('name, incidents_7d, target_sectors')
    .eq('trend_status', 'ESCALATING')
    .order('incidents_7d', { ascending: false })
    .limit(5)

  if (actors) {
    alerts.escalating = actors.map(a => ({
      name: a.name,
      incidents: a.incidents_7d,
      sectors: a.target_sectors?.slice(0, 3) || [],
    }))
  }

  alerts.total = alerts.ransomware.length + alerts.kev.length + alerts.escalating.length
  return alerts
}

/**
 * Generate email HTML
 */
function generateEmailHtml(userName, alerts) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0f172a;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          <tr>
            <td style="padding-bottom: 30px; text-align: center;">
              <h1 style="color: #00ffd5; margin: 0; font-size: 28px;">VIGIL</h1>
              <p style="color: #64748b; margin: 10px 0 0 0; font-size: 14px;">Threat Intelligence Platform</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; border-radius: 12px; padding: 30px;">
              <h2 style="color: #f8fafc; margin: 0 0 10px 0; font-size: 22px;">Hi ${userName || 'there'},</h2>
              <p style="color: #94a3b8; margin: 0 0 25px 0; font-size: 15px;">
                Here's what happened this week. With Professional, you'd get these alerts in real-time.
              </p>

              <!-- Stats -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 25px;">
                <tr>
                  <td style="width: 33%; text-align: center; padding: 15px; background-color: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                    <div style="font-size: 28px;">🔴</div>
                    <div style="color: #f87171; font-size: 24px; font-weight: bold;">${alerts.ransomware.length}</div>
                    <div style="color: #64748b; font-size: 12px;">Ransomware</div>
                  </td>
                  <td style="width: 5px;"></td>
                  <td style="width: 33%; text-align: center; padding: 15px; background-color: rgba(249, 115, 22, 0.1); border-radius: 8px;">
                    <div style="font-size: 28px;">🟠</div>
                    <div style="color: #fb923c; font-size: 24px; font-weight: bold;">${alerts.kev.length}</div>
                    <div style="color: #64748b; font-size: 12px;">New KEVs</div>
                  </td>
                  <td style="width: 5px;"></td>
                  <td style="width: 33%; text-align: center; padding: 15px; background-color: rgba(234, 179, 8, 0.1); border-radius: 8px;">
                    <div style="font-size: 28px;">📈</div>
                    <div style="color: #facc15; font-size: 24px; font-weight: bold;">${alerts.escalating.length}</div>
                    <div style="color: #64748b; font-size: 12px;">Escalating</div>
                  </td>
                </tr>
              </table>

              ${alerts.ransomware.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h3 style="color: #f87171; margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                  🔴 Ransomware Incidents
                </h3>
                ${alerts.ransomware.slice(0, 3).map(inc => `
                <div style="padding: 12px; background-color: rgba(239, 68, 68, 0.05); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #ef4444;">
                  <div style="color: #f8fafc; font-size: 14px;">${inc.actor} hit ${inc.sector || 'unknown'}</div>
                  <div style="color: #64748b; font-size: 12px;">${inc.victim} • ${formatDate(inc.date)}</div>
                </div>
                `).join('')}
              </div>
              ` : ''}

              ${alerts.kev.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h3 style="color: #fb923c; margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                  🟠 New KEV Vulnerabilities
                </h3>
                ${alerts.kev.slice(0, 3).map(kev => `
                <div style="padding: 12px; background-color: rgba(249, 115, 22, 0.05); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #f97316;">
                  <div style="color: #f8fafc; font-size: 14px;">${kev.cve} (CVSS ${kev.cvss})</div>
                  <div style="color: #64748b; font-size: 12px;">${kev.description}</div>
                </div>
                `).join('')}
              </div>
              ` : ''}

              ${alerts.escalating.length > 0 ? `
              <div style="margin-bottom: 25px;">
                <h3 style="color: #facc15; margin: 0 0 15px 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px;">
                  📈 Escalating Threat Actors
                </h3>
                ${alerts.escalating.slice(0, 3).map(actor => `
                <div style="padding: 12px; background-color: rgba(234, 179, 8, 0.05); border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #eab308;">
                  <div style="color: #f8fafc; font-size: 14px;">${actor.name}</div>
                  <div style="color: #64748b; font-size: 12px;">${actor.incidents} incidents • ${actor.sectors.join(', ')}</div>
                </div>
                `).join('')}
              </div>
              ` : ''}

              <div style="text-align: center; padding: 25px 0; border-top: 1px solid #334155;">
                <p style="color: #94a3b8; margin: 0 0 20px 0; font-size: 14px;">Get these alerts in real-time</p>
                <a href="https://vigil.theintelligence.company/pricing" style="display: inline-block; padding: 14px 28px; background-color: #00ffd5; color: #0f172a; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  Upgrade to Professional - $39/mo
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 30px; text-align: center;">
              <p style="color: #64748b; font-size: 12px;">
                <a href="https://vigil.theintelligence.company/settings" style="color: #00ffd5;">Manage preferences</a>
                •
                <a href="https://vigil.theintelligence.company/unsubscribe" style="color: #64748b;">Unsubscribe</a>
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
}

/**
 * Main function
 */
async function sendMissedAlerts() {
  console.log('=== Send Missed Alerts Emails ===\n')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Limit: ${LIMIT} users\n`)

  if (!resend && !DRY_RUN) {
    console.error('RESEND_API_KEY not set - cannot send emails')
    process.exit(1)
  }

  // Get free tier users
  console.log('Step 1: Finding free tier users...')
  const { data: subscriptions, error: subError } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('tier', 'free')
    .limit(parseInt(LIMIT))

  if (subError) {
    console.error('Error fetching subscriptions:', subError.message)
    process.exit(1)
  }

  console.log(`  Found ${subscriptions?.length || 0} free tier users`)

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No free tier users to email')
    return
  }

  // Get user emails (from profiles or auth)
  const userIds = subscriptions.map(s => s.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

  // Fetch alerts data once (same for all users)
  console.log('\nStep 2: Fetching threat data...')
  const alerts = await getMissedAlerts(null, 7)
  console.log(`  Ransomware: ${alerts.ransomware.length}`)
  console.log(`  KEVs: ${alerts.kev.length}`)
  console.log(`  Escalating: ${alerts.escalating.length}`)

  if (alerts.total === 0) {
    console.log('\nNo alerts to report this week')
    return
  }

  // Send emails
  console.log('\nStep 3: Sending emails...')
  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    const profile = profileMap.get(sub.user_id)

    if (!profile?.email) {
      console.log(`  Skipping ${sub.user_id} - no email`)
      continue
    }

    const html = generateEmailHtml(profile.full_name, alerts)
    const subject = `🔔 ${alerts.total} threat alerts this week you didn't receive`

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would send to: ${profile.email}`)
      sent++
      continue
    }

    try {
      await resend.emails.send({
        from: 'Vigil <alerts@vigil.theintelligence.company>',
        to: profile.email,
        subject,
        html,
      })
      console.log(`  ✓ Sent to ${profile.email}`)
      sent++
    } catch (err) {
      console.log(`  ✗ Failed for ${profile.email}: ${err.message}`)
      failed++
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n=== Summary ===')
  console.log(`Sent: ${sent}`)
  console.log(`Failed: ${failed}`)
}

sendMissedAlerts().catch(console.error)
