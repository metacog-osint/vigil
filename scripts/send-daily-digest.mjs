#!/usr/bin/env node
// Daily Digest Email Script
// Sends personalized threat intelligence summaries to subscribed users
// Run via: npm run send:digest or GitHub Actions scheduled workflow

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, generateDigestHtml } from './lib/email.mjs'

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const SINGLE_USER = process.argv.find(arg => arg.startsWith('--user='))?.split('=')[1]

async function main() {
  console.log('=== Vigil Daily Digest ===')
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  if (!process.env.RESEND_API_KEY && !DRY_RUN) {
    console.error('RESEND_API_KEY not set. Use --dry-run to test without sending.')
    process.exit(1)
  }

  try {
    // Get users subscribed to daily digest
    const users = await getSubscribedUsers()
    console.log(`Found ${users.length} users subscribed to daily digest`)

    if (users.length === 0) {
      console.log('No users to send digest to. Exiting.')
      return
    }

    // Get threat data for the last 24 hours
    const threatData = await getThreatData()
    console.log(`Threat data: ${threatData.incidents.length} incidents, ${threatData.kevs.length} KEVs, ${threatData.escalating.length} escalating actors`)

    // Send digest to each user
    let sent = 0
    let failed = 0

    for (const user of users) {
      try {
        const digest = await generateUserDigest(user, threatData)

        if (DRY_RUN) {
          console.log(`[DRY RUN] Would send to ${user.email}:`)
          console.log(`  - ${digest.criticalItems.length} critical items`)
          console.log(`  - ${digest.highItems.length} high priority items`)
          console.log(`  - ${digest.watchlistUpdates.length} watchlist updates`)
        } else {
          const result = await sendEmail({
            to: user.email,
            subject: generateSubject(digest),
            html: generateDigestHtml(digest),
          })

          if (result.success) {
            sent++
            console.log(`✓ Sent to ${user.email}`)
          } else {
            failed++
            console.error(`✗ Failed for ${user.email}: ${result.error}`)
          }
        }

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        failed++
        console.error(`Error processing ${user.email}:`, error.message)
      }
    }

    console.log(`\n=== Summary ===`)
    console.log(`Sent: ${sent}`)
    console.log(`Failed: ${failed}`)
    console.log(`Total: ${users.length}`)

    // Log to sync_log for monitoring
    if (!DRY_RUN) {
      await logDigestRun(users.length, sent, failed)
    }

  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

/**
 * Get users who have opted in to daily digests
 */
async function getSubscribedUsers() {
  // For now, get users with email notification preferences
  // In the future, this will check user_preferences.digest_frequency
  let query = supabase
    .from('user_preferences')
    .select(`
      user_id,
      email,
      digest_frequency,
      digest_time,
      org_profile:organization_profiles(sector, region, country, tech_vendors, tech_stack)
    `)
    .eq('digest_frequency', 'daily')

  if (SINGLE_USER) {
    query = query.eq('email', SINGLE_USER)
  }

  const { data, error } = await query

  if (error) {
    // Table might not exist yet - return empty array
    console.warn('Could not fetch user preferences:', error.message)
    return []
  }

  return data || []
}

/**
 * Get threat data from the last 24 hours
 */
async function getThreatData() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const cutoff = yesterday.toISOString()

  // Fetch data in parallel
  const [incidentsResult, kevsResult, escalatingResult, alertsResult] = await Promise.all([
    // Recent incidents
    supabase
      .from('incidents')
      .select(`
        id, victim_name, victim_sector, discovered_date, status,
        threat_actor:threat_actors(id, name)
      `)
      .gte('discovered_date', cutoff.split('T')[0])
      .order('discovered_date', { ascending: false })
      .limit(50),

    // Recent KEVs
    supabase
      .from('vulnerabilities')
      .select('*')
      .not('kev_date', 'is', null)
      .gte('kev_date', cutoff.split('T')[0])
      .order('kev_date', { ascending: false })
      .limit(20),

    // Escalating actors
    supabase
      .from('threat_actors')
      .select('id, name, actor_type, incidents_7d, target_sectors')
      .eq('trend_status', 'ESCALATING')
      .order('incidents_7d', { ascending: false })
      .limit(10),

    // Recent alerts
    supabase
      .from('alerts')
      .select('*')
      .gte('published_date', cutoff.split('T')[0])
      .order('published_date', { ascending: false })
      .limit(20),
  ])

  return {
    incidents: incidentsResult.data || [],
    kevs: kevsResult.data || [],
    escalating: escalatingResult.data || [],
    alerts: alertsResult.data || [],
  }
}

/**
 * Generate personalized digest for a user
 */
async function generateUserDigest(user, threatData) {
  const profile = user.org_profile?.[0] || {}
  const userSector = profile.sector?.toLowerCase()
  const userVendors = (profile.tech_vendors || []).map(v => v.toLowerCase())

  const criticalItems = []
  const highItems = []
  const watchlistUpdates = []

  // Process KEVs - prioritize those affecting user's vendors
  for (const kev of threatData.kevs) {
    const kevVendors = (kev.affected_vendors || []).map(v => v.toLowerCase())
    const affectsUser = userVendors.some(uv => kevVendors.some(kv => kv.includes(uv) || uv.includes(kv)))
    const severity = kev.cvss_score >= 9 ? 'critical' : kev.cvss_score >= 7 ? 'high' : 'medium'

    const item = {
      title: `${kev.cve_id} - ${kev.affected_vendors?.slice(0, 2).join(', ') || 'Multiple vendors'}`,
      description: kev.description?.slice(0, 150) + '...',
      severity,
      cve: kev.cve_id,
      affectsUser,
    }

    if (affectsUser || kev.ransomware_campaign_use) {
      criticalItems.push(item)
    } else if (severity === 'critical' || severity === 'high') {
      highItems.push(item)
    }
  }

  // Process incidents - prioritize user's sector
  for (const incident of threatData.incidents) {
    const incidentSector = incident.victim_sector?.toLowerCase()
    const affectsUserSector = userSector && incidentSector === userSector

    const item = {
      title: `${incident.threat_actor?.name || 'Unknown'} claimed ${incident.victim_name}`,
      description: `${incident.victim_sector || 'Unknown sector'} - ${incident.status || 'claimed'}`,
      actors: incident.threat_actor ? [incident.threat_actor.name] : [],
    }

    if (affectsUserSector) {
      criticalItems.push(item)
    } else {
      highItems.push(item)
    }
  }

  // Process escalating actors - prioritize those targeting user's sector
  for (const actor of threatData.escalating) {
    const targetsSector = userSector && (actor.target_sectors || []).some(s => s.toLowerCase() === userSector)

    if (targetsSector) {
      criticalItems.push({
        title: `${actor.name} is ESCALATING`,
        description: `${actor.incidents_7d} incidents in 7 days, targeting ${actor.target_sectors?.slice(0, 3).join(', ')}`,
        actors: [actor.name],
      })
    }
  }

  // Get watchlist updates (if user has watchlist)
  const watchlistItems = await getUserWatchlistUpdates(user.user_id, threatData)
  watchlistUpdates.push(...watchlistItems)

  return {
    userName: user.email?.split('@')[0],
    date: new Date(),
    criticalItems: criticalItems.slice(0, 10),
    highItems: highItems.slice(0, 10),
    watchlistUpdates: watchlistUpdates.slice(0, 5),
    stats: {
      incidents: threatData.incidents.length,
      kevs: threatData.kevs.length,
      escalating: threatData.escalating.length,
    },
    profileSector: profile.sector,
  }
}

/**
 * Get watchlist updates for a user
 */
async function getUserWatchlistUpdates(userId, threatData) {
  const updates = []

  // Get user's watchlist items
  const { data: watchlistItems } = await supabase
    .from('watchlist_items')
    .select(`
      item_type,
      item_id,
      item_name,
      watchlist:watchlists!inner(user_id)
    `)
    .eq('watchlist.user_id', userId)

  if (!watchlistItems?.length) return updates

  // Check for updates to watched actors
  const watchedActorNames = watchlistItems
    .filter(i => i.item_type === 'actor')
    .map(i => i.item_name?.toLowerCase())

  for (const actor of threatData.escalating) {
    if (watchedActorNames.includes(actor.name?.toLowerCase())) {
      updates.push({
        title: actor.name,
        change: `Status changed to ESCALATING (${actor.incidents_7d} incidents in 7d)`,
      })
    }
  }

  // Check for watched CVEs that became KEVs
  const watchedCves = watchlistItems
    .filter(i => i.item_type === 'cve')
    .map(i => i.item_id)

  for (const kev of threatData.kevs) {
    if (watchedCves.includes(kev.cve_id)) {
      updates.push({
        title: kev.cve_id,
        change: 'Added to CISA KEV catalog',
      })
    }
  }

  return updates
}

/**
 * Generate email subject based on digest content
 */
function generateSubject(digest) {
  const critical = digest.criticalItems.length
  const high = digest.highItems.length

  if (critical > 0) {
    return `🚨 Vigil Daily: ${critical} critical item${critical > 1 ? 's' : ''} need attention`
  } else if (high > 0) {
    return `⚠️ Vigil Daily: ${high} high priority item${high > 1 ? 's' : ''}`
  } else {
    return `📊 Vigil Daily Digest - ${new Date().toLocaleDateString()}`
  }
}

/**
 * Log digest run to sync_log
 */
async function logDigestRun(total, sent, failed) {
  await supabase.from('sync_log').insert({
    source: 'daily_digest',
    status: failed === 0 ? 'success' : 'partial',
    records_added: sent,
    records_updated: 0,
    error_message: failed > 0 ? `${failed} emails failed to send` : null,
    metadata: { total, sent, failed },
  })
}

// Run
main().catch(console.error)
