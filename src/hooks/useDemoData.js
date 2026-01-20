/**
 * Demo Data Hook
 *
 * Provides mock data that matches the Supabase API patterns.
 * Components can use this hook to get data regardless of demo mode.
 */

import { useDemo } from '../contexts/DemoContext'
import { useCallback, useMemo } from 'react'

// Helper to create Supabase-like response
const mockResponse = (data, count = null) => ({
  data,
  error: null,
  count: count ?? data?.length ?? 0,
})

// Generate dates relative to now
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
const today = () => new Date().toISOString()

// ============================================================================
// MOCK DATA - Rich, realistic data showcasing correlations
// ============================================================================

const MOCK_ACTORS = [
  {
    id: 'demo-actor-lockbit',
    name: 'LockBit 3.0',
    actor_type: 'Ransomware',
    origin_country: 'Russia',
    description: 'LockBit is one of the most prolific Ransomware-as-a-Service (RaaS) operations globally. Known for fast encryption, double extortion tactics, and their bug bounty program for finding vulnerabilities in their own malware.',
    trend_status: 'ESCALATING',
    status: 'active',
    incidents_7d: 12,
    incidents_prev_7d: 5,
    incident_velocity: 1.71,
    target_sectors: ['healthcare', 'manufacturing', 'finance', 'government', 'education'],
    target_countries: ['United States', 'Germany', 'United Kingdom', 'France', 'Italy'],
    ttps: ['T1486', 'T1490', 'T1027', 'T1059', 'T1082', 'T1083', 'T1057', 'T1021'],
    aliases: ['LockBit', 'ABCD Ransomware', 'LockBit Black'],
    first_seen: '2019-09-01',
    last_seen: today(),
    created_at: '2019-09-01T00:00:00Z',
    metadata: { affiliate_count: 100, ransom_range: '$50K - $50M' },
  },
  {
    id: 'demo-actor-blackcat',
    name: 'BlackCat (ALPHV)',
    actor_type: 'Ransomware',
    origin_country: 'Russia',
    description: 'Sophisticated ransomware group using Rust-based malware. Believed to be a rebrand/successor of DarkSide and BlackMatter operations. Known for targeting critical infrastructure and high-value targets.',
    trend_status: 'ESCALATING',
    status: 'active',
    incidents_7d: 8,
    incidents_prev_7d: 4,
    incident_velocity: 1.14,
    target_sectors: ['healthcare', 'legal', 'finance', 'technology', 'energy'],
    target_countries: ['United States', 'Canada', 'Australia', 'Germany', 'United Kingdom'],
    ttps: ['T1486', 'T1027', 'T1055', 'T1112', 'T1070', 'T1562', 'T1490'],
    aliases: ['ALPHV', 'Noberus', 'BlackCat'],
    first_seen: '2021-11-01',
    last_seen: today(),
    created_at: '2021-11-01T00:00:00Z',
    metadata: { written_in: 'Rust', affiliate_count: 60 },
  },
  {
    id: 'demo-actor-apt29',
    name: 'APT29 (Cozy Bear)',
    actor_type: 'Nation-State',
    origin_country: 'Russia',
    description: 'Russian state-sponsored threat group associated with the SVR (Foreign Intelligence Service). Known for SolarWinds supply chain attack and targeting government, diplomatic, and research organizations.',
    trend_status: 'STABLE',
    status: 'active',
    incidents_7d: 2,
    incidents_prev_7d: 2,
    incident_velocity: 0.29,
    target_sectors: ['government', 'defense', 'technology', 'think-tanks', 'healthcare'],
    target_countries: ['United States', 'NATO Members', 'Ukraine', 'European Union'],
    ttps: ['T1566', 'T1195', 'T1078', 'T1071', 'T1027', 'T1053', 'T1059'],
    aliases: ['Cozy Bear', 'The Dukes', 'NOBELIUM', 'Midnight Blizzard', 'UNC2452'],
    first_seen: '2008-01-01',
    last_seen: today(),
    created_at: '2008-01-01T00:00:00Z',
    metadata: { sponsor: 'SVR', sophistication: 'High' },
  },
  {
    id: 'demo-actor-clop',
    name: 'Cl0p',
    actor_type: 'Ransomware',
    origin_country: 'Russia',
    description: 'Ransomware group notorious for exploiting zero-day vulnerabilities in file transfer software (MOVEit, GoAnywhere, Accellion). Focuses on data theft and extortion over encryption.',
    trend_status: 'DECLINING',
    status: 'active',
    incidents_7d: 3,
    incidents_prev_7d: 15,
    incident_velocity: 0.43,
    target_sectors: ['finance', 'retail', 'healthcare', 'education', 'government'],
    target_countries: ['United States', 'United Kingdom', 'Canada', 'Germany'],
    ttps: ['T1190', 'T1486', 'T1567', 'T1070', 'T1059', 'T1083'],
    aliases: ['TA505', 'Clop', 'Cl0p Ransomware'],
    first_seen: '2019-02-01',
    last_seen: today(),
    created_at: '2019-02-01T00:00:00Z',
    metadata: { specialty: 'Zero-day exploitation' },
  },
  {
    id: 'demo-actor-play',
    name: 'Play Ransomware',
    actor_type: 'Ransomware',
    origin_country: 'Unknown',
    description: 'Emerging ransomware group that has rapidly grown in 2024. Uses similar tactics to Hive and Nokoyawa. Known for targeting SMBs and mid-market enterprises.',
    trend_status: 'ESCALATING',
    status: 'active',
    incidents_7d: 6,
    incidents_prev_7d: 3,
    incident_velocity: 0.86,
    target_sectors: ['manufacturing', 'construction', 'retail', 'healthcare'],
    target_countries: ['United States', 'Brazil', 'Argentina', 'Germany'],
    ttps: ['T1486', 'T1059', 'T1047', 'T1021', 'T1082'],
    aliases: ['PlayCrypt', 'Play'],
    first_seen: '2022-06-01',
    last_seen: today(),
    created_at: '2022-06-01T00:00:00Z',
    metadata: {},
  },
  {
    id: 'demo-actor-lazarus',
    name: 'Lazarus Group',
    actor_type: 'Nation-State',
    origin_country: 'North Korea',
    description: 'North Korean state-sponsored APT known for financially motivated attacks, cryptocurrency theft, and destructive malware. Responsible for WannaCry, Sony Pictures hack, and numerous bank heists.',
    trend_status: 'STABLE',
    status: 'active',
    incidents_7d: 1,
    incidents_prev_7d: 1,
    incident_velocity: 0.14,
    target_sectors: ['finance', 'cryptocurrency', 'defense', 'aerospace', 'entertainment'],
    target_countries: ['United States', 'South Korea', 'Japan', 'Global'],
    ttps: ['T1566', 'T1059', 'T1027', 'T1071', 'T1486', 'T1195'],
    aliases: ['Hidden Cobra', 'Zinc', 'APT38', 'Guardians of Peace'],
    first_seen: '2009-01-01',
    last_seen: today(),
    created_at: '2009-01-01T00:00:00Z',
    metadata: { sponsor: 'RGB', motivation: 'Financial, Espionage' },
  },
]

