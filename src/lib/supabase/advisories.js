/**
 * Advisories Module
 * Database queries for GitHub Security Advisories (GHSA)
 * Supply chain vulnerability management for open-source packages
 */

import { supabase } from './client'

// Supported package ecosystems
export const ECOSYSTEMS = [
  { value: 'npm', label: 'npm (JavaScript)' },
  { value: 'pip', label: 'PyPI (Python)' },
  { value: 'maven', label: 'Maven (Java)' },
  { value: 'go', label: 'Go Modules' },
  { value: 'rust', label: 'Cargo (Rust)' },
  { value: 'nuget', label: 'NuGet (.NET)' },
  { value: 'rubygems', label: 'RubyGems' },
  { value: 'composer', label: 'Composer (PHP)' },
]

export const advisories = {
  /**
   * Get all advisories with optional filtering
   */
  async getAll(options = {}) {
    const {
      limit = 50,
      offset = 0,
      ecosystem = null,
      severity = null,
      search = '',
      packageName = null,
    } = options

    let query = supabase
      .from('advisories')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (ecosystem) {
      query = query.eq('ecosystem', ecosystem)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    if (search) {
      query = query.or(
        `ghsa_id.ilike.%${search}%,summary.ilike.%${search}%,package_name.ilike.%${search}%,cve_id.ilike.%${search}%`
      )
    }

    if (packageName) {
      query = query.ilike('package_name', `%${packageName}%`)
    }

    return query
  },

  /**
   * Get advisory by GHSA ID
   */
  async getByGHSA(ghsaId) {
    return supabase
      .from('advisories')
      .select('*')
      .eq('ghsa_id', ghsaId)
      .single()
  },

  /**
   * Get advisories by CVE ID
   */
  async getByCVE(cveId) {
    return supabase
      .from('advisories')
      .select('*')
      .eq('cve_id', cveId)
      .order('published_at', { ascending: false })
  },

  /**
   * Get advisories for a specific package
   */
  async getByPackage(ecosystem, packageName) {
    return supabase
      .from('advisories')
      .select('*')
      .eq('ecosystem', ecosystem)
      .ilike('package_name', packageName)
      .order('severity', { ascending: true }) // critical first
      .order('published_at', { ascending: false })
  },

  /**
   * Get critical advisories across all ecosystems
   */
  async getCritical(limit = 50) {
    return supabase
      .from('advisories')
      .select('*')
      .eq('severity', 'critical')
      .order('published_at', { ascending: false })
      .limit(limit)
  },

  /**
   * Get recent advisories
   */
  async getRecent(days = 30, limit = 50) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    return supabase
      .from('advisories')
      .select('*')
      .gte('published_at', cutoffDate.toISOString())
      .order('published_at', { ascending: false })
      .limit(limit)
  },

  /**
   * Get counts by ecosystem
   */
  async getCountsByEcosystem() {
    const { data, error } = await supabase
      .from('advisories')
      .select('ecosystem, severity')

    if (error || !data) {
      return []
    }

    const counts = {}
    for (const row of data) {
      if (!row.ecosystem) continue

      if (!counts[row.ecosystem]) {
        counts[row.ecosystem] = { ecosystem: row.ecosystem, total: 0, critical: 0, high: 0 }
      }
      counts[row.ecosystem].total++
      if (row.severity === 'critical') counts[row.ecosystem].critical++
      if (row.severity === 'high') counts[row.ecosystem].high++
    }

    return Object.values(counts).sort((a, b) => b.total - a.total)
  },

  /**
   * Get counts by severity
   */
  async getCountsBySeverity() {
    const { data, error } = await supabase
      .from('advisories')
      .select('severity')

    if (error || !data) {
      return [
        { severity: 'critical', count: 0 },
        { severity: 'high', count: 0 },
        { severity: 'moderate', count: 0 },
        { severity: 'low', count: 0 },
      ]
    }

    const counts = { critical: 0, high: 0, moderate: 0, low: 0 }
    for (const row of data) {
      const sev = row.severity?.toLowerCase()
      if (counts[sev] !== undefined) {
        counts[sev]++
      }
    }

    return [
      { severity: 'critical', count: counts.critical },
      { severity: 'high', count: counts.high },
      { severity: 'moderate', count: counts.moderate },
      { severity: 'low', count: counts.low },
    ]
  },

  /**
   * Search advisories by text
   */
  async search(query, limit = 20) {
    return supabase
      .from('advisories')
      .select('*')
      .or(
        `ghsa_id.ilike.%${query}%,summary.ilike.%${query}%,package_name.ilike.%${query}%,cve_id.ilike.%${query}%`
      )
      .order('published_at', { ascending: false })
      .limit(limit)
  },

  /**
   * Get advisories linked to a CVE in our vulnerabilities table
   */
  async getLinkedToCVE(cveId) {
    const { data, error } = await supabase
      .from('cve_advisories')
      .select(`
        advisory:advisories(*)
      `)
      .eq('cve_id', cveId)

    if (error) return { data: [], error }

    return { data: data?.map(r => r.advisory).filter(Boolean) || [], error: null }
  },

  /**
   * Get most affected packages (packages with most advisories)
   */
  async getMostAffectedPackages(limit = 20) {
    const { data, error } = await supabase
      .from('advisories')
      .select('ecosystem, package_name, severity')

    if (error || !data) return []

    // Count advisories per package
    const packageCounts = {}
    for (const row of data) {
      if (!row.package_name) continue

      const key = `${row.ecosystem}:${row.package_name}`
      if (!packageCounts[key]) {
        packageCounts[key] = {
          ecosystem: row.ecosystem,
          package_name: row.package_name,
          total: 0,
          critical: 0,
        }
      }
      packageCounts[key].total++
      if (row.severity === 'critical') packageCounts[key].critical++
    }

    return Object.values(packageCounts)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
  },
}

export default advisories
