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
end of the run. Workers Free refused the 51st subrequest of an invocation, the
feeds spent the budget, and that final write — and the catch block's write — were
what got refused. 5,869 rows under one name; the last row naming an actual feed was
dated 31 May.

CISA KEV ingested on 19 September while the last logged run of its cron was
30 August. URLhaus had ingested nothing since 30 May and nothing said so.

Four more faults surfaced once per-feed logging existed. Each was invisible before
it:

| Fault                                               | Detail                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sync_log.records_failed` never existed             | Added in migration 005, but 001 and 005 both use `CREATE TABLE IF NOT EXISTS`, so the live table is the 001 shape. Every write naming that column was rejected (107).                                                                                                               |
| KEV flag frozen at 12 January                       | The worker writes `kev_date`; the app filters on `is_kev`. Two column sets for the same facts, parted company when the GitHub Actions workflows were disabled. `?kev=true` served a catalogue eight months old. A trigger now keeps them in agreement whoever writes the row (102). |
| `resolve_ioc_geo` timed out on every call since 097 | Not the work — 56,421 of 56,431 indicators were already located — but a heap fetch per row in the scan feeding the anti-join. `INCLUDE (value)` made it index-only: 15.6s to 1.2s (106, 108, 109).                                                                                  |
| NVD could never finish                              | It fetched NVD's full 2,000-result page and upserted 50 at a time: 40 subrequests against an invocation allowing 32. Batching at 250 took it to 8.                                                                                                                                  |

## 2. What the worker does now

Every cron trigger runs the **same scheduler** (`workers/src/lib/scheduler.js`)
over a **job registry** (`workers/src/feeds/registry.js`). No cron owns a list of
feeds; the trigger is just a tick. Since 6 Nov 2026 there is one, `15,45 * * * *`
(it replaced four), and `workers/src/lib/__tests__/capacity.test.js` checks the
registry's declared costs still fit its 48 ticks a day.

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
  **The rule only works if the declared cost is true.** On 16 Nov 2026 three daily
  feeds declared 12 and used more: ransomware.live 17, malpedia 23, misp-galaxy 23.
  The scheduler started them with 12 to 16 left, and in the 14 days to 16 Nov they
  failed on the budget 5, 7 and 8 times. They now declare 20, 24 and 24, so a tick
  without room defers them instead.
- **Due 15 minutes early** (`DUE_SLACK_MINUTES`, half the tick gap). A job's clock
  starts when its run finished, some way into a tick, and the check reads it at the
  start of one, so without the slack every job slipped a tick each run: 6-hour feeds
  ran 6.5 to 8 hours apart. `capacity.test.js` keeps the slack under half the gap,
  so no job is due again at the tick right after it ran.
- `skipped` is not success. Neither is a run that fetched records and wrote none of
  them. **`unchanged` is** success — having checked is the assertion.

`feed_health` (101) compares each feed against its declared cadence.
`ingestion_is_healthy()` answers in one boolean whether Vigil may present its data
as current.

**A run that succeeds and adds nothing is a third case** (163). From 22:15 UTC on
11 Nov 2026 RansomLook returned the same 100 posts on every run for 32.5 hours, and
every run was a success. `state` still describes only the check. For feeds where a
long silence is abnormal, `feed_expectations.stall_after_minutes` sets how long the
feed goes without adding a record when it is working, and `feed_health.stalled` is
true past it (null for a feed not watched). A stalled critical feed makes
`ingestion_is_healthy()` false and fails the Feed health workflow, and `/api/feed` says
so in its `health` block.

**`records_added` means genuinely new records, or null** (worker change of 15 Nov
2026, migration 167). Before it, every job but ransomlook and ioc-geo logged 0 there
whatever it brought: the scheduler read only `added`, the upsert feeds called every
row written `updated` (ThreatFox: 757,520 "updated" in 30 days, 0 added), and the Edge
Function feeds reported real insert counts under names nothing read. Now:

- **Upsert feeds** (threatfox, urlhaus, feodo, malwarebazaar, pulsedive, tor-exits,
  bgpstream, nvd, cisa-kev, cisa-ics, anyrun-trends) pass `countInserted: true`. The
  same request asks PostgREST for `created_at` back; rows stamped with that
  statement's transaction time are the inserted ones (`countInsertedRows` in
  `workers/src/lib/supabase.js`, which also gives the one known overcount).
  `createInsertTally` (`lib/inserts.js`) sums them. Only for tables whose
  `created_at` defaults to now() and is not in the payload.
- **Edge Function feeds** declare `countNew` in the registry, reading `new`,
  `advisories_new`, `filings_new`, or one count per blog or state.
- **Everything else** (enrichment, refreshes, the RPC checks) logs **null**, which
  means "cannot say", not "nothing". The ops page shows it as —.
- Every row with a real count carries `metadata.new_counted = true`. 167 reads only
  those rows for `last_new_at` and `stalled`, and adds `new_counted_since` (the first),
  so years of zeros and legacy counts cannot read as a stall: a feed's clock starts
  when its count does. A new job that reports a count is watchable the same day.

**Watched (167), from 45 days of history to 15 Nov.** The longest gap for every iocs
and vulnerabilities feed is the 3–4 Nov database pause; the thresholds sit above the
longest ordinary gap and below that.

| Feed | Every | Longest ordinary gaps | Stalls after |
| --- | --- | --- | --- |
| ransomlook (163) | 1 h | 20, 17, 15 h | 18 h |
| threatfox (critical) | 1 h | 6, 5, 5 h | 12 h |
| urlhaus | 6 h | 14, 8, 8 h | 24 h |
| malwarebazaar | 6 h | 14, 12, 9 h | 24 h |
| nvd | 6 h | 13, 12, 9 h | 24 h |
| tor-exits | 1 day | 34, 30, 26 h | 72 h |
| vendor-research | 6 h | 82, 67, 63 h | 144 h |
| state-breach-notices | 1 day | 97, 75, 73 h | 144 h |

**Not watched, deliberately:** cisa-kev (a few additions a week, irregular),
pulsedive (gaps to 256 h), feodo and bgpstream (nothing new in 45 days), cisa-ics
(gaps to 172 h), anyrun-trends (gaps to 121 h), cisa-advisories, ncsc-advisories,
sec-edgar, fincen-advisories and ofac-sdn (new records in 1 to 5 runs in 45 days),
ransomwhere (a snapshot), and the enrichment and check jobs, which add nothing by
design. The reasoning per feed is in 167.

**Order:** deploy the worker, wait for a ransomlook run, apply 167 (it refuses
otherwise, because applied first it would leave ransomlook unwatched), then merge:
`scripts/check-feed-health.mjs` and `/api/feed` read `new_counted_since`. The merge
waits on 167 and 167 waits on the deployed worker, so the deploy runs from the
branch's own checkout, not from the shared tree on `main`, which does not have the
change yet. For this change that was
`[local path]`, rebased onto
`main` after #100 so the same deploy also drops the VulnCheck job.

```sql
select feed_id, state, last_status, minutes_since_success, last_error,
       stalled, minutes_since_new, stall_after_minutes, new_counted_since
