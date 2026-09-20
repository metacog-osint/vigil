# Vigil

**A threat intelligence database that records why it believes things.**

Vigil tracks ransomware groups, APTs, exploited vulnerabilities and indicators from ~30 public
sources. That part is not unusual. What is unusual is that Vigil keeps a written record of every
judgment call it makes about that data — which two names are one group, when a group counts as
dead, whether a sanctions designation applies — with the evidence behind each one, and refuses to
assert anything it cannot support.

Live at [vigil.theintelligence.company](https://vigil.theintelligence.company). The landing page
reads the live database without an account.

---

## Why this exists

Threat intelligence products routinely conflate three different claims:

| Relationship       | Meaning                          | Example               |
| ------------------ | -------------------------------- | --------------------- |
| **Identity**       | Two names for the same operation | ALPHV = BlackCat      |
| **Lineage**        | One grew out of another          | Mespinoza became Pysa |
| **Shared tooling** | Different groups, same malware   | Cobalt Strike users   |

Merge them and you get a database that looks authoritative and is quietly wrong. Alias lists from
public feeds regularly file distinct groups together; indicators arrive labelled with a malware
family and get attributed to whichever group a vendor once associated with it; a group whose
servers were seized three years ago still reads `status = active`.

Vigil keeps the three apart, and every decision that required a human is stored with its rationale,
its evidence and who made it. The reasoning lives in the migration headers, not in a wiki — see
[`supabase/migrations/`](./supabase/migrations/), and the
Methodology section of the in-app Help page.

## Three worked examples

**A sanctions match that was declined** — [`089_sanctions_alias_review.sql`](./supabase/migrations/089_sanctions_alias_review.sql)

OFAC's SDN list names `HYDRA` as an alias of HYDRA MARKET, a darknet marketplace. Vigil tracks a
ransomware family called Hydra with zero incidents. Matching on aliases would have published the
claim that a tracked actor is OFAC-designated when it is not.

Exact name matches are applied automatically. Alias matches are queued as data-quality findings and
applied only once a verdict is recorded. The Hydra match was reviewed and **rejected**, and the
rejection persists — the same evidence will not re-raise it.

**A police operation that was being counted as victims** — [`095_lockbit_identity.sql`](./supabase/migrations/095_lockbit_identity.sql)

LockBit existed as seven separate records (`LockBit`, `lockbit2`, `Lockbit3`, `lockbit3_fs`,
`lockbit3_cronos`, `lockbit4`, `lockbit5`). 4,275 incidents were split across them, so the record
actually named "LockBit" showed 5 incidents and read INACTIVE while the group's live activity
accrued to `lockbit5`. The date ranges are contiguous and non-overlapping: one brand on one leak
infrastructure, which is identity — not lineage, not shared tooling.

`lockbit3_cronos` was different, and merging it blindly would have made Vigil wrong in public. Its
23 "victims", all dated 20–21 February 2024, are the NCA and FBI notices posted on the seized leak
site during Operation Cronos: _Who is LockbitSupp?_, _US Indictments_, _Arrest in Poland_,
_Lockbit Decryption Keys_. An incident row asserts that a group claimed a victim. These assert the
opposite. They were moved to `leak_site_notices` — kept, because the takedown is part of the
group's history, but no longer counted.

**A status that requires evidence** — [`096_actor_status_defunct.sql`](./supabase/migrations/096_actor_status_defunct.sql)

Every actor in the database read `status = active`, including groups seized years earlier. The
obvious fix — infer death from silence — is wrong: LockBit's infrastructure was seized in February
2024 and it has claimed victims since.

So `defunct` requires two things: a **recorded event that ended the operation**, and **no victim
claim in the 180 days since**. Each event is stored with its date, the authorities involved and a
link to the announcing authority's own page. Silence alone means dormant, which the INACTIVE trend
already says. A group that resumes is marked active again the moment it claims a victim, and the
resumption is recorded rather than passing silently.

## The review process

Checks run hourly and split findings three ways:

1. **Detected** — recorded with the evidence behind them.
2. **Auto-fixed** — only where the fix is mechanical: a duplicate incident with the same actor,
   victim and date; a spelling variant of a name already decided.
3. **Queued for review** — anything requiring judgment. These wait for a recorded verdict and are
   never applied on their own.

Queued findings are reviewed in the product, at `/review`. Each one shows the question the check
asked and everything it found, and a verdict cannot be recorded without the reasoning that supports
it. Verdicts are kept permanently and append-only — a finding can be ruled on more than once and
every ruling is retained. Recording one does not change the data: applying a decision is a separate
act, so a verdict never silently rewrites an incident.

A reviewer who cannot decide can say so. "Not enough evidence" leaves the finding queued with the
reason on the record, because forcing a binary answer is how a queue gets cleared by guessing.

Some findings stay queued on purpose. `babuk2`/`satanlock` are reported as linked operators rather
than a shared brand; `ransomedvc2`/`rebornvc` is a successor claim resting on three incidents.
Neither is guessed at.

## What Vigil does not claim

- **Claimed incidents are claims.** A ransomware group's post asserts a breach. Vigil records the
  assertion and its date, not a verified compromise.
- **Victim names** appear as the leak site published them. Where a site redacted a name, it stays
  redacted rather than being guessed.
- **Sector and country** are inferred by keyword where a source gives none. Coverage is partial —
  71% of incidents have no country — and the views that use them state their own coverage.
- **Leak-site reachability** reflects the upstream source's last check, not a live probe.
- **History is only ever added to.** A re-sighted indicator is recorded as a new sighting rather
  than overwriting the last; infrastructure that disappears keeps its history.

---

## What's in it

As of 20 September 2026 — live figures are on the landing page:

|                                  |          |
| -------------------------------- | -------- |
| Threat actors                    | ~4,500   |
| Incidents (victim claims, 2020–) | ~39,500  |
| Indicators                       | ~570,000 |
| CISA KEV entries                 | ~1,825   |
| Sanctioned addresses (OFAC)      | 1,043    |
| Database migrations              | 126      |

Of those actors, roughly 380 carry a trend assessment. The rest are names seen too few times to
say anything about — which the interface states rather than counting them as tracked groups.

**Features:** dashboard and activity timeline; threat actor profiles with ATT&CK techniques,
tooling, leak-site addresses, sanctions designations and takedown history; ransomware incident
browser; CISA KEV and NVD vulnerabilities with EPSS; IOC search and bulk lookup; MITRE ATT&CK
matrix; trend and geographic analysis; investigations and notebooks; watchlists and alerting;
attack surface and vendor monitoring; CSV/JSON/STIX 2.1 export; REST API.

## How it works

```
Public feeds ──► Cloudflare Worker (cron) ──► Supabase Postgres ──► React SPA on Vercel
                       26 feeds                   RLS enforced          anon read-only
                  hourly / 6h / daily / weekly   126 migrations
```

- **Ingestion** runs on a **Cloudflare Worker** with four cron schedules — hourly for ransomware
  leak sites and fresh IOCs, six-hourly for IOC and vulnerability feeds, daily for actor databases
  and enrichment, weekly for MITRE reference data. The free plan allows 10 ms CPU per trigger, so
  feeds stream and filter rather than parsing whole documents. (The OFAC SDN feed reads a 29 MB XML
  export and keeps the 99 entries carrying a digital currency address.)
- **Hourly data-quality checks** and `apply_actor_status` run as Postgres functions after
  ingestion; results land in `sync_log`.
- **Storage** is Supabase Postgres. Row-level security is enforced on every table: public threat
  data is anon-readable and never anon-writable, user data is scoped by `user_id`, and the review
  tables are service-role only.
- **`scripts/`** holds Node equivalents of the worker feeds plus additional sources used ad hoc.
  Production ingestion is the worker; the ingestion workflows under `.github/workflows/` are the
  superseded GitHub Actions path.

## Repository layout

```
src/            React app — 159 components, 46 routes, lazy-loaded
  lib/supabase/   query modules, one per entity
  pages/          route pages
api/            Vercel functions — REST API v1, Stripe, SCIM, email
workers/        Cloudflare Worker — 22 ingestion feeds
supabase/
  migrations/   126 migrations; the reasoning is in the headers
scripts/        Node ingestion, enrichment, correlation and digest jobs
docs/           architecture, database, API, auth, data ingestion
e2e/            Playwright specs, run through demo mode
```

## Running it

Requires Node 18+ and a Supabase project.

```bash
npm install
cp .env.example .env     # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev              # http://localhost:5174
```

Apply `supabase/migrations/` in order. `npm run ingest` populates from the public feeds; individual
sources have their own scripts (`npm run ingest:kev`, `ingest:ransomlook`, …).

```bash
npm test          # 928 unit tests
npm run test:e2e  # Playwright, via demo mode — no credentials needed
npm run build
```

## Documentation

|                                                    |                                     |
| -------------------------------------------------- | ----------------------------------- |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)     | System architecture                 |
| [docs/DATABASE.md](./docs/DATABASE.md)             | Schema and relationships            |
| [docs/API.md](./docs/API.md)                       | REST API reference                  |
| [docs/AUTH.md](./docs/AUTH.md)                     | Authentication and authorization    |
| [docs/DATA_INGESTION.md](./docs/DATA_INGESTION.md) | Feeds, scheduling, troubleshooting  |
| [DATA_SOURCES.md](./DATA_SOURCES.md)               | Every source, endpoint and schedule |
| [CHANGELOG.md](./CHANGELOG.md)                     | Version history                     |

## Data sources

Ransomware leak sites (RansomLook, Ransomware.live, Ransomwatch) · vulnerabilities (CISA KEV, NVD,
EPSS, VulnCheck, CISA ICS) · indicators (ThreatFox, URLhaus, Feodo, MalwareBazaar, Pulsedive, Tor
exits) · threat actors (MITRE ATT&CK, MITRE ATLAS, Malpedia, MISP Galaxy) · sanctions (OFAC SDN) ·
payments (Ransomwhere) · routing (BGPStream) · enrichment (Censys, ANY.RUN).

Each source's terms differ, and not all permit commercial use. See
[DATA_SOURCES.md](./DATA_SOURCES.md) before building on this.

---

_The Intelligence Company · [github.com/metacog-osint/vigil](https://github.com/metacog-osint/vigil)_