const MOCK_INCIDENTS = [
  {
    id: 'demo-inc-1',
    victim_name: 'Ascension Health',
    victim_sector: 'healthcare',
    victim_country: 'United States',
    actor_id: 'demo-actor-blackcat',
    threat_actor: { id: 'demo-actor-blackcat', name: 'BlackCat (ALPHV)' },
    discovered_date: daysAgo(2),
    description: 'Major healthcare system impacted by ransomware attack affecting 140 hospitals across 19 states. EHR systems offline, diverting ambulances.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { hospitals_affected: 140, states: 19 },
  },
  {
    id: 'demo-inc-2',
    victim_name: 'Boeing',
    victim_sector: 'aerospace',
    victim_country: 'United States',
    actor_id: 'demo-actor-lockbit',
    threat_actor: { id: 'demo-actor-lockbit', name: 'LockBit 3.0' },
    discovered_date: daysAgo(5),
    description: '43GB of data exfiltrated and published after ransom deadline passed. Includes supplier information and internal communications.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { data_size: '43GB' },
  },
  {
    id: 'demo-inc-3',
    victim_name: 'UK Royal Mail',
    victim_sector: 'logistics',
    victim_country: 'United Kingdom',
    actor_id: 'demo-actor-lockbit',
    threat_actor: { id: 'demo-actor-lockbit', name: 'LockBit 3.0' },
    discovered_date: daysAgo(10),
    description: 'International shipping services disrupted for weeks. Ransom negotiation transcripts leaked showing $80M demand.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { ransom_amount: '$80M' },
  },
  {
    id: 'demo-inc-4',
    victim_name: 'MGM Resorts',
    victim_sector: 'hospitality',
    victim_country: 'United States',
    actor_id: 'demo-actor-blackcat',
    threat_actor: { id: 'demo-actor-blackcat', name: 'BlackCat (ALPHV)' },
    discovered_date: daysAgo(12),
    description: 'Casino and hotel operations disrupted. Slot machines, room keys, and reservation systems impacted. Social engineering via help desk.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { estimated_loss: '$100M' },
  },
  {
    id: 'demo-inc-5',
    victim_name: 'Change Healthcare',
    victim_sector: 'healthcare',
    victim_country: 'United States',
    actor_id: 'demo-actor-blackcat',
    threat_actor: { id: 'demo-actor-blackcat', name: 'BlackCat (ALPHV)' },
    discovered_date: daysAgo(15),
    description: 'Healthcare payment processor breach affecting pharmacies and providers nationwide. Prescription processing delayed for millions.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { ransom_paid: '$22M' },
  },
  {
    id: 'demo-inc-6',
    victim_name: 'Clorox Company',
    victim_sector: 'manufacturing',
    victim_country: 'United States',
    actor_id: 'demo-actor-lockbit',
    threat_actor: { id: 'demo-actor-lockbit', name: 'LockBit 3.0' },
    discovered_date: daysAgo(18),
    description: 'Consumer goods manufacturer hit with ransomware. Production and distribution impacted, product shortages reported.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: {},
  },
  {
    id: 'demo-inc-7',
    victim_name: 'Johnson Controls',
    victim_sector: 'manufacturing',
    victim_country: 'United States',
    actor_id: 'demo-actor-play',
    threat_actor: { id: 'demo-actor-play', name: 'Play Ransomware' },
    discovered_date: daysAgo(20),
    description: 'Building automation and security systems vendor breached. 27TB of data stolen including DHS floor plans.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { data_size: '27TB', ransom_amount: '$51M' },
  },
  {
    id: 'demo-inc-8',
    victim_name: 'MOVEit Mass Exploitation',
    victim_sector: 'multiple',
    victim_country: 'Global',
    actor_id: 'demo-actor-clop',
    threat_actor: { id: 'demo-actor-clop', name: 'Cl0p' },
    discovered_date: daysAgo(25),
    description: 'Mass exploitation of MOVEit Transfer CVE-2023-34362. Over 2,500 organizations impacted including government agencies.',
    status: 'confirmed',
    source: 'ransomwatch',
    data_stolen: true,
    ransom_demanded: true,
    metadata: { victims_count: 2500 },
  },
]

