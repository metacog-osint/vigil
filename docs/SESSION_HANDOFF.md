# Session handoff — 20 September 2026

Written at the end of a long working session so the next one can pick up without
re-deriving anything. Read this, then `README.md`, then the migration headers for
whatever you are about to touch.

---

## 1. What Vigil is

The README says "threat intelligence database". The sharper version, and the one
that should govern decisions:

> **Vigil is an argument that threat intelligence products lie by construction,
> and a working demonstration of what it costs not to.**

The dashboard is the delivery mechanism. The product is the discipline — every
judgment call recorded with its evidence, and nothing asserted that cannot be
supported. Migrations `089`, `095` and `096` are the worked examples and are the
strongest thing in the repository.

Three consequences that keep coming up:

- **A feature that does not work is worse than a feature that is not there yet.**
  A nav item that 400s is the product making a claim it cannot back, aimed at its
  own users instead of at threat data.
- **Absence and zero are different answers.** A count that failed is `null`, not
  `0`. See `src/lib/supabase/dashboard.js`.
- **Judgment calls get queued, never guessed.** `data_quality_findings` plus the
  decision tables. See §6.

Vigil serves three purposes at once, and they have different acceptance criteria.
Do not collapse them:

|                     |                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Portfolio piece** | Read by people assessing the work. Must be credible and clean.                                                              |
| **Engine**          | A downstream consumer reads from it, with its own spec and its own Supabase project. Vigil's schema is not its only reader. |
| **Product**         | Vigil may be used directly by people who are not its author. **This is not ruled out** — do not assume otherwise.           |

---

## 2. Where things stand

- **Branch:** `main`. PRs #35-#38 landed the evening of 20 September; every P0
  from that evening's list is merged, deployed and checked in production.
- **Supabase project:** `faqazkwdkajhxmwxchop`
- **Migrations:** repo has 124 files, numbered to `126`. Live DB numbers by
  timestamp, so repo filenames are for humans only.
- **Tests:** ~1,032 unit tests passing. Count drifts as sessions edit specs.
- **Lint:** ~338 warnings against a CI ceiling of 500. `npm run lint` still says
  `--max-warnings 0` and therefore fails; two numbers claim to be the standard.

**Tables the frontend queries that the live database lacks: 62 → 32** over this
session. Every remaining one is listed in §4.

---

## 3. What this session changed

**Honesty on surfaces a visitor sees**

- Landing page 500 handling: a failed count rendered `0`. It renders `—` now.
  Both copies of `getOverview` collapsed into one. (`05396e5`)
- 24 leak-site posts that were not victim claims moved to `leak_site_notices`,
  generalising 095 beyond LockBit. `detect_leak_site_notices()` queues future
  candidates and never moves a row. (`e685b8e`, applied)
- Play redacts victim names with `?` where other groups use `*`; 39 rows were
  reading as ordinary victims. (`70a4fe5`, applied)

**Queries that had never once succeeded**

- `vulnerabilities` has no `id` column (key is `cve_id`) — fixed in `compare.js`,
  `whatsNew.js` and later `sharedWatchlists.js`. (`47c25ec`, `07ded75`)
- `saved_searches` was missing 9 columns its own UI writes; the table held zero
  rows because nothing could ever be saved. (`47c25ec`, migration 100)

**Features the sidebar linked to that had no tables**

- Investigations (8 tables + view) — `117`
- Attack surface / Assets (4 tables + 2 views) — `118`
- Custom IOC lists (3 tables + view) — `119`
- Teams (4 tables) — `120` ← **product decision: Vigil has teams**
- Audit log unified and completed — `121`
- Vendor risk (4 tables, 2 views, scoring RPC) — `122`
- Team watchlists repointed and completed — `123`

**Repository hygiene**

- Deleted 20 unimported `src/lib` modules and all Firebase remnants; 10,470 lines,
  and a 55.6 kB `vendor-firebase` chunk left the production bundle. (`0c608bb`)
- `api/` brought into the lint path — the Stripe webhook, SCIM and auth helpers
  had never been statically analysed. (`6b6bc06`)
- README rewritten around the methodology. (`4b67040`)

---

## 4. What is left

### Needs a decision from the owner

Nothing below is blocked on engineering. Each is "finish it / hide it / leave it",
and the test is **would you demo it?**

