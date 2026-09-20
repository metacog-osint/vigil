# Ingestion rewrite — handover

**Session:** 20 September 2026 · branch `feat/geolocation-and-origin`
**Status:** deployed and running. Five commits, seven migrations applied live.
**Companion to** [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md), which carries the
wider picture. This covers ingestion only. Delete it once its open items have found
homes.

---

## 1. What was wrong

Not what it looked like. Ingestion had been working the whole time; **the record of
it had stopped.**

Every worker invocation wrote one `sync_log` row named `cloudflare-worker`, at the
end of the run. Workers Free refuses the 51st subrequest of an invocation, the
feeds spent the budget, and that final write — and the catch block's write — were
what got refused. 5,869 rows under one name; the last row naming an actual feed was
dated 31 May.

CISA KEV ingested on 19 September while the last logged run of its cron was
30 August. URLhaus had ingested nothing since 30 May and nothing said so.

Four more faults surfaced once per-feed logging existed. Each was invisible before
it:

| Fault | Detail |
|---|---|
| `sync_log.records_failed` never existed | Added in migration 005, but 001 and 005 both use `CREATE TABLE IF NOT EXISTS`, so the live table is the 001 shape. Every write naming that column was rejected (107). |
| KEV flag frozen at 12 January | The worker writes `kev_date`; the app filters on `is_kev`. Two column sets for the same facts, parted company when the GitHub Actions workflows were disabled. `?kev=true` served a catalogue eight months old. A trigger now keeps them in agreement whoever writes the row (102). |
| `resolve_ioc_geo` timed out on every call since 097 | Not the work — 56,421 of 56,431 indicators were already located — but a heap fetch per row in the scan feeding the anti-join. `INCLUDE (value)` made it index-only: 15.6s to 1.2s (106, 108, 109). |
| NVD could never finish | It fetched NVD's full 2,000-result page and upserted 50 at a time: 40 subrequests against an invocation allowing 32. Batching at 250 took it to 8. |

## 2. What the worker does now

Every cron trigger runs the **same scheduler** (`workers/src/lib/scheduler.js`)
over a **job registry** (`workers/src/feeds/registry.js`). No cron owns a list of
feeds; the four triggers are just ticks.

- Each job declares `priority`, `cost` and `intervalMinutes`, and writes **its own
  `sync_log` row as it finishes**, under its own id.
- **Subrequest budget.** The Supabase client refuses its own calls before the
  platform does, leaving room to record the run. Running out is logged as
  `budget_exhausted`, not silence.
- **Time budget.** A Cron Trigger gets 15 minutes and is then cut off with no error
  to catch. `createTimeBudget` holds back five minutes so the job running when the
  clock gets low can finish and be recorded. A run that stops this way records
  `stopped_early: "time"`.
- **A job starts only when its whole declared cost is available.** Half-cost
  admission was tried and was wrong: a feed that runs out part-way has already
  spent what it used getting there and writes nothing for it.
- `skipped` is not success. Neither is a run that fetched records and wrote none of
  them. **`unchanged` is** success — having checked is the assertion.

`feed_health` (101) compares each feed against its declared cadence.
`ingestion_is_healthy()` answers in one boolean whether Vigil may present its data
as current.

```sql
select feed_id, state, last_status, minutes_since_success, last_error
from feed_health order by critical desc, state;

select ingestion_is_healthy();
```

### Measuring a feed's cost

Do not guess these. Run the feed against an outsized budget and read what it spent:

```js
const budget = createSubrequestBudget({ limit: 10000, reserve: 0 })
const db = createSupabaseClient(env, { budget })
await ingestNVD(db)
console.log(budget.used)
```

That is how NVD was found to cost 40 against a ceiling of 32.

## 3. Commits and migrations

| Commit | What |
|---|---|
| `0e13935` | The rewrite: scheduler, registry, per-feed logging, subrequest budget, `feed_health`, KEV columns, `records_failed` |
| `ca088d3` | `ioc_geo` covering index — 15.6s to 1.2s |
| `b12745a` | OFAC `Last-Modified` check and parser fixture |
| `b7de512` | NVD batching and the full-cost admission rule |
| `c4136cb` | The wall-clock budget |

Migrations applied live: **101, 102, 106, 107, 108, 109, 124**. Numbers 103–105 and
110–123 belong to the parallel session on the same branch.

Worker tests: **29, from none**. `vitest.config.js` now includes `workers/**`.

## 4. Where it stands, 18:33 UTC 20 Sep

| | |
|---|---|
| fresh | **14** |
| late | 0 |
| stale | 3 — `censys`, `epss`, `malpedia` |
| never run under the new ids | 7 — `anyrun-trends`, `bgpstream`, `misp-galaxy`, `mitre`, `mitre-atlas`, `ransomwhere`, `tor-exits` |
| failing | `ofac-sdn` (525), `vulncheck` (401) |
| `ingestion_is_healthy()` | **false**, solely because of `ofac-sdn` |

Nine fresh at 17:30, fourteen at 18:33. `pulsedive` ran for the first time since
January; `feodo` and `malwarebazaar` for the first time since May. The seven that
have never run are priority 4–5 daily and weekly jobs.

---

## Open items

### 1. The database is the bottleneck — start here

Everything else on this list is downstream of it.

The same NVD feed, same code, same day:

| Where | Duration |
|---|---|
| Locally, against the live database | **27 seconds** |
| Inside the worker (`http:/ingest/nvd`) | **274 seconds** |

The 18:15 tick took **876 seconds — 14.6 of its 15 allowed minutes**, where the
17:15 tick took 124. Feeds that take seconds locally took minutes:
`ransomware.live` 210s, `threatfox` 102s, `alert-rules` 78s.

