// supabase/functions/_shared/rdsPool.ts
//
// Shared RDS connection helper for Edge Functions. AWS RDS serves a
// certificate signed by Amazon's own RDS CA, which isn't in Deno's default
// trusted root store, so we fetch the public CA bundle and verify against
// it explicitly instead of disabling TLS verification.
//
// The pool (and the CA bundle fetch) is memoized per isolate, so importing
// this from multiple functions/invocations reuses the same connections
// instead of opening a fresh pool every time.

import { Pool } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

let poolPromise: Promise<Pool> | null = null

async function createPool(): Promise<Pool> {
  const rdsCaBundle = await fetch(
    'https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem'
  )
    .then((res) => res.text())
    .catch(() => '')

  const rdsUrl = new URL(Deno.env.get('RDS_DATABASE_URL') ?? '')

  return new Pool(
    {
      hostname: rdsUrl.hostname,
      port: rdsUrl.port ? Number(rdsUrl.port) : 5432,
      user: decodeURIComponent(rdsUrl.username),
      password: decodeURIComponent(rdsUrl.password),
      database: rdsUrl.pathname.replace(/^\//, ''),
      tls: {
        enabled: true,
        enforce: true,
        caCertificates: rdsCaBundle ? [rdsCaBundle] : [],
      },
    },
    3,
    true
  )
}

export function getRdsPool(): Promise<Pool> {
  if (!poolPromise) poolPromise = createPool()
  return poolPromise
}
