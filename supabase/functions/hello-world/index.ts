// supabase/functions/hello-world/index.ts
//
// A Supabase Edge Function (Deno runtime). It reads the caller's JWT,
// verifies the user via Supabase Auth, and returns a personalized payload
// computed server-side. Auth still lives on Supabase (SUPABASE_URL /
// SUPABASE_ANON_KEY), but the `profiles` data now lives in an external
// RDS Postgres instance, so that one query goes over a direct Postgres
// connection instead of PostgREST. Deploy with:
//
//   supabase functions deploy hello-world
//
// Required secrets (see `supabase functions secrets set`):
//   RDS_DATABASE_URL = postgresql://<user>:<password>@<rds-endpoint>:5432/<dbname>?sslmode=require
//
// Invoke from the client with:
//
//   const { data, error } = await supabase.functions.invoke('hello-world', {
//     body: { name: 'optional override' },
//   })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getRdsPool } from '../_shared/rdsPool.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Client scoped to the caller's JWT so RLS + auth.getUser() work as that user.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const name = body?.name || user.email?.split('@')[0] || 'there'

    // Pull the profile from RDS (raw Postgres, no PostgREST in front of it).
    const rdsPool = await getRdsPool()
    const rdsClient = await rdsPool.connect()
    let profile: { username: string | null; website: string | null } | null = null
    try {
      const result = await rdsClient.queryObject<{ username: string | null; website: string | null }>(
        `select username, website from public.profiles where id = $1 limit 1`,
        [user.id]
      )
      profile = result.rows[0] ?? null
    } finally {
      rdsClient.release()
    }

    const createdAt = new Date(user.created_at)
    const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000)

    const payload = {
      message: `Hello, ${name}! This response was generated server-side by an Edge Function.`,
      user_id: user.id,
      email: user.email,
      username: profile?.username ?? null,
      website: profile?.website ?? null,
      account_age_days: accountAgeDays,
      generated_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
