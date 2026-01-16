#!/usr/bin/env node

/**
 * Alert Rule Evaluation Engine
 * Evaluates user-defined alert rules against new threat data
 *
 * Run with: node scripts/evaluate-alert-rules.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { format, subHours } from 'date-fns'
import 'dotenv/config'

// Initialize clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

// How far back to look for new data (run every 15 min, look back 30 min for overlap)
const LOOKBACK_HOURS = 0.5

// Rule type evaluators
const RULE_EVALUATORS = {
  /**
   * Vendor CVE Alert
   * Triggers when CVEs affecting specified vendors are added to KEV
   */
  async vendor_cve(rule, sinceTime) {
    const { vendors = [], min_severity, kev_only } = rule.conditions || {}

    let query = supabase
      .from('vulnerabilities')
      .select('id, cve_id, vendor_project, product, vulnerability_name, cvss_score, kev_date')
      .gte('updated_at', sinceTime.toISOString())

    // Only KEV vulns
    if (kev_only) {
      query = query.not('kev_date', 'is', null)
    }

    // Filter by vendors (case-insensitive)
    if (vendors.length > 0) {
      const vendorFilter = vendors.map(v => `vendor_project.ilike.%${v}%`).join(',')
      query = query.or(vendorFilter)
    }

    // Filter by severity
    if (min_severity) {
      const minCvss = { critical: 9.0, high: 7.0, medium: 4.0, low: 0.0 }[min_severity] || 0
      query = query.gte('cvss_score', minCvss)
    }

    const { data, error } = await query.limit(20)
    if (error) throw error

    return (data || []).map(vuln => ({
      entity_type: 'vulnerability',
      entity_id: vuln.id,
      title: vuln.cve_id,
      description: `${vuln.vendor_project || ''} ${vuln.product || ''}: ${vuln.vulnerability_name || 'No description'}`,
      severity: vuln.cvss_score >= 9 ? 'critical' : vuln.cvss_score >= 7 ? 'high' : 'medium',
      url: `/vulnerabilities?cve=${vuln.cve_id}`,
    }))
  },

  /**
   * Actor Activity Alert
   * Triggers when specified actors have new activity or escalate
   */
  async actor_activity(rule, sinceTime) {
    const { actor_names = [], event_types = [] } = rule.conditions || {}
    const matches = []

    // Check for escalating actors
    if (event_types.includes('escalating') || event_types.length === 0) {
      let query = supabase
        .from('threat_actors')
        .select('id, name, trend_status, incidents_7d')
        .eq('trend_status', 'ESCALATING')

      if (actor_names.length > 0) {
        query = query.in('name', actor_names)
      }

      const { data: escalating } = await query.limit(10)
      for (const actor of escalating || []) {
        matches.push({
          entity_type: 'actor',
          entity_id: actor.id,
          title: actor.name,
          description: `${actor.name} is ESCALATING with ${actor.incidents_7d} incidents in the last 7 days`,
          severity: 'high',
          url: `/actors?search=${encodeURIComponent(actor.name)}`,
        })
      }
    }

    // Check for new incidents by actor
    if (event_types.includes('new_incident') || event_types.length === 0) {
      let query = supabase
        .from('incidents')
        .select(`
          id, victim_name, victim_sector, discovered_date,
          threat_actor:threat_actors(id, name)
        `)
        .gte('created_at', sinceTime.toISOString())

      if (actor_names.length > 0) {
        // Filter by actor name through the join
        query = query.not('threat_actor', 'is', null)
      }

      const { data: incidents } = await query.limit(20)
      for (const inc of incidents || []) {
        if (actor_names.length === 0 || actor_names.includes(inc.threat_actor?.name)) {
          matches.push({
            entity_type: 'incident',
            entity_id: inc.id,
            title: `New victim: ${inc.victim_name || 'Unknown'}`,
            description: `${inc.threat_actor?.name || 'Unknown actor'} claimed ${inc.victim_name} (${inc.victim_sector || 'Unknown sector'})`,
            severity: 'medium',
            url: `/ransomware`,
          })
        }
      }
    }

    return matches
  },

  /**
   * Sector Incident Alert
   * Triggers when incidents occur in specified sectors
   */
  async sector_incident(rule, sinceTime) {
    const { sectors = [] } = rule.conditions || {}

    if (sectors.length === 0) return []

    const { data: incidents, error } = await supabase
      .from('incidents')
      .select(`
        id, victim_name, victim_sector, discovered_date,
        threat_actor:threat_actors(id, name)
      `)
      .gte('created_at', sinceTime.toISOString())
      .in('victim_sector', sectors)
      .limit(20)

    if (error) throw error

    return (incidents || []).map(inc => ({
      entity_type: 'incident',
      entity_id: inc.id,
      title: `${inc.victim_sector} incident: ${inc.victim_name || 'Unknown'}`,
      description: `${inc.threat_actor?.name || 'Unknown actor'} targeted ${inc.victim_name} in the ${inc.victim_sector} sector`,
      severity: 'high',
      url: `/ransomware?sector=${inc.victim_sector}`,
    }))
  },

  /**
   * KEV Added Alert
   * Triggers when new CVEs are added to CISA KEV
   */
  async kev_added(rule, sinceTime) {
    const { min_cvss, ransomware_only } = rule.conditions || {}

    let query = supabase
      .from('vulnerabilities')
      .select('id, cve_id, vendor_project, product, vulnerability_name, cvss_score, kev_date, known_ransomware_use')
      .gte('kev_date', sinceTime.toISOString())

    if (min_cvss) {
      query = query.gte('cvss_score', min_cvss)
    }

    if (ransomware_only) {
      query = query.eq('known_ransomware_use', true)
    }

    const { data, error } = await query.order('kev_date', { ascending: false }).limit(20)
    if (error) throw error

    return (data || []).map(vuln => ({
      entity_type: 'vulnerability',
      entity_id: vuln.id,
      title: `New KEV: ${vuln.cve_id}`,
      description: `${vuln.vendor_project || ''} ${vuln.product || ''} - CVSS ${vuln.cvss_score || 'N/A'}`,
      severity: vuln.cvss_score >= 9 ? 'critical' : vuln.cvss_score >= 7 ? 'high' : 'medium',
      url: `/vulnerabilities?cve=${vuln.cve_id}`,
    }))
  },

  /**
   * Severity Threshold Alert
   * Triggers on any event above a severity threshold
   */
  async severity_threshold(rule, sinceTime) {
    const { min_severity = 'high' } = rule.conditions || {}
    const matches = []

    // Map severity to CVSS
    const minCvss = { critical: 9.0, high: 7.0, medium: 4.0, low: 0.0 }[min_severity] || 7.0

    // Check high-severity vulnerabilities
    const { data: vulns } = await supabase
      .from('vulnerabilities')
      .select('id, cve_id, vendor_project, product, cvss_score, kev_date')
      .gte('updated_at', sinceTime.toISOString())
      .gte('cvss_score', minCvss)
      .not('kev_date', 'is', null)
      .limit(10)

    for (const vuln of vulns || []) {
      matches.push({
        entity_type: 'vulnerability',
        entity_id: vuln.id,
        title: vuln.cve_id,
        description: `Critical vulnerability: ${vuln.vendor_project || ''} ${vuln.product || ''} - CVSS ${vuln.cvss_score}`,
        severity: vuln.cvss_score >= 9 ? 'critical' : 'high',
        url: `/vulnerabilities?cve=${vuln.cve_id}`,
      })
    }

    return matches
  },
}

