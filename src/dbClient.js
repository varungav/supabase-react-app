import { supabase } from './supabaseClient'

/**
 * dbClient.js
 *
 * Thin wrapper around the `db` Edge Function, which is the generic
 * request -> SQL middleware sitting in front of RDS (see
 * supabase/functions/db/index.ts). This replaces direct
 * `supabase.from(table)...` calls now that `profiles`/`tasks` data lives in
 * RDS instead of Supabase's own Postgres -- auth still goes through
 * Supabase, only the data layer moved.
 */
async function call(table, action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('db', {
    body: { table, action, ...extra },
  })

  // supabase-js only sets `error` for transport/HTTP-level failures; a 4xx/5xx
  // JSON body from our own function (e.g. { error: 'Task not found' }) still
  // comes back as `data`, so surface that too.
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data?.data
}

export const db = {
  tasks: {
    list: () => call('tasks', 'list'),
    create: (title) => call('tasks', 'create', { data: { title } }),
    update: (id, changes) => call('tasks', 'update', { id, data: changes }),
    remove: (id) => call('tasks', 'delete', { id }),
  },
  profiles: {
    get: () => call('profiles', 'get'),
    upsert: (changes) => call('profiles', 'upsert', { data: changes }),
  },
}
