# Handoff — the intelligence lane, 20 September 2026

Companion to **`docs/SESSION_HANDOFF.md`**, which covers ingestion, the worker
rewrite, platform traps and how to work in this repo while other sessions are in
it. Read that one first: its §5 (working practices) and §6 (traps) apply to
everything here, and its §4 lists the review-queue items. It arrives with the
ingestion work, so if `main` does not have it yet, it is on that branch.

This document covers the other lane: what Vigil _claims_, and how it is made to
earn those claims. Attribution, sanctions, identity, location, and the alerts
that are supposed to reach someone.

---

## 1. What landed, and what each piece rests on

All merged to `main` (PRs #29–#33) and live in the database.

| Area                   | State                                                                 | Rests on                                                      |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Group profiles**     | 1,725 technique links across 387 groups, 837 tools, 876 leak sites    | ransomware.live — **personal-use licence**, see §2            |
| **OFAC sanctions**     | 1,043 designated addresses, 99 entities, delistings dated not deleted | SDN.XML, daily                                                |
| **Identity**           | LockBit is one actor (4,251 incidents, 2020→now), not seven           | reviewed verdicts in `actor_relationship_decisions`           |
| **Defunct status**     | 8 groups, each with a citable takedown                                | `actor_takedowns`, primary sources only                       |
| **Indicator location** | 56,404 located, 150 countries                                         | DB-IP ranges held locally, **CC BY 4.0 attribution required** |
| **Actor origin**       | 483 groups, with attribution confidence                               | MISP galaxy                                                   |
| **Alert delivery**     | Rules evaluated hourly, in-app only                                   | `evaluate_alert_rules`, registry job `alert-rules`            |
| **Landing page**       | Reads the live database                                               | nothing invented; sections render empty on failure            |

### The rules these encode

Worth knowing before changing any of it, because each was a decision rather than
an implementation detail:

- **Defunct requires an event _and_ silence.** A takedown alone is not death:
  LockBit's site was seized in February 2024 and it published a victim two days
  ago. 180 days of silence after a recorded event, and a group that resumes is
  marked active again automatically, with the resumption recorded as a finding.
- **Attribution is a claim.** Origin carries the source's own confidence score and
  is never inferred from where a group's servers sit. The three geographies —
  infrastructure, origin, victim — are separate and must not be conflated. The
  feed used to write origin into `target_countries`, which stated that the
  Equation Group targets the United States.
- **Alias matches are queued, not applied.** An exact name match applies; anything
  else waits for a recorded verdict. OFAC lists `HYDRA` as an alias of HYDRA
  MARKET, and Vigil tracks an unrelated ransomware family called Hydra.
- **A count that failed is not zero**, and a view that can show only part of its
  data says so (`CoverageNote`).

---

## 2. Decisions waiting on the owner

**1. ransomware.live licence — personal use only.**
Its free tier is documented as permitting personal use only, which constrains any use beyond that. It supplies the group profiles
(techniques, tooling, leak sites). Every row carries `source = 'ransomware.live'`,
so the rows to replace are identifiable exactly. CISA #StopRansomware advisories
(public domain) plus the leak-site feeds already ingested are the likely
replacement. Recorded in memory as `vigil-commercial-source-swap`.

**2. Email delivery is off, deliberately.**
`evaluate_alert_rules` writes in-app notifications only. Rules that ask for email
record the intent and are counted as `email_pending`; nothing is sent. Turning it
on needs `RESEND_API_KEY` in the worker and an explicit decision, because the
failure mode is a false "you have been breached" reaching someone. The dormant path
(`alert_queue`, `queue_alert_event`, `process-alerts.mjs`) is kept and its
audience function repaired, so it can be revived rather than rebuilt.

**3. Victim country stopped on 29 May 2026.**
28,214 of 39,531 incidents have no country, and **nothing since 29 May has one** —
the feed that carried it stopped when the workflows were disabled, and ransomlook
carries no country. Maps say so rather than showing an empty world. Fixing it
means a victim feed that supplies location: ransomware.live's victim endpoint
(same licence problem), or SEC 8-K Item 1.05 and state AG breach notices, which
would additionally let a claim be marked _confirmed_ — analysis no leak-site
tracker is doing.

**4. Three verdicts I did not take.**

- `Hive` = `hiveleak` — same group, both stop on 16 Jan 2023; the alias rule
  missed it because the names differ by more than spelling.
- `Royal` → `black suit` — DOJ titles its own action "BlackSuit (Royal)", so this
  is a rebrand: lineage, not identity, and the model distinguishes them.
- **Conti** — 351 incidents, silent since June 2022, genuinely defunct, but it
  dissolved after the Conti Leaks rather than being seized, so there is no single
  authority page to cite. It needs a different evidence standard.

---

## 3. Operational items

**`ofac-sdn` has never succeeded.** Marked critical in `feed_expectations` because
sanctions claims must not be made from stale data. It fails with **HTTP 525** from
Treasury's endpoint — upstream Cloudflare, not Vigil. The scheduler retries hourly.
Until it succeeds once, the sanctions table is whatever was loaded by hand on
20 September. If 525s persist, it needs a fallback or a mirror.

**DB-IP ranges need a monthly refresh.** `node scripts/load-ip-geo.mjs` — 357,325
IPv4 ranges, published monthly, no key. It is a script rather than a worker feed
because parsing it costs far more than the 10 ms of CPU a free-plan Cron Trigger
gets. **IPv6 is deliberately not loaded** (Vigil holds no IPv6 indicators); the
loader takes `--ipv6` when that changes.

**CC BY 4.0 requires the DB-IP credit wherever the located data is shown.** It is
currently on the IOC search page and in the Help methodology. Any new view that
displays country needs it too.

**Two e2e tests are flaky by construction.** `mobile.spec.js` asserts a 10-second
budget that includes `waitForLoadState('networkidle')` against the **live
production database**, so it measures whatever else is touching Supabase at the
time. They failed twice today under load from a parallel session and passed on a
quiet database. Either raise the budget substantially or measure render time.
The deeper issue is that the whole e2e suite runs against production.

**Three e2e tests are skipped with a stated reason** — they need a signed-in
account with access that demo mode cannot provide.

---

## 4. Ready to do, no decision needed

- **4,123 of 4,504 actors have no trend** — one-off names with too few incidents.
  They pad the actor list. Label them "insufficient data" and keep them out of
  default views.
- **Zero actors have a stored AI summary.** The demo has nothing pre-written;
  summaries generate on request or not at all.
- **`iocs.actor_id` is NULL in all 568k rows** and always has been. Indicators
  reach a group only through `ioc_actor_links` (the reviewed family mapping).
  Anything written against `actor_id` will silently return nothing.
- **48,332 of 51,076 IP indicators are stored as `address:port`** (ThreatFox's
  format), so an exact search for a bare address cannot match them. `ioc_ip()`
  handles it for geolocation; search does not.
- **Sector inference is keyword matching on the victim's name.** It is shallow and
  should stay in aggregate views, not individual claims.

---

## 5. Things that will bite

Beyond §6 of the other handoff:

- **`LIMIT` + `ORDER BY` on a large table is a trap here, repeatedly.** The
  planner walks the ordered index and discards rows looking for matches. It cost
  28 seconds on indicator search (fixed in 090), and again on country search
  (fixed in 114). Collect a bounded candidate set _first_, then order it.
- **A `CASE` in a `WHERE` clause is opaque to the planner.** Two query shapes need
  two statements, not one clever one (112 → 113).
- **`jsonb_populate_record` writes an explicit NULL** for any column missing from
  the json, which defeats a column default and trips `NOT NULL`.
- **Changing a function's return type needs `DROP FUNCTION` first.**
- **A stale visibility map makes an index-only scan do heap fetches.** 5,279 of
  them turned a 54 ms query into 5.4 seconds until `VACUUM (ANALYZE)`.
- **Check whether a failed statement partially applied.** A timed-out
  `ALTER TABLE` held a lock on `iocs` for five minutes and had to be cancelled.

---

## 6. If you only do one thing

The other handoff says **build the review-queue page**, and that is the right
answer from this lane too. Twenty findings are waiting on verdicts, the decision
tables exist, `record_finding` and the verdict tables are wired — and the only way
a verdict has ever been recorded is a hand-written migration.

Every claim in §1 rests on that process being real. Right now it is real in SQL
and invisible in the product.
