#!/usr/bin/env node
// Seed known actor-CVE and actor-technique correlations
// Based on public threat intelligence reports

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env from .env file if not already set
let supabaseUrl = process.env.VITE_SUPABASE_URL
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=').trim()
      if (key && value) {
        if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value
        if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value
      }
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================
// KNOWN ACTOR-CVE CORRELATIONS
// Sources: CISA advisories, vendor reports, threat research
// ============================================
const ACTOR_CVE_CORRELATIONS = [
  // LockBit
  { actor: 'LockBit', cves: [
    { cve: 'CVE-2023-4966', confidence: 'high', source: 'CISA', notes: 'Citrix Bleed - mass exploitation' },
    { cve: 'CVE-2023-0669', confidence: 'high', source: 'CISA', notes: 'GoAnywhere MFT' },
    { cve: 'CVE-2021-44228', confidence: 'high', source: 'Multiple', notes: 'Log4Shell' },
    { cve: 'CVE-2023-27350', confidence: 'medium', source: 'Sophos', notes: 'PaperCut' },
    { cve: 'CVE-2023-20269', confidence: 'medium', source: 'Cisco', notes: 'Cisco ASA/FTD' },
  ]},

  // ALPHV/BlackCat
  { actor: 'ALPHV', cves: [
    { cve: 'CVE-2021-44228', confidence: 'high', source: 'FBI', notes: 'Log4Shell' },
    { cve: 'CVE-2021-21972', confidence: 'high', source: 'Mandiant', notes: 'VMware vCenter' },
    { cve: 'CVE-2023-22515', confidence: 'high', source: 'CISA', notes: 'Atlassian Confluence' },
    { cve: 'CVE-2023-46604', confidence: 'medium', source: 'Rapid7', notes: 'Apache ActiveMQ' },
  ]},
  { actor: 'BlackCat', cves: [
    { cve: 'CVE-2021-44228', confidence: 'high', source: 'FBI', notes: 'Log4Shell' },
    { cve: 'CVE-2021-21972', confidence: 'high', source: 'Mandiant', notes: 'VMware vCenter' },
  ]},

  // Cl0p
  { actor: 'Cl0p', cves: [
    { cve: 'CVE-2023-34362', confidence: 'high', source: 'CISA', notes: 'MOVEit Transfer - mass exploitation' },
    { cve: 'CVE-2023-0669', confidence: 'high', source: 'CISA', notes: 'GoAnywhere MFT' },
    { cve: 'CVE-2021-27101', confidence: 'high', source: 'Mandiant', notes: 'Accellion FTA' },
    { cve: 'CVE-2021-27102', confidence: 'high', source: 'Mandiant', notes: 'Accellion FTA' },
    { cve: 'CVE-2021-27103', confidence: 'high', source: 'Mandiant', notes: 'Accellion FTA' },
    { cve: 'CVE-2021-27104', confidence: 'high', source: 'Mandiant', notes: 'Accellion FTA' },
    { cve: 'CVE-2024-50623', confidence: 'high', source: 'CISA', notes: 'Cleo file transfer' },
  ]},
  { actor: 'Clop', cves: [
    { cve: 'CVE-2023-34362', confidence: 'high', source: 'CISA', notes: 'MOVEit Transfer' },
  ]},

  // Play
  { actor: 'Play', cves: [
    { cve: 'CVE-2022-41040', confidence: 'high', source: 'Microsoft', notes: 'ProxyNotShell' },
    { cve: 'CVE-2022-41082', confidence: 'high', source: 'Microsoft', notes: 'ProxyNotShell' },
    { cve: 'CVE-2023-20269', confidence: 'medium', source: 'Cisco', notes: 'Cisco ASA/FTD' },
  ]},

  // Black Basta
  { actor: 'Black Basta', cves: [
    { cve: 'CVE-2024-1709', confidence: 'high', source: 'CISA', notes: 'ConnectWise ScreenConnect' },
    { cve: 'CVE-2024-1708', confidence: 'high', source: 'CISA', notes: 'ConnectWise ScreenConnect' },
    { cve: 'CVE-2023-27350', confidence: 'medium', source: 'Trend Micro', notes: 'PaperCut' },
  ]},

  // Akira
  { actor: 'Akira', cves: [
    { cve: 'CVE-2023-20269', confidence: 'high', source: 'CISA', notes: 'Cisco ASA/FTD VPN' },
    { cve: 'CVE-2020-3259', confidence: 'medium', source: 'Cisco', notes: 'Cisco ASA/FTD' },
  ]},

  // Royal/BlackSuit
  { actor: 'Royal', cves: [
    { cve: 'CVE-2023-27350', confidence: 'high', source: 'CISA', notes: 'PaperCut' },
    { cve: 'CVE-2021-44228', confidence: 'medium', source: 'HHS', notes: 'Log4Shell' },
  ]},
  { actor: 'BlackSuit', cves: [
    { cve: 'CVE-2023-27350', confidence: 'high', source: 'CISA', notes: 'PaperCut' },
  ]},

  // Rhysida
  { actor: 'Rhysida', cves: [
    { cve: 'CVE-2020-1472', confidence: 'high', source: 'CISA', notes: 'Zerologon' },
    { cve: 'CVE-2023-3519', confidence: 'medium', source: 'CISA', notes: 'Citrix ADC' },
  ]},

  // Vice Society
  { actor: 'Vice Society', cves: [
    { cve: 'CVE-2021-34473', confidence: 'high', source: 'CISA', notes: 'ProxyShell' },
    { cve: 'CVE-2021-34523', confidence: 'high', source: 'CISA', notes: 'ProxyShell' },
    { cve: 'CVE-2021-31207', confidence: 'high', source: 'CISA', notes: 'ProxyShell' },
  ]},

  // BianLian
  { actor: 'BianLian', cves: [
    { cve: 'CVE-2022-21587', confidence: 'medium', source: 'CISA', notes: 'Oracle E-Business Suite' },
    { cve: 'CVE-2023-20269', confidence: 'medium', source: 'Cisco', notes: 'Cisco ASA/FTD' },
  ]},

  // Medusa
  { actor: 'Medusa', cves: [
    { cve: 'CVE-2023-48788', confidence: 'high', source: 'Fortinet', notes: 'FortiClient EMS SQL injection' },
  ]},

  // 8Base
  { actor: '8Base', cves: [
    { cve: 'CVE-2022-47966', confidence: 'medium', source: 'Trend Micro', notes: 'ManageEngine' },
  ]},

  // Hunters International
  { actor: 'Hunters International', cves: [
    { cve: 'CVE-2023-46604', confidence: 'medium', source: 'Arctic Wolf', notes: 'Apache ActiveMQ' },
  ]},
]

