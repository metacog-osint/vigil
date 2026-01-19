/**
 * Breach Alert Module
 *
 * Monitors HIBP breaches and alerts users when their organization's
 * domain or related domains appear in new breaches.
 */

import { supabase } from './supabase/client'
import { logger } from './logger'

/**
 * Check if a domain matches the org profile
 */
function domainMatchesOrg(domain, orgProfile) {
  if (!domain || !orgProfile) return false

  // Direct domain match
  if (orgProfile.domain && domain.endsWith(orgProfile.domain)) {
    return true
  }

  // Check vendor domains
  if (orgProfile.tech_vendors) {
    const vendorDomains = getVendorDomains(orgProfile.tech_vendors)
    if (vendorDomains.some((vd) => domain.endsWith(vd))) {
      return true
    }
  }

  return false
}

/**
 * Map common vendors to their domains
 */
function getVendorDomains(vendors) {
  const vendorDomainMap = {
    microsoft: ['microsoft.com', 'azure.com', 'office365.com'],
    google: ['google.com', 'googleapis.com'],
    amazon: ['amazon.com', 'aws.com'],
    salesforce: ['salesforce.com'],
    slack: ['slack.com'],
    zoom: ['zoom.us'],
    dropbox: ['dropbox.com'],
    adobe: ['adobe.com'],
    cisco: ['cisco.com', 'webex.com'],
    okta: ['okta.com'],
    // Add more as needed
  }

  const domains = []
  for (const vendor of vendors) {
    const normalized = vendor.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (vendorDomainMap[normalized]) {
      domains.push(...vendorDomainMap[normalized])
    }
  }
  return domains
}

/**
 * Get recent breaches that may affect the organization
 */
export async function getRelevantBreaches(orgProfile, options = {}) {
  const { daysBack = 30, limit = 50 } = options

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    // Fetch recent breaches
    const { data: breaches, error } = await supabase
      .from('breaches')
      .select('*')
      .gte('breach_date', cutoffDate.toISOString())
      .order('breach_date', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Failed to fetch breaches:', error)
      return []
    }

    if (!breaches || !orgProfile) {
      return breaches || []
    }

    // Score each breach for relevance
    return breaches.map((breach) => {
      const relevance = calculateBreachRelevance(breach, orgProfile)
      return { ...breach, relevance }
    }).filter((b) => b.relevance.score > 0)
      .sort((a, b) => b.relevance.score - a.relevance.score)
  } catch (err) {
    logger.error('Error getting relevant breaches:', err)
    return []
  }
}

/**
 * Calculate how relevant a breach is to the organization
 */
function calculateBreachRelevance(breach, orgProfile) {
  let score = 0
  const reasons = []

  // Check domain match
  if (breach.domain && domainMatchesOrg(breach.domain, orgProfile)) {
    score += 100
    reasons.push('Domain match')
  }

  // Check sector match
  if (orgProfile.sector && breach.metadata?.sector) {
    if (breach.metadata.sector.toLowerCase() === orgProfile.sector.toLowerCase()) {
      score += 50
      reasons.push('Same sector')
    }
  }

  // Check data types exposed
  const sensitiveDataTypes = ['Passwords', 'Credit cards', 'Bank accounts', 'SSN', 'Medical records']
  const exposedSensitive = (breach.data_classes || []).filter((dc) =>
    sensitiveDataTypes.some((sdt) => dc.toLowerCase().includes(sdt.toLowerCase()))
  )
  if (exposedSensitive.length > 0) {
    score += 10 * exposedSensitive.length
    reasons.push(`Sensitive data: ${exposedSensitive.join(', ')}`)
  }

  // Check breach size
  if (breach.pwn_count) {
    if (breach.pwn_count > 1000000) {
      score += 20
      reasons.push('Large breach (1M+)')
    } else if (breach.pwn_count > 100000) {
      score += 10
      reasons.push('Medium breach (100K+)')
    }
  }

  // Check if verified
  if (breach.is_verified) {
    score += 5
    reasons.push('Verified breach')
  }

  return { score, reasons }
}

