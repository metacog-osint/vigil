# CLAUDE.md - AI Assistant Context

> **Last Updated:** January 19, 2026 | **Version:** 2.1.0

Essential context for AI assistants. **For detailed docs, see the `docs/` folder.**

## Documentation Index

| Document | Description |
|----------|-------------|
| `docs/ARCHITECTURE.md` | System architecture overview |
| `docs/DATABASE.md` | Table definitions and relationships |
| `docs/API.md` | REST API reference |
| `docs/AUTH.md` | Authentication & authorization (Supabase) |
| `docs/DATA_INGESTION.md` | Scripts, scheduling, troubleshooting |
| `docs/FEATURES.md` | Feature documentation |
| `docs/UX_IMPROVEMENTS.md` | UX system (Focus Mode, Digests, etc.) |
| `DATA_SOURCES.md` | All threat intel feeds |

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
const supabase = createClient(url, key)  // DON'T DO THIS
```

### Auth Hook

```javascript
import { useAuth } from '../hooks/useAuth'
const { user, profile, loading } = useAuth()  // user.id (not user.uid)
```

### Query Functions

```javascript
import { threatActors, incidents, iocs, correlations } from '../lib/supabase'
const { data } = await threatActors.getAll({ trendStatus: 'ESCALATING' })
```

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
1. Script in `scripts/ingest-{source}.mjs`
2. npm script in `package.json`
3. Query functions in `src/lib/supabase/`

### Modify schema
1. Migration in `supabase/migrations/`
2. Update `src/lib/supabase/`

---

## Key NPM Scripts

```bash
npm run dev                 # Dev server
npm run build               # Production build
npm run lint                # ESLint
npm run ingest              # All data sources
npm run process:alerts      # Alert queue
npm run send:digests        # Email digests
```

---

## Critical Reminders

1. **Single Supabase client** - `src/lib/supabase/client.js` is the source of truth
2. **API helpers in `api/_lib/`** - Use underscore prefix to avoid Vercel function deployment
3. **Barrel exports** - Components organized in subdirectories with `index.js` files
4. **Pre-commit hooks** - Husky runs ESLint/Prettier on staged files
5. **Trend status**: ESCALATING (>25% increase), DECLINING (>25% decrease), STABLE (else)

---

## Deployment

```bash
npm run build && npx vercel --prod --yes
```

Domain: vigil.theintelligence.company
