/**
 * Relevance Scoring Module
 * Personalized intelligence scoring based on organization profile
 */

import { supabase } from './client'

export const relevance = {
  async getRelevantActors(profile, limit = 20) {
    if (!profile?.sector) return { data: [], error: null }

    // Get actors that target the user's sector
    let query = supabase
      .from('threat_actors')
      .select('*')
      .contains('target_sectors', [profile.sector])
      .order('incident_velocity', { ascending: false, nullsFirst: false })
      .limit(limit)

    return query
  },

  async getRelevantVulnerabilities(profile, limit = 50) {
    if (!profile?.tech_vendors?.length) return { data: [], error: null }

    // Get vulnerabilities affecting user's tech stack
    const { data, error } = await supabase
      .from('vulnerabilities')
      .select('*')
      .order('cvss_score', { ascending: false })

    if (error || !data) return { data: [], error }

    // Filter and score by vendor/product match
    const scored = data
      .map(vuln => ({
        ...vuln,
        relevance_score: this.calculateVulnScore(vuln, profile)
      }))
      .filter(v => v.relevance_score > 0)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit)

    return { data: scored, error: null }
  },

  // Calculate actor relevance score (0-100)
  calculateActorScore(actor, profile) {
    if (!profile) return 0
    let score = 0

    // Sector match (50 points)
    if (profile.sector && actor.target_sectors?.includes(profile.sector)) {
      score += 50
    } else if (profile.secondary_sectors?.some(s => actor.target_sectors?.includes(s))) {
      score += 25
    }

    // Country/region match (30 points)
    if (profile.country && actor.target_countries?.includes(profile.country)) {
      score += 30
    }

    // Escalating status bonus (20 points)
    if (actor.trend_status === 'ESCALATING') score += 20
    else if (actor.trend_status === 'STABLE') score += 10

    return Math.min(score, 100)
  },

  // Calculate vulnerability relevance score (0-100)
  calculateVulnScore(vuln, profile) {
    if (!profile) return 0
    let score = 0

    const vendors = (profile.tech_vendors || []).map(v => v.toLowerCase())
    const stack = (profile.tech_stack || []).map(s => s.toLowerCase())

    // Vendor match (40 points)
    if (vuln.affected_vendors?.some(v => vendors.includes(v.toLowerCase()))) {
      score += 40
    }

    // Product match (40 points)
    if (vuln.affected_products?.some(p => stack.some(s => p.toLowerCase().includes(s)))) {
      score += 40
    }

    // KEV status (10 points)
    if (vuln.kev_date) score += 10

    // Ransomware use (10 points)
    if (vuln.ransomware_campaign_use) score += 10

    return Math.min(score, 100)
  },

  // Get relevance label from score
  getRelevanceLabel(score) {
    if (score >= 80) return { label: 'Critical', color: 'red' }
    if (score >= 60) return { label: 'High', color: 'orange' }
    if (score >= 40) return { label: 'Medium', color: 'yellow' }
    if (score >= 20) return { label: 'Low', color: 'blue' }
    return { label: 'Info', color: 'gray' }
  }
}

export default relevance
