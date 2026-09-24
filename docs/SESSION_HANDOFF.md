# Session handoff — 20–22 September 2026

Written so the next session can pick up without re-deriving anything. Read
this, then `README.md`, then the migration headers for whatever you are about
to touch — those headers carry the reasoning and are the strongest
documentation in this repository.

**Start with §2a.** Then read **§2b** before building any page: it records what
is on screen, what is not, and the two rules the disclosures query layer encodes
that a careless commit would undo.

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

_Last updated 24 September 2026. Every figure below was measured, not carried
forward - the previous version of this block was two days old and wrong about
five of eight lines._

- **Branch:** `main`.
- **Supabase project:** `faqazkwdkajhxmwxchop`
- **Migrations:** numbered to `147`, all applied. The live DB numbers by
  timestamp, so repo filenames are for humans only.
- **Tests:** 1,217 passing (1,135 unit, 82 worker).
- **Lint:** 298 warnings against a ceiling of **325**, set only in
  `package.json`.
- **Worker:** deployed, 37 feeds watched. **`fincen-advisories` is in the
  registry but was not in the deployed bundle as of this line** - see §2e.
- **Edge Functions:** 10, including `fincen-advisories`.
- **Database:** 2,687 MB of 8,192 MB (33%). See §2c.
- **Open findings:** 369. §2a was re-counted at 340 earlier the same day;
  migrations 145-147 added the rest.

### The database went down on 24 September, and nobody did anything to fix it

Worth recording because the next person to see it should not go looking for a
cause in their own work. Between roughly 02:40 and 03:37 UTC every query
against Postgres hung - no response at 45 seconds - while the API gateway
answered normally (`/rest/v1/` returned 401 in 0.14s) and `edge_logs` and
`realtime_logs` kept flowing. `postgres_logs` and `postgrest_logs` simply
stopped. The Supabase management API could not reach the database either,
though the project reported `ACTIVE_HEALTHY` throughout.

Immediately before it went quiet the logs carried `canceling statement due to
statement timeout` and checkpoints with `write=85 seconds`, and the edge log
shows `state-breach-notices` and `ofac-sdn` running in that window. Both are
bulk writers.

It recovered on its own at 03:37 UTC with no intervention and no data loss.

The thing to take from it: **a scheduled ingestion run can make the whole
product unreachable for the better part of an hour.** The live site's static
shell still served, so it looked up while every query behind it hung. Nothing
watches for that - `ingestion_is_healthy()` asks whether feeds are running, not
whether the database is answering.

### What the corpus is made of

The reason this section exists: the owner's instruction on 22 September was
"I do not want a ransomware-heavy platform, there are equal to more critical
threats out there."

| Corpus                                     |   Rows |     Share |
| ------------------------------------------ | -----: | --------: |
| Ransomware leak-site claims                | 39,575 | **80.8%** |
| Regulator breach notices (CA, WA, OR, SEC) |  8,895 | **18.2%** |
| Vendor research reports                    |    286 |      0.6% |
| ICS/OT advisories                          |    148 |      0.3% |
| MITRE campaigns                            |     56 |      0.1% |
| Government attribution advisories          |     16 |      0.0% |

Ransomware was ~98.7% of this on 21 September. The diagnosis mattered more than
any single feed: Vigil was never short of non-ransomware _sources_, it was that
one table outnumbered all the others eighty to one, so only a high-volume
non-ransomware source could move it.

---

## 2a. Do these first

**1. Use the review queue.** `/review`. **340 findings open, and no verdict has
ever been recorded through the page.** It is the product's central claim and it
has never been exercised for real. Everything else on this list is optional;
this is not.

Counts re-queried 24 September. The last handover said 80; the SEC check alone
has gone from 16 to 254 since, so treat any count here as decaying and re-run
the query rather than trusting the table.

