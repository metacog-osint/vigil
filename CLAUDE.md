# CLAUDE.md - AI Assistant Context

> **Last Updated:** 19 November 2026 | **Version:** 2.5.0
>
> Read [`docs/SESSION_HANDOFF.md`](./docs/SESSION_HANDOFF.md) first: current
> state, open work, the rules for sharing this tree, and repeat traps. This file
> holds rules and pointers only (12 KB cap).

## Documentation Index

| Document                       | Description                                               |
| ------------------------------ | --------------------------------------------------------- |
| `docs/ARCHITECTURE.md`         | System architecture overview                              |
| `docs/DATABASE.md`             | Table definitions and relationships                       |
| `docs/API.md`                  | REST API reference                                        |
| `docs/AUTH.md`                 | Authentication & authorization (Supabase)                 |
| `docs/TERMS_AND_SESSIONS.md`   | Terms acceptance & session timeouts                       |
| `docs/DATA_INGESTION.md`       | Scripts, scheduling, troubleshooting                      |
| `docs/FEATURES.md`             | Feature documentation                                     |
| `docs/UX_IMPROVEMENTS.md`      | UX system (Focus Mode, Digests, etc.)                     |
| `DATA_SOURCES.md`              | All threat intel feeds                                    |
| `docs/SESSION_HANDOFF.md`      | **Start here** — current state, open work, working rules  |
| `docs/INGESTION_HANDOVER.md`   | The worker, the feed registry, feed health                |
| `docs/THREAT_COVERAGE_GAPS.md` | What Vigil does not cover, and who else records an attack |

---

## Project Overview

**Vigil** - Cyber threat intelligence dashboard by The Intelligence Company.

- **URL:** https://vigil.theintelligence.company
- **Stack:** React + Vite + Tailwind + Supabase

---

## Key Patterns

### Supabase Client (Single Instance)

```javascript
// ✅ CORRECT: Always import from centralized client
import { supabase } from '../lib/supabase/client'

// ❌ WRONG: Never create new clients
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key) // DON'T DO THIS
```

### Auth Hook

```javascript
import { useAuth } from '../hooks/useAuth'
const { user, profile, loading } = useAuth() // user.id (not user.uid)
```

### Query Functions

```javascript
import { threatActors, incidents, iocs, correlations } from '../lib/supabase'
const { data } = await threatActors.getAll({ trendStatus: 'ESCALATING' })
```

⚠️ **There used to be two query layers, and it was the most expensive trap in
this repo.** `src/lib/supabase.js` defined the same objects a second time
alongside `src/lib/supabase/*.js`, and most pages imported the monolith — so
fixing a module changed nothing on screen. That produced four separate
user-visible defects on 20 September, including a page that reported no sync
data beside a table of 15,068 rows.

The monolith is now 145 lines of pure re-exports and nothing else. **Keep it
that way.** Any new object goes in `src/lib/supabase/`, is exported from
`src/lib/supabase/index.js`, and is re-exported from the monolith:

```javascript
// in src/lib/supabase.js
export { threatActors } from './supabase/threatActors'
```

`src/lib/__tests__/queryLayerSurface.test.js` fails if the two drift apart.
**A missing method is not an error anyone sees:** it throws, a `try/catch`
swallows it, and the page shows an empty state.

### Component Imports (Barrel Exports)

```javascript
// ✅ CORRECT: Import from barrels
import { CorrelationPanel } from '../components/panels'
import { StatCard } from '../components/common'

// ❌ WRONG: Direct file imports may not exist
import CorrelationPanel from '../components/CorrelationPanel'
```

---

## Styling

- Tailwind CSS, dark mode only
- Custom classes in `src/index.css`: `.cyber-card`, `.cyber-glow`, `.badge-*`, `.cyber-button`, `.cyber-input`

---

## Environment Variables

```bash
# Required (.env)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY    # Server-side only

# Server-side only (Vercel)
GROQ_API_KEY                 # AI summaries
RESEND_API_KEY               # Email
VAPID_PUBLIC_KEY             # Push notifications
```

---

## Common Tasks

### Add a page

1. Create in `src/pages/`
2. Add route in `src/App.jsx`
3. Add nav in `src/components/Sidebar.jsx`

### Add a data source

`scripts/ingest-{source}.mjs` is the old pattern. New sources run on the
Cloudflare worker, and the fetch and parse happen in a Supabase Edge Function
where there is CPU for them.

1. Edge Function in `supabase/functions/{source}/index.ts`, deployed
2. Thin caller in `workers/src/feeds/{source}.js` — one subrequest, no parsing
3. Entry in `workers/src/feeds/registry.js`
4. Row in `feed_expectations` via a migration. **Without one the feed is not
   watched and can stop with nothing saying so.** Not `critical` until it has
   run at least once.
5. Query functions in `src/lib/supabase/`, exported from `index.js` **and
   re-exported from the monolith**
6. Licence and reasoning in `DATA_SOURCES.md`
7. **A worker deploy (Tom)** — no CI deploy, so a merged source does not run
   until one. Never from the shared tree: `docs/INGESTION_HANDOVER.md`,
   "Deploying the worker"

### Modify schema

1. Migration in `supabase/migrations/`
2. **Grants in the same migration** (reminder 12). From 30 October 2026
   nothing in `public` is reachable by default:

   ```sql
   -- every new table, view or materialized view, including one rebuilt with DROP + CREATE.
   -- Until 30 Oct 2026 the defaults still grant everything to anon and authenticated,
   -- so start from nothing, then grant what is meant (156 learned this live)
   revoke all on public.my_table from anon, authenticated;
   grant select on public.my_table to anon, authenticated;
   -- only if the worker or an Edge Function writes it directly over REST
   grant select, insert, update, delete on public.my_table to service_role;
   alter table public.my_table enable row level security;

   -- every SECURITY DEFINER function: shut it, then open it to its caller
   revoke execute on function public.apply_x(jsonb, text) from public, anon, authenticated;
   grant execute on function public.apply_x(jsonb, text) to service_role;
   ```

