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

_Last updated 21 September 2026, 04:20 UTC._

- **Branch:** `main`. PRs #35-#41 are merged. No feature branch is outstanding.
- **Supabase project:** `faqazkwdkajhxmwxchop`
- **Migrations:** repo has 133 files, numbered to `135`, all applied. Live DB
  numbers by timestamp, so repo filenames are for humans only.
- **Tests:** ~1,081 passing (1,015 unit, 66 worker). Count drifts as sessions
  edit specs.
- **Lint:** 321 warnings against a threshold of **325**, ratcheted down from 350
  and set in one place (`package.json`). `npm run lint` passes.
- **The worker is deployed.** 21 September 04:13 UTC, 32 jobs. This had been
  outstanding for three feeds across three sessions.
- **Sources:** 30 feeds, of which two are governments attributing activity.

**Tables the frontend queries that the live database lacks: 62 → 32** as of
20 September. Every remaining one is listed in §4.

## 2a. The one thing to do first

**Use the review queue.** It is at `/review`. Sixty-five findings are open and
**no verdict has ever been recorded through the page**. The write path has been
exercised against the live database in a transaction that rolled back, and the
page has been driven signed-out and under test, but nobody has yet ruled on a
real finding. Doing so is both the highest-value work left and the only way to
know the page is right.

The other two items that stood here on 21 September are done: the worker is
deployed and PRs #40 and #41 are merged.

### What is in the queue now

| Check                         | Count | What it asks                                                          |
| ----------------------------- | ----- | --------------------------------------------------------------------- |
| `victim_country_disagreement` | 25    | Two sources name different countries for one victim                   |
| `sec_disclosure_candidate`    | 16    | A company filed an 8-K and a group claimed a company of that name     |
| `leak_site_notice_candidate`  | 12    | A leak-site post that reads as an announcement, not a victim claim    |
| `attribution_unstated`        | 1     | NCSC named Iran without saying what its relationship to the actors is |
| `campaign_multiple_actors`    | 1     | MITRE attributes C0052 to two groups; `actor_id` holds one            |
| others                        | 10    | Alias reviews, audit-log trust, vulnerability key quality             |

**Start with the 16 SEC candidates.** Ruling on those turns "claimed by Qilin"
into "claimed by Qilin, and the company told the SEC" - the only corroboration
a leak-site feed cannot buy.

Do not clear them quickly. "Not enough evidence" is a verdict, it keeps the
finding queued, and it is the correct answer more often than the queue's length
suggests.

---

## 2b. What the overnight session of 21 September did

**The map draws government attribution.** This was the one thing left half-done
at 04:00 and it is the visible change. A third layer on the Geography tab -
Victims, Attackers, **Attributed** - coloured by `attribution_strength` and not
by count, because three advisories calling a country's actors "pro-Russia
hacktivists" are not a stronger claim than one calling them "state-sponsored",
and a gradient would have said they were. The tooltip lists every phrase the
advisories used, verbatim, alongside which is strongest and which governments
said it.

**A second government.** NCSC-UK, via `ncsc-advisories`. Iran is now named
independently by CISA ("Iranian-Affiliated") and NCSC ("Iranian state actors"),
which raises its strongest claim from `affiliated` to `state`.

Four other national CERTs were checked and rejected with evidence: CERT-EU
publishes vulnerability notices and monthly digests, CCCS publishes vendor patch
advisories, JPCERT publishes Japanese-language vulnerability alerts, and ACSC
refused every request. **A feed returning HTTP 200 and ten items is not a feed
that says who did it** - the 21 September coverage note had verified the fetch
and not the content, and called NCSC and CERT-EU the two cheapest wins. One of
the two was.

**The attribution table is testable.** It lived inside a Deno Edge Function
where nothing could reach it, and the only record it worked was a paragraph
saying a person had checked - after it had already been wrong twice. It is now
`supabase/functions/_shared/attribution.ts`, which has no Deno imports, so
vitest loads it under Node. Fourteen tests against real advisory titles.

**24 MITRE campaigns link to their actors.** They named the actor in a text
array and `actor_id` was null on all 56, so nothing could navigate from Volt
Typhoon to the KV Botnet activity or from Sandworm to the 2022 Ukraine Electric
Power Attack. One campaign is queued because MITRE names two groups for it.