Alongside that, four incidents in ninety minutes: plain `SELECT 1` timing out for
minutes, a Cloudflare **520** from `faqazkwdkajhxmwxchop.supabase.co`, a **503**
mid-NVD, and `upsert_group_profiles` hitting a statement timeout (`57014`) after
239 seconds. The project reported `ACTIVE_HEALTHY` throughout — the Micro instance
refusing connections, not an outage.

**Unresolved: how much of this we caused.** Two Claude sessions, the worker, the
app and several measurement runs were hitting it at once, and the parallel session
was applying migrations in bulk. Establish a baseline when the room is quiet before
concluding anything. **A compute upgrade is real monthly cost against a stated
constraint of Supabase Pro only** — exhaust query discipline first.

A timeout during a real ingest now shows up as a recorded feed error. Those are
honest records of a slow database, not broken feeds.

### 2. OFAC cannot be fetched from Cloudflare

`ofac-sdn` returns **HTTP 525** (Cloudflare "SSL handshake failed") on every run —
four attempts across two hours. Not Treasury: three direct fetches from the desktop
returned 200 and 29,093,584 bytes in 2.4–6.0s.

This is the **only** reason `ingestion_is_healthy()` returns false.

Data is current (1,043 addresses, confirmed 20 Sep) because it was ingested from a
local run, not by the worker.

Mitigated, not fixed: the feed now HEADs the list and compares `Last-Modified`
against `feed_cursors` (124), so it needs that connection only the few times a
month the SDN list changes. Unchanged: 1.4s, no download. Changed: 64s and 29 MB.
The failure is cheap now too — 4.4s instead of 61s.

**Options, both $0:**

- **Supabase Edge Function.** Pro includes 2M invocations/month against a need of
  ~30; 2s CPU against the Worker's 10ms; 400s wall clock; 256 MB memory. Egress is
  billed on data sent *to a client*, so pulling 29 MB *in* is not charged. Does not
  create a project, so no compute hours. Caveat: 2s CPU is generous but unproven
  for a 29 MB scan.
- **Local npm script.** Free, but only runs when a laptop does — wrong for a feed
  marked `critical`.

**Not started. Deferred for review.**

### 3. VulnCheck returns 401

`HTTP 401 unauthorized` on every run. The key is invalid or expired. Renew it, or
remove the feed from `registry.js` **and** `feed_expectations`. Leaving it fails
every six hours for no benefit.

### 4. Confirm the backlog finishes draining

The seven never-run feeds are picked up by the **00:00 and 03:00** ticks, where the
hourly feeds are not due and most of the budget is free. Check tomorrow. If any are
still `never` after a day, the admission rule is starving them and the priorities
need revisiting.

### 5. Smaller things

- **`urlhaus`** is alive again (553 updated) but logged 100 failures in that run.
- **`threatfox`** once recorded 1,296 records failed with none written, during the
  contention above. Now correctly an error rather than a success. Watch it.
- **NVD intermittently writes 250 of 2,000 records as failures** — exactly one
  batch. Same statement-timeout pattern; likely item 1.
- **Cadence is declared twice** — `intervalMinutes` in the registry and
  `expected_interval_minutes` in `feed_expectations`. The migration says change one
  and change the other. Nothing enforces it. A test could.
- **The pre-commit hook covers neither `workers/` nor `supabase/`.** Every commit
  this session printed *"lint-staged could not find any staged files matching
  configured tasks"*, despite CLAUDE.md saying Husky runs ESLint/Prettier on staged
  files. Linting was run by hand.
- **`BUILD_PLAN_V2.md` and `ROADMAP.md` are eight months stale** — January, v1.3.2,
  "32 data sources", "migrations 068 total". The repo is past 124. This is the repo
  being used as a work sample.

---

## Not ingestion, still open

- **Three offshoot documents have no home.** `OFFSHOOT_SPEC v2.5.md`,
  `COMPETITOR_SCAN.md` and `CU_BACKTEST.md` are still in `~/Downloads`. The spec's
  §1 says Vigil carries no commercial surface, and memory records the same rule, so
  pricing, the stop rule and the United Savings conflict-of-interest note must not
  be committed here. Suggested: a separate private repo. `CU_BACKTEST.md` splits
  cleanly — its analysis and sourcing would strengthen `docs/`, its "what this
  means for the product" section belongs with the spec.
- **The "Vigil work-sample steps 1–5"** the spec gates itself on are not in the
  repo, and `BUILD_PLAN_V2.md` / `ROADMAP.md` are too stale to be it. Ask.

---

## Traps worth not rediscovering

- **Do not diagnose a run by checking it four minutes in.** The 18:00 tick was
  called dead while it was still working — `ransomware.live` was mid-flight and
  took 239 seconds. That misreading produced a confident, wrong conclusion about
  CPU limits. Wait for the `worker-run` row, or read `stopped_early`.
- **Measure before theorising.** Three attempts at `resolve_ioc_geo` were reasoned
  from the code; `EXPLAIN` found it in one pass. Same for NVD's cost.
- **The live database does not match the migration files.** `sync_log` proved it.
  Check the live schema before trusting a migration.
- Supabase project ref is **`faqazkwdkajhxmwxchop`**. A wrong ref returns "You do
  not have permission", which reads like an auth failure and is not.
- **Workers Free: 50 subrequests, 10 ms CPU, 15 min wall clock per invocation;
  5 cron triggers per account.** Four are used; the spare is deliberate.
- OFAC ignores `If-Modified-Since` — returns 200 and the whole document — but
  `Last-Modified` on a HEAD is reliable.
- **Batch size is a subrequest decision, not a throughput one.** KEV, ThreatFox,
  Ransomlook and NVD all batch at 250. It trades subrequests for CPU and memory, so
  it is not free.
