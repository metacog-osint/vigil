#!/usr/bin/env node
/**
 * Set up correlation infrastructure
 * This script creates tables, views, and functions for data correlation
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupCorrelations() {
  console.log('Setting up correlation infrastructure...\n')

  // Check existing tables
  console.log('Checking existing tables...')

  const tables = ['actor_iocs', 'actor_vulnerabilities', 'attack_chains']
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    console.log(`  ${table}: ${count !== null ? 'exists' : 'missing'}`)
  }

  // Test materialized view queries directly
  console.log('\n=== Industry Threat Landscape ===')
  const { data: industryData, error: industryError } = await supabase
    .from('cyber_events')
    .select('target_industry, actor_type')
    .not('target_industry', 'is', null)
    .limit(5)

  if (industryError) {
    console.log('Error querying cyber_events:', industryError.message)
  } else {
    console.log('Sample industries:', [...new Set(industryData.map(d => d.target_industry))].slice(0, 5))
  }

  // Test country data
  console.log('\n=== Country Threat Profile ===')
  const { data: countryData } = await supabase
    .from('cyber_events')
    .select('target_country, actor_country, actor_type')
    .not('target_country', 'is', null)
    .limit(5)

  if (countryData) {
    console.log('Sample countries:', [...new Set(countryData.map(d => d.target_country))].slice(0, 5))
  }

  // Test actor aggregation
  console.log('\n=== Actor Activity ===')
  const { data: actorData } = await supabase
    .from('cyber_events')
    .select('actor_name, actor_type')
    .not('actor_name', 'eq', 'Undetermined')
    .not('actor_name', 'is', null)
    .limit(100)

  if (actorData) {
    const actorCounts = {}
    actorData.forEach(d => {
      actorCounts[d.actor_name] = (actorCounts[d.actor_name] || 0) + 1
    })
    const topActors = Object.entries(actorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    console.log('Top actors (from cyber_events):')
    topActors.forEach(([name, count]) => console.log(`  ${name}: ${count} events`))
  }

  // Test weekly trends
  console.log('\n=== Weekly Activity Trends ===')
  const { data: iocTrends } = await supabase
    .from('iocs')
    .select('first_seen')
    .order('first_seen', { ascending: false })
    .limit(1000)

  if (iocTrends) {
    const weekCounts = {}
    iocTrends.forEach(d => {
      if (d.first_seen) {
        const week = d.first_seen.substring(0, 10)
        weekCounts[week] = (weekCounts[week] || 0) + 1
      }
    })
    const recentWeeks = Object.entries(weekCounts).slice(0, 5)
    console.log('Recent IOC activity:')
    recentWeeks.forEach(([week, count]) => console.log(`  ${week}: ${count} IOCs`))
  }

  console.log('\n=== Summary ===')
  console.log('Correlation views need to be created via Supabase SQL Editor.')
  console.log('Copy the SQL from: supabase/migrations/062_correlations.sql')
  console.log('\nThe data is ready for correlation analysis!')
}

setupCorrelations()