from feed_health order by critical desc, state;

select ingestion_is_healthy();

-- what the feeds have counted since the deploy
select source, count(*) runs, sum(records_added) new_records,
       count(*) filter (where records_added is null) uncounted
from sync_log where completed_at > now() - interval '1 day'
group by source order by source;

-- change a threshold, or watch another feed (null stops watching)
update feed_expectations set stall_after_minutes = 1080 where feed_id = 'ransomlook';
```

### Measuring a feed's cost

Do not guess these. Run the feed against an outsized budget and read what it spent:

```js
installFetchMeter()
const budget = createSubrequestBudget({ limit: 10000, reserve: 0 })
const db = createSupabaseClient(env)
await withSubrequestBudget(budget, () => ingestNVD(db))
console.log(budget.used)
```

That is how NVD was found to cost 40 against a ceiling of 32. Since 17 Nov 2026
`budget.used` counts every call, the feed's own `fetch()` included (see "The
fetch meter" below); before that it counted only the Supabase client's.

Or read it from production. Each job's `sync_log` row carries
`metadata.subrequests_used`, the invocation's running total when it finished, so a
job's own cost is the step from the row before it in the same tick:

```sql
with r as (
  select source, status, completed_at, (metadata->>'subrequests_used')::int used,
         date_trunc('hour', started_at)
           + floor(extract(minute from started_at) / 30) * interval '30 minutes' tick
  from sync_log
  where started_at >= now() - interval '14 days'
    and metadata ? 'subrequests_used' and source <> 'worker-run')
