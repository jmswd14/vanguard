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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Decode JWT to extract user ID without a network round-trip
    let userId: string
    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.sub
      if (!userId) throw new Error('No sub')
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { messages, include_history } = await req.json()

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const today = new Date().toISOString().split('T')[0]

    // Fetch user context in parallel
    const [tasksRes, habitsRes, habitLogsRes, journalRes] = await Promise.all([
      sb.from('tasks').select('name, due, priority, done, lists(name)')
        .eq('user_id', userId).eq('done', false).order('due', { ascending: true }).limit(25),
      sb.from('habits').select('id, name, description, icon, frequency')
        .eq('user_id', userId).limit(20),
      sb.from('habit_logs').select('habit_id, completed, date')
        .eq('user_id', userId).gte('date', new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]),
      sb.from('journal_entries').select('title, content, gratitude_1, gratitude_2, gratitude_3, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    ])

    // Build tasks context
    const tasks = tasksRes.data || []
    const overdue = tasks.filter(t => t.due && t.due < today)
    const dueToday = tasks.filter(t => t.due === today)
    const upcoming = tasks.filter(t => t.due && t.due > today).slice(0, 8)
    const noDate = tasks.filter(t => !t.due).slice(0, 5)

    const fmtTask = (t: any) =>
      `  - ${t.name}${t.due ? ` [${t.due}]` : ''}${t.priority && t.priority !== 'none' ? ` (${t.priority})` : ''}${t.lists?.name ? ` — ${t.lists.name}` : ''}`

    let tasksContext = ''
    if (overdue.length) tasksContext += `OVERDUE (${overdue.length}):\n${overdue.map(fmtTask).join('\n')}\n\n`
    if (dueToday.length) tasksContext += `DUE TODAY:\n${dueToday.map(fmtTask).join('\n')}\n\n`
    if (upcoming.length) tasksContext += `UPCOMING:\n${upcoming.map(fmtTask).join('\n')}\n\n`
    if (noDate.length) tasksContext += `NO DATE:\n${noDate.map(fmtTask).join('\n')}\n\n`
    if (!tasksContext) tasksContext = '  No active tasks.\n'

    // Build habits context
    const habits = habitsRes.data || []
    const logs = habitLogsRes.data || []
    const todayLogs = new Set(logs.filter(l => l.date === today && l.completed).map(l => l.habit_id))
    const habitsContext = habits.length
      ? habits.map(h => `  - ${h.name}${todayLogs.has(h.id) ? ' ✓' : ''}`).join('\n')
      : '  No habits tracked.'

    // Build journal context
    const stripHtml = (s: string) => s?.replace(/<[^>]*>/g, '').trim() || ''
    const journalContext = (journalRes.data || []).map(e => {
      const date = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const body = e.title
        ? `${e.title}: ${stripHtml(e.content || '')}`
        : e.gratitude_1
          ? [e.gratitude_1, e.gratitude_2, e.gratitude_3].filter(Boolean).join('; ')
          : stripHtml(e.content || '')
      return `  [${date}] ${body.slice(0, 200)}`
    }).join('\n') || '  No recent journal entries.'

    // Optionally include past conversation summaries
    let historyContext = ''
    if (include_history) {
      const { data: pastMsgs } = await sb.from('chat_messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (pastMsgs && pastMsgs.length > 0) {
        // Summarize past messages (just show them, Claude will use them)
        historyContext = `\nPAST CONVERSATION CONTEXT (most recent first):\n${
          pastMsgs.reverse().map(m => `  [${m.role.toUpperCase()}]: ${m.content.slice(0, 150)}`).join('\n')
        }\n`
      }
    }

    const systemPrompt = `You are a personal AI assistant embedded in Motherboard — the user's private life management portal. You have real-time access to their data.

TODAY: ${today}

TASKS:
${tasksContext}
HABITS (✓ = completed today):
${habitsContext}

RECENT JOURNAL:
${journalContext}
${historyContext}
Be direct, concise, and genuinely helpful. Reference the user's actual data naturally when relevant. You know this person — their tasks, habits, and thoughts. Speak like a trusted assistant, not a generic AI.`

    // Convert messages to Gemini format (role: user|model, parts: [{text}])
    const geminiContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // Call Gemini with streaming
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(geminiRes.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
