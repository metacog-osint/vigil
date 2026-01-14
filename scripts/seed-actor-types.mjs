#!/usr/bin/env node
/**
 * Seed Additional Actor Types
 *
 * Adds cybercrime, hacktivism, initial_access_broker actors
 * and reclassifies existing actors where appropriate.
 *
 * Run: node scripts/seed-actor-types.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load env
let supabaseUrl = process.env.VITE_SUPABASE_URL
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=').trim()
      if (key?.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value
      if (key?.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================
// CYBERCRIME GROUPS
// Financial crime, BEC, carding, fraud
// ============================================
const cybercrimeGroups = [
  {
    name: 'FIN6',
    aliases: ['ITG08', 'Skeleton Spider', 'Magecart Group 6'],
    description: 'Financially motivated cybercrime group known for targeting POS systems and e-commerce platforms. Active since 2015, responsible for large-scale payment card theft.',
    target_sectors: ['retail', 'hospitality', 'entertainment'],
    first_seen: '2015-01-01',
    ttps: ['T1059', 'T1055', 'T1003', 'T1486'],
  },
  {
    name: 'FIN7',
    aliases: ['Carbanak', 'Carbon Spider', 'Sangria Tempest', 'ELBRUS'],
    description: 'Prolific financially motivated group targeting retail, restaurant, and hospitality sectors. Known for sophisticated phishing and POS malware. Later pivoted to ransomware partnerships.',
    target_sectors: ['retail', 'hospitality', 'finance'],
    first_seen: '2013-01-01',
    ttps: ['T1566', 'T1059', 'T1055', 'T1003', 'T1021'],
  },
  {
    name: 'FIN8',
    aliases: ['Syssphinx'],
    description: 'Financially motivated group targeting POS environments in hospitality and retail. Known for living-off-the-land techniques and custom backdoors.',
    target_sectors: ['retail', 'hospitality', 'finance'],
    first_seen: '2016-01-01',
    ttps: ['T1059', 'T1053', 'T1003', 'T1055'],
  },
  {
    name: 'FIN11',
    aliases: ['TA505', 'Lace Tempest', 'DEV-0950'],
    description: 'High-volume financially motivated group known for Clop ransomware, Dridex banking trojan, and exploiting zero-days like MOVEit.',
    target_sectors: ['finance', 'retail', 'healthcare'],
    first_seen: '2016-01-01',
    ttps: ['T1566', 'T1059', 'T1486', 'T1190'],
  },
  {
    name: 'FIN12',
    aliases: ['Wizard Spider', 'DEV-0193', 'Pistachio Tempest'],
    description: 'Fast-moving ransomware group known for Ryuk and Conti. Specializes in rapid deployment, often encrypting within days of initial access.',
    target_sectors: ['healthcare', 'manufacturing', 'technology'],
    first_seen: '2018-01-01',
    ttps: ['T1486', 'T1021', 'T1059', 'T1055'],
  },
  {
    name: 'Cosmic Lynx',
    aliases: [],
    description: 'Business Email Compromise (BEC) group targeting large corporations. Known for impersonating executives and law firms in multi-million dollar fraud schemes.',
    target_sectors: ['finance', 'technology', 'manufacturing'],
    first_seen: '2019-01-01',
    ttps: ['T1566', 'T1534', 'T1656'],
  },
  {
    name: 'Scattered Spider',
    aliases: ['UNC3944', 'Roasted 0ktapus', 'Octo Tempest', 'Star Fraud'],
    description: 'Young English-speaking cybercrime group known for SIM swapping, social engineering, and targeting large enterprises. Partnered with ALPHV/BlackCat for ransomware.',
    target_sectors: ['technology', 'telecommunications', 'gaming'],
    first_seen: '2022-01-01',
    ttps: ['T1566', 'T1078', 'T1621', 'T1486'],
  },
  {
    name: 'Magecart',
    aliases: ['Magecart Group', 'Web Skimmers'],
    description: 'Umbrella term for groups injecting payment card skimmers into e-commerce websites. Multiple subgroups with varying sophistication.',
    target_sectors: ['retail', 'e-commerce'],
    first_seen: '2015-01-01',
    ttps: ['T1059', 'T1505', 'T1189'],
  },
  {
    name: 'SilverTerrier',
    aliases: ['Nigerian BEC'],
    description: 'Collective of Nigerian threat actors conducting Business Email Compromise (BEC) schemes, romance scams, and advance fee fraud.',
    target_sectors: ['finance', 'manufacturing', 'legal'],
    first_seen: '2014-01-01',
    ttps: ['T1566', 'T1534', 'T1656'],
  },
  {
    name: 'Silence Group',
    aliases: ['Silence', 'Whisper Spider'],
    description: 'Russian-speaking cybercrime group targeting banks through ATM jackpotting and SWIFT fraud. Known for long-term reconnaissance.',
    target_sectors: ['finance'],
    first_seen: '2016-01-01',
    ttps: ['T1566', 'T1059', 'T1021', 'T1003'],
  },
  {
    name: 'Cobalt Group',
    aliases: ['Cobalt Gang', 'Cobalt Spider', 'Gold Kingswood'],
    description: 'Eastern European cybercrime syndicate targeting banks via ATM attacks and SWIFT. Caused over $1 billion in losses.',
    target_sectors: ['finance'],
    first_seen: '2016-01-01',
    ttps: ['T1566', 'T1059', 'T1021', 'T1055'],
  },
  {
    name: 'MoneyTaker',
    aliases: [],
    description: 'Russian-speaking group targeting financial institutions, particularly through card processing and interbank transfers.',
    target_sectors: ['finance'],
    first_seen: '2016-01-01',
    ttps: ['T1566', 'T1059', 'T1003'],
  },
]

// ============================================
// HACKTIVISM GROUPS
// Politically/ideologically motivated
// ============================================
const hacktivismGroups = [
  {
    name: 'Anonymous',
    aliases: ['Anon', 'Anonymous Collective'],
    description: 'Decentralized international hacktivist collective. Known for DDoS attacks, data leaks, and defacements targeting governments and corporations.',
    target_sectors: ['government', 'finance', 'media'],
    first_seen: '2003-01-01',
    ttps: ['T1498', 'T1491', 'T1530'],
  },
  {
    name: 'Anonymous Sudan',
    aliases: ['Storm-1359'],
    description: 'Pro-Russian hacktivist group conducting DDoS attacks against Western targets. Despite name, believed to be Russian-affiliated.',
    target_sectors: ['government', 'technology', 'healthcare'],
    first_seen: '2023-01-01',
    ttps: ['T1498', 'T1499'],
  },
  {
    name: 'Killnet',
    aliases: ['Killnet Collective'],
    description: 'Pro-Russian hacktivist group conducting DDoS attacks against NATO countries and Ukraine supporters.',
    target_sectors: ['government', 'transportation', 'finance'],
    first_seen: '2022-01-01',
    ttps: ['T1498', 'T1499'],
  },
  {
    name: 'NoName057(16)',
    aliases: ['NoName', 'NN057'],
    description: 'Pro-Russian hacktivist group using DDoSia tool for crowdsourced DDoS attacks against Ukraine and Western targets.',
    target_sectors: ['government', 'finance', 'transportation'],
    first_seen: '2022-03-01',
    ttps: ['T1498', 'T1499'],
  },
  {
    name: 'IT Army of Ukraine',
    aliases: ['IT Army UA'],
    description: 'Pro-Ukrainian hacktivist collective coordinating cyber attacks against Russian infrastructure and businesses.',
    target_sectors: ['government', 'finance', 'energy'],
    first_seen: '2022-02-01',
    ttps: ['T1498', 'T1491', 'T1530'],
  },
  {
    name: 'GhostSec',
    aliases: ['Ghost Security'],
    description: 'Hacktivist group originally focused on anti-ISIS operations, later expanded to other targets including critical infrastructure.',
    target_sectors: ['government', 'energy', 'technology'],
    first_seen: '2015-01-01',
    ttps: ['T1498', 'T1491', 'T1530'],
  },
  {
    name: 'SiegedSec',
    aliases: ['Sieged Security'],
    description: 'Hacktivist group known for breaching organizations over political/social issues. Targets include NATO, state governments.',
    target_sectors: ['government', 'education'],
    first_seen: '2022-01-01',
    ttps: ['T1530', 'T1491', 'T1190'],
  },
  {
    name: 'Cyber Av3ngers',
    aliases: ['CyberAv3ngers', 'Cyber Avengers'],
    description: 'Iranian-linked hacktivist group targeting Israeli and Western critical infrastructure, particularly water systems.',
    target_sectors: ['energy', 'water', 'manufacturing'],
    first_seen: '2023-01-01',
    ttps: ['T1190', 'T1491', 'T1498'],
  },
  {
    name: 'Predatory Sparrow',
    aliases: ['Gonjeshke Darande'],
    description: 'Anti-Iranian hacktivist group (possibly state-backed) known for attacks on Iranian infrastructure including steel plants.',
    target_sectors: ['manufacturing', 'energy', 'government'],
    first_seen: '2021-01-01',
    ttps: ['T1485', 'T1491', 'T1561'],
  },
  {
    name: 'Belarusian Cyber Partisans',
    aliases: ['Cyber Partisans'],
    description: 'Anti-Lukashenko hacktivist group leaking government data and disrupting Belarusian state systems.',
    target_sectors: ['government', 'transportation'],
    first_seen: '2020-01-01',
    ttps: ['T1530', 'T1485', 'T1491'],
  },
  {
    name: 'Lapsus$',
    aliases: ['LAPSUS$', 'DEV-0537'],
    description: 'Data extortion group targeting large tech companies through social engineering. Known for leaking source code from Microsoft, Nvidia, Samsung.',
    target_sectors: ['technology', 'gaming', 'telecommunications'],
    first_seen: '2021-12-01',
    ttps: ['T1078', 'T1566', 'T1530', 'T1657'],
  },
]

// ============================================
// INITIAL ACCESS BROKERS
// Sell network access to ransomware groups
// ============================================
const initialAccessBrokers = [
  {
    name: 'Exotic Lily',
    aliases: ['TA580', 'Projector Libra'],
    description: 'Initial access broker using callback phishing and fake business personas. Provides access to Conti, Diavol, and other ransomware groups.',
    target_sectors: ['technology', 'healthcare', 'manufacturing'],
    first_seen: '2021-01-01',
    ttps: ['T1566', 'T1204', 'T1078'],
  },
  {
    name: 'Zebra2104',
    aliases: [],
    description: 'Initial access broker selling access on criminal forums. Known for providing access to MountLocker and Phobos ransomware operators.',
    target_sectors: ['manufacturing', 'technology', 'retail'],
    first_seen: '2020-01-01',
    ttps: ['T1190', 'T1133', 'T1078'],
  },
  {
    name: 'Prophet Spider',
    aliases: ['UNC961'],
    description: 'Initial access broker exploiting public-facing applications. Sells access to various ransomware affiliates.',
    target_sectors: ['technology', 'healthcare', 'education'],
    first_seen: '2020-01-01',
    ttps: ['T1190', 'T1505', 'T1078'],
  },
  {
    name: 'Shatak',
    aliases: ['TA551', 'Gold Cabin'],
    description: 'Malware distribution and initial access broker. Delivers IcedID and BazarLoader leading to ransomware.',
    target_sectors: ['manufacturing', 'technology', 'legal'],
    first_seen: '2018-01-01',
    ttps: ['T1566', 'T1204', 'T1059'],
  },
  {
    name: 'Qakbot Operators',
    aliases: ['QBot', 'Quakbot', 'Pinkslipbot'],
    description: 'Operators of Qakbot banking trojan, pivoted to initial access brokering for ransomware groups including Black Basta.',
    target_sectors: ['finance', 'manufacturing', 'technology'],
    first_seen: '2007-01-01',
    ttps: ['T1566', 'T1055', 'T1059', 'T1021'],
  },
  {
    name: 'Emotet Operators',
    aliases: ['TA542', 'Mummy Spider', 'Gold Crestwood'],
    description: 'Operators of Emotet malware-as-a-service. Major initial access provider for Ryuk, Conti, and other ransomware.',
    target_sectors: ['manufacturing', 'healthcare', 'government'],
    first_seen: '2014-01-01',
    ttps: ['T1566', 'T1059', 'T1055', 'T1021'],
  },
  {
    name: 'TrickBot Gang',
    aliases: ['Wizard Spider', 'Gold Blackburn', 'ITG23'],
    description: 'Operators of TrickBot and BazarLoader. Major initial access provider and later operator of Conti ransomware.',
    target_sectors: ['healthcare', 'finance', 'manufacturing'],
    first_seen: '2016-01-01',
    ttps: ['T1566', 'T1055', 'T1021', 'T1486'],
  },
  {
    name: 'IcedID Operators',
    aliases: ['Gold Cabin', 'Shatak'],
    description: 'Operators of IcedID banking trojan. Provides initial access for ransomware groups including Conti and Egregor.',
    target_sectors: ['finance', 'manufacturing', 'technology'],
    first_seen: '2017-01-01',
    ttps: ['T1566', 'T1055', 'T1059'],
  },
  {
    name: 'BatLoader Operators',
    aliases: [],
    description: 'Operators of BatLoader malware. Uses SEO poisoning to deliver initial access leading to ransomware.',
    target_sectors: ['technology', 'manufacturing', 'professional services'],
    first_seen: '2022-01-01',
    ttps: ['T1189', 'T1059', 'T1204'],
  },
  {
    name: 'SocGholish Operators',
    aliases: ['TA569', 'Gold Prelude'],
    description: 'Operators of SocGholish (FakeUpdates) malware. Compromises websites to deliver fake browser updates leading to ransomware.',
    target_sectors: ['media', 'retail', 'technology'],
    first_seen: '2017-01-01',
    ttps: ['T1189', 'T1059', 'T1204'],
  },
]

// ============================================
// DATA EXTORTION GROUPS
// Steal data without encryption
// ============================================
const dataExtortionGroups = [
  {
    name: 'Karakurt',
    aliases: ['Karakurt Team', 'Karakurt Lair'],
    description: 'Data extortion group that steals data without deploying ransomware. Linked to Conti operations.',
    target_sectors: ['healthcare', 'technology', 'manufacturing'],
    first_seen: '2021-06-01',
    ttps: ['T1530', 'T1567', 'T1657'],
  },
  {
    name: 'RansomHouse',
    aliases: ['Ransom House'],
    description: 'Data extortion group claiming to be "penetration testers" exposing poor security. Does not deploy ransomware.',
    target_sectors: ['healthcare', 'technology', 'retail'],
    first_seen: '2021-12-01',
    ttps: ['T1530', 'T1567', 'T1657'],
  },
  {
    name: 'Donut Leaks',
    aliases: ['D0nut', 'Donut'],
    description: 'Data extortion group known for creative victim shaming. Focuses on data theft and leak threats.',
    target_sectors: ['technology', 'manufacturing'],
    first_seen: '2022-01-01',
    ttps: ['T1530', 'T1567', 'T1657'],
  },
  {
    name: 'SnapMC',
    aliases: [],
    description: 'Data extortion group exploiting vulnerabilities for quick data theft. Known for fast operations (under 30 minutes).',
    target_sectors: ['technology', 'manufacturing', 'healthcare'],
    first_seen: '2021-01-01',
    ttps: ['T1190', 'T1530', 'T1567'],
  },
  {
    name: 'Marketo',
    aliases: [],
    description: 'Data extortion marketplace/group that sells stolen data from multiple breaches.',
    target_sectors: ['technology', 'finance', 'healthcare'],
    first_seen: '2021-01-01',
    ttps: ['T1530', 'T1567'],
  },
]

// ============================================
// ACTORS TO RECLASSIFY
// Existing ransomware actors that should be data_extortion
// ============================================
const reclassifyToDataExtortion = [
  'BianLian',  // Shifted to data-only extortion in 2023
  'Karakurt',
  'RansomHouse',
]

// ============================================
// MAIN FUNCTIONS
// ============================================

async function upsertActors(actors, actorType) {
  console.log(`\nUpserting ${actors.length} ${actorType} actors...`)

  let added = 0
  let errors = 0

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
      console.error(`  Error upserting ${actor.name}:`, error.message)
      errors++
    } else {
      added++
    }
  }

  console.log(`  Added/updated: ${added}, Errors: ${errors}`)
  return { added, errors }
}

async function reclassifyActors(actorNames, newType) {
  console.log(`\nReclassifying ${actorNames.length} actors to ${newType}...`)

  let updated = 0

  for (const name of actorNames) {
    const { data, error } = await supabase
      .from('threat_actors')
      .update({ actor_type: newType })
      .eq('name', name)
      .select()

    if (error) {
      console.error(`  Error reclassifying ${name}:`, error.message)
    } else if (data?.length > 0) {
      console.log(`  Reclassified: ${name}`)
      updated++
    }
  }

  console.log(`  Updated: ${updated}`)
  return updated
}

async function getActorStats() {
  const { data } = await supabase
    .from('threat_actors')
    .select('actor_type')

  const counts = {}
  data?.forEach(r => {
    const type = r.actor_type || 'unknown'
    counts[type] = (counts[type] || 0) + 1
  })

  return counts
}

async function main() {
  console.log('=== Seeding Additional Actor Types ===')
  console.log(`Started: ${new Date().toISOString()}`)

  // Show before stats
  console.log('\n--- Before ---')
  const beforeStats = await getActorStats()
  Object.entries(beforeStats).sort((a,b) => b[1]-a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })

  // Upsert new actors
  const results = {
    cybercrime: await upsertActors(cybercrimeGroups, 'cybercrime'),
    hacktivism: await upsertActors(hacktivismGroups, 'hacktivism'),
    iab: await upsertActors(initialAccessBrokers, 'initial_access_broker'),
    extortion: await upsertActors(dataExtortionGroups, 'data_extortion'),
  }

  // Reclassify existing actors
  const reclassified = await reclassifyActors(reclassifyToDataExtortion, 'data_extortion')

  // Show after stats
  console.log('\n--- After ---')
  const afterStats = await getActorStats()
  Object.entries(afterStats).sort((a,b) => b[1]-a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })

  // Summary
  console.log('\n=== Summary ===')
  console.log(`Cybercrime groups added: ${results.cybercrime.added}`)
  console.log(`Hacktivism groups added: ${results.hacktivism.added}`)
  console.log(`Initial Access Brokers added: ${results.iab.added}`)
  console.log(`Data Extortion groups added: ${results.extortion.added}`)
  console.log(`Actors reclassified: ${reclassified}`)

  // Log sync
  await supabase.from('sync_log').insert({
    source: 'actor_types_seed',
    status: 'success',
    records_processed: cybercrimeGroups.length + hacktivismGroups.length +
                       initialAccessBrokers.length + dataExtortionGroups.length,
    records_added: results.cybercrime.added + results.hacktivism.added +
                   results.iab.added + results.extortion.added,
    completed_at: new Date().toISOString(),
  })

  console.log(`\nCompleted: ${new Date().toISOString()}`)
}

main().catch(console.error)
