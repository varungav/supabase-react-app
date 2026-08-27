// supabase/functions/db/index.ts
//
// Generic "middleware" Edge Function: translates a small, allowlisted set
// of structured requests into parameterized SQL against RDS. This replaces
// direct `supabase.from(table)...` calls (which only work through
// PostgREST) now that `profiles`/`tasks` data lives in RDS instead of
// Supabase's own Postgres.
//
// Auth still goes through Supabase (JWT verified via
// supabaseClient.auth.getUser()). Every query is scoped server-side to the
// caller's user id -- RDS has no RLS safety net, so that scoping is
// enforced here in code and must never be skipped or driven by
// client-supplied values.
//
// Deploy with:
//   supabase functions deploy db
//
// Request contract (POST body):
//   { table: 'tasks',    action: 'list' }
//   { table: 'tasks',    action: 'create', data: { title } }
//   { table: 'tasks',    action: 'update', id, data: { is_complete } }
//   { table: 'tasks',    action: 'delete', id }
//   { table: 'profiles', action: 'get' }
//   { table: 'profiles', action: 'upsert', data: { username, website, avatar_url } }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { PoolClient } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'
import { getRdsPool } from '../_shared/rdsPool.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth is still verified against Supabase -- this function only takes
    // over the data layer, not authentication.
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
      return json({ error: 'Not authenticated' }, 401)
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const { table, action, id, data } = body ?? {}

    const pool = await getRdsPool()
    const client = await pool.connect()

    try {
      if (table === 'tasks') {
        return await handleTasks(client, user.id, action, id, data)
      }
      if (table === 'profiles') {
        return await handleProfiles(client, user.id, action, data)
      }
      return json({ error: `Unknown table "${table}"` }, 400)
    } finally {
      client.release()
    }
  } catch (error) {
    return json({ error: error.message }, 500)
  }
})

// ---- tasks ---------------------------------------------------------------

async function handleTasks(
  client: PoolClient,
  userId: string,
  action: string,
  id: unknown,
  data: Record<string, unknown> | undefined
) {
  switch (action) {
    case 'list': {
      const result = await client.queryObject(
        `select id, title, is_complete, inserted_at
         from public.tasks
         where user_id = $1
         order by inserted_at desc`,
        [userId]
      )
      return json({ data: result.rows })
    }

    case 'create': {
      const title = String(data?.title ?? '').trim()
      if (!title) return json({ error: 'title is required' }, 400)

      const result = await client.queryObject(
        `insert into public.tasks (title, user_id)
         values ($1, $2)
         returning id, title, is_complete, inserted_at`,
        [title, userId]
      )
      return json({ data: result.rows[0] })
    }

    case 'update': {
      if (!id) return json({ error: 'id is required' }, 400)
      const isComplete = Boolean(data?.is_complete)

      // user_id is part of the WHERE clause, not just the id -- this is
      // what keeps one user from toggling/deleting another user's task.
      const result = await client.queryObject(
        `update public.tasks
         set is_complete = $1
         where id = $2 and user_id = $3
         returning id, title, is_complete, inserted_at`,
        [isComplete, id, userId]
      )
      if (result.rows.length === 0) return json({ error: 'Task not found' }, 404)
      return json({ data: result.rows[0] })
    }

    case 'delete': {
      if (!id) return json({ error: 'id is required' }, 400)

      const result = await client.queryObject(
        `delete from public.tasks where id = $1 and user_id = $2 returning id`,
        [id, userId]
      )
      if (result.rows.length === 0) return json({ error: 'Task not found' }, 404)
      return json({ data: { id } })
    }

    default:
      return json({ error: `Unknown action "${action}" for tasks` }, 400)
  }
}

// ---- profiles --------------------------------------------------------------

async function handleProfiles(
  client: PoolClient,
  userId: string,
  action: string,
  data: Record<string, unknown> | undefined
) {
  switch (action) {
    case 'get': {
      const result = await client.queryObject(
        `select username, website, avatar_url
         from public.profiles
         where id = $1
         limit 1`,
        [userId]
      )
      return json({ data: result.rows[0] ?? null })
    }

    case 'upsert': {
      // id is always the caller's own id -- never taken from the client --
      // so this can only ever create/update the caller's own profile row.
      const username = data?.username ?? null
      const website = data?.website ?? null
      const avatarUrl = data?.avatar_url ?? null

      const result = await client.queryObject(
        `insert into public.profiles (id, username, website, avatar_url, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (id) do update
           set username = excluded.username,
               website = excluded.website,
               avatar_url = excluded.avatar_url,
               updated_at = excluded.updated_at
         returning username, website, avatar_url`,
        [userId, username, website, avatarUrl]
      )
      return json({ data: result.rows[0] })
    }

    default:
      return json({ error: `Unknown action "${action}" for profiles` }, 400)
  }
}
