/**
 * Data Sources Module
 * Management and status of threat intelligence data sources
 */

import { supabase } from './client'
import { logger } from '../logger'

export const dataSources = {
  // Data source definitions
  sources: [
    { id: 'ransomlook', name: 'RansomLook', type: 'ransomware', automated: true, frequency: '6 hours' },
    { id: 'ransomware_live', name: 'Ransomware.live', type: 'ransomware', automated: true, frequency: '6 hours' },
    { id: 'mitre_attack', name: 'MITRE ATT&CK', type: 'apt', automated: true, frequency: '6 hours' },
    { id: 'malpedia', name: 'Malpedia', type: 'malware', automated: true, frequency: '6 hours' },
    { id: 'misp_galaxy', name: 'MISP Galaxy', type: 'actors', automated: true, frequency: '6 hours' },
    { id: 'cisa_kev', name: 'CISA KEV', type: 'vulnerabilities', automated: true, frequency: '6 hours' },
    { id: 'nvd', name: 'NVD', type: 'vulnerabilities', automated: true, frequency: '6 hours' },
    { id: 'threatfox', name: 'ThreatFox', type: 'iocs', automated: true, frequency: '6 hours' },
    { id: 'urlhaus', name: 'URLhaus', type: 'iocs', automated: true, frequency: '6 hours' },
    { id: 'feodo', name: 'Feodo Tracker', type: 'iocs', automated: true, frequency: '6 hours' },
    { id: 'cisa_alerts', name: 'CISA Alerts', type: 'alerts', automated: true, frequency: '6 hours' },
    { id: 'actor_types_seed', name: 'Curated Actors', type: 'actors', automated: false, frequency: 'manual' },
    { id: 'actor_snapshot', name: 'Trend Snapshots', type: 'analytics', automated: true, frequency: '6 hours' },
  ],

  async getSyncStatus() {
    // Get latest sync for each source
    const { data, error } = await supabase
      .from('sync_log')
      .select('source, status, completed_at, records_added, error_message')
      .order('completed_at', { ascending: false })

    if (error) return { data: [], error }

    // Deduplicate to get latest per source
    const latest = new Map()
    for (const row of data || []) {
      if (!latest.has(row.source)) {
        latest.set(row.source, row)
      }
    }

    // Merge with source definitions
    const result = this.sources.map(source => ({
      ...source,
      lastSync: latest.get(source.id)?.completed_at || null,
      lastStatus: latest.get(source.id)?.status || 'never',
      recordsAdded: latest.get(source.id)?.records_added || 0,
      error: latest.get(source.id)?.error_message || null,
    }))

    return { data: result, error: null }
  },

  async getActorTypeCounts() {
    const { data, error } = await supabase
      .from('threat_actors')
      .select('actor_type')

    if (error) return { data: {}, error }

    const counts = {}
    for (const row of data || []) {
      const type = row.actor_type || 'unknown'
      counts[type] = (counts[type] || 0) + 1
    }

    return { data: counts, error: null }
  },

  async triggerManualUpdate(sourceId) {
    const source = this.sources.find(s => s.id === sourceId)
    if (!source) {
      return { success: false, message: 'Unknown data source' }
    }

    if (source.automated) {
      return {
        success: false,
        message: `${source.name} is automated. It updates every ${source.frequency} via GitHub Actions.`
      }
    }

    // For actor_types_seed, actually run the seed
    if (sourceId === 'actor_types_seed') {
      return await this.seedCuratedActors()
    }

    return { success: false, message: 'No handler for this source' }
  },

  // Curated actor data embedded in the app
  curatedActors: {
    cybercrime: [
      { name: 'FIN6', aliases: ['ITG08', 'Skeleton Spider', 'Magecart Group 6'], description: 'Financially motivated cybercrime group known for targeting POS systems and e-commerce platforms.', target_sectors: ['retail', 'hospitality', 'entertainment'], first_seen: '2015-01-01', ttps: ['T1059', 'T1055', 'T1003', 'T1486'] },
      { name: 'FIN7', aliases: ['Carbanak', 'Carbon Spider', 'Sangria Tempest'], description: 'Prolific financially motivated group targeting retail, restaurant, and hospitality sectors.', target_sectors: ['retail', 'hospitality', 'finance'], first_seen: '2013-01-01', ttps: ['T1566', 'T1059', 'T1055', 'T1003'] },
      { name: 'FIN8', aliases: ['Syssphinx'], description: 'Financially motivated group targeting POS environments in hospitality and retail.', target_sectors: ['retail', 'hospitality', 'finance'], first_seen: '2016-01-01', ttps: ['T1059', 'T1053', 'T1003', 'T1055'] },
      { name: 'FIN11', aliases: ['TA505', 'Lace Tempest'], description: 'High-volume financially motivated group known for Clop ransomware and Dridex banking trojan.', target_sectors: ['finance', 'retail', 'healthcare'], first_seen: '2016-01-01', ttps: ['T1566', 'T1059', 'T1486', 'T1190'] },
      { name: 'Scattered Spider', aliases: ['UNC3944', 'Roasted 0ktapus', 'Octo Tempest'], description: 'Young English-speaking cybercrime group known for SIM swapping and social engineering.', target_sectors: ['technology', 'telecommunications', 'gaming'], first_seen: '2022-01-01', ttps: ['T1566', 'T1078', 'T1621', 'T1486'] },
      { name: 'Magecart', aliases: ['Magecart Group', 'Web Skimmers'], description: 'Umbrella term for groups injecting payment card skimmers into e-commerce websites.', target_sectors: ['retail', 'e-commerce'], first_seen: '2015-01-01', ttps: ['T1059', 'T1505', 'T1189'] },
      { name: 'Cobalt Group', aliases: ['Cobalt Gang', 'Cobalt Spider'], description: 'Eastern European cybercrime syndicate targeting banks via ATM attacks and SWIFT.', target_sectors: ['finance'], first_seen: '2016-01-01', ttps: ['T1566', 'T1059', 'T1021', 'T1055'] },
    ],
    hacktivism: [
      { name: 'Anonymous', aliases: ['Anon', 'Anonymous Collective'], description: 'Decentralized international hacktivist collective known for DDoS attacks and data leaks.', target_sectors: ['government', 'finance', 'media'], first_seen: '2003-01-01', ttps: ['T1498', 'T1491', 'T1530'] },
      { name: 'Anonymous Sudan', aliases: ['Storm-1359'], description: 'Pro-Russian hacktivist group conducting DDoS attacks against Western targets.', target_sectors: ['government', 'technology', 'healthcare'], first_seen: '2023-01-01', ttps: ['T1498', 'T1499'] },
      { name: 'Killnet', aliases: ['Killnet Collective'], description: 'Pro-Russian hacktivist group conducting DDoS attacks against NATO countries.', target_sectors: ['government', 'transportation', 'finance'], first_seen: '2022-01-01', ttps: ['T1498', 'T1499'] },
      { name: 'NoName057(16)', aliases: ['NoName', 'NN057'], description: 'Pro-Russian hacktivist group using DDoSia tool for crowdsourced DDoS attacks.', target_sectors: ['government', 'finance', 'transportation'], first_seen: '2022-03-01', ttps: ['T1498', 'T1499'] },
      { name: 'IT Army of Ukraine', aliases: ['IT Army UA'], description: 'Pro-Ukrainian hacktivist collective coordinating cyber attacks against Russian infrastructure.', target_sectors: ['government', 'finance', 'energy'], first_seen: '2022-02-01', ttps: ['T1498', 'T1491', 'T1530'] },
      { name: 'GhostSec', aliases: ['Ghost Security'], description: 'Hacktivist group originally focused on anti-ISIS operations.', target_sectors: ['government', 'energy', 'technology'], first_seen: '2015-01-01', ttps: ['T1498', 'T1491', 'T1530'] },
      { name: 'SiegedSec', aliases: ['Sieged Security'], description: 'Hacktivist group known for breaching organizations over political/social issues.', target_sectors: ['government', 'education'], first_seen: '2022-01-01', ttps: ['T1530', 'T1491', 'T1190'] },
      { name: 'Lapsus$', aliases: ['LAPSUS$', 'DEV-0537'], description: 'Data extortion group targeting large tech companies through social engineering.', target_sectors: ['technology', 'gaming', 'telecommunications'], first_seen: '2021-12-01', ttps: ['T1078', 'T1566', 'T1530', 'T1657'] },
    ],
    initial_access_broker: [
      { name: 'Exotic Lily', aliases: ['TA580', 'Projector Libra'], description: 'Initial access broker using callback phishing and fake business personas.', target_sectors: ['technology', 'healthcare', 'manufacturing'], first_seen: '2021-01-01', ttps: ['T1566', 'T1204', 'T1078'] },
      { name: 'Prophet Spider', aliases: ['UNC961'], description: 'Initial access broker exploiting public-facing applications.', target_sectors: ['technology', 'healthcare', 'education'], first_seen: '2020-01-01', ttps: ['T1190', 'T1505', 'T1078'] },
      { name: 'Qakbot Operators', aliases: ['QBot', 'Quakbot'], description: 'Operators of Qakbot banking trojan, pivoted to initial access brokering.', target_sectors: ['finance', 'manufacturing', 'technology'], first_seen: '2007-01-01', ttps: ['T1566', 'T1055', 'T1059', 'T1021'] },
      { name: 'Emotet Operators', aliases: ['TA542', 'Mummy Spider'], description: 'Operators of Emotet malware-as-a-service, major initial access provider.', target_sectors: ['manufacturing', 'healthcare', 'government'], first_seen: '2014-01-01', ttps: ['T1566', 'T1059', 'T1055', 'T1021'] },
      { name: 'TrickBot Gang', aliases: ['Wizard Spider', 'ITG23'], description: 'Operators of TrickBot and BazarLoader, major initial access provider.', target_sectors: ['healthcare', 'finance', 'manufacturing'], first_seen: '2016-01-01', ttps: ['T1566', 'T1055', 'T1021', 'T1486'] },
    ],
    data_extortion: [
      { name: 'Karakurt', aliases: ['Karakurt Team', 'Karakurt Lair'], description: 'Data extortion group that steals data without deploying ransomware.', target_sectors: ['healthcare', 'technology', 'manufacturing'], first_seen: '2021-06-01', ttps: ['T1530', 'T1567', 'T1657'] },
      { name: 'RansomHouse', aliases: ['Ransom House'], description: 'Data extortion group claiming to be "penetration testers" exposing poor security.', target_sectors: ['healthcare', 'technology', 'retail'], first_seen: '2021-12-01', ttps: ['T1530', 'T1567', 'T1657'] },
      { name: 'Donut Leaks', aliases: ['D0nut', 'Donut'], description: 'Data extortion group known for creative victim shaming.', target_sectors: ['technology', 'manufacturing'], first_seen: '2022-01-01', ttps: ['T1530', 'T1567', 'T1657'] },
    ]
  },

  async seedCuratedActors() {
    logger.info('Seeding curated actors...')
    let totalAdded = 0
    let totalErrors = 0

    for (const [actorType, actors] of Object.entries(this.curatedActors)) {
      for (const actor of actors) {
        const record = {
          name: actor.name,
          aliases: actor.aliases || [],
          actor_type: actorType,
          description: actor.description,
          target_sectors: actor.target_sectors || [],
          first_seen: actor.first_seen,
          ttps: actor.ttps || [],
          source: 'manual_curation',
          status: 'active',
        }

        const { error } = await supabase
          .from('threat_actors')
          .upsert(record, { onConflict: 'name', ignoreDuplicates: false })

        if (error) {
          console.error(`Error upserting ${actor.name}:`, error.message)
          totalErrors++
        } else {
          totalAdded++
        }
      }
    }

    // Log sync
    await supabase.from('sync_log').insert({
      source: 'actor_types_seed',
      status: totalErrors === 0 ? 'success' : 'partial',
      records_processed: Object.values(this.curatedActors).flat().length,
      records_added: totalAdded,
      error_message: totalErrors > 0 ? `${totalErrors} errors` : null,
      completed_at: new Date().toISOString(),
    })

    return {
      success: true,
      message: `Seeded ${totalAdded} curated actors (${totalErrors} errors)`,
      added: totalAdded,
      errors: totalErrors
    }
  }
}

export default dataSources