const MOCK_VULNERABILITIES = [
  {
    id: 'demo-vuln-1',
    cve_id: 'CVE-2024-21887',
    description: 'Ivanti Connect Secure and Policy Secure contain a command injection vulnerability in the web component that allows an authenticated administrator to send specially crafted requests and execute arbitrary commands.',
    cvss_score: 9.1,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H',
    epss_score: 0.97,
    epss_percentile: 99,
    kev_date: '2024-01-10',
    published_date: '2024-01-12',
    vendor: 'Ivanti',
    product: 'Connect Secure',
    cwe_id: 'CWE-77',
    references: ['https://www.ivanti.com/security'],
    exploiting_actors: ['APT29 (Cozy Bear)', 'UNC5221', 'Volt Typhoon'],
    metadata: { actively_exploited: true, ransomware_campaign: true },
  },
  {
    id: 'demo-vuln-2',
    cve_id: 'CVE-2023-34362',
    description: 'Progress MOVEit Transfer SQL injection vulnerability allows unauthenticated attackers to access the database and execute arbitrary code.',
    cvss_score: 9.8,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    epss_score: 0.95,
    epss_percentile: 98,
    kev_date: '2023-06-02',
    published_date: '2023-05-31',
    vendor: 'Progress Software',
    product: 'MOVEit Transfer',
    cwe_id: 'CWE-89',
    references: ['https://www.progress.com/security'],
    exploiting_actors: ['Cl0p'],
    metadata: { actively_exploited: true, ransomware_campaign: true, mass_exploitation: true },
  },
  {
    id: 'demo-vuln-3',
    cve_id: 'CVE-2024-1709',
    description: 'ConnectWise ScreenConnect authentication bypass vulnerability allows attackers to create admin accounts and execute code remotely.',
    cvss_score: 10.0,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
    epss_score: 0.94,
    epss_percentile: 97,
    kev_date: '2024-02-22',
    published_date: '2024-02-19',
    vendor: 'ConnectWise',
    product: 'ScreenConnect',
    cwe_id: 'CWE-288',
    references: ['https://www.connectwise.com/security'],
    exploiting_actors: ['LockBit 3.0', 'BlackCat (ALPHV)', 'Black Basta'],
    metadata: { actively_exploited: true, ransomware_campaign: true },
  },
  {
    id: 'demo-vuln-4',
    cve_id: 'CVE-2024-3400',
    description: 'Palo Alto Networks PAN-OS command injection vulnerability in GlobalProtect gateway. Allows unauthenticated RCE with root privileges.',
    cvss_score: 10.0,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
    epss_score: 0.96,
    epss_percentile: 99,
    kev_date: '2024-04-12',
    published_date: '2024-04-12',
    vendor: 'Palo Alto Networks',
    product: 'PAN-OS',
    cwe_id: 'CWE-77',
    references: ['https://security.paloaltonetworks.com'],
    exploiting_actors: ['UTA0218', 'Multiple APTs'],
    metadata: { actively_exploited: true, zero_day: true },
  },
  {
    id: 'demo-vuln-5',
    cve_id: 'CVE-2023-4966',
    description: 'Citrix NetScaler ADC and Gateway sensitive information disclosure (Citrix Bleed). Allows session token theft.',
    cvss_score: 9.4,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L',
    epss_score: 0.93,
    epss_percentile: 96,
    kev_date: '2023-10-18',
    published_date: '2023-10-10',
    vendor: 'Citrix',
    product: 'NetScaler ADC',
    cwe_id: 'CWE-119',
    references: ['https://support.citrix.com/security'],
    exploiting_actors: ['LockBit 3.0', 'Medusa', 'Multiple Groups'],
    metadata: { actively_exploited: true, ransomware_campaign: true },
  },
]