**Three hand-overs unblocked**, all stuck behind the same knot: an
exhaustive-deps warning the commit hook rejects, guarding a real render loop.
`useActorData`'s `loadActors` depended on `actors.length`, so doing what the
rule asked would have made the effect re-run on every change to `actors` -
and the effect sets `actors`. The count moved to a ref.

Two defects fell out of the `alert_rules` rename that was called a one-liner:
the table has never existed under that name, so the noisy-rules panel has
always rendered empty rather than absent; and `user_alert_rules` names the
column `rule_name`, so even with the right table every row would have been
blank.

**The IOC country filter was ignored in demo mode.** Typing a country returned
unfiltered results with the field on screen claiming otherwise, and with an
empty search box it returned every indicator, because `''.includes('')` is true
for all of them. Now confirmed on the page rather than in the query layer -
which is what the handover asked for, and is how this was found.

**Commercial material is out of the public repository.** Three files, not the
one the handover named: `PRICING_ANALYSIS.md`, and `SAAS_ROADMAP.md` and
`COST_ANALYSIS.md` which were in `docs/archive/` - just as public. Preserved at
`D:\Projects\Vigil-commercial`. **The git history still contains all three**,
and `/pricing` is still a live route; both are noted in §4 as owner decisions.

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
- ~~**`alert_rules` → `user_alert_rules`**~~ Done 21 September, and it was not
  a one-line rename: see §2b and the trap in §6. `processAnalytics` hoisted out
  of the component, and two further defects found in the doing.

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

- ~~**`TenantProvider` calls four RPCs that do not exist**~~ Stale as written.
  `TENANCY_PROVISIONED = false` already guarded three of the four, and a page
  load was checked in the browser on 21 September: **no RPC request is made at
  all**. The fourth, `tenantMembers.canAccess`, was unguarded and had no
  callers; it is guarded now. Nothing to do.
- **Team watchlists have a schema and a query layer and no interface.** Nothing
  renders `sharedWatchlists`. Small feature build.
- **`investigation_entities` is read-only.** The Entities tab lists linked
  entities; nothing writes one. The table exists and is empty, so the tab says
  "No linked entities", which is true.
- ~~**`detect_leak_site_notices()` is not scheduled**~~ Hourly since
  21 September (`leak-site-notices` in the registry, migration 133).
- ~~**`npm run lint` vs CI disagree**~~ One number, in `package.json`, ratcheted
  to 325 on 21 September against an actual 321.
- ~~**`CLAUDE.md` is dated January**~~ Updated 21 September. "Add a data source"
  described `scripts/ingest-{source}.mjs`, which is not how any source added in
  the last two days works; it now describes the Edge Function → worker →
  registry → `feed_expectations` → deploy path.

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

**A feed returning 200 and ten items is not a feed that says who did it.** The
21 September coverage note named NCSC-UK and CERT-EU as the two cheapest new
sources, "the same RSS shape as CISA". The fetch had been verified; the content
had not. CERT-EU's security advisories are vulnerability notices with no
attribution in any of them, and its threat-intelligence feed is monthly
round-ups covering dozens of unrelated events. CCCS and JPCERT are the same.
Read what a feed contains before costing the work.

**`waitForLoadState('networkidle')` proves nothing after a pushState.** The e2e
helper navigates in-app, so there is no network activity to settle and the call
returns before React has rendered. `isVisible()` then checks once without
retrying. Two tests raced this for months and lost on webkit, which renders
more slowly than chromium. Use `expect(...).toBeVisible()`, which retries.

**An exhaustive-deps warning can be guarding a real loop.** `useActorData`'s
`loadActors` depended on `actors.length`, so adding it to the effect's
dependency list - which is what the rule asks - makes the effect re-run on
every change to `actors`, and the effect calls `loadActors(true)`, which sets
`actors`. Handed over twice as "a one-line rename blocked by a lint warning".
Break the cycle first; the count belongs in a ref.

**A missing table is silent.** `AlertAnalyticsDashboard` queried `alert_rules`,
which has never existed - the table is `user_alert_rules`. supabase-js returns
`{ data: null, error }` rather than throwing, the code read `data || []`, and
the noisy-rules panel has always rendered _empty_ rather than absent. An empty
panel reads as "you have no noisy rules", which is a claim, and a false one.

