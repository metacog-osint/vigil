// Supabase Edge Function: Ingest Ransomwatch Data
// Fetches ransomware group and victim data from ransomwatch API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RANSOMWATCH_URL = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RansomwatchPost {
  group_name: string
  post_title: string
  discovered: string
  website?: string
}

// Parse ransomwatch date format: "YYYY-MM-DD HH:MM:SS.ffffff"
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  try {
    // Replace space with T and remove microseconds for ISO format
    const cleaned = dateStr.replace(' ', 'T').split('.')[0]
    const date = new Date(cleaned)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing env vars' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Fetch ransomwatch data
    const response = await fetch(RANSOMWATCH_URL)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)

    const posts: RansomwatchPost[] = await response.json()
    console.log(`Fetched ${posts.length} total posts`)

    // Parse all dates and sort by most recent
    const postsWithDates = posts
      .map(p => ({ ...p, parsedDate: parseDate(p.discovered) }))
      .filter(p => p.parsedDate !== null)
      .sort((a, b) => b.parsedDate!.getTime() - a.parsedDate!.getTime())

    console.log(`${postsWithDates.length} posts have valid dates`)

    // Get unique groups from all posts (not just recent)
    const allGroups = [...new Set(posts.map(p => p.group_name))]
    console.log(`Found ${allGroups.length} unique groups`)

    // Upsert all threat actors
    let actorsAdded = 0
    for (const groupName of allGroups) {
      const groupPosts = postsWithDates.filter(p => p.group_name === groupName)
      if (groupPosts.length === 0) continue

      const firstSeen = groupPosts[groupPosts.length - 1].parsedDate
      const lastSeen = groupPosts[0].parsedDate

      const { error } = await supabase
        .from('threat_actors')
        .upsert({
          name: groupName,
          actor_type: 'ransomware',
          source: 'ransomwatch',
          first_seen: firstSeen?.toISOString().split('T')[0],
          last_seen: lastSeen?.toISOString().split('T')[0],
          status: 'active',
        }, {
          onConflict: 'name',
          ignoreDuplicates: false,
        })

      if (!error) actorsAdded++
    }

    console.log(`Upserted ${actorsAdded} threat actors`)

    // Get actor IDs for mapping
    const { data: actors } = await supabase
      .from('threat_actors')
      .select('id, name')
      .eq('source', 'ransomwatch')

    const actorMap = new Map(actors?.map(a => [a.name, a.id]) || [])

    // Take most recent 2000 posts (most recent by date, not array position)
    const recentPosts = postsWithDates.slice(0, 2000)
    console.log(`Processing ${recentPosts.length} most recent posts`)

    let added = 0
    let skipped = 0

    for (const post of recentPosts) {
      try {
        const actorId = actorMap.get(post.group_name)
        if (!actorId) {
          skipped++
          continue
        }

        const dateStr = post.parsedDate!.toISOString().split('T')[0]

        const { error } = await supabase.from('incidents').insert({
          actor_id: actorId,
          victim_name: post.post_title || 'Unknown',
          victim_website: post.website || null,
          discovered_date: dateStr,
          status: 'claimed',
          source: 'ransomwatch',
        })

        if (error) {
          skipped++
        } else {
          added++
        }
      } catch {
        skipped++
      }
    }

    console.log(`Added ${added} incidents, skipped ${skipped}`)

    // Update trends
    try {
      await supabase.rpc('apply_actor_trends')
    } catch {}

    return new Response(
      JSON.stringify({
        success: true,
        groups: allGroups.length,
        groupsUpserted: actorsAdded,
        incidentsAdded: added,
        incidentsSkipped: skipped,
        mostRecentDate: postsWithDates[0]?.discovered,
        oldestProcessed: recentPosts[recentPosts.length - 1]?.discovered,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
