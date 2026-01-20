/**
 * Demo Mode Context
 *
 * Provides demo mode state and mock data throughout the app.
 * When in demo mode, components use mock data instead of live API calls.
 */

import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const DemoContext = createContext(null)

// Mock data showcasing correlation features
export const DEMO_DATA = {
  // Threat actors with rich correlation data
  actors: [
    {
      id: 'demo-actor-1',
      name: 'LockBit 3.0',
      actor_type: 'Criminal',
      origin_country: 'Russia',
      description: 'Ransomware-as-a-Service operation, one of the most prolific ransomware groups.',
      trend_status: 'ESCALATING',
      incidents_7d: 12,
      incidents_prev_7d: 5,
      incident_velocity: 1.71,
      target_sectors: ['healthcare', 'manufacturing', 'finance', 'government'],
      target_countries: ['United States', 'Germany', 'United Kingdom', 'France'],
      ttps: ['T1486', 'T1490', 'T1027', 'T1059', 'T1082'],
      aliases: ['LockBit', 'ABCD Ransomware'],
      first_seen: '2019-09-01',
      last_seen: new Date().toISOString(),
    },
    {
      id: 'demo-actor-2',
      name: 'BlackCat (ALPHV)',
      actor_type: 'Criminal',
      origin_country: 'Russia',
      description: 'Sophisticated ransomware group written in Rust, successor to Conti operations.',
      trend_status: 'ESCALATING',
      incidents_7d: 8,
      incidents_prev_7d: 4,
      incident_velocity: 1.14,
      target_sectors: ['healthcare', 'legal', 'finance', 'technology'],
      target_countries: ['United States', 'Canada', 'Australia', 'Germany'],
      ttps: ['T1486', 'T1027', 'T1055', 'T1112', 'T1070'],
      aliases: ['ALPHV', 'Noberus'],
      first_seen: '2021-11-01',
      last_seen: new Date().toISOString(),
    },
    {
      id: 'demo-actor-3',
      name: 'APT29 (Cozy Bear)',
      actor_type: 'Nation-State',
      origin_country: 'Russia',
      description:
        'Russian state-sponsored group associated with SVR, known for supply chain attacks.',
      trend_status: 'STABLE',
      incidents_7d: 2,
      incidents_prev_7d: 2,
      incident_velocity: 0.29,
      target_sectors: ['government', 'defense', 'technology', 'think-tanks'],
      target_countries: ['United States', 'NATO Members', 'Ukraine'],
      ttps: ['T1566', 'T1195', 'T1078', 'T1071', 'T1027'],
      aliases: ['Cozy Bear', 'The Dukes', 'NOBELIUM'],
      first_seen: '2008-01-01',
      last_seen: new Date().toISOString(),
    },
    {
      id: 'demo-actor-4',
      name: 'Cl0p',
      actor_type: 'Criminal',
      origin_country: 'Russia',
      description: 'Ransomware group known for exploiting zero-days in file transfer software.',
      trend_status: 'DECLINING',
      incidents_7d: 3,
      incidents_prev_7d: 15,
      incident_velocity: 0.43,
      target_sectors: ['finance', 'retail', 'healthcare', 'education'],
      target_countries: ['United States', 'United Kingdom', 'Canada'],
      ttps: ['T1190', 'T1486', 'T1567', 'T1070'],
      aliases: ['TA505', 'Clop'],
      first_seen: '2019-02-01',
      last_seen: new Date().toISOString(),
    },
  ],

  // Recent incidents
  incidents: [
    {
      id: 'demo-incident-1',
      victim_name: 'Ascension Health',
      threat_actor: { id: 'demo-actor-2', name: 'BlackCat (ALPHV)' },
      sector: 'healthcare',
      country: 'United States',
      discovered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Major healthcare system impacted by ransomware attack affecting 140 hospitals.',
    },
    {
      id: 'demo-incident-2',
      victim_name: 'Boeing',
      threat_actor: { id: 'demo-actor-1', name: 'LockBit 3.0' },
      sector: 'aerospace',
      country: 'United States',
      discovered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      description: '43GB of data exfiltrated and published after ransom deadline.',
    },
    {
      id: 'demo-incident-3',
      victim_name: 'UK Royal Mail',
      threat_actor: { id: 'demo-actor-1', name: 'LockBit 3.0' },
      sector: 'logistics',
      country: 'United Kingdom',
      discovered_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'International shipping services disrupted for weeks.',
    },
  ],

  // Vulnerabilities with actor correlations
  vulnerabilities: [
    {
      id: 'demo-vuln-1',
      cve_id: 'CVE-2024-21887',
      description: 'Ivanti Connect Secure command injection allowing remote code execution',
      cvss_score: 9.1,
      epss_score: 0.97,
      kev_status: true,
      kev_date_added: '2024-01-10',
      ransomware_campaign: true,
      vendors: ['Ivanti'],
      exploiting_actors: ['APT29 (Cozy Bear)', 'UNC5221'],
    },
    {
      id: 'demo-vuln-2',
      cve_id: 'CVE-2023-34362',
      description: 'MOVEit Transfer SQL injection allowing authentication bypass',
      cvss_score: 9.8,
      epss_score: 0.95,
      kev_status: true,
      kev_date_added: '2023-06-02',
      ransomware_campaign: true,
      vendors: ['Progress Software'],
      exploiting_actors: ['Cl0p'],
    },
    {
      id: 'demo-vuln-3',
      cve_id: 'CVE-2024-1709',
      description: 'ConnectWise ScreenConnect authentication bypass',
      cvss_score: 10.0,
      epss_score: 0.94,
      kev_status: true,
      kev_date_added: '2024-02-22',
      ransomware_campaign: true,
      vendors: ['ConnectWise'],
      exploiting_actors: ['LockBit 3.0', 'BlackCat (ALPHV)'],
    },
  ],

  // IOCs attributed to actors
  iocs: [
    {
      id: 'demo-ioc-1',
      type: 'ip',
      value: '185.220.101.34',
      actor: 'LockBit 3.0',
      confidence: 'high',
      source: 'ThreatFox',
    },
    {
      id: 'demo-ioc-2',
      type: 'domain',
      value: 'lockbit3-ransom.onion',
      actor: 'LockBit 3.0',
      confidence: 'high',
      source: 'Ransomwatch',
    },
    {
      id: 'demo-ioc-3',
      type: 'sha256',
      value: 'a1b2c3d4e5f6...',
      actor: 'BlackCat (ALPHV)',
      confidence: 'high',
      source: 'MalwareBazaar',
    },
    {
      id: 'demo-ioc-4',
      type: 'ip',
      value: '45.129.14.83',
      actor: 'APT29 (Cozy Bear)',
      confidence: 'medium',
      source: 'ThreatFox',
    },
  ],

  // Industry threat landscape
  industryThreats: [
    {
      industry: 'Healthcare',
      event_count: 847,
      unique_actors: 23,
      top_actor: 'LockBit 3.0',
      actor_type: 'Criminal',
      events_last_90d: 156,
    },
    {
      industry: 'Manufacturing',
      event_count: 612,
      unique_actors: 18,
      top_actor: 'LockBit 3.0',
      actor_type: 'Criminal',
      events_last_90d: 98,
    },
    {
      industry: 'Finance',
      event_count: 534,
      unique_actors: 31,
      top_actor: 'BlackCat (ALPHV)',
      actor_type: 'Criminal',
      events_last_90d: 87,
    },
    {
      industry: 'Government',
      event_count: 423,
      unique_actors: 42,
      top_actor: 'APT29 (Cozy Bear)',
      actor_type: 'Nation-State',
      events_last_90d: 65,
    },
    {
      industry: 'Education',
      event_count: 398,
      unique_actors: 15,
      top_actor: 'Vice Society',
      actor_type: 'Criminal',
      events_last_90d: 72,
    },
  ],

  // Country threat data
  countryThreats: [
    {
      country: 'US',
      total_events: 2847,
      unique_actors: 89,
      nation_state_events: 423,
      criminal_events: 2124,
      hacktivist_events: 300,
    },
    {
      country: 'GB',
      total_events: 534,
      unique_actors: 45,
      nation_state_events: 87,
      criminal_events: 412,
      hacktivist_events: 35,
    },
    {
      country: 'DE',
      total_events: 423,
      unique_actors: 38,
      nation_state_events: 65,
      criminal_events: 334,
      hacktivist_events: 24,
    },
    {
      country: 'FR',
      total_events: 312,
      unique_actors: 32,
      nation_state_events: 45,
      criminal_events: 245,
      hacktivist_events: 22,
    },
    {
      country: 'AU',
      total_events: 287,
      unique_actors: 28,
      nation_state_events: 34,
      criminal_events: 231,
      hacktivist_events: 22,
    },
  ],

  // Attack chains
  attackChains: [
    {
      id: 'demo-chain-1',
      name: 'LockBit Healthcare Campaign',
      actor: 'LockBit 3.0',
      target_sectors: ['healthcare'],
      techniques: ['T1566 (Phishing)', 'T1078 (Valid Accounts)', 'T1486 (Data Encrypted)'],
      vulnerabilities: ['CVE-2024-1709'],
      confidence: 'high',
    },
    {
      id: 'demo-chain-2',
      name: 'Cl0p MOVEit Exploitation',
      actor: 'Cl0p',
      target_sectors: ['finance', 'healthcare', 'government'],
      techniques: ['T1190 (Exploit Public App)', 'T1567 (Exfiltration Over Web)'],
      vulnerabilities: ['CVE-2023-34362'],
      confidence: 'high',
    },
  ],

  // Detected patterns
  patterns: [
    {
      id: 'demo-pattern-1',
      type: 'campaign',
      name: 'Healthcare Targeting Surge',
      description: 'Multiple ransomware groups showing increased focus on healthcare sector',
      confidence: 85,
      actors: ['LockBit 3.0', 'BlackCat (ALPHV)'],
      detected_at: new Date().toISOString(),
    },
    {
      id: 'demo-pattern-2',
      type: 'temporal_cluster',
      name: 'Coordinated Activity Burst',
      description: 'Unusual spike in ransomware incidents detected over 48-hour period',
      confidence: 72,
      incident_count: 23,
      detected_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],

  // Dashboard stats
  stats: {
    totalActors: 247,
    incidents30d: 523,
    incidentsTotal: 52847,
    kevTotal: 1124,
    iocTotal: 1247893,
    escalatingActors: 12,
  },

  // AI summary
  aiSummary:
    'LockBit 3.0 and BlackCat continue to dominate ransomware activity, with healthcare seeing a 35% increase in targeting this month. Critical vulnerabilities in Ivanti and ConnectWise products are being actively exploited. APT29 activity remains elevated following recent geopolitical tensions.',

  // Week comparison
  weekComparison: {
    currentWeek: { incidents: 127, iocs: 34521, actors_active: 45 },
    previousWeek: { incidents: 98, iocs: 28934, actors_active: 38 },
    incidentChange: 29.6,
  },
}

export function DemoProvider({ children }) {
  const [isDemoMode, setIsDemoMode] = useState(false)
  const navigate = useNavigate()

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true)
    navigate('/')
  }, [navigate])

  // Exit demo mode and go to registration
  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false)
    navigate('/auth?mode=register')
  }, [navigate])

  // Just clear demo mode state (no navigation)
  const clearDemoMode = useCallback(() => {
    setIsDemoMode(false)
  }, [])

  const value = {
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
    clearDemoMode,
    demoData: DEMO_DATA,
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider')
  }
  return context
}

export default DemoContext
