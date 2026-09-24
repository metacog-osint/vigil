# CLAUDE.md - AI Assistant Context

> **Last Updated:** 24 September 2026 | **Version:** 2.5.0
>
> **Parts of this file are dated.** Read
> [`docs/SESSION_HANDOFF.md`](./docs/SESSION_HANDOFF.md) first: it carries current
> state, what is outstanding, the rules for working alongside the other sessions
> that share this working tree, and the traps that have bitten more than once.

Essential context for AI assistants. **For detailed docs, see the `docs/` folder.**

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

The monolith is now 141 lines of pure re-exports and nothing else. **Keep it
that way.** Any new object goes in `src/lib/supabase/`, is exported from
`src/lib/supabase/index.js`, and is re-exported from the monolith:

```javascript
// in src/lib/supabase.js
export { threatActors } from './supabase/threatActors'
```

`src/lib/__tests__/queryLayerSurface.test.js` fails if the two drift apart.

The reason this mattered is worth keeping even though the duplication is gone:
**a missing method is not an error anyone sees.** It is `undefined`, it throws
at the call site, a `try/catch` swallows it, and the page renders an empty
state that reads exactly like "there is nothing here".

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
7. **`cd workers && npm run deploy`** — there is no CI deploy for the worker,
   so a source that is merged is not a source that runs

### Modify schema

1. Migration in `supabase/migrations/`
2. Update `src/lib/supabase/`

---

## Key NPM Scripts

```bash
npm run dev                 # Dev server
npm run build               # Production build
npm run lint                # ESLint (325-warning ceiling, set in package.json only)
npm run ingest              # All data sources (legacy scripts/ path)
npm run process:alerts      # Alert queue
npm run send:digests        # Email digests

cd workers && npm run deploy   # The scheduled feeds. NOT run by CI.
```

---

## Critical Reminders

1. **Single Supabase client** - `src/lib/supabase/client.js` is the source of truth
2. **API helpers in `api/_lib/`** - Use underscore prefix to avoid Vercel function deployment
3. **Barrel exports** - Components organized in subdirectories with `index.js` files
4. **Pre-commit hooks** - Husky runs ESLint/Prettier on staged files
5. **Trend status**: ESCALATING (>25% increase), DECLINING (>25% decrease), STABLE (else)
6. **The worker has no CI deploy.** Merging a feed does not schedule it; only
   `cd workers && npm run deploy` does. This has been missed in three sessions.
7. **Judgment calls are queued, never guessed.** `record_finding(...)` puts the
   question in `data_quality_findings` for a person. A regular expression
   deciding whether "Pro-Russia hacktivists" means the Russian state is how
   two false attributions reached the database.
8. **A new source must be registered in `source_licences` first.**
   `apply_actor_origins` and `apply_vendor_research` raise on an unregistered
   source rather than writing rows nobody can judge for resale. Two sources are
   NonCommercial; `actor_origins_commercial` is how they come out of a paid
   tier.
9. **Building a page? Read `docs/SESSION_HANDOFF.md` §2b first.** The 8,898
   regulator disclosures and the contested claims both have pages now,
   `/disclosures` and `/contested-claims`, merged and deployed on 24 September.
   **292 vendor reports and the whole licence layer still have no page at all.**
   §2b also records the two rules `src/lib/supabase/disclosures.js` encodes — no
   single total of people affected, and every figure a database count rather
   than a tally of returned rows — both of which a careless commit would undo.

10. **There is no subscription tier system.** It was removed on 22 September and
    the code is archived outside this repository. If you find `canAccess`,
    `FeatureGate`, a tier or a paywall in anything you are reading, it is either
    `src/lib/tenants.js` (unrelated, tenant membership) or something that should
    not be there. The database schema deliberately survives; nothing writes it.

11. **Prefer a `git worktree` to working in the shared directory.** Several
    sessions share one working tree and last write wins. See
    `docs/SESSION_HANDOFF.md` §5.

---

## Deployment

**Vercel deploys production from `main` automatically.** Merging a PR is the
deploy; observed four times on 24 September, each landing within a minute or
two. You do not normally run anything.

Check it actually went out rather than assuming — the pricing page stayed live
for a day because a commit was mistaken for a deploy:

```bash
gh api "repos/metacog-osint/vigil/deployments?environment=Production&per_page=1"   --jq '.[]|{sha:.sha[0:7],created:.created_at}'
```

Manual deploy, only if the automatic one has failed:

```bash
npm run build && npx vercel --prod --yes
```

**The Cloudflare worker is the exception and has no CI deploy at all.** See
reminder 6.

Domain: vigil.theintelligence.company
