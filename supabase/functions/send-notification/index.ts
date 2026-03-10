import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Fix 2 — log env var presence at cold start so it shows in function logs
console.log('[send-notification] SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.slice(0, 10) + '...' : 'MISSING')
console.log('[send-notification] SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.slice(0, 10) + '...' : 'MISSING')
console.log('[send-notification] RESEND_API_KEY:', RESEND_API_KEY ? RESEND_API_KEY.slice(0, 10) + '...' : 'MISSING')

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { to, subject, html, user_id, type, link } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── Send email via Resend ────────────────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vanguard <notifications@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[send-notification] Resend error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[send-notification] Email sent, id:', data.id)

    // ── Write in-app notification row ────────────────────────────────────────
    let dbError: string | null = null

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      dbError = 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var is missing — skipping DB insert'
      console.error('[send-notification]', dbError)
    } else if (!user_id) {
      console.log('[send-notification] No user_id provided — skipping DB insert')
    } else {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id,
          type:    type || 'system',
          title:   subject,
          message: htmlToPlainText(html),
          read:    false,
          link:    link || null,
        }),
      })

      // Fix 1 — check DB insert result and surface errors
      if (!dbRes.ok) {
        const dbBody = await dbRes.text()
        dbError = `DB insert failed (${dbRes.status}): ${dbBody}`
        console.error('[send-notification]', dbError)
      } else {
        console.log('[send-notification] In-app notification written for user_id:', user_id)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      email_id: data.id,
      ...(dbError ? { db_error: dbError } : {}),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-notification] Unhandled error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
