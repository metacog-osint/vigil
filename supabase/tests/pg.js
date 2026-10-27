/**
 * A real Postgres for tests, in-process.
 *
 * PGlite is Postgres compiled to WebAssembly. It runs inside the test process:
 * no Docker, no service in CI, the same on Windows as on the CI runner. That
 * matters here because the logic worth testing in Vigil increasingly lives in
 * SQL (matching, the review queue, the licence switch), and until this file
 * nothing ran that SQL before it reached the live database.
 *
 * What it is not: Supabase. There is no PostgREST, no row-level security
 * context and no auth. The roles and the `auth.uid()` stub below exist so a
 * migration's GRANT and function bodies load unchanged; tests run as the
 * superuser. PGlite 0.5.9 is Postgres 18; production is 17. Keep tests to
 * behaviour both share.
 *
 * Each test file builds the few columns it needs with `schema`, then loads the
 * real migration file under test, so a test can never pass against a copy of
 * the SQL that differs from what ships.
 */
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

// What a Supabase database has before any migration of ours runs.
const SUPABASE_BASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;

  create schema extensions;
  create extension pg_trgm schema extensions;

  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`

/** The text of a migration in supabase/migrations, by file name. */
export function migration(file) {
  return readFileSync(path.join(MIGRATIONS, file), 'utf8')
}

/**
 * A new database with Supabase's base objects, then `schema` (the stand-in
 * tables a test needs), then each migration file named, in order.
 */
export async function freshDatabase({ schema = '', migrations = [] } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } })
  await db.exec(SUPABASE_BASE)
  if (schema) await db.exec(schema)
  for (const file of migrations) await db.exec(migration(file))
  return db
}