| Check                             | Count | What it asks                                                                                                  |
| --------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------- |
| `sec_disclosure_candidate`        |   254 | A company filed an 8-K and a group claimed a company of that name                                             |
| `victim_country_disagreement`     |    25 | Two sources name different countries for one victim                                                           |
| `claim_value_unverified`          |    17 | A claimed figure nothing independent supports                                                                 |
| `leak_site_notice_candidate`      |    13 | A leak-site post that reads as an announcement, not a victim claim                                            |
| `vendor_attribution_candidate`    |     8 | A vendor report whose wording may be an attribution                                                           |
| `actor_origin_ambiguous`          |     5 | An actor matching ETDA entries that name two different countries                                              |
| `leak_site_notice_review`         |     3 | Ruled once, queued again                                                                                      |
| `actor_alias_review`              |     2 | Two names, one group?                                                                                         |
| `ioc_actor_backfill`              |     1 | Should `iocs.actor_id` ever be derived from `malware_family`? See §4g                                         |
| `actor_row_may_be_malware_family` |     1 | 16 actor rows that match a family name and have no incidents — groups, or mis-ingested families?              |
| eleven others                     |    11 | Audit-log trust, victim and vulnerability key quality, review authority, an actor that resumed after takedown |

Two of these were queued on 24 September rather than found by a feed: they came
out of measuring the `iocs.actor_id` backfill, and they are the reason not to
run it. §4g carries the measurement.

Start with the **254 SEC candidates**: ruling on those turns "claimed by Qilin"
into "claimed by Qilin, and the company told the SEC".

**2. Merge #44, then #42 and #43.** #44 removes the subscription tier system.
Until it is merged **and deployed**, vigil.theintelligence.company/pricing is
still serving $29/mo and $99/mo Subscribe buttons — checked 22 September, after
the commit landed on the branch. The commit is not the fix; the deploy is.
#42 and #43 are green including webkit and supersede the old stale PRs. See §2d.

**3. Read §2b before building any page.** The two largest rows were closed on
22 September; the vendor research corpus and the licence layer are still
invisible, and §2b records what the disclosures page settled and what it did
not.

---

## 2b. What exists in the database and not on screen

The two largest rows were built on 22 September. What remains is the vendor
research corpus and the licence layer.