const MOCK_IOCS = [
  { id: 'demo-ioc-1', type: 'ip', value: '185.220.101.34', actor_id: 'demo-actor-lockbit', actor_name: 'LockBit 3.0', confidence: 'high', source: 'ThreatFox', first_seen: daysAgo(5), last_seen: today(), tags: ['c2', 'ransomware'] },
  { id: 'demo-ioc-2', type: 'domain', value: 'lockbit3753ekiocyo5epmpy6klmejchjtzddoekjlnt6mu3qh4de2id.onion', actor_id: 'demo-actor-lockbit', actor_name: 'LockBit 3.0', confidence: 'high', source: 'Ransomwatch', first_seen: daysAgo(30), last_seen: today(), tags: ['leak-site', 'tor'] },
  { id: 'demo-ioc-3', type: 'sha256', value: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456', actor_id: 'demo-actor-blackcat', actor_name: 'BlackCat (ALPHV)', confidence: 'high', source: 'MalwareBazaar', first_seen: daysAgo(10), last_seen: daysAgo(2), tags: ['ransomware', 'rust'] },
  { id: 'demo-ioc-4', type: 'ip', value: '45.129.14.83', actor_id: 'demo-actor-apt29', actor_name: 'APT29 (Cozy Bear)', confidence: 'medium', source: 'ThreatFox', first_seen: daysAgo(20), last_seen: daysAgo(5), tags: ['apt', 'c2'] },
  { id: 'demo-ioc-5', type: 'domain', value: 'update-microsoft-security.com', actor_id: 'demo-actor-apt29', actor_name: 'APT29 (Cozy Bear)', confidence: 'high', source: 'URLhaus', first_seen: daysAgo(15), last_seen: daysAgo(3), tags: ['phishing', 'typosquat'] },
  { id: 'demo-ioc-6', type: 'ip', value: '91.215.85.142', actor_id: 'demo-actor-clop', actor_name: 'Cl0p', confidence: 'high', source: 'ThreatFox', first_seen: daysAgo(25), last_seen: daysAgo(8), tags: ['c2', 'moveit'] },
  { id: 'demo-ioc-7', type: 'sha256', value: 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678', actor_id: 'demo-actor-play', actor_name: 'Play Ransomware', confidence: 'high', source: 'MalwareBazaar', first_seen: daysAgo(7), last_seen: daysAgo(1), tags: ['ransomware', 'encryptor'] },
  { id: 'demo-ioc-8', type: 'url', value: 'hxxps://malicious-update[.]com/payload.exe', actor_id: 'demo-actor-lockbit', actor_name: 'LockBit 3.0', confidence: 'medium', source: 'URLhaus', first_seen: daysAgo(3), last_seen: today(), tags: ['payload', 'dropper'] },
]

const MOCK_PATTERNS = [
  {
    id: 'demo-pattern-1',
    type: 'campaign',
    name: 'Healthcare Targeting Surge',
    description: 'Multiple ransomware groups showing coordinated increase in healthcare sector targeting. LockBit and BlackCat leading with 35% increase in healthcare victims.',
    confidence: 85,
    severity: 'high',
    actors: ['LockBit 3.0', 'BlackCat (ALPHV)'],
    sectors: ['healthcare'],
    indicators: ['Increased affiliate recruitment', 'New healthcare-specific TTPs', 'Timing around open enrollment'],
    detected_at: daysAgo(3),
    status: 'active',
  },
  {
    id: 'demo-pattern-2',
    type: 'temporal_cluster',
    name: 'Weekend Activity Spike',
    description: 'Unusual 48-hour burst of ransomware deployment detected across multiple groups. 23 incidents in 48 hours vs. typical 8-10.',
    confidence: 72,
    severity: 'medium',
    actors: ['Multiple'],
    incident_count: 23,
    baseline_count: 9,
    detected_at: daysAgo(5),
    status: 'resolved',
  },
  {
    id: 'demo-pattern-3',
    type: 'ttp_cluster',
    name: 'ScreenConnect Exploitation Wave',
    description: 'Mass exploitation of CVE-2024-1709 detected. At least 5 ransomware groups actively targeting unpatched ScreenConnect instances.',
    confidence: 92,
    severity: 'critical',
    actors: ['LockBit 3.0', 'BlackCat (ALPHV)', 'Black Basta', 'Play Ransomware', 'Akira'],
    cves: ['CVE-2024-1709'],
    detected_at: daysAgo(1),
    status: 'active',
  },
  {
    id: 'demo-pattern-4',
    type: 'geographic',
    name: 'LATAM Expansion',
    description: 'Play Ransomware showing significant expansion into Latin American markets. Brazil and Argentina incidents up 200% month-over-month.',
    confidence: 78,
    severity: 'medium',
    actors: ['Play Ransomware'],
    regions: ['Brazil', 'Argentina', 'Mexico', 'Chile'],
    detected_at: daysAgo(7),
    status: 'active',
  },
]

const MOCK_ATTACK_CHAINS = [
  {
    id: 'demo-chain-1',
    name: 'LockBit Healthcare Campaign 2024',
    description: 'Coordinated campaign targeting US healthcare organizations via compromised RMM tools and vulnerable Citrix appliances.',
    actor_id: 'demo-actor-lockbit',
    actor_name: 'LockBit 3.0',
    target_sectors: ['healthcare'],
    target_countries: ['United States'],
    stages: [
      { phase: 'Initial Access', technique: 'T1190', description: 'Exploit Citrix Bleed (CVE-2023-4966)' },
      { phase: 'Initial Access', technique: 'T1133', description: 'Compromised ScreenConnect (CVE-2024-1709)' },
      { phase: 'Execution', technique: 'T1059.001', description: 'PowerShell for payload delivery' },
      { phase: 'Persistence', technique: 'T1547', description: 'Registry run keys' },
      { phase: 'Defense Evasion', technique: 'T1562.001', description: 'Disable security tools' },
      { phase: 'Lateral Movement', technique: 'T1021.001', description: 'RDP with stolen credentials' },
      { phase: 'Exfiltration', technique: 'T1567', description: 'Data exfil to cloud storage' },
      { phase: 'Impact', technique: 'T1486', description: 'LockBit 3.0 ransomware deployment' },
    ],
    vulnerabilities: ['CVE-2023-4966', 'CVE-2024-1709'],
    iocs: ['185.220.101.34', 'lockbit3753ekiocyo5epmpy6klmejchjtzddoekjlnt6mu3qh4de2id.onion'],
    confidence: 'high',
    first_seen: daysAgo(30),
    last_seen: daysAgo(2),
    status: 'active',
  },
  {
    id: 'demo-chain-2',
    name: 'Cl0p MOVEit Mass Exploitation',
    description: 'Zero-day exploitation campaign targeting MOVEit Transfer instances globally. Data theft focused with no encryption.',
    actor_id: 'demo-actor-clop',
    actor_name: 'Cl0p',
    target_sectors: ['finance', 'healthcare', 'government', 'education'],
    target_countries: ['United States', 'United Kingdom', 'Canada', 'Germany'],
    stages: [
      { phase: 'Initial Access', technique: 'T1190', description: 'Exploit MOVEit SQL injection (CVE-2023-34362)' },
      { phase: 'Execution', technique: 'T1059', description: 'Web shell deployment' },
      { phase: 'Collection', technique: 'T1005', description: 'Automated data collection from file transfers' },
      { phase: 'Exfiltration', technique: 'T1567', description: 'Mass data exfiltration' },
      { phase: 'Impact', technique: 'T1657', description: 'Extortion via leak site' },
    ],
    vulnerabilities: ['CVE-2023-34362'],
    iocs: ['91.215.85.142'],
    confidence: 'high',
    first_seen: daysAgo(180),
    last_seen: daysAgo(25),
    status: 'concluded',
  },
  {
    id: 'demo-chain-3',
    name: 'APT29 Government Targeting 2024',
    description: 'Ongoing espionage campaign targeting government and diplomatic organizations via phishing and supply chain compromise.',
    actor_id: 'demo-actor-apt29',
    actor_name: 'APT29 (Cozy Bear)',
    target_sectors: ['government', 'defense', 'think-tanks'],
    target_countries: ['United States', 'NATO Members', 'Ukraine'],
    stages: [
      { phase: 'Reconnaissance', technique: 'T1598', description: 'Spearphishing for information' },
      { phase: 'Initial Access', technique: 'T1566.002', description: 'Spearphishing link to credential harvester' },
      { phase: 'Initial Access', technique: 'T1195.002', description: 'Compromise software supply chain' },
      { phase: 'Persistence', technique: 'T1078', description: 'Valid cloud accounts' },
      { phase: 'Collection', technique: 'T1114', description: 'Email collection' },
      { phase: 'Exfiltration', technique: 'T1041', description: 'Exfil over C2 channel' },
    ],
    vulnerabilities: ['CVE-2024-21887'],
    iocs: ['45.129.14.83', 'update-microsoft-security.com'],
    confidence: 'high',
    first_seen: daysAgo(90),
    last_seen: daysAgo(5),
    status: 'active',
  },
]

const MOCK_INDUSTRY_THREATS = [
  { industry: 'Healthcare', event_count: 847, unique_actors: 23, top_actor: 'LockBit 3.0', actor_type: 'Ransomware', events_last_90d: 156, trend: 35 },
  { industry: 'Manufacturing', event_count: 612, unique_actors: 18, top_actor: 'LockBit 3.0', actor_type: 'Ransomware', events_last_90d: 98, trend: 12 },
  { industry: 'Finance', event_count: 534, unique_actors: 31, top_actor: 'BlackCat (ALPHV)', actor_type: 'Ransomware', events_last_90d: 87, trend: -5 },
  { industry: 'Government', event_count: 423, unique_actors: 42, top_actor: 'APT29 (Cozy Bear)', actor_type: 'Nation-State', events_last_90d: 65, trend: 8 },
  { industry: 'Education', event_count: 398, unique_actors: 15, top_actor: 'Vice Society', actor_type: 'Ransomware', events_last_90d: 72, trend: 22 },
  { industry: 'Technology', event_count: 356, unique_actors: 28, top_actor: 'Lazarus Group', actor_type: 'Nation-State', events_last_90d: 54, trend: 15 },
  { industry: 'Retail', event_count: 289, unique_actors: 14, top_actor: 'Cl0p', actor_type: 'Ransomware', events_last_90d: 45, trend: -18 },
  { industry: 'Energy', event_count: 234, unique_actors: 19, top_actor: 'BlackCat (ALPHV)', actor_type: 'Ransomware', events_last_90d: 38, trend: 28 },
]

const MOCK_COUNTRY_THREATS = [
  { country: 'US', country_name: 'United States', total_events: 2847, unique_actors: 89, nation_state_events: 423, criminal_events: 2124, hacktivist_events: 300 },
  { country: 'GB', country_name: 'United Kingdom', total_events: 534, unique_actors: 45, nation_state_events: 87, criminal_events: 412, hacktivist_events: 35 },
  { country: 'DE', country_name: 'Germany', total_events: 423, unique_actors: 38, nation_state_events: 65, criminal_events: 334, hacktivist_events: 24 },
  { country: 'FR', country_name: 'France', total_events: 312, unique_actors: 32, nation_state_events: 45, criminal_events: 245, hacktivist_events: 22 },
  { country: 'AU', country_name: 'Australia', total_events: 287, unique_actors: 28, nation_state_events: 34, criminal_events: 231, hacktivist_events: 22 },
  { country: 'CA', country_name: 'Canada', total_events: 265, unique_actors: 25, nation_state_events: 28, criminal_events: 215, hacktivist_events: 22 },
  { country: 'BR', country_name: 'Brazil', total_events: 198, unique_actors: 18, nation_state_events: 12, criminal_events: 172, hacktivist_events: 14 },
  { country: 'JP', country_name: 'Japan', total_events: 156, unique_actors: 22, nation_state_events: 45, criminal_events: 98, hacktivist_events: 13 },
]

// Generate daily counts for charts
const generateDailyCounts = (days = 90, baseCount = 15, variance = 10) => {
  const counts = []
  for (let i = days; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const count = Math.max(0, baseCount + Math.floor(Math.random() * variance * 2) - variance)
    counts.push({
      date: date.toISOString().split('T')[0],
      count,
    })
  }
  return counts
}

// Generate sector breakdown
const generateSectorBreakdown = () => [
  { name: 'Healthcare', value: 156 },
  { name: 'Manufacturing', value: 98 },
  { name: 'Finance', value: 87 },
  { name: 'Government', value: 65 },
  { name: 'Education', value: 72 },
  { name: 'Technology', value: 54 },
  { name: 'Retail', value: 45 },
  { name: 'Energy', value: 38 },
  { name: 'Legal', value: 32 },
  { name: 'Construction', value: 28 },
]

// ============================================================================
// DEMO DATA HOOK
// ============================================================================

export function useDemoData() {
  const { isDemoMode } = useDemo()

  // Dashboard functions
  const getDashboardOverview = useCallback(async () => {
    if (!isDemoMode) return null
    return mockResponse({
      totalActors: 247,
      incidents30d: 523,
      incidentsTotal: 52847,
      kevTotal: 1124,
      iocTotal: 1247893,
      escalatingActors: MOCK_ACTORS.filter(a => a.trend_status === 'ESCALATING').length,
    })
  }, [isDemoMode])

  // Threat Actors functions
  const getActors = useCallback(async (options = {}) => {
    if (!isDemoMode) return null
    const { limit = 100, search = '', trendStatus = '', actorType = '' } = options

    let filtered = [...MOCK_ACTORS]

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(searchLower) ||
        a.aliases?.some(alias => alias.toLowerCase().includes(searchLower))
      )
    }

    if (trendStatus) {
      filtered = filtered.filter(a => a.trend_status === trendStatus)
    }

    if (actorType) {
      filtered = filtered.filter(a => a.actor_type.toLowerCase() === actorType.toLowerCase())
    }

    return mockResponse(filtered.slice(0, limit), filtered.length)
  }, [isDemoMode])

  const getActorById = useCallback(async (id) => {
    if (!isDemoMode) return null
    const actor = MOCK_ACTORS.find(a => a.id === id)
    return mockResponse(actor)
  }, [isDemoMode])

  const getEscalatingActors = useCallback(async (limit = 10) => {
    if (!isDemoMode) return null
    const escalating = MOCK_ACTORS
      .filter(a => a.trend_status === 'ESCALATING')
      .sort((a, b) => b.incident_velocity - a.incident_velocity)
      .slice(0, limit)
    return mockResponse(escalating)
  }, [isDemoMode])

  const getTopActors = useCallback(async (_days = 30, limit = 10) => {
    if (!isDemoMode) return null
    const sorted = [...MOCK_ACTORS]
      .sort((a, b) => b.incidents_7d - a.incidents_7d)
      .slice(0, limit)
      .map(actor => ({
        ...actor,
        incident_count: [{ count: actor.incidents_7d * 4 }], // Approximate 30-day count
      }))
    return mockResponse(sorted)
  }, [isDemoMode])

  const getTrendSummary = useCallback(async () => {
    if (!isDemoMode) return null
    return {
      escalating: MOCK_ACTORS.filter(a => a.trend_status === 'ESCALATING').length,
      stable: MOCK_ACTORS.filter(a => a.trend_status === 'STABLE').length,
      declining: MOCK_ACTORS.filter(a => a.trend_status === 'DECLINING').length,
    }
  }, [isDemoMode])

  // Incidents functions
  const getIncidents = useCallback(async (options = {}) => {
    if (!isDemoMode) return null
    const { limit = 50, search = '', sector = '' } = options

    let filtered = [...MOCK_INCIDENTS]

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(i =>
        i.victim_name.toLowerCase().includes(searchLower) ||
        i.victim_sector?.toLowerCase().includes(searchLower)
      )
    }

    if (sector) {
      filtered = filtered.filter(i => i.victim_sector === sector)
    }

    return mockResponse(filtered.slice(0, limit), filtered.length)
  }, [isDemoMode])

  const getRecentIncidents = useCallback(async (options = {}) => {
    if (!isDemoMode) return null
    const { limit = 50 } = options
    return mockResponse(MOCK_INCIDENTS.slice(0, limit), MOCK_INCIDENTS.length)
  }, [isDemoMode])

  const getDailyCounts = useCallback(async (days = 90) => {
    if (!isDemoMode) return null
    return generateDailyCounts(days)
  }, [isDemoMode])

  const getSectorBreakdown = useCallback(async () => {
    if (!isDemoMode) return null
    return generateSectorBreakdown()
  }, [isDemoMode])

  // Vulnerabilities functions
  const getVulnerabilities = useCallback(async (options = {}) => {
    if (!isDemoMode) return null
    const { limit = 50, kevOnly = false } = options

    let filtered = [...MOCK_VULNERABILITIES]

    if (kevOnly) {
      filtered = filtered.filter(v => v.kev_date)
    }

    return mockResponse(filtered.slice(0, limit), filtered.length)
  }, [isDemoMode])

  const getVulnById = useCallback(async (cveId) => {
    if (!isDemoMode) return null
    const vuln = MOCK_VULNERABILITIES.find(v => v.cve_id === cveId)
    return mockResponse(vuln)
  }, [isDemoMode])

  // IOCs functions
  const getIOCs = useCallback(async (options = {}) => {
    if (!isDemoMode) return null
    const { limit = 50, type = '', search = '' } = options

    let filtered = [...MOCK_IOCS]

    if (type) {
      filtered = filtered.filter(ioc => ioc.type === type)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(ioc =>
        ioc.value.toLowerCase().includes(searchLower) ||
        ioc.actor_name?.toLowerCase().includes(searchLower)
      )
    }

    return mockResponse(filtered.slice(0, limit), filtered.length)
  }, [isDemoMode])

  const searchIOC = useCallback(async (value) => {
    if (!isDemoMode) return null
    const matches = MOCK_IOCS.filter(ioc =>
      ioc.value.toLowerCase().includes(value.toLowerCase())
    )
    return mockResponse(matches)
  }, [isDemoMode])

  // Patterns functions
  const getPatterns = useCallback(async () => {
    if (!isDemoMode) return null
    return mockResponse(MOCK_PATTERNS)
  }, [isDemoMode])

  // Attack Chains functions
  const getAttackChains = useCallback(async (options = {}) => {
    if (!isDemoMode) return null
    const { actor_id = '', sector = '' } = options

    let filtered = [...MOCK_ATTACK_CHAINS]

    if (actor_id) {
      filtered = filtered.filter(c => c.actor_id === actor_id)
    }

    if (sector) {
      filtered = filtered.filter(c => c.target_sectors?.includes(sector))
    }

    return mockResponse(filtered)
  }, [isDemoMode])

  // Industry threats
  const getIndustryThreats = useCallback(async () => {
    if (!isDemoMode) return null
    return mockResponse(MOCK_INDUSTRY_THREATS)
  }, [isDemoMode])

  // Country threats
  const getCountryThreats = useCallback(async () => {
    if (!isDemoMode) return null
    return mockResponse(MOCK_COUNTRY_THREATS)
  }, [isDemoMode])

  // Correlations
  const getActorCorrelations = useCallback(async (actorId) => {
    if (!isDemoMode) return null

    const actor = MOCK_ACTORS.find(a => a.id === actorId)
    if (!actor) return mockResponse(null)

    const actorIncidents = MOCK_INCIDENTS.filter(i => i.actor_id === actorId)
    const actorIOCs = MOCK_IOCS.filter(i => i.actor_id === actorId)
    const actorChains = MOCK_ATTACK_CHAINS.filter(c => c.actor_id === actorId)

    // Find vulnerabilities this actor exploits
    const actorVulns = MOCK_VULNERABILITIES.filter(v =>
      v.exploiting_actors?.some(a => actor.name.includes(a) || a.includes(actor.name.split(' ')[0]))
    )

    return mockResponse({
      actor,
      incidents: actorIncidents,
      iocs: actorIOCs,
      vulnerabilities: actorVulns,
      attackChains: actorChains,
      techniques: actor.ttps || [],
    })
  }, [isDemoMode])

  const getVulnActors = useCallback(async (cveId) => {
    if (!isDemoMode) return null

    const vuln = MOCK_VULNERABILITIES.find(v => v.cve_id === cveId)
    if (!vuln) return mockResponse([])

    const actorNames = vuln.exploiting_actors || []
    const actors = MOCK_ACTORS.filter(a =>
      actorNames.some(name => a.name.includes(name) || name.includes(a.name.split(' ')[0]))
    )

    return mockResponse(actors)
  }, [isDemoMode])

  // AI Summary
  const getAISummary = useCallback(async () => {
    if (!isDemoMode) return null
    return {
      summary: 'LockBit 3.0 and BlackCat continue to dominate ransomware activity with a combined 35% increase in healthcare targeting this month. The mass exploitation of ConnectWise ScreenConnect (CVE-2024-1709) has enabled at least 5 ransomware groups to compromise new victims. APT29 activity remains elevated with ongoing campaigns against government and diplomatic targets following geopolitical tensions. Recommend prioritizing patches for Ivanti, Citrix, and ConnectWise products.',
      generated_at: new Date().toISOString(),
      key_points: [
        'Healthcare sector seeing 35% increase in ransomware attacks',
        'CVE-2024-1709 (ScreenConnect) being mass exploited by multiple groups',
        'APT29 espionage campaigns targeting government entities',
        'Play Ransomware rapidly expanding into LATAM markets',
      ],
    }
  }, [isDemoMode])

  // Week comparison
  const getWeekComparison = useCallback(async () => {
    if (!isDemoMode) return null
    return {
      currentWeek: { incidents: 127, iocs: 34521, actors_active: 45 },
      previousWeek: { incidents: 98, iocs: 28934, actors_active: 38 },
      incidentChange: 29.6,
      iocChange: 19.3,
      actorChange: 18.4,
    }
  }, [isDemoMode])

  // Memoized return value to prevent infinite re-renders
  return useMemo(() => ({
    isDemoMode,

    // Direct data access (static arrays)
    actors: MOCK_ACTORS,
    incidents: MOCK_INCIDENTS,
    vulnerabilities: MOCK_VULNERABILITIES,
    iocs: MOCK_IOCS,
    patterns: MOCK_PATTERNS,
    attackChains: MOCK_ATTACK_CHAINS,
    industryThreats: MOCK_INDUSTRY_THREATS,
    countryThreats: MOCK_COUNTRY_THREATS,

    // Dashboard
    getDashboardOverview,

    // Threat Actors
    getActors,
    getActorById,
    getEscalatingActors,
    getTopActors,
    getTrendSummary,

    // Incidents
    getIncidents,
    getRecentIncidents,
    getDailyCounts,
    getSectorBreakdown,

    // Vulnerabilities
    getVulnerabilities,
    getVulnById,

    // IOCs
    getIOCs,
    searchIOC,

    // Patterns
    getPatterns,

    // Attack Chains
    getAttackChains,

    // Correlations
    getActorCorrelations,
    getVulnActors,

    // Industry/Country
    getIndustryThreats,
    getCountryThreats,

    // AI & Comparisons
    getAISummary,
    getWeekComparison,
  }), [
    isDemoMode,
    getDashboardOverview,
    getActors,
    getActorById,
    getEscalatingActors,
    getTopActors,
    getTrendSummary,
    getIncidents,
    getRecentIncidents,
    getDailyCounts,
    getSectorBreakdown,
    getVulnerabilities,
    getVulnById,
    getIOCs,
    searchIOC,
    getPatterns,
    getAttackChains,
    getActorCorrelations,
    getVulnActors,
    getIndustryThreats,
    getCountryThreats,
    getAISummary,
    getWeekComparison,
  ])
}

export default useDemoData