// ============================================
// KNOWN ACTOR-TECHNIQUE CORRELATIONS
// Common TTPs used by ransomware groups
// ============================================
const ACTOR_TTP_CORRELATIONS = [
  // LockBit common TTPs
  { actor: 'LockBit', techniques: [
    { id: 'T1190', confidence: 'high', notes: 'Exploit Public-Facing Application' },
    { id: 'T1133', confidence: 'high', notes: 'External Remote Services (RDP, VPN)' },
    { id: 'T1486', confidence: 'high', notes: 'Data Encrypted for Impact' },
    { id: 'T1490', confidence: 'high', notes: 'Inhibit System Recovery' },
    { id: 'T1027', confidence: 'medium', notes: 'Obfuscated Files or Information' },
  ]},

  // ALPHV/BlackCat TTPs
  { actor: 'ALPHV', techniques: [
    { id: 'T1190', confidence: 'high', notes: 'Exploit Public-Facing Application' },
    { id: 'T1486', confidence: 'high', notes: 'Data Encrypted for Impact' },
    { id: 'T1567', confidence: 'high', notes: 'Exfiltration Over Web Service' },
    { id: 'T1059.001', confidence: 'medium', notes: 'PowerShell' },
  ]},

  // Cl0p TTPs
  { actor: 'Cl0p', techniques: [
    { id: 'T1190', confidence: 'high', notes: 'Exploit Public-Facing Application (file transfer)' },
    { id: 'T1567', confidence: 'high', notes: 'Exfiltration Over Web Service' },
    { id: 'T1486', confidence: 'medium', notes: 'Data Encrypted for Impact' },
  ]},
  { actor: 'Clop', techniques: [
    { id: 'T1190', confidence: 'high', notes: 'Exploit Public-Facing Application' },
  ]},

  // Black Basta TTPs
  { actor: 'Black Basta', techniques: [
    { id: 'T1566.001', confidence: 'high', notes: 'Spearphishing Attachment (Qakbot)' },
    { id: 'T1486', confidence: 'high', notes: 'Data Encrypted for Impact' },
    { id: 'T1021.001', confidence: 'high', notes: 'Remote Desktop Protocol' },
    { id: 'T1047', confidence: 'medium', notes: 'Windows Management Instrumentation' },
  ]},

  // Play TTPs
  { actor: 'Play', techniques: [
    { id: 'T1190', confidence: 'high', notes: 'Exploit Public-Facing Application' },
    { id: 'T1486', confidence: 'high', notes: 'Data Encrypted for Impact' },
    { id: 'T1082', confidence: 'medium', notes: 'System Information Discovery' },
  ]},
]