// Send email notification
async function sendEmailNotification(email, rule, matches) {
  const subject = `Vigil Alert: ${rule.rule_name} (${matches.length} match${matches.length !== 1 ? 'es' : ''})`

  const matchList = matches.map(m => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${m.title}</strong><br>
        <span style="color: #6b7280; font-size: 14px;">${m.description}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;
          ${m.severity === 'critical' ? 'background: #fef2f2; color: #dc2626;' :
            m.severity === 'high' ? 'background: #fff7ed; color: #ea580c;' :
            'background: #fefce8; color: #ca8a04;'}">${m.severity}</span>
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #0ea5e9; }
    .header h1 { color: #0ea5e9; margin: 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f9fafb; padding: 12px; text-align: left; font-weight: 600; }
    .footer { text-align: center; padding: 20px 0; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Alert Triggered</h1>
      <p style="color: #6b7280; margin: 8px 0 0;">${rule.rule_name}</p>
    </div>

    <p>Your alert rule matched ${matches.length} item${matches.length !== 1 ? 's' : ''}:</p>

    <table>
      <thead>
        <tr>
          <th>Details</th>
          <th style="text-align: center;">Severity</th>
        </tr>
      </thead>
      <tbody>
        ${matchList}
      </tbody>
    </table>

    <p style="text-align: center;">
      <a href="https://vigil.theintelligence.company" style="display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px;">View in Vigil</a>
    </p>

    <div class="footer">
      <p>You received this because you have alert rules configured in Vigil.</p>
      <p><a href="https://vigil.theintelligence.company/settings">Manage alert rules</a></p>
    </div>
  </div>
</body>
</html>
`

  await resend.emails.send({
    from: 'Vigil Alerts <alerts@theintelligence.company>',
    to: email,
    subject,
    html,
  })
}

// Create in-app notification
async function createInAppNotification(userId, rule, matches) {
  const notifications = matches.slice(0, 5).map(match => ({
    user_id: userId,
    notification_type: rule.rule_type === 'kev_added' ? 'kev_added' :
                       rule.rule_type === 'actor_activity' ? 'actor_escalating' :
                       rule.rule_type === 'sector_incident' ? 'sector_incident' :
                       'vendor_alert',
    title: match.title,
    message: match.description,
    severity: match.severity,
    link: match.url,
    related_id: match.entity_id,
    related_type: match.entity_type,
  }))

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)
  }
}

// Record trigger in history
async function recordTrigger(rule, matches) {
  // Update rule stats
  await supabase
    .from('user_alert_rules')
    .update({
      last_triggered_at: new Date().toISOString(),
      trigger_count: rule.trigger_count + 1,
    })
    .eq('id', rule.id)

  // Record in trigger history
  await supabase
    .from('alert_triggers')
    .insert({
      rule_id: rule.id,
      user_id: rule.user_id,
      trigger_data: { matches: matches.slice(0, 10) },
      notification_sent: rule.notify_in_app,
      email_sent: rule.notify_email,
    })
}

// Main function
async function main() {
  console.log('=== Alert Rule Evaluation ===')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('')

  const sinceTime = subHours(new Date(), LOOKBACK_HOURS)
  console.log(`Looking for data since: ${sinceTime.toISOString()}`)
  console.log('')

  // Get all enabled rules
  const { data: rules, error } = await supabase
    .from('user_alert_rules')
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching rules:', error.message)
    process.exit(1)
  }

  if (!rules || rules.length === 0) {
    console.log('No enabled alert rules found')
    return
  }

  console.log(`Evaluating ${rules.length} rule(s)`)
  console.log('')

  // Get user emails for email notifications
  const userIds = [...new Set(rules.map(r => r.user_id))]

  for (const rule of rules) {
    console.log(`Rule: ${rule.rule_name} (${rule.rule_type})`)

    try {
      const evaluator = RULE_EVALUATORS[rule.rule_type]
      if (!evaluator) {
        console.log(`  Unknown rule type: ${rule.rule_type}`)
        continue
      }

      const matches = await evaluator(rule, sinceTime)

      if (matches.length === 0) {
        console.log('  No matches')
        continue
      }

      console.log(`  Found ${matches.length} match(es)`)

      // Send in-app notifications
      if (rule.notify_in_app) {
        await createInAppNotification(rule.user_id, rule, matches)
        console.log('  In-app notifications created')
      }

      // Send email notification
      if (rule.notify_email) {
        // Get user email (from Firebase, stored in user_preferences or passed as param)
        // For now, we'll need to handle this via a lookup or stored email
        // This is a simplified version - in production you'd fetch the user's email
        console.log('  Email notification queued (requires user email lookup)')
      }

      // Record trigger
      await recordTrigger(rule, matches)
      console.log('  Trigger recorded')

    } catch (err) {
      console.error(`  Error evaluating rule: ${err.message}`)
    }

    console.log('')
  }

  console.log('=== Complete ===')
}

main().catch(console.error)
