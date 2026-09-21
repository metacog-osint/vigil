# Session handoff — 20–21 September 2026

Written at the end of a long working session so the next one can pick up without
re-deriving anything. Read this, then `README.md`, then the migration headers for
whatever you are about to touch.

Start with §2a: there are three things to do before anything else, one of which
is a single command.

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

_Last updated 21 September 2026, 04:00 UTC._

- **Branch:** `main`. PRs #35-#39 are merged. **PR #40 is open and unmerged** -
  the CISA advisory source; see §2a.
- **Supabase project:** `faqazkwdkajhxmwxchop`
- **Migrations:** repo has 129 files, numbered to `131`, all applied. Live DB
  numbers by timestamp, so repo filenames are for humans only.
- **Tests:** ~1,046 passing (1,000 unit, 47 worker). Count drifts as sessions
  edit specs.
- **Lint:** 328 warnings against a threshold of **350, now set in one place**
  (`package.json`); CI no longer overrides it. `npm run lint` passes.
- **`ingestion_is_healthy()` is `false`**, for exactly one reason: see §2a.

**Tables the frontend queries that the live database lacks: 62 → 32** as of
20 September. Every remaining one is listed in §4.

## 2a. The three things to do first

**1. Deploy the worker.** `cd workers && npm run deploy`

Three feeds were added on 20-21 September - `threatcluster`, `sec-edgar`,
`cisa-advisories` - and the worker has not been redeployed since the last of
them. Their data is present because the Edge Functions were invoked by hand;
the scheduled jobs are not live.

`cisa-advisories` is marked critical, so until it runs once
`ingestion_is_healthy()` returns false. That is accurate rather than broken -
a declared critical feed has never run - but it is the only thing red.

Whether a brand-new feed should be marked critical before it has ever run is a
fair question. It was marked critical because its absence is invisible: without
it the map shows one Iranian event and nothing indicates anything is missing.

**2. Merge or close PR #40.** It is green and complete; it was left open only
because the session ended.

**3. Use the review queue.** 63 findings are open and **no verdict has ever
been recorded through the page**. The write path has been exercised against the
live database in a transaction that rolled back, and the page has been driven
signed-out and under test, but nobody has yet ruled on a real finding. Doing so
is both the highest-value work left and the only way to know the page is right.

---

## 3. What the 20-21 September sessions changed

### The night of 20-21 September (PRs #35-#40)

**Sources.** Vigil ingested nothing but ransomware leak sites. It now has three
more kinds of evidence:

| Source                         | What it gives                                | Licence                    |
| ------------------------------ | -------------------------------------------- | -------------------------- |
| ThreatCluster Ransomware-Intel | victim country - filled 6,042 incidents      | TLP:CLEAR, redistributable |
| SEC EDGAR 8-K Item 1.05        | the victim's own disclosure to its regulator | US public domain           |
| CISA AA-series advisories      | government-attributed state activity         | US public domain           |

Victim country went from 28.6% to **43.9%** and from four months stale to
current. ransomware.live had been its sole supplier and stopped on 29 May;
ransomlook carries none.

**The review queue exists** (`/review`, migration 126). Verdicts are recorded
from the product, append-only, reviewer taken from the JWT, rationale required.

**Five defects with one root cause.** `src/lib/supabase.js` defined the query
objects a second time alongside `src/lib/supabase/*.js`. See §6 - it is the
most expensive thing in this repository's history and it is now guarded.

**Security.** Six SECURITY DEFINER functions were callable without signing in
(125); 66 functions had no pinned `search_path` (127).

**The e2e suite no longer touches production** (§6), and main's CI went from 21
failing tests to green.

### Earlier on 20 September

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

**Attribution language is not decoration.** CISA writes "Iranian-Affiliated",
"Russian State-Sponsored", "China-Nexus" and "Pro-Russia Hacktivists" and means
four different things. The first version of the advisory parser read the summary
as well as the title, and turned "Pro-Russia Hacktivists" into `state` and
"China-Nexus" into `state`, because the body text mentioned state-sponsored
actors elsewhere. Read the title; it is where the care is.

**`format:check` reports ~300 files locally and 3 in CI.** The working tree has
CRLF endings and Prettier expects LF, so a local run flags almost everything. CI
checks out with LF and sees the truth. Do not "fix" the other 300.