// ============================================
// MAIN SEEDING FUNCTION
// ============================================
async function seedCorrelations() {
  console.log('Starting correlation seeding...\n')

  // Get all actors for lookup
  const { data: actors, error: actorError } = await supabase
    .from('threat_actors')
    .select('id, name, aliases')

  if (actorError) {
    console.error('Error fetching actors:', actorError)
    return
  }

  // Build actor lookup map (name -> id)
  const actorMap = new Map()
  for (const actor of actors) {
    actorMap.set(actor.name.toLowerCase(), actor.id)
    // Also map aliases
    if (actor.aliases) {
      for (const alias of actor.aliases) {
        actorMap.set(alias.toLowerCase(), actor.id)
      }
    }
  }

  console.log(`Loaded ${actors.length} actors for lookup\n`)

  // Get all CVEs for lookup
  const { data: cves, error: cveError } = await supabase
    .from('vulnerabilities')
    .select('cve_id')

  if (cveError) {
    console.error('Error fetching CVEs:', cveError)
    return
  }

  const cveSet = new Set(cves?.map(c => c.cve_id) || [])
  console.log(`Loaded ${cveSet.size} CVEs for lookup\n`)

  // Get all techniques for lookup
  const { data: techniques, error: techError } = await supabase
    .from('techniques')
    .select('id')

  if (techError) {
    console.error('Error fetching techniques:', techError)
    // Continue anyway, techniques table might not exist
  }

  const techSet = new Set(techniques?.map(t => t.id) || [])
  console.log(`Loaded ${techSet.size} techniques for lookup\n`)

  // ============================================
  // SEED ACTOR-CVE CORRELATIONS
  // ============================================
  console.log('=== Seeding Actor-CVE Correlations ===\n')

  let cveInserted = 0
  let cveSkipped = 0
  let cveNotFound = 0

  for (const entry of ACTOR_CVE_CORRELATIONS) {
    const actorId = actorMap.get(entry.actor.toLowerCase())

    if (!actorId) {
      console.log(`  Actor not found: ${entry.actor}`)
      continue
    }

    for (const cve of entry.cves) {
      // Check if CVE exists in our database
      if (!cveSet.has(cve.cve)) {
        console.log(`  CVE not in database: ${cve.cve} (for ${entry.actor})`)
        cveNotFound++
        continue
      }

      const { error } = await supabase
        .from('actor_vulnerabilities')
        .upsert({
          actor_id: actorId,
          cve_id: cve.cve,
          confidence: cve.confidence,
          source: cve.source,
          notes: cve.notes,
          first_seen: new Date().toISOString().split('T')[0],
        }, { onConflict: 'actor_id,cve_id' })

      if (error) {
        console.log(`  Error inserting ${entry.actor} -> ${cve.cve}: ${error.message}`)
        cveSkipped++
      } else {
        console.log(`  ${entry.actor} -> ${cve.cve} (${cve.confidence})`)
        cveInserted++
      }
    }
  }

  console.log(`\nActor-CVE results: ${cveInserted} inserted, ${cveSkipped} errors, ${cveNotFound} CVEs not in DB\n`)

  // ============================================
  // SEED ACTOR-TECHNIQUE CORRELATIONS
  // ============================================
  console.log('=== Seeding Actor-Technique Correlations ===\n')

  let ttpInserted = 0
  let ttpSkipped = 0
  let ttpNotFound = 0

  for (const entry of ACTOR_TTP_CORRELATIONS) {
    const actorId = actorMap.get(entry.actor.toLowerCase())

    if (!actorId) {
      console.log(`  Actor not found: ${entry.actor}`)
      continue
    }

    for (const ttp of entry.techniques) {
      // Check if technique exists in our database
      if (techSet.size > 0 && !techSet.has(ttp.id)) {
        console.log(`  Technique not in database: ${ttp.id} (for ${entry.actor})`)
        ttpNotFound++
        continue
      }

      const { error } = await supabase
        .from('actor_techniques')
        .upsert({
          actor_id: actorId,
          technique_id: ttp.id,
          confidence: ttp.confidence,
          notes: ttp.notes,
          first_seen: new Date().toISOString().split('T')[0],
        }, { onConflict: 'actor_id,technique_id' })

      if (error) {
        console.log(`  Error inserting ${entry.actor} -> ${ttp.id}: ${error.message}`)
        ttpSkipped++
      } else {
        console.log(`  ${entry.actor} -> ${ttp.id} (${ttp.confidence})`)
        ttpInserted++
      }
    }
  }

  console.log(`\nActor-Technique results: ${ttpInserted} inserted, ${ttpSkipped} errors, ${ttpNotFound} TTPs not in DB\n`)

  // ============================================
  // SUMMARY
  // ============================================
  console.log('=== Seeding Complete ===')
  console.log(`CVE correlations: ${cveInserted} created`)
  console.log(`TTP correlations: ${ttpInserted} created`)
}

// Run the seeding
seedCorrelations()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