| Feature                  | Missing                        | Note                                     |
| ------------------------ | ------------------------------ | ---------------------------------------- |
| **Status page**          | 5 tables + `get_system_status` | Matters once customers watch uptime      |
| **Chat integrations**    | 4 tables + 1 view              | Slack/Teams is how an MSP consumes this  |
| **Escalation / on-call** | 6 tables + 5 RPCs              | Needs a working alert sender first       |
| **SSO**                  | 3 tables                       | Enterprise sales gate                    |
| **Benchmarks**           | 3 tables                       | Needs a customer base to compare against |
| **Usage analytics**      | 4 tables + 3 views             | Internal only, low stakes                |

### Belongs to another session's lane

- **`webhooks` / `webhook_deliveries`** (2 tables). Schema is a one-hour job, but
  nothing _sends_ webhooks. Attach to whatever the alert-delivery work lands
  (`104_alert_delivery.sql`) rather than building it in isolation.
- **`alert_rules` → `user_alert_rules`** in `AlertAnalyticsDashboard.jsx:331`.
  A genuine one-line rename; the table exists under the other name and has the
  `enabled` column the query filters on. Blocked only by a pre-existing
  `exhaustive-deps` warning in that file which the commit hook rejects — clearing
  it means hoisting `processAnalytics` (~80 lines). Handed over twice, still open.

### Done the evening of 20 September

Left here because the reasoning is worth keeping, not because there is work in it.

- **The review queue exists** (`/review`, migration 126). Verdicts are recorded
  from the product, append-only, with the reviewer taken from the JWT and a
  rationale the database insists on. §7 used to say build this.
- **Group profiles are reachable.** There was no `/actors/:id` route, and the
  protected route group had no catch-all, so any unmatched path rendered an
  empty `<main>` - indistinguishable from a page that failed to load.
- **The dashboard no longer contradicts itself.** The week-over-week tile
  compared a partial calendar week against a full one; on a Sunday that was one
  day against seven, reported as a 94% fall beside a rolling seven-day figure.
- **Six SECURITY DEFINER functions were callable without signing in**
  (migration 125). Revoking from `anon` alone would have done nothing - the
  grant was to PUBLIC, and `anon` is a member of it.
- **OFAC fetches from a Supabase Edge Function.** Cloudflare's edge could not
  complete the handshake with Treasury (HTTP 525, nine attempts); Supabase's
  network does it in 672 ms for all 29 MB. **Inert until `npm run deploy` is run
  from `workers/`** - there is no CI deploy for the worker.

### Ready to do, no decision needed

- **`TenantProvider` wraps the entire app** and calls four RPCs that do not
  exist, swallowing the error on every page load. `BrandingConfigSection` and
  `SSOConfigSection` both render in Settings, so it is reachable UI, not dead
  code — which is why it was left. Fix or remove, but it is not a feature
  question.
- **Team watchlists have a schema and a query layer and no interface.** Nothing
  renders `sharedWatchlists`. Small feature build.
- **`investigation_entities` is read-only.** The Entities tab lists linked
  entities; nothing writes one. The table exists and is empty, so the tab says
  "No linked entities", which is true.
- **`detect_leak_site_notices()` is not scheduled.** It seeded the queue once.
  Making it hourly is one line beside `run_data_quality_checks` in
  `workers/src/index.js` — that file is another session's lane.
- **`npm run lint` vs CI** disagree (0 vs 500, reality ~338). Pick one; 350 would
  ratchet.
- **`CLAUDE.md` is dated January** and describes an older project.

### Open review-queue items (analyst judgment, not code)

In `data_quality_findings`, waiting on a recorded verdict:

- `babuk2` / `satanlock` — reported as linked operators, not a shared brand
- `ransomedvc2` / `rebornvc` — successor claim resting on three incidents
- Monti's 19 `"<victim> - Press Release"` rows — 11 duplicate an existing row,
  **8 are the only record of that victim and must not be removed**
- `radiant` / "Dutch ???" and `arcusmedia` / "New .Gov ?" — claims with the
  victim name withheld; redaction or notice?
- 6 incidents whose `victim_name` is the leak site's HTML block — **5 name the
  victim inside the markup**, so they must not be hidden
- 11 `leak_site_notice_candidate` rows, mostly Ragnar Locker
  `"Announcement: <company> going to be leaked"`, which _do_ name a victim
- `audit_log_trust` — browser-written audit entries are self-reported

**None of these have a UI.** The only way a verdict has ever been recorded is a
hand-written migration. Building that page is the single highest-value feature
left: it is the product's central claim, and it currently has no product behind
it.

---

## 5. How to work in this repo right now

**Several Claude sessions share one working tree.** Not worktrees — one directory.
Branches do not protect you; last write wins.