**Demo mode is a second implementation and drifts.** The IOC page's country
filter worked against the RPC and was dropped on the floor in demo mode, which
is what the e2e suite and every demo visitor sees. Worse, with an empty search
box it returned every indicator, because `''.includes('')` is true for all of
them. When a filter is added, add it to both paths.

**`min(uuid)` does not exist in Postgres.** Use `(array_agg(x))[1]`. The
migration that hit this rolled back cleanly, which was checked before retrying -
as `§5` says to.

**`create or replace view` cannot insert a column in the middle.** New columns
go last, or the statement fails with "cannot change name of view column". The
frontend selects by name, so last is fine.

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

## 6a. Open work, as of 04:20 on 21 September

### Started and not finished

Nothing. The map layer, the second government, the campaign links, the IOC
country filter and the three blocked hand-overs all landed in PR #40.

### Needs a person, not a session

**Sixty-five findings, no verdict ever recorded.** See §2a. This is the only
item that is both high-value and completely unblocked.

### Owner decisions, unchanged

VulnCheck's key (401 on every run - the feed has still never succeeded), the
six empty feature groups, the ransomware.live licence, and the leaked-password
toggle in the Auth dashboard. See §4.

**Two new ones, both about material that is already public:**

- **The git history still holds the three commercial documents**, readable at
  any commit before 21 September. Removing them means `git filter-repo` and a
  force-push that breaks every clone and every open PR, so it was deliberately
  not done. The alternative is to treat the content as disclosed and move on.
- **`/pricing` is still a live route** on vigil.theintelligence.company showing
  tiers and Subscribe buttons. Taking a public pricing page down is a
  commercial decision.

### Small and known

- `ofac-reachability-probe` Edge Function is emptied and returns 410. Confirmed
  again on 21 September that there is no delete API and the MCP has no delete
  tool, so this needs a click in the Supabase dashboard.
- `mitre` and `mitre-atlas` have still never recorded a run. They are priority
  4-5 weeklies, so this may simply be their turn not arriving - the campaign
  data itself was last written on 20 September, so something ran.
- `settings.spec.js:46` is selector soup that failed on three browsers on
  20 September. The same class of problem in `vulnerabilities.spec.js` and
  `export.spec.js` was fixed on 21 September; this one was not touched.
- 13 open Dependabot PRs, two with conflicts. Mostly major-version bumps -
  vite 5→7, eslint 8→9, react-router 6→7, react 18→19 - which is why they are
  still open. Not something to merge unattended.

### Where to take the sources next

`docs/THREAT_COVERAGE_GAPS.md` has the ranked list, rewritten on 21 September
after the feeds were read rather than only fetched. The short version:

**HHS OCR is the richest thing left.** ~7,876 US healthcare breaches since
2009, each 500+ individuals, each the victim's own account to a regulator. High
value and awkward: the official portal is a session-based JSF page that 302s,
so it needs a scraper or a third-party mirror, not an afternoon.

Then state AG breach notices (California, Maine, Washington, Texas - free, one
scraper each), then DOJ indictments, then vendor research into the review queue
rather than a parser.

---

## 7. If you only do one thing

**Use the review queue**, at `/review`. Sixty-five findings are waiting on a
verdict and not one has ever been recorded through the page. Every one is a
judgment call no amount of engineering will settle — which two names are one
group, whether a post is a victim claim, whether an advisory naming Iran
without saying how means state or something weaker.

Two groups are worth starting with. **Sixteen SEC candidates**: a company filed
an 8-K Item 1.05 saying a material cybersecurity incident occurred, and a
ransomware group claimed an organisation of the same name. Ruling on those
turns "claimed by Qilin" into "claimed by Qilin, and the company told the SEC" —
the only corroboration a leak-site feed cannot buy. **Twenty-five country
disagreements**, where two sources name different countries for the same victim
and neither was applied.

Both groups exist because the sources refused to guess, and the queue grew
again overnight for the same reason: NCSC published "Iranian cyber targeting of
dissidents", which names a country and not the relationship, and MITRE
attributes one campaign to two groups where the schema holds one. Neither was
resolved by a regular expression. That is the mechanism working, and it
produces work rather than removing it.

Clearing them through the page is also the only way to know the page is right.
It has been driven signed-out and under test, and its write path has been
exercised against the live database in a transaction that rolled back, but no
real verdict has been recorded through it yet.

Do not clear them quickly. "Not enough evidence" is a verdict, it keeps the
finding queued, and it is the correct answer more often than the queue's length
suggests.