select source, min(d), max(d), count(*)
from (select *, used - coalesce(lag(used) over (partition by tick order by completed_at), 0) d
      from r) x
where status = 'success'
group by source order by max(d) desc;
```

The budget failures are logged with status `error` and the message "subrequest
budget exhausted", not `budget_exhausted`: the feeds catch the error themselves.
Search on the message.

Rows written before the fetch meter was deployed (below) count only the client's
calls; rows after it count everything, so the steps between rows are larger.

### The fetch meter and Workers Paid (17 Nov 2026)

At 03:15 UTC on 17 Nov a tick of 14 due jobs was cut off during pulsedive with
nothing recorded: no pulsedive row, no `worker-run` row. The budget had counted
only the Supabase client's calls. Each feed's own `fetch()` (its source, its Edge
Function) and the `sync_log` row per job sat in a fixed reserve of 18, which did
not grow with the number of jobs, so a busy tick passed Workers Free's 50 while
the budget still showed room. Every call after that was refused, the log writes
too. (The 10 ms CPU limit on Free could also have done it; the logs cannot say
which.)

Two changes:

- **Workers Paid** ($5 a month, Tom, 17 Nov). 10,000 subrequests and 30 s CPU an
  invocation by default. The worker's own ceiling is 1,000
  (`workers/src/lib/limits.js`), well under the platform's, so a runaway feed
  stops with a `budget_exhausted` row.
- **The fetch meter** (`workers/src/lib/subrequests.js`). The worker's global
  `fetch` is wrapped once, and every call inside `withSubrequestBudget()` is
  spent against that invocation's budget, carried in AsyncLocalStorage
  (`compatibility_flags = ["nodejs_als"]`). A feed's calls are refused at the
  ceiling; the run's bookkeeping (`feed_health`, `sync_log`) is counted but
  never refused. The reserve is now 5: one feed's log row, the summary row and
  its error fallback. Everything earlier is already counted.
  `workers/src/lib/__tests__/subrequests.test.js` replays the 03:15 tick under a
  50 cap.

Deployed 15:10 UTC 18 Nov 2026 as version `0d58658d` (from `2c41205`). Its first
tick, 15:15 UTC, ran 7 jobs and counted 27 subrequests, where like ticks had
counted 14 or 15 before the meter; nothing was refused. Redeployed unchanged
about 16:15 UTC as `c201cda0`.

### The hub's daily line, built here (175, 18 Nov 2026)

The `public-summary` job (hourly, priority 2) builds the summary
`GET /api/summary` serves, with the same three reads the endpoint used to make
on every request, and upserts it into `public_summary`. It reads with
`SUPABASE_ANON_KEY`, a worker secret, never the service role, so the public
policies decide what counts. Without that secret it fails and says so.
`workers/src/lib/publicSummary.js` holds the builder because the worker is
deployed from an export of `workers/` alone; `api/_lib/publicSummary.js`
re-exports it.

## 3. Commits and migrations

| Commit    | What                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| `0e13935` | The rewrite: scheduler, registry, per-feed logging, subrequest budget, `feed_health`, KEV columns, `records_failed` |
| `ca088d3` | `ioc_geo` covering index — 15.6s to 1.2s                                                                            |
| `b12745a` | OFAC `Last-Modified` check and parser fixture                                                                       |
| `b7de512` | NVD batching and the full-cost admission rule                                                                       |
| `c4136cb` | The wall-clock budget                                                                                               |

Migrations applied live: **101, 102, 106, 107, 108, 109, 124**. Numbers 103–105 and
110–123 belong to the parallel session on the same branch.

Worker tests: **29, from none**. `vitest.config.js` now includes `workers/**`.

## 4. Where it stands, 18:33 UTC 20 Sep

|                             |                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| fresh                       | **14**                                                                                              |
| late                        | 0                                                                                                   |
| stale                       | 3 — `censys`, `epss`, `malpedia`                                                                    |
| never run under the new ids | 7 — `anyrun-trends`, `bgpstream`, `misp-galaxy`, `mitre`, `mitre-atlas`, `ransomwhere`, `tor-exits` |
| failing                     | `ofac-sdn` (525), `vulncheck` (401)                                                                 |
| `ingestion_is_healthy()`    | **false**, solely because of `ofac-sdn`                                                             |

Nine fresh at 17:30, fourteen at 18:33. `pulsedive` ran for the first time since
January; `feodo` and `malwarebazaar` for the first time since May. The seven that
have never run are priority 4–5 daily and weekly jobs.

---

## Open items

### 1. The database is the bottleneck — start here

Everything else on this list is downstream of it.

The same NVD feed, same code, same day:

| Where                                  | Duration        |
| -------------------------------------- | --------------- |
| Locally, against the live database     | **27 seconds**  |
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

### 2. OFAC cannot be fetched from Cloudflare — RESOLVED 20 Sep, awaiting a worker deploy

**The fetch moved to a Supabase Edge Function** (`supabase/functions/ofac-sdn`),
which the worker job now invokes: one subrequest instead of four. Measured from
that runtime before anything was built — HEAD 200 in 586 ms, GET 200 and
29,093,584 bytes in **672 ms**. Cloudflare's edge is the only thing that cannot
do it.

**This is inert until `npm run deploy` is run from `workers/`.** There is no CI
deploy for the worker. Until then the account below still holds.

A bug surfaced in the port: the worker read its cursor with
`.select('cursor', 'feed_id=eq.ofac-sdn')`. The second argument to `.select()`
is an options object, not a filter, so it read every row and took the first. It
worked only because `feed_cursors` holds exactly one row.

<details><summary>The original diagnosis, kept because it is what made the fix obvious</summary>

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
  billed on data sent _to a client_, so pulling 29 MB _in_ is not charged. Does not
  create a project, so no compute hours. Caveat: 2s CPU is generous but unproven
  for a 29 MB scan.
- **Local npm script.** Free, but only runs when a laptop does — wrong for a feed
  marked `critical`.

</details>

### 3. VulnCheck returns 401 — RESOLVED, retired 15 Nov 2026

A new key was set on 15 Nov 2026, but the feed was retired instead of unpaused:
VulnCheck's Service Terms (rev. 20 Apr 2026) s7 forbid making its data available
for free, and Vigil is free and public. Migration 164 registers it in
`source_licences`, backs up and strips the 201 `vulncheck-kev` rows, and removes
its `feed_expectations` row; the job is gone from `registry.js`. Its worker would
also have written `kev_date`, which `/api/feed` publishes as CISA's.

### 4. Confirm the backlog finishes draining — ANSWERED, it is draining

By 22:00 on 20 September: **17 fresh, 1 late, 2 stale, 6 never** (from 14 / 0 / 3
/ 9). Four of the seven never-run feeds had come good on their own —
`anyrun-trends`, `bgpstream`, `misp-galaxy` and `epss`. The admission rule was
not starving them; they were waiting their turn as priority 4–5 jobs, exactly as
designed.

Still `never`: `mitre`, `mitre-atlas` and `tor-exits` (weeklies, not yet due),
`ransomwhere` (ran and errored), plus `ofac-sdn` and `vulncheck` below.

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
  this session printed _"lint-staged could not find any staged files matching
  configured tasks"_, despite CLAUDE.md saying Husky runs ESLint/Prettier on staged
  files. Linting was run by hand.
- ~~`BUILD_PLAN_V2.md` and `ROADMAP.md` are eight months stale~~ — moved to
  `docs/archive/` on 20 September with a notice saying they are historical and
  that the README and migration headers win where they disagree.

---

## Not ingestion, still open

- **The downstream consumer's own documents have no home.** They are held outside
  the repo and must stay that way: this repository carries no commercial surface,
  and those documents do. They belong in a separate private repo. One of them
  splits cleanly — its analysis and sourcing would strengthen `docs/`; the rest
  stays with the spec.

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
- **Workers Paid since 17 Nov 2026: 10,000 subrequests and 30 s CPU per
  invocation by default, 15 min wall clock for a cron trigger.** (Free was 50
  subrequests and 10 ms CPU.) The worker holds itself to 1,000 subrequests
  (`workers/src/lib/limits.js`). Vigil uses one cron trigger (four until
  6 Nov 2026).
- OFAC ignores `If-Modified-Since` — returns 200 and the whole document — but
  `Last-Modified` on a HEAD is reliable.
- **Batch size is a subrequest decision, not a throughput one.** KEV, ThreatFox,
  Ransomlook and NVD all batch at 250. It trades subrequests for CPU and memory, so
  it is not free.
