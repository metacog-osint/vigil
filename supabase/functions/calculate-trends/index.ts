// Supabase Edge Function: Calculate Actor Trends
// Updates trend status, velocity, and incident counts for all actors
// Schedule: Every hour via cron

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    console.log('Calculating actor trends...')

    // Call the PostgreSQL function to apply trends
    const { error } = await supabase.rpc('apply_actor_trends')

    if (error) {
      throw error
    }

    // Get summary for response
    const [escalating, stable, declining] = await Promise.all([
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }).eq('trend_status', 'ESCALATING'),
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }).eq('trend_status', 'STABLE'),
      supabase.from('threat_actors').select('*', { count: 'exact', head: true }).eq('trend_status', 'DECLINING'),
    ])

    console.log(`Trends calculated: ${escalating.count} escalating, ${stable.count} stable, ${declining.count} declining`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Trends calculated successfully',
        summary: {
          escalating: escalating.count || 0,
          stable: stable.count || 0,
          declining: declining.count || 0,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Trend calculation error:', error)

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
