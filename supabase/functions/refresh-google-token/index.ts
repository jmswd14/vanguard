// IMPORTANT: This function must have "Verify JWT with legacy secret" set to OFF in Supabase Dashboard
// Edge Functions → refresh-google-token → Details → Verify JWT = OFF
// This setting resets to ON on every redeploy — must be manually turned off after each deployment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user from JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch refresh token from DB using service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: tokenRow } = await supabase
      .from('google_tokens')
      .select('refresh_token')
      .eq('user_id', user.id)
      .single()

    if (!tokenRow?.refresh_token) {
      return new Response(JSON.stringify({ error: 'No refresh token found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call Google token refresh endpoint
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenRow.refresh_token,
        grant_type: 'refresh_token',
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      }),
    })

    const data = await resp.json()
    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: data.error_description || 'Refresh failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

    // Update stored access token
    await supabase.from('google_tokens').update({
      access_token: data.access_token,
      expires_at: expiresAt,
    }).eq('user_id', user.id)

    return new Response(JSON.stringify({ access_token: data.access_token, expires_at: expiresAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