3. Update `src/lib/supabase/`

`node scripts/check-migration-grants.mjs` checks both rules, and the test
suite runs it on every migration from 154 on.

---

## Key NPM Scripts

```bash
npm run dev                 # Dev server
npm run build               # Production build
npm run lint                # ESLint (325-warning ceiling, set in package.json only)
npm run ingest              # All data sources (legacy scripts/ path)
npm run process:alerts      # Alert queue
npm run send:digests        # Email digests
```

The worker (the scheduled feeds) is not deployed by CI or by an npm script in
the shared tree: see reminder 6.

---

## Critical Reminders

1. **Single Supabase client** - `src/lib/supabase/client.js` is the source of truth
2. **API helpers in `api/_lib/`** - Use underscore prefix to avoid Vercel function deployment
3. **Barrel exports** - Components organized in subdirectories with `index.js` files
4. **Pre-commit hooks** - Husky runs ESLint/Prettier on staged files
5. **Trend status**: ESCALATING (>25% increase), DECLINING (>25% decrease), STABLE (else)
6. **The worker has no CI deploy.** Merging a feed does not schedule it; only
   Tom's deploy from a dry-run-checked export of main does
   (`docs/INGESTION_HANDOVER.md`, "Deploying the worker"). Never
   `npm run deploy` in the shared tree: it is often behind main and rolls the
   live worker back.
7. **Judgment calls are queued, never guessed.** `record_finding(...)` puts the
   question in `data_quality_findings` for a person. A regular expression
   deciding whether "Pro-Russia hacktivists" means the Russian state is how
   two false attributions reached the database.
8. **A new source must be registered in `source_licences` first.**
   `apply_actor_origins` and `apply_vendor_research` raise on an unregistered
   source rather than writing rows nobody can judge for resale. Two sources are
   NonCommercial; `actor_origins_commercial` is how they come out of a paid
   tier.
9. **Building a page? Read `docs/SESSION_HANDOFF.md` §2b first.** It lists what
   still has no page, and the two rules `src/lib/supabase/disclosures.js`
   encodes: no single total of people affected, and every figure a database
   count rather than a tally of returned rows.

10. **There is no subscription tier system** (removed 22 Sep 2026). `canAccess`,
    `FeatureGate` or a paywall should not be there; `src/lib/tenants.js` is
    unrelated (tenant membership). The schema survives and nothing writes it.

11. **Work in a `git worktree`, not the shared directory.** Several sessions
    share one working tree and last write wins. `docs/SESSION_HANDOFF.md` §5 has
    the commands, and the `merge-base` check that tells you whether a branch is
    actually finished.

12. **Say who can reach every object you create** ("Modify schema" above).
    Since 30 Oct 2026 a new table or view without a `GRANT` gives "permission
    denied", which a `try/catch` turns into an empty page. Functions are still
    executable by all three roles by default, so a `SECURITY DEFINER` writer
    left open can be called with the browser's anon key
    (`apply_ransom_payments`, 152 to 154). Revoke from `authenticated` by name
    too, not only `public` (what 145 and 147 missed). A public read is
    `SECURITY INVOKER` over tables anon can already read (178).

---

## Doctrine kit and the public feed (30 Oct 2026)

- `doctrine/kit/` is a vendored copy of The Intelligence Company's shared kit (`D:\Projects\tic-doctrine`). Never
  edit it here: change the kit and run `python D:/Projects/tic-doctrine/tools/sync.py <this repo>`. CI runs
  `tic.py kitcheck` and `registers doctrine`.
- `doctrine/` holds Vigil's registers: requirements under SQ4, warning problems `VG-WP-1` (a group's surge) and
  `VG-WP-2` (exploitation of a newly listed vulnerability), indicators, assumptions, the sector map, source grades
  (proposed; Tom to confirm) and a method summary.
- `GET /api/feed` (`api/feed.js`, `api/_lib/doctrineFeed.js`) serves the feed in contract `tic-feed/2`. It reads
  claims and group names only from the `*_commercial` views: Ransomware.live's terms forbid re-serving its raw data.
- `GET /api/summary` (`api/summary.js`, `api/_lib/publicSummary.js`, 31 Oct 2026) is the one-line "Latest from
  Vigil" for theintelligence.company: the latest complete day's leak-site claims, the group count and the group
  that posted the most. The hub depends on its fields (`built_at`, `day`, `brief`); keep them stable. Since 175
  (18 Nov 2026) the worker's `public-summary` job builds it hourly into `public_summary` and the endpoint serves
  that row, so `built_at` is the real build time; the builder lives in `workers/src/lib/publicSummary.js`. Not under
  `api/public/`: `.eslintrc.cjs` ignores every folder named `public`, so lint would skip it. `docs/API.md` has
  the contract.
- US persons: Vigil is not bound by EO 12333 (Tom, 30 Oct 2026). Items that name organizations say so in
  `us_person_data`; nothing is stripped for that reason.

---

## Deployment

**Vercel deploys production from `main` automatically.** Merging is the deploy,
but check it went out:

```bash
gh api "repos/metacog-osint/vigil/deployments?environment=Production&per_page=1"   --jq '.[]|{sha:.sha[0:7],created:.created_at}'
```

Manual deploy, only if the automatic one failed:

```bash
npm run build && npx vercel --prod --yes
```

**The Cloudflare worker is the exception and has no CI deploy at all** — see
reminder 6.

Domain: vigil.theintelligence.company
