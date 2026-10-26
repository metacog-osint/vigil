/**
 * Every migration says who may reach what it creates.
 *
 * TWO RULES, ONE CAUSE
 *
 * Supabase's default privileges in `public` used to decide access for us:
 * every new table, view and sequence was granted to anon, authenticated and
 * service_role, and every new function was executable by all three.
 *
 * 1. From 30 October 2026 that stops for tables and sequences (Supabase
 *    changelog 45329). In Postgres, default privileges "on tables" also cover
 *    views and materialized views. A new object with no GRANT returns
 *    "permission denied" to supabase-js, and CLAUDE.md records what that
 *    looks like here: a try/catch swallows it, and the page renders an empty
 *    state that reads exactly like "there is nothing here". A worker or Edge
 *    Function writing straight to the table as service_role fails the same
 *    way. So: every public table, view and materialized view a migration
 *    creates needs a GRANT on it in the same file. Rebuilding a view or
 *    materialized view with DROP + CREATE makes it a new object.
 *
 * 2. Functions are not part of that change and stay executable by everyone.
 *    A SECURITY DEFINER function runs as its owner, past RLS, so the default
 *    is an open door. Migration 152 left apply_ransom_payments callable with
 *    the browser's anon key. 145 and 147 revoked from public and anon, which
 *    leaves Supabase's separate grant to authenticated in place. So: every
 *    SECURITY DEFINER function a migration creates must be revoked from
 *    public, anon and authenticated, then granted to whoever is meant to call
 *    it. Migration 154 closes the four that were open.
 *
 * Enforced from migration 154 on. Earlier files are history and are applied;
 * the checker reports on them only when asked (--all).
 *
 * A deliberate exception is written into the migration as a comment naming
 * the object, so the reason travels with it:
 *
 *   -- no-grants: some_internal_table - written only by apply_x() as owner
 *
 * This reads SQL with regular expressions, not a parser. Function bodies and
 * comments are removed first, so a CREATE TABLE inside a plpgsql body or a
 * comment is not mistaken for one the migration runs.
 *
 * Usage: node scripts/check-migration-grants.mjs [--all]
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIRST_ENFORCED = 154

const DEFINER_MUST_REVOKE = ['public', 'anon', 'authenticated']

const ident = '"?([a-z_][a-z0-9_]*)"?'
const qualified = `(?:${ident}\\.)?${ident}`

/**
 * Strips comments, then dollar-quoted bodies, and lowercases. Comments go
 * first because migration headers are long prose and may mention `$$`.
 */
function strip(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\$([a-z0-9_]*)\$[\s\S]*?\$\1\$/gi, ' ')
    .toLowerCase()
}

function exemptions(sql) {
  return new Set(
    [...sql.matchAll(/--\s*no-grants:\s*([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase())
  )
}

function publicName(schema, name) {
  return !schema || schema === 'public' ? name : null
}

/**
 * Problems in one migration's SQL. Returns
 * { ungranted: [name], openDefiners: [{ name, missing: [role] }] }.
 */
export function findGrantProblems(sql) {
  const exempt = exemptions(sql)
  const s = strip(sql)

  const created = new Set()
  const createRe = new RegExp(
    `\\bcreate\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+)?(?:table|view)\\s+(?:if\\s+not\\s+exists\\s+)?${qualified}`,
    'g'
  )
  for (const m of s.matchAll(createRe)) {
    const name = publicName(m[1], m[2])
    if (name) created.add(name)
  }

  const granted = new Set()
  for (const m of s.matchAll(/\bgrant\s+[^;]*?\s+on\s+([^;]*?)\s+to\s+[^;]*/g)) {
    const target = m[1].trim()
    if (
      /^(function|procedure|routine|all|schema|sequence|sequences|database|type|domain)\b/.test(
        target
      )
    )
      continue
    for (const item of target.replace(/^table\s+/, '').split(',')) {
      const parts = item.trim().replace(/"/g, '').split('.')
      granted.add(parts[parts.length - 1])
    }
  }

  const ungranted = [...created].filter((n) => !granted.has(n) && !exempt.has(n))

  const definers = new Set()
  const fnRe = new RegExp(`\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+${qualified}\\s*\\(`, 'g')
  for (const statement of s.split(';')) {
    const m = fnRe.exec(statement)
    fnRe.lastIndex = 0
    if (!m || !/\bsecurity\s+definer\b/.test(statement)) continue
    const name = publicName(m[1], m[2])
    if (name) definers.add(name)
  }

  const revoked = new Map()
  const revokeRe = new RegExp(
    `\\brevoke\\s+(?:all|execute)(?:\\s+privileges)?\\s+on\\s+function\\s+${qualified}\\s*(?:\\([^)]*\\))?\\s+from\\s+([^;]+)`,
    'g'
  )
  for (const m of s.matchAll(revokeRe)) {
    const name = publicName(m[1], m[2])
    if (!name) continue
    const roles = revoked.get(name) ?? new Set()
    for (const role of m[3].split(','))
      roles.add(role.trim().replace(/\s+cascade$|\s+restrict$/, ''))
    revoked.set(name, roles)
  }

  const openDefiners = [...definers]
    .filter((n) => !exempt.has(n))
    .map((name) => ({
      name,
      missing: DEFINER_MUST_REVOKE.filter((role) => !revoked.get(name)?.has(role)),
    }))
    .filter((d) => d.missing.length > 0)

  return { ungranted, openDefiners }
}

export function migrationNumber(file) {
  const m = /^(\d+)_/.exec(file)
  return m ? Number(m[1]) : null
}

export function checkMigrations(dir, { all = false } = {}) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => all || (migrationNumber(f) ?? 0) >= FIRST_ENFORCED)
    .sort()
    .map((file) => ({ file, ...findGrantProblems(readFileSync(join(dir, file), 'utf8')) }))
    .filter((r) => r.ungranted.length || r.openDefiners.length)
}

function main() {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
  const all = process.argv.includes('--all')
  const problems = checkMigrations(dir, { all })

  for (const p of problems) {
    for (const name of p.ungranted) console.log(`${p.file}: ${name} is created with no GRANT`)
    for (const d of p.openDefiners) {
      console.log(
        `${p.file}: SECURITY DEFINER ${d.name}() is not revoked from ${d.missing.join(', ')}`
      )
    }
  }

  const scope = all ? 'all migrations' : `migrations ${FIRST_ENFORCED} and later`
  console.log(
    problems.length
      ? `\n${problems.length} file(s) with problems in ${scope}.`
      : `No problems in ${scope}.`
  )
  if (problems.length && !all) process.exit(1)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main()
}