- **Stage explicit paths.** Never `git add -A`; you will sweep another session's
  in-flight work into your commit.
- **Check `git log` and `git status` before and after.** The branch itself moved
  mid-session.
- **Migration numbers collide.** Take the next free number, expect to renumber,
  and renumber rather than argue — the live DB uses timestamps, so only the
  filename matters. This happened three times today.
- **Stay out of other lanes.** `workers/`, the alert path and `iocs.js` were
  actively being rewritten today.

**Applying migrations.** Use the Supabase MCP `apply_migration`. Write the full
reasoning into the repo file and apply a condensed version that points back at it,
so the migration log does not hold a second copy that can drift.

**The live database times out intermittently.** Six `Connection terminated due to
connection timeout` errors today. It recovers. **Always check whether a failed
statement partially applied before retrying**, and clean up test rows.

**Dry-run before applying anything destructive.** Two real victims were nearly
deleted today by rules that looked conclusive — `cmd organization / "Contact
Group"` is a Tasmanian building-services company, and 8 of Monti's press-release
rows are the sole record of their victim. `094`'s header says the same thing.

---

## 6. Traps that bit more than once

**`current_setting('app.user_id', true)`** — the Firebase-era session variable.
Every RLS policy written before the January auth migration uses it. Nothing sets
it, so it evaluates NULL and **every policy denies**. Applying such a migration
unchanged creates tables that silently return nothing to everybody, which reads
as an empty account rather than a fault. Present in `016`, `017`, `018`, `025`,
`040`. Rewrite to `(auth.uid())::text` before applying anything of that vintage.

**`vulnerabilities` has no `id`.** Its key is `cve_id`. Three separate modules
assumed otherwise. If a fourth turns up, add a shared key-column helper.

**`.count || 0`** — supabase-js resolves rather than throws, so a failed count is
`{ count: undefined, error }` and `|| 0` publishes a figure the database never
returned. Check `.error`.

**Two query layers, and they are where the bugs come from.**
`src/lib/supabase.js` (~2,700 lines) and `src/lib/supabase/*.js` both define the
same objects; most files import the monolith. On 20 September this single fact
produced four separate user-visible defects:

| Object          | What it cost                                                    |
| --------------- | --------------------------------------------------------------- |
| `threatActors`  | the actor page could not resolve a name from the url            |
| `trendAnalysis` | a dashboard fix changed the labels on screen and not one number |
| `syncLog`       | the Operations page reported no sync data beside 15,068 rows    |
| `savedSearches` | five methods missing; nothing calls them yet                    |

A missing method is **not** an error anyone sees. It is `undefined`, it throws at
the call site, a `try/catch` swallows it, and the page renders an empty state
that reads exactly like _there is nothing here_.

`src/lib/__tests__/queryLayerSurface.test.js` now asserts that every object
defined in both places exposes at least the methods its module defines. It found
the `savedSearches` divergence on its first run. `threatActors`, `trendAnalysis`,
`syncLog`, `savedSearches`, `dashboard` and `sharedWatchlists` are re-export
shims; the rest are still duplicated. **Shim any object you touch.**

**A count read through the API is not the count in the database.** The public
policies hide rows, so the same query returns 982 as `anon` and 1,019 as
`service_role` over 30 days of incidents. Neither is wrong. Before chasing a
figure that looks off by a little, check which role read it - an hour went into
this one on the assumption it was a date-handling bug.

**PostgREST coerces a filter value to the column's type.** `discovered_date` is
a date, so `gte.2026-08-21T20:45:12Z` and `gte.2026-08-21` return the same rows.
A timestamp against a date column is untidy, not a bug.

**Views default to definer rights.** `audit_activity_summary` showed every user's
activity to every user. New views get `WITH (security_invoker = true)`.

**RLS recursion.** A policy on table A that queries table B whose policy queries A
will not run. Use a `SECURITY DEFINER` lookup function — see
`can_see_investigation()` and `is_team_member()`.

---

## 7. If you only do one thing

**Use the review queue.** It exists now, at `/review`. Twenty-one findings are
waiting on a verdict, and every one of them is a judgment call that no amount of
engineering will settle - which two names are one group, whether a post is a
victim claim, whether 100 duplicate vulnerability rows should go.

Clearing them through the page is also the only way to know the page is right.
It has been driven signed-out and under test, and its write path has been
exercised against the live database in a transaction that rolled back, but no
real verdict has been recorded through it yet.

Do not clear them quickly. "Not enough evidence" is a verdict, it keeps the
finding queued, and it is the correct answer more often than the queue's length
suggests.
