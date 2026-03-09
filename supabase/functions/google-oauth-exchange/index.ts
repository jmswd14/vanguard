// IMPORTANT: This function must have "Verify JWT with legacy secret" set to OFF in Supabase Dashboard
// Edge Functions → google-oauth-exchange → Details → Verify JWT = OFF
// This setting resets to ON on every redeploy — must be manually turned off after each deployment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, redirect_uri } = await req.json()

    // Exchange auth code for tokens with Google
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        redirect_uri,
        grant_type: 'authorization_code',
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      }),
    })

    const data = await resp.json()
    console.log('[oauth-exchange] Google token response ok:', resp.ok, 'has access_token:', !!data.access_token, 'has refresh_token:', !!data.refresh_token)

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: data.error_description || data.error || 'Token exchange failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
