#!/usr/bin/env node
/**
 * Send Digests Script
 *
 * Sends daily/weekly digest emails to subscribed users.
 * Run via: npm run send:digests -- --type=daily|weekly
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

// Environment setup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

if (!RESEND_API_KEY) {
  console.error('Missing RESEND_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const resend = new Resend(RESEND_API_KEY)

// Parse command line args
const args = process.argv.slice(2)
const typeArg = args.find(a => a.startsWith('--type='))
const digestType = typeArg ? typeArg.split('=')[1] : 'weekly'

if (!['daily', 'weekly'].includes(digestType)) {
  console.error('Invalid digest type. Use --type=daily or --type=weekly')
  process.exit(1)
}

const dryRun = args.includes('--dry-run')

console.log(`\n🗓️  Sending ${digestType} digests${dryRun ? ' (DRY RUN)' : ''}...\n`)

async function main() {
  try {
    // Get recipients
    const { data: recipients, error: recipientError } = await supabase
      .from('digest_preferences')
      .select('user_id, send_time, timezone')
      .eq('frequency', digestType)

    if (recipientError) {
      console.error('Error fetching recipients:', recipientError)
      return
    }

    if (!recipients?.length) {
      console.log('No recipients configured for', digestType, 'digests')
      return
    }

    console.log(`Found ${recipients.length} recipient(s)\n`)

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const recipient of recipients) {
      try {
        // Get user email
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(recipient.user_id)

        if (userError || !user?.email) {
          console.log(`⚠️  Skipping user ${recipient.user_id} - no email found`)
          skipped++
          continue
        }

        console.log(`📧 Processing: ${user.email}`)

        // Generate digest content
        const digest = await generateDigestContent(recipient.user_id, digestType)

        // Check if content changed
        const hasChanged = await checkContentChanged(recipient.user_id, digest)
        if (!hasChanged) {
          console.log(`   ⏭️  Skipping - no new content since last digest`)
          skipped++
          continue
        }

        // Generate email
        const email = generateEmail(digest)

        if (dryRun) {
          console.log(`   ✅ Would send: "${email.subject}"`)
          sent++
          continue
        }

        // Send email via Resend
        const { error: sendError } = await resend.emails.send({
          from: 'Vigil <digests@vigil.theintelligence.company>',
          to: user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })

        if (sendError) {
          console.log(`   ❌ Failed to send:`, sendError)
          failed++
          continue
        }

        // Record in history
        await recordDigestSent(recipient.user_id, digest)

        console.log(`   ✅ Sent successfully`)
        sent++

      } catch (err) {
        console.error(`   ❌ Error processing recipient:`, err.message)
        failed++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   Sent: ${sent}`)
    console.log(`   Skipped: ${skipped}`)
    console.log(`   Failed: ${failed}`)

  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

/**
 * Generate digest content for a user
 */