**`/disclosures` and `/contested-claims` are merged** (#46, #49) and reach
production on the next deploy, which Vercel runs from `main` automatically.
The pricing-page lesson in §2a still applies to anything not yet merged: the
commit is not the fix, the deploy is.

| Data                       |   Rows | Query layer             | On screen              |
| -------------------------- | -----: | ----------------------- | ---------------------- |
| `victim_disclosures`       |  8,896 | `disclosures.js`        | **yes** — /disclosures  |
| `breach_notices_by_state`  | 3 rows | `disclosures.js`        | **yes** — /disclosures  |
| `vendor_reports`           |    286 | `vendorReports.js`      | **no**                 |
| `vendor_report_actors`     |     21 | `vendorReports.js`      | **no**                 |
| `source_licences`          |     21 | `sourceLicences.js`     | **no**                 |
| `actor_origins_commercial` |      — | `sourceLicences.js`     | **no**                 |
| `contested_claims`         |      8 | `contestedClaims.js`    | **yes** — /contested-claims |
| `evidence_publishers`      |     20 | `contestedClaims.js`    | partly — tiers only    |
| `regulatory_advisories`    |    183 | `advisoryRegister.js`   | **yes** — /financial-crime |
| `attributed_activity`      |     16 | `attributedActivity.js` | **yes** — map layer    |

**What the disclosures page settled, and what it did not.** It renders the
filings, the per-state totals and a name search, and it states plainly that the
state counts are not comparable. It does **not** let anyone rule on a filing:
`match_status` is displayed, never written. Connecting a notice to a leak-site
claim is still a queued judgment (§4a) with no interface.

**Read `src/lib/supabase/disclosures.js` before building anything near it.**
Two rules are encoded there with tests, and both are one careless commit from
being undone:

- **There is deliberately no method returning a single total of people
  affected.** Washington counts its own residents, Oregon counts everyone
  worldwide, California publishes nothing. Adding them gives 1.45 billion
  "people affected", a figure about nothing. A test asserts the absence of such
  a method, because the obvious next commit is the one that adds it.
- **Every figure is a database count, never a tally of returned rows.**
  PostgREST caps a plain `select()` at 1,000. Counting client-side shipped
  "1,000 filings held" against a real 8,896, and "0 carry a count" against
  3,255 — the first thousand rows are all Californian and California publishes
  no counts. Both rendered as fact. The tests assert `head: true` rather than
  the numbers, so the fix cannot regress quietly.

Two things follow, in order of value:

1. **A review surface for vendor reports.** 286 reports, 21 actor links
   proposed and 8 attribution questions queued, none of them rulable through
   the product. This is also what would finally write `linguistic` — the sixth
   `attribution_strength` exists and nothing has ever set it.
2. **Presentation the user controls.** Agreed with the owner on 22 September:
   _the user_ decides how the data is presented rather than a fixed view. Even
   at 80.8%, any dashboard that ranks by row count will look like a ransomware
   product. The disclosures page is a start — a registry filter and a name
   search — and not the whole of what was asked for.

---

## 2c. Free-tier headroom, measured 22 September

|                                  |                                         |
| -------------------------------- | --------------------------------------- |
| Database                         | **2,642 MB of 8,192 MB** (Supabase Pro) |
| Everything added 21–22 September | **~9 MB**                               |
| Worker cron triggers             | **4 of 5** allowed on Workers Free      |
| Cron invocations                 | ~29/day against 100,000/day             |

**The growth is not the feeds.** `entity_changelog` is 1,197 MB — 45% of the
whole database — and `iocs` another 827 MB. Together about **95 MB/month, with
the IOC rate rising** (15k rows in May, 37k in September). Roughly four years
of headroom.

**Nothing may be pruned to buy room.** History is the product. So when this
becomes a problem the answer is a storage plan, not a `DELETE`, and that
conversation should start well before 8 GB rather than at it.

---

## 2d. Dependabot

The config was the problem, not the bumps. `.github/dependabot.yml` now groups
npm majors and GitHub Actions, and Dependabot superseded the old PRs within a
minute.

- **#42** — 10 npm minor/patch updates, rebased onto current main. **All checks
  green, webkit included. Ready to merge.**
- **#43** — 6 GitHub Actions bumps in one PR. **All green. Ready to merge.**

Those two greens are the proof of something worth remembering: **the thirteen
older PRs' red crosses were inherited, not caused.** Every one predated PR #39,
which is what took main from 21 failing tests to green, so their CI ran against
a main that was already broken.

**Seven major-version PRs remain** (#7, #8, #10–#14). Each is a piece of work
rather than a merge: eslint 8→9 needs the flat-config migration and would take
the lint gate with it; react-router 6→7 and react 18→19 change APIs the app
uses; vite 5→7 and `@vitejs/plugin-react` 4→5 move together. They collapse into
one `major-updates` PR on Dependabot's next scheduled run.

---

## 3. What the 20–22 September sessions built

Kept short. The reasoning lives in the migration headers, which are the
strongest documentation in this repository.

**Evidence that is not a ransomware leak-site claim.** Vigil ingested nothing
else until 21 September. It now has five more kinds:

| Source                                       | What it gives                                  | Licence                         |
| -------------------------------------------- | ---------------------------------------------- | ------------------------------- |
| CISA AA-series (`cisa-advisories`)           | Government-attributed state activity           | US public domain                |
| NCSC-UK (`ncsc-advisories`)                  | A second government, attributing independently | OGL v3.0                        |
| SEC EDGAR 8-K (`sec-edgar`)                  | The victim's own disclosure to its regulator   | US public domain                |
| State AGs CA/WA/OR (`state-breach-notices`)  | 8,812 breach notices, every cause              | US state public record          |
| Vendor research, 8 feeds (`vendor-research`) | Reports and the questions they raise           | Vendor copyright, not sellable  |
| ETDA/ThaiCERT (`etda-actors`)                | Actor origin countries, 10.7% → 14.9%          | **CC BY-NC-SA — NonCommercial** |

**The map draws government attribution.** A third layer beside Victims and
Attackers, coloured by `attribution_strength` rather than by count, because
three advisories calling a country's actors "pro-Russia hacktivists" are not a
stronger claim than one calling them "state-sponsored". Iran is now named
independently by CISA and NCSC.

**A licence switch that works.** `source_licences` records what every source
permits; `actor_origins_commercial` is the view a paid tier reads instead of
`threat_actors`. Verified: 669 actor origins held, **483 sellable, 186
withheld** — exactly what ETDA added. Cutting a NonCommercial source is one
`UPDATE`.

**24 MITRE campaigns linked** to their actors — Volt Typhoon to the KV Botnet
activity, Sandworm to the 2022 Ukraine power attack.

**Three hand-overs unblocked**, all stuck behind an exhaustive-deps warning
that was itself guarding a real render loop. Two further defects fell out:
`alert_rules` has never existed under that name, and `user_alert_rules` names
the column `rule_name`.

**Commercial material out of the public repository** — three files, not the one
the handover named.

---

## 4. Everything outstanding

Compiled 22 September from every session since 19 September, and measured
against the live database rather than remembered. Where a number appears, it
was queried.

### 4a. Needs a person, not a session

Nothing here is blocked on engineering. All of it is judgment.

| Item                                                                                                                               | Measured                           |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Review-queue findings with no verdict.** The page exists; a verdict has never been recorded through it. §2a.                     | **80 open** (31 resolved, 82 auto) |
| **Vendor→actor link proposals, none confirmed.** `vendor_report_actors.confirmed` is false on every row.                           | **21**                             |
| **Regulator disclosures unreviewed.** Whether a state notice and a leak-site claim describe one event is a judgment, by design.    | **8,879 of 8,895**                 |
| **Three named alias verdicts still untaken** — Hive = hiveleak, Royal → BlackSuit, and Conti, which has no citable authority page. | 3                                  |
| **Family decisions left open** from the September identity work — Hades, Medusa, NetWorm.                                          | 3                                  |

The first row is the one that matters. The review queue is the product's
central claim and no human has ever exercised it end to end.

### 4b. Owner decisions, unchanged

- **The git history still holds the three commercial documents**, readable at
  any commit before 21 September. Removing them means `git filter-repo` and a
  force-push that breaks every clone and open PR.
- **ransomware.live is personal-use-only** and supplies all group profiles plus
  11,256 victim countries — the largest commercial exposure in the project.
- **VulnCheck's key 401s on every run**; the feed has never succeeded.
- **The six empty feature groups** — status page, chat integrations,
  escalation/on-call, SSO, benchmarks, usage analytics. The test is: would you
  demo it?
- **Leaked-password protection** is off, in the Auth dashboard.
- **12 of 21 registered sources have an unchecked licence**, including
  `misp-galaxy` and `mitre-attack`, which between them supply most of the actor
  origins Vigil holds. An unchecked licence is not a permissive one.
- **Alert delivery is deliberately off.** A false "you have been breached" is
  the one mistake that cannot be walked back. Turn it on only after the review
  queue has been used in anger.
- **ETDA's terms are accepted in principle**, on the condition that the source
  can be cut from any restricted tier later. `source_licences` plus
  `actor_origins_commercial` is the mechanism that honours it.

### 4c. Ready to build, no decision needed

**The vendor research surface in §2b is the highest value work left.** The
regulator disclosures are on screen as of 22 September; 286 vendor reports and
the 21 actor links proposed against them are not, and none of the 8 queued
attribution questions can be ruled on through the product.

Feeds and data completeness, measured 22 September 00:45 UTC:

| Item                                                                                                                                     | Measured         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Malpedia stale.** Already ingested, licensed and registered, and it carries actor country — the cheapest remaining win on attribution. | 114.8 days       |
| **`censys` stale and erroring.**                                                                                                         | 247.9 days       |
| **`mitre` and `mitre-atlas` have never recorded a run** (priority 4–5 weeklies).                                                         | never            |
| **Six feeds late** — anyrun-trends, bgpstream, epss, misp-galaxy, ransomwhere, tor-exits; `epss` erroring.                               | 1.1–1.2 days     |
| **Incidents with no country.** Was 71% in September.                                                                                     | 22,216 of 39,575 |
| **Incidents with no sector.**                                                                                                            | 4,075            |
| **Actors with no trend status.** Need an "insufficient data" label and exclusion from default views.                                     | 4,123 of 4,504   |
| **Actors with a stored AI summary.** Every `ai_summary` is empty.                                                                        | 0                |
| **MITRE campaigns with no actor link.** Salt Typhoon and Volt Typhoon are exactly the non-ransomware activity that is missing.           | 32 of 56         |

Schemas that exist with nothing rendering them:

- **AI summaries into the review queue** as drafts — generated, then approved or
  edited with sources shown, and only approved text reaching a group page.
  Unreviewed generated prose would undercut the whole argument; the queue is
  what makes it defensible.
- **Team watchlists** have a schema and a query layer and no interface.
- **`investigation_entities` is read-only** — the tab lists linked entities and
  nothing writes one.
- **`webhooks` / `webhook_deliveries`** — attach to whatever alert-delivery work
  lands rather than building it in isolation.

### 4d. Validation and reliability — agreed, never built

All of this came out of the detection-engineering discussion on 20 September and
was agreed at the time. None of it exists. The first two are the ones that would
catch a real miss.

- **A regression suite of real cases**, replayed on every deploy, starting with
  eight: the Jack Henry listing; the `svfcu.org` domain-only victim; Fiserv's
  engineering-data claim; the LockBit seizure notices; a name collision; the
  Citrix Bleed exploited-vulnerability and patch-deadline pair; an undecided
  alias pair; and a stale feed during a weekly run. A change that breaks one
  fails the build, and every future miss becomes a case before its fix.
- **Variation testing, which is the largest gap.** The cases above test known
  examples, not variants of them. Each needs spellings that must still match
  (`SVFCU`, `www.svfcu.org`, typos) and near-misses that must not. Parent and
  product names too: **a listing naming Symitar, ProfitStars or Banno would get
  past the matcher today**, though all three are Jack Henry.
- **A daily end-to-end test** — a clearly marked synthetic claim through
  ingestion, matching and delivery. If today's test did not pass, nothing
  should report "all clear"; it reports monitoring degraded.
- **A weekly review-path test**, separate from the daily one, timing the human
  decision. The daily test cannot wait on a person, so it cannot cover the
  queue.
- **Source drift checks** — per-feed volume and completeness thresholds. Zero
  ransomware listings in 24 hours is an alarm, and so is a missing-victim-name
  rate above a threshold. This catches a source that changes silently, which an
  end-to-end test cannot.
- **A measured hit rate**, monthly: of the incidents publicly reported, how many
  would Vigil have alerted on. Misses become new test cases.
- **A plain statement of what Vigil cannot see** — ransoms paid and never
  listed, and anything inside a vendor's own systems. Saying so is honest and it
  is also the protection.
- **Feedback on every alert** — useful, not relevant, already knew. The
  `actions` table already has the field. An alert type nobody acts on gets
  retuned or retired.
- **A database performance baseline on a quiet instance.** Same NVD feed, same
  code, same day: 27 seconds locally against 274 in the worker, and one tick
  took 876 seconds of its 15-minute budget. Nobody has measured this with the
  instance quiet, and "it needs a bigger instance" is a recurring monthly cost
  against the one-expense constraint. Free-tier headroom is §2c.

### 4e. Sources: what to do next, and what not to re-try

**Do next, in order:**

1. **HHS OCR** — ~7,876 US healthcare breaches, the victim's own account to a
   regulator. **The owner has agreed this gets its own session.** Re-checked
   22 September: a session-based JSF portal with ViewState and no export. Days
   of scraper work, or a CC BY 4.0 mirror.
2. **More state AGs.** About a dozen publish a readable list; three are in.
   Adding one is a `REGISTRIES` entry in `state-breach-notices` — a URL, its
   pagination and a column map. The owner asked for all of them.
3. **Connecting breach notices to existing sources** — the owner's idea on
   22 September. A California notice and a leak-site claim for the same
   organisation is a candidate, not a fact, so it belongs in the queue.
4. **Vendor research feeds** — MSTIC, Mandiant, Talos, Unit 42. All free RSS and
   all attributing, but in prose, so each one is a queued finding and never a
   regular expression.
5. **Law enforcement** — Europol operations and Treasury designations. DOJ is
   rejected below.
6. **Acronis** — asked about on 21 September and never assessed.

**Checked and rejected. Do not re-try without reading the evidence:**

| Source                                  | Why not                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DOJ press releases**                  | Real JSON API, looks ideal. **549 releases over two weeks: 14 topic matches, zero genuine cyber events.** Its taxonomy is administrative — "Cybercrime" includes child exploitation, "Countering Nation-State Threats" includes transporting defendants from Haiti |
| **CERT-EU**                             | Security advisories are vulnerability notices with no attribution; threat-intelligence is monthly digests covering dozens of unrelated events                                                                                                                      |
| **CCCS (Canada)**                       | Entirely vendor patch notices: "SolarWinds security advisory (AV26-941)"                                                                                                                                                                                           |
| **JPCERT**                              | 29 Japanese-language vulnerability alerts, no attribution                                                                                                                                                                                                          |
| **ACSC (Australia)**                    | cyber.gov.au refused every request                                                                                                                                                                                                                                 |
| **Texas AG**                            | HTTP 401 — Salesforce portal behind auth                                                                                                                                                                                                                           |
| **New Hampshire AG**                    | HTTP 403 — blocks non-browser clients                                                                                                                                                                                                                              |
| **Maine, Montana, Indiana, Vermont AG** | 404 at their documented paths                                                                                                                                                                                                                                      |
| **Iowa AG**                             | HTTP 200, but the page carries no table                                                                                                                                                                                                                            |
| **GreyNoise API**                       | Returns an IP's classification and geolocation — where the box is, not who rented it. Its _research blog_ is ingested and is a different thing                                                                                                                     |

### 4f. Small debts

- **`settings.spec.js:46`** is selector soup that has failed on three browsers.
- **The mobile performance e2e tests** assert a 10-second budget that includes
  `networkidle`, so they measure whatever else is touching the database rather
  than the app. They will keep blocking merges at random until the budget is
  raised or they measure render time instead.
- **The pre-commit hook covers neither `workers/` nor `supabase/`.**
- **Feed cadence is declared in two places** with nothing enforcing agreement.
- **`urlhaus` has 100 recorded failures**, and NVD intermittently fails one
  batch.
- **Indicators are stored as `address:port`.**
- **Seven tables have RLS enabled and no policy** — `alert_queue`,
  `certificates`, `certificate_hosts`, `dns_records`, `tenants`,
  `tenant_branding`, `tenant_invitations`. Closed to the public, so INFO-level.
- **Eight materialized views are readable through the API.** WARN-level.
- **Dependabot** — §2d. #42 and #43 are green and ready; the seven
  major-version PRs are each a piece of work rather than a merge.
- **Vercel bot protection** was tripped on 21 September by a 30-second
  production poll. Attack Challenge Mode was never enabled — the API returns
  `Seawall Config not found` — and it should have cleared. Worth loading the
  site once to confirm. **Do not poll production.**

### 4g. Recently closed — do not re-do

These appear as open in older notes and in chat, and are fixed. Check here
before spending time on any of them.

| Item                                                          | State                                           |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `alert_rules` → `user_alert_rules` in AlertAnalyticsDashboard | Fixed; the column is `rule_name`                |
| `useActorData.js` exhaustive-deps blocking the commit hook    | Fixed; the file lints clean                     |
| `detect_leak_site_notices()` not scheduled                    | Fixed; it is in `workers/src/feeds/registry.js` |
| `npm run lint` and CI disagreeing on the warning ceiling      | Fixed; one number, 325, in `package.json` only  |
| e2e running against the live production database              | Fixed in #39; stubbed                           |
| `ofac-reachability-probe` Edge Function                       | Deleted                                         |
| The subscription tier system                                  | Removed in #44; see below                       |
| Backfilling `iocs.actor_id` by joining our own data            | Measured 24 September and rejected; see below   |

**On #44, because “removed” is doing different work at each layer.** The pricing
page, the Stripe client and its three Vercel functions, `SubscriptionContext`,
`features.js` and the upsell components are gone from the repository, and the
gating is unwound at twenty call sites rather than stubbed to true. The 17 files
are archived outside this repository, alongside the other commercial material.

Three things deliberately survive, and a session that assumes otherwise will be
wrong:

- **The database still has the schema.** `011_subscriptions_and_api.sql` is
  applied and its tables remain, as does `tenants.subscription_tier` — which a
  view in `021_tenants.sql` still selects. Nothing writes the column any more.
  Dropping it would destroy records, which this project does not do.
- **The git history still holds all of it**, the same caveat as the three
  commercial documents above.
- **Production keeps serving the old bundle until someone deploys.** See §2a.

**On the `iocs.actor_id` backfill, because the proposal keeps coming back.**
`actor_id` is NULL on all **577,742** rows. The suggestion each time is a batch
pass with no model in it, joining against Vigil's own incident and actor data.
Measured 24 September, that join does not exist and the fallback is unsafe:

- **`incident_id` is NULL on all 577,742 rows too.** There is no IOC→incident
  link to walk, so the one path that would have been provenance rather than
  inference is not there.
- The only remaining path is `malware_family` → actor by name or alias. It
  reaches **22,231 rows, 3.8%** of the table — not "much of it". 446,234 rows
  have a family matching no actor at all, and the largest families are not
  families: `malware_download` (152,855), `malware` (70,577), `phishing`
  (33,534), `Unknown malware` (25,788).
- **The 3.8% it does reach is where it is most wrong.** `Mirai` matches an actor
  typed `apt`, and Mirai is a botnet family with many unrelated operators.
  `unknown` matches an actor literally named `Unknown`. `Snake` matches two —
  Turla, whose malware it is, and a ransomware group of the same name.
  `XWorm`, `ValleyRAT` and `Havoc` are commodity tooling, and the actor rows
  they match look like malware families mis-ingested as actors.

So the backfill would not fill the column so much as launder a naming
coincidence into an attribution, at the exact scale that makes it impossible to
unpick later. **Do not run it.** Both the specific question and the actor-row
problem are queued in `data_quality_findings` for a person, which is where a
judgment of this kind belongs. The queue already carries 15 resolved
`family_actor_review` findings, so the question has precedent and a format.

A defensible version exists and is a different piece of work: give IOCs a real
provenance column at ingestion — the report, advisory or leak-site post an
indicator came from — and derive the actor from that. That is a fact about
where a row came from rather than a guess about what it means.

### 4h. Never started

Shadow mode · victim identity resolution · lead time as a statistic (the SEC
and state data make this computable — Krispy Kreme 8 days, Key Tronic 21) ·
provenance on every number · engine contract views · a public methodology page.

**An agent-facing lookup.** Added 22 September, from a read of a published
enrichment-agent design. The SOAR-style pipelines — a hash or an IP arrives,
the agent queries VirusTotal, AbuseIPDB, Shodan, OTX, URLhaus and GreyNoise,
and a model writes it up — have no source among those six that answers "is this
victim on a leak site, which actor, and how settled is the attribution?". A
read-only endpoint, HTTP or MCP, returning `leak_claims` and an `actor_brief`
carrying `resolution_state` would make Vigil a source for that ecosystem rather
than a competitor inside it. The selling point is the part those agents cannot
do: it returns **undecided** when the data does not settle it, instead of
inventing an alias merge. §4a's three untaken alias verdicts are the honest
demonstration of that, not an embarrassment.

**It is blocked on licence, not on engineering.** ransomware.live supplies the
group profiles and 11,256 victim countries and is personal-use-only (§4b).
Serving that over an API to third parties is further from personal use than
anything Vigil does today. Build it against the regulator disclosures and the
vendor-research corpus, or replace the source first — do not point it at
`incidents` and assume the licence travels with the row. `source_licences` and
`actor_origins_commercial` are the mechanism; rule 8 in CLAUDE.md is the reason.

Work belonging to the separate product, and to the owner's own commitments
around it, is tracked outside this repository by deliberate decision. Do not
add it here.

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

**The same column name can mean two different quantities.** Washington's breach
registry publishes "Number of Washingtonians Affected". Oregon's publishes
"Number Affected", and its largest row is Marriott at 500,000,000 — the global
figure. Both landed in `persons_affected`, and the first version of
`breach_notices_by_state` summed them, reporting "1,397,860,427 people affected
in Oregon" beside a Washington figure that was a real fact about Washington.

`persons_affected_scope` now says which is which and the view reports them
separately. **Never sum that column across states.** It was caught by reading
the largest row rather than the row count, which is the general lesson: a
column full of plausible numbers hides this, and the extremes do not.

**`create or replace view` cannot rename a column either**, not just insert
one. It fails with "cannot change name of view column". Drop and recreate, and
check what depends on the view first.

**`create or replace view` cannot insert a column in the middle.** New columns
go last, or the statement fails with "cannot change name of view column". The
frontend selects by name, so last is fine.

**A name match is not a mention.** Matching every actor name against vendor
report titles linked "An AI-Orchestrated **Global** Campaign" to a ransomware
brand named `global`, and "NightEagle targets **Russian** companies" to one
named `Russian` — a report about Russian _victims_. Restricting to named groups
fixed both.

Then "**Mirage** Kitten targeting aviation" matched `Mirage`, a Ke3chang alias,
proposing an Iranian group's campaign as the work of two Chinese actors. The
obvious fix — drop a one-word match whose next word is capitalised — also
removed four true positives, because the word splitter had discarded
punctuation and "Mirage Kitten" looked identical to "Webworm: New burrowing
techniques". **Read the original text, not the tokenised version**, when the
distinction you need is punctuation.

**Regex-per-name does not scale; n-grams do.** Testing 2,322 actor names
against every title timed out on six of eight feeds. Splitting titles into 1-,
2- and 3-word n-grams normalised with `actor_key` and joining on an index took
it from 67.8s and six failures to 4.9s and none. The same shape of fix applied
to `apply_actor_origins`, which hit the statement timeout at 11 seconds by
unnesting aliases in a correlated subquery.

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

---

## 7. If you only do one thing

**Use the review queue**, at `/review`. Eighty findings are waiting and not one
verdict has ever been recorded through the page.

Every one is a judgment no amount of engineering will settle — which two names
are one group, whether a post is a victim claim, whether an advisory naming
Iran without saying how means state or something weaker. **Sixteen SEC
candidates** are the place to start: a company filed an 8-K Item 1.05 saying a
material incident occurred, and a ransomware group claimed an organisation of
the same name. Ruling on those turns "claimed by Qilin" into "claimed by Qilin,
and the company told the SEC" — the only corroboration a leak-site feed cannot
buy.

The queue grew by 22 between 20 and 22 September, and every addition was a
source refusing to guess: NCSC naming Iran without saying how, MITRE
attributing one campaign to two groups, ETDA disagreeing with Vigil about
OnionDog, GreyNoise calling someone "a suspected Chinese speaker". **That is
the mechanism working. It produces work rather than removing it, and the work
has never once been done.**

Clearing them through the page is also the only way to know the page is right.
It has been driven signed-out and under test, and its write path has been
exercised against the live database in a transaction that rolled back, but no
real verdict has been recorded through it yet.

Do not clear them quickly. "Not enough evidence" is a verdict, it keeps the
finding queued, and it is the correct answer more often than the queue's length
suggests.