/**
 * Check if org email domain appears in a specific breach
 */
export async function checkOrgInBreach(breachName, orgDomain) {
  try {
    // This would require HIBP paid API for email search
    // For now, we check against our breach database
    const { data, error } = await supabase
      .from('breach_affected_domains')
      .select('*')
      .eq('breach_name', breachName)
      .eq('domain', orgDomain)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to check org in breach:', error)
    }

    return data !== null
  } catch (err) {
    logger.error('Error checking org in breach:', err)
    return false
  }
}

/**
 * Create breach alert for user
 */
export async function createBreachAlert(userId, breach, relevance) {
  try {
    const { error } = await supabase.from('alerts').insert({
      user_id: userId,
      type: 'breach',
      severity: relevance.score >= 100 ? 'critical' : relevance.score >= 50 ? 'high' : 'medium',
      title: `Breach Alert: ${breach.name}`,
      message: `${breach.title} may affect your organization. ${relevance.reasons.join('. ')}.`,
      metadata: {
        breach_name: breach.name,
        breach_date: breach.breach_date,
        pwn_count: breach.pwn_count,
        data_classes: breach.data_classes,
        relevance_score: relevance.score,
        relevance_reasons: relevance.reasons,
      },
    })

    if (error) {
      logger.error('Failed to create breach alert:', error)
      return false
    }

    return true
  } catch (err) {
    logger.error('Error creating breach alert:', err)
    return false
  }
}

/**
 * Process new breaches and create alerts for affected users
 */
export async function processBreachAlerts() {
  try {
    // Get all users with org profiles
    const { data: profiles, error: profileError } = await supabase
      .from('organization_profiles')
      .select('user_id, domain, sector, tech_vendors')
      .not('domain', 'is', null)

    if (profileError) {
      logger.error('Failed to fetch org profiles:', profileError)
      return { processed: 0, alerts: 0 }
    }

    // Get breaches from last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: newBreaches, error: breachError } = await supabase
      .from('breaches')
      .select('*')
      .gte('created_at', yesterday.toISOString())

    if (breachError) {
      logger.error('Failed to fetch new breaches:', breachError)
      return { processed: 0, alerts: 0 }
    }

    let alertCount = 0

    for (const breach of newBreaches || []) {
      for (const profile of profiles || []) {
        const relevance = calculateBreachRelevance(breach, profile)

        if (relevance.score >= 50) {
          const created = await createBreachAlert(profile.user_id, breach, relevance)
          if (created) alertCount++
        }
      }
    }

    logger.info(`Processed ${newBreaches?.length || 0} breaches, created ${alertCount} alerts`)
    return { processed: newBreaches?.length || 0, alerts: alertCount }
  } catch (err) {
    logger.error('Error processing breach alerts:', err)
    return { processed: 0, alerts: 0 }
  }
}

/**
 * Get breach statistics for dashboard
 */
export async function getBreachStats(daysBack = 30) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const { data, error } = await supabase
      .from('breaches')
      .select('id, pwn_count, data_classes, is_verified')
      .gte('breach_date', cutoffDate.toISOString())

    if (error) {
      logger.error('Failed to fetch breach stats:', error)
      return null
    }

    const stats = {
      totalBreaches: data?.length || 0,
      totalRecordsExposed: data?.reduce((sum, b) => sum + (b.pwn_count || 0), 0) || 0,
      verifiedBreaches: data?.filter((b) => b.is_verified).length || 0,
      dataTypesExposed: [...new Set(data?.flatMap((b) => b.data_classes || []) || [])],
    }

    return stats
  } catch (err) {
    logger.error('Error getting breach stats:', err)
    return null
  }
}

export default {
  getRelevantBreaches,
  checkOrgInBreach,
  createBreachAlert,
  processBreachAlerts,
  getBreachStats,
}