async function generateDigestContent(userId, type) {
  const days = type === 'daily' ? 1 : 7

  // Get user's org profile
  const { data: profile } = await supabase
    .from('org_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Get change summary
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Fetch stats
  const [incidentsResult, actorsResult, vulnsResult] = await Promise.all([
    supabase
      .from('incidents')
      .select('id, victim_name, sector, country, discovered_at, threat_actor_id')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('threat_actors')
      .select('id, name, trend_status, incidents_7d')
      .eq('trend_status', 'ESCALATING')
      .order('incidents_7d', { ascending: false })
      .limit(5),

    supabase
      .from('vulnerabilities')
      .select('cve_id, severity, description, is_kev')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const incidents = incidentsResult.data || []
  const actors = actorsResult.data || []
  const vulns = vulnsResult.data || []

  // Get actor names for incidents
  const actorIds = [...new Set(incidents.map(i => i.threat_actor_id).filter(Boolean))]
  let actorMap = {}
  if (actorIds.length > 0) {
    const { data: actorData } = await supabase
      .from('threat_actors')
      .select('id, name')
      .in('id', actorIds)
    actorMap = Object.fromEntries((actorData || []).map(a => [a.id, a.name]))
  }

  // Calculate KEV count
  const kevCount = vulns.filter(v => v.is_kev).length

  return {
    type,
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days,
    },
    profile: profile ? {
      sector: profile.sector,
      region: profile.region,
      country: profile.country,
    } : null,
    summary: {
      totalIncidents: incidents.length,
      escalatingActors: actors.length,
      newKEVs: kevCount,
      incidentChange: 0, // Would need previous period comparison
    },
    relevantToYou: null, // Simplified for script
    topActors: actors.map(a => ({
      id: a.id,
      name: a.name,
      incidentCount: a.incidents_7d || 0,
      trendStatus: a.trend_status,
    })),
    topIncidents: incidents.map(i => ({
      id: i.id,
      victimName: i.victim_name,
      actorName: actorMap[i.threat_actor_id] || 'Unknown',
      sector: i.sector,
      country: i.country,
      date: i.discovered_at,
    })),
    newVulnerabilities: vulns.map(v => ({
      id: v.cve_id,
      name: v.cve_id,
      severity: v.severity,
      description: v.description?.substring(0, 150),
      isKEV: v.is_kev || false,
    })),
  }
}

/**
 * Check if digest content has changed since last send
 */
async function checkContentChanged(userId, digest) {
  const contentHash = createContentHash(digest)

  const { data } = await supabase
    .from('digest_history')
    .select('content_hash')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  return !data || data.content_hash !== contentHash
}

/**
 * Create hash of digest content
 */
function createContentHash(digest) {
  const key = [
    digest.summary.totalIncidents,
    digest.summary.escalatingActors,
    digest.topActors.map(a => a.id).join(','),
    digest.topIncidents.map(i => i.id).join(','),
  ].join('|')

  return crypto.createHash('md5').update(key).digest('hex').substring(0, 16)
}

/**
 * Generate email HTML and text
 */
function generateEmail(digest) {
  const isDaily = digest.type === 'daily'
  const periodLabel = isDaily ? 'Today' : 'This Week'
  const BASE_URL = 'https://vigil.theintelligence.company'

  const subject = `${digest.profile?.sector ? '🎯 ' : ''}Vigil ${isDaily ? 'Daily' : 'Weekly'} Digest - ${digest.summary.totalIncidents} incidents`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; }
    .header { background: linear-gradient(135deg, #0891b2, #0e7490); padding: 24px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 0; color: white; }
    .content { padding: 24px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: white; }
    .stat-label { font-size: 12px; color: #94a3b8; }
    .section { margin: 20px 0; }
    .section-title { color: #06b6d4; font-weight: bold; margin-bottom: 10px; }
    .item { background: #334155; padding: 12px; border-radius: 6px; margin: 8px 0; }
    .item-title { color: white; font-weight: 500; }
    .item-meta { color: #94a3b8; font-size: 12px; }
    .cta { display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; }
    .footer a { color: #06b6d4; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Vigil ${isDaily ? 'Daily' : 'Weekly'} Digest</h1>
    </div>
    <div class="content">
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${digest.summary.totalIncidents}</div>
          <div class="stat-label">INCIDENTS</div>
        </div>
        <div class="stat">
          <div class="stat-value">${digest.summary.escalatingActors}</div>
          <div class="stat-label">ESCALATING</div>
        </div>
        <div class="stat">
          <div class="stat-value">${digest.summary.newKEVs}</div>
          <div class="stat-label">NEW KEVS</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">👤 Top Threat Actors</div>
        ${digest.topActors.slice(0, 3).map(a => `
          <div class="item">
            <div class="item-title">${a.name}</div>
            <div class="item-meta">${a.incidentCount} incidents</div>
          </div>
        `).join('')}
      </div>

      <div class="section">
        <div class="section-title">🔥 Recent Incidents</div>
        ${digest.topIncidents.slice(0, 3).map(i => `
          <div class="item">
            <div class="item-title">${i.victimName}</div>
            <div class="item-meta">${i.actorName} | ${i.sector || 'Unknown'}</div>
          </div>
        `).join('')}
      </div>

      <div style="text-align: center;">
        <a href="${BASE_URL}" class="cta">View Full Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      <a href="${BASE_URL}/settings">Manage preferences</a>
      <p>© ${new Date().getFullYear()} The Intelligence Company</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = `
VIGIL ${isDaily ? 'DAILY' : 'WEEKLY'} DIGEST

📊 ${periodLabel.toUpperCase()} AT A GLANCE
• ${digest.summary.totalIncidents} incidents
• ${digest.summary.escalatingActors} escalating actors
• ${digest.summary.newKEVs} new KEVs

👤 TOP THREAT ACTORS
${digest.topActors.slice(0, 3).map(a => `• ${a.name} - ${a.incidentCount} incidents`).join('\n')}

🔥 RECENT INCIDENTS
${digest.topIncidents.slice(0, 3).map(i => `• ${i.victimName} - ${i.actorName}`).join('\n')}

View full dashboard: ${BASE_URL}
  `.trim()

  return { html, text, subject }
}

/**
 * Record digest in history
 */
async function recordDigestSent(userId, digest) {
  const contentHash = createContentHash(digest)

  await supabase.from('digest_history').insert({
    user_id: userId,
    digest_type: digest.type,
    content_hash: contentHash,
    sent_at: new Date().toISOString(),
  })
}

// Run
main()