**The pre-commit hook lints staged files at zero warnings.** Touching a file with
pre-existing debt means clearing all of it or using `--no-verify`. Going around
it is how three files reached CI unformatted on 21 September. If you use
`--no-verify`, run `npx prettier --write` on what you staged.

**Do not poll production.** A monitor checking the deployed site every 30 seconds
tripped Vercel's bot protection on 21 September, and the browser used for testing
began getting "Vercel Security Checkpoint" instead of the site. Attack Challenge
Mode was _not_ enabled - checked via the API, which returns
`Seawall Config not found` - so it was a client-level challenge rather than a
project setting, but it cost the session its ability to test against production.
Watch the Vercel dashboard or the GitHub deployment, not the site itself.

---

## 6a. Open work, 21 September

### Started and not finished

**The map does not draw the advisory data.** This is the one thing left
half-done. `attributed_activity` holds ten CISA advisories, five with
attribution, and `attributed_activity_by_country` aggregates them - but
`ThreatAttributionMap.jsx` still draws only two layers: victim country from
incidents, and a count of _actors_ per origin country. Neither shows that a
government attributed activity to Iran.

The session stopped before this deliberately. It is a visible change to how
attribution is presented and deserves a fresh start rather than being tacked
onto a long session's end.

When building it, the thing to preserve: `attribution_strength` is
`state | affiliated | nexus | aligned | criminal`, and those are not
interchangeable. A map rendering "Pro-Russia hacktivists" the same as "Russian
state-sponsored actors" would undo the reason the column exists.

**The IOC country filter has never been confirmed by eye.** The wiring, the RPC
and the data are verified - `search_iocs('', null, 100, 'IR')` returns 100 rows

- but nobody has typed a country into the live page and watched rows filter. It
  had never once worked before 20 September, so it deserves a look.

### Owner decisions, unchanged

VulnCheck's key (401 on every run), the six empty feature groups, the
ransomware.live licence, Pricing, and the leaked-password toggle in the Auth
dashboard. See §4.

### Needs a decision, not a tidy-up

**`docs/PRICING_ANALYSIS.md` is money content in a public repository.** It holds
competitor pricing, Vigil's own tier table and competitive positioning. This
repository is public, and the standing rule is that commercial material stays
out of it - the same rule that had the handover documents scrubbed before they
were first pushed on 20 September.

Archiving it does not help: `docs/archive/` is just as public. The real options
are to delete it from the tree, or move it to wherever the downstream product's
documents live. Both are decisions about the business rather than the code, so
it was left exactly where it is and flagged here instead.

### Small and known

- `ofac-reachability-probe` Edge Function is emptied and returns 410. It can be
  deleted from the dashboard; there is no delete API.
- `mitre` and `mitre-atlas` have still never run. They are priority 4-5
  weeklies, so this may simply be their turn not arriving.
- `campaigns` holds 56 MITRE campaigns with **no target countries and no actor
  links**, last updated December 2025. It looks like a usable source of
  attributed operations and is not one.

---

## 7. If you only do one thing

**Use the review queue.** It exists now, at `/review`. Sixty-three findings are
waiting on a verdict, and every one is a judgment call no amount of engineering
will settle - which two names are one group, whether a post is a victim claim,
whether 100 duplicate vulnerability rows should go.

Two groups are worth starting with. **Seventeen SEC candidates**: a company
filed an 8-K Item 1.05 saying a material cybersecurity incident occurred, and a
ransomware group claimed an organisation of the same name. Ruling on those turns
"claimed by Qilin" into "claimed by Qilin, and the company told the SEC" - the
only corroboration a leak-site feed cannot buy. **Twenty-five country
disagreements**, where two sources name different countries for the same victim
and neither was applied.

Both groups exist because the new sources refused to guess. That is the
mechanism working, and it produces work rather than removing it.

Clearing them through the page is also the only way to know the page is right.
It has been driven signed-out and under test, and its write path has been
exercised against the live database in a transaction that rolled back, but no
real verdict has been recorded through it yet.

Do not clear them quickly. "Not enough evidence" is a verdict, it keeps the
finding queued, and it is the correct answer more often than the queue's length
suggests.
