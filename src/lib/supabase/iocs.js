/**
 * IOCs (Indicators of Compromise) Module
 * Database queries for IOC management and enrichment
 */

import { supabase } from './client'

/**
 * Detect the type of IOC based on value pattern
 * @param {string} value - IOC value to analyze
 * @returns {string} IOC type
 */
export function detectIOCType(value) {
  if (!value) return 'unknown'

  // CVE pattern
  if (/^CVE-\d{4}-\d+$/i.test(value)) return 'cve'

  // IPv4
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return 'ip'

  // IPv6
  if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value)) return 'ip'

  // SHA256
  if (/^[a-fA-F0-9]{64}$/.test(value)) return 'hash_sha256'

  // SHA1
  if (/^[a-fA-F0-9]{40}$/.test(value)) return 'hash_sha1'

  // MD5
  if (/^[a-fA-F0-9]{32}$/.test(value)) return 'hash_md5'

  // URL
  if (/^https?:\/\//i.test(value)) return 'url'

  // Domain (simple check)
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(value)) return 'domain'

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'

  return 'unknown'
}

export const iocs = {
  async getAll(options = {}) {
    const { limit = 100, offset = 0, type = '', search = '', confidence = '' } = options

    let query = supabase
      .from('iocs')
      .select(
        `
        *,
        threat_actor:threat_actors(id, name)
      `,
        { count: 'exact' }
      )
      .order('last_seen', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('type', type)
    }

    if (search) {
      query = query.ilike('value', `%${search}%`)
    }

    if (confidence) {
      query = query.eq('confidence', confidence)
    }

    return query
  },

  async search(value, type = null) {
    let query = supabase
      .from('iocs')
      .select(
        `
        *,
        threat_actor:threat_actors(id, name)
      `
      )
      .ilike('value', `%${value}%`)
      .order('last_seen', { ascending: false })
      .limit(100)

    if (type) {
      query = query.eq('type', type)
    }

    return query
  },

  async getByActor(actorId, limit = 50) {
    return supabase
      .from('iocs')
      .select('*')
      .eq('actor_id', actorId)
      .order('last_seen', { ascending: false })
      .limit(limit)
  },

  async getRecent(limit = 100) {
    return supabase
      .from('iocs')
      .select(
        `
        *,
        threat_actor:threat_actors(id, name)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit)
  },

  async quickLookup(value) {
    const type = detectIOCType(value)

    const promises = [
      supabase
        .from('iocs')
        .select(
          `
          *,
          threat_actor:threat_actors(id, name, trend_status)
        `
        )
        .or(`value.eq.${value},value.ilike.%${value}%`)
        .order('last_seen', { ascending: false })
        .limit(10),

      supabase
        .from('malware_samples')
        .select('*')
        .or(`sha256.eq.${value},md5.eq.${value},sha1.eq.${value}`)
        .limit(5),
    ]

    if (/^CVE-\d{4}-\d+$/i.test(value)) {
      promises.push(supabase.from('vulnerabilities').select('*').ilike('cve_id', value).limit(1))
    }

    const results = await Promise.all(promises)

    return {
      iocs: results[0].data || [],
      malware: results[1].data || [],
      vulnerabilities: results[2]?.data || [],
      type,
      found:
        results[0].data?.length > 0 || results[1].data?.length > 0 || results[2]?.data?.length > 0,
    }
  },

  getEnrichmentLinks(value, type) {
    const links = []

    switch (type) {
      case 'ip':
        links.push(
          {
            name: 'VirusTotal',
            url: `https://www.virustotal.com/gui/ip-address/${value}`,
            icon: 'virustotal',
          },
          { name: 'Shodan', url: `https://www.shodan.io/host/${value}`, icon: 'shodan' },
          { name: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${value}`, icon: 'abuseipdb' },
          { name: 'Censys', url: `https://search.censys.io/hosts/${value}`, icon: 'censys' }
        )
        break
      case 'hash_sha256':
      case 'hash_md5':
      case 'hash_sha1':
      case 'hash':
        links.push(
          {
            name: 'VirusTotal',
            url: `https://www.virustotal.com/gui/file/${value}`,
            icon: 'virustotal',
          },
          {
            name: 'MalwareBazaar',
            url: `https://bazaar.abuse.ch/browse.php?search=${value}`,
            icon: 'malwarebazaar',
          },
          {
            name: 'Hybrid Analysis',
            url: `https://www.hybrid-analysis.com/search?query=${value}`,
            icon: 'hybrid',
          }
        )
        break
      case 'domain':
        links.push(
          {
            name: 'VirusTotal',
            url: `https://www.virustotal.com/gui/domain/${value}`,
            icon: 'virustotal',
          },
          {
            name: 'URLhaus',
            url: `https://urlhaus.abuse.ch/browse.php?search=${value}`,
            icon: 'urlhaus',
          },
          {
            name: 'Shodan',
            url: `https://www.shodan.io/search?query=hostname%3A${value}`,
            icon: 'shodan',
          }
        )
        break
      case 'url':
        const encoded = encodeURIComponent(value)
        links.push(
          {
            name: 'VirusTotal',
            url: `https://www.virustotal.com/gui/url/${encoded}`,
            icon: 'virustotal',
          },
          {
            name: 'URLhaus',
            url: `https://urlhaus.abuse.ch/browse.php?search=${encoded}`,
            icon: 'urlhaus',
          }
        )
        break
      case 'cve':
        links.push(
          { name: 'NVD', url: `https://nvd.nist.gov/vuln/detail/${value}`, icon: 'nvd' },
          {
            name: 'CISA KEV',
            url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`,
            icon: 'cisa',
          },
          { name: 'CVE.org', url: `https://www.cve.org/CVERecord?id=${value}`, icon: 'cve' },
          {
            name: 'Exploit-DB',
            url: `https://www.exploit-db.com/search?cve=${value}`,
            icon: 'exploitdb',
          }
        )
        break
      default:
        links.push({
          name: 'VirusTotal',
          url: `https://www.virustotal.com/gui/search/${encodeURIComponent(value)}`,
          icon: 'virustotal',
        })
    }

    return links
  },
}

export default iocs
