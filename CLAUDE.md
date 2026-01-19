# CLAUDE.md - AI Assistant Context

> **Last Updated:** January 19, 2026 | **Version:** 2.0.0

This file provides essential context for AI assistants. For detailed documentation, see the referenced files.

## Documentation Index

| Document | Description |
|----------|-------------|
| `DATA_SOURCES.md` | All threat intel feeds and rollout plan |
| `docs/DATA_INGESTION.md` | Scripts, scheduling, and troubleshooting |
| `docs/DATABASE.md` | Table definitions and relationships |
| `docs/API.md` | REST API reference |
| `docs/ARCHITECTURE.md` | System architecture overview |
| `docs/FEATURES.md` | Feature documentation |
| `docs/AUTH.md` | Authentication & authorization |
| `docs/EMAIL.md` | Custom email configuration |
| `docs/ALERTING.md` | Real-time alerting system |
| `docs/SECURITY.md` | Security & code quality |
| `docs/INFRASTRUCTURE.md` | Infrastructure modules |
| `docs/UX_IMPROVEMENTS.md` | UX improvements system |
| `docs/STATE_MANAGEMENT.md` | React state patterns |

---

## Project Overview

**Vigil** is a cyber threat intelligence dashboard by The Intelligence Company. It aggregates data from multiple public threat feeds and presents it in an analyst-friendly interface.

- **Live URL:** https://vigil.theintelligence.company
- **Brand:** The Intelligence Company
- **Roadmap:** See `ROADMAP.md` for planned features

---

## Architecture Summary

### Supabase-First Architecture

1. **PostgreSQL for all data**: Complex queries, JOINs across actors, incidents, and IOCs
2. **Supabase Auth**: Email/password, Google OAuth, JWT tokens, RLS

### Data Ingestion

Edge Functions run on schedule to pull from APIs. See `docs/DATA_INGESTION.md` for details.

### Schema Design

Key relationships:
- `threat_actors` ← one-to-many → `incidents`
- `threat_actors` ← one-to-many → `iocs`
- `incidents` ← one-to-many → `iocs`

Arrays: `aliases`, `target_sectors`, `target_countries`, `ttps`, `tags`
JSONB `metadata` column on each table for flexible extension.

---

## Code Patterns

### Supabase Queries

```javascript
// src/lib/supabase.js contains all query functions
import { threatActors, incidents, iocs, vulnerabilities } from '../lib/supabase'

// Example: Get actors with trend filtering
const { data } = await threatActors.getAll({ trendStatus: 'ESCALATING' })

// Example: Get escalating actors only
const { data } = await threatActors.getEscalating(10)
```

### Real-time Subscriptions

```javascript
import { subscribeToTable } from '../lib/supabase'

useEffect(() => {
  const unsubscribe = subscribeToTable('incidents', (payload) => {
    if (payload.eventType === 'INSERT') {
      // Handle new incident
    }
  })
  return () => unsubscribe()
}, [])
```

### Supabase Auth

```javascript
import { useAuth } from '../hooks/useAuth'

function Component() {
  const { user, profile, loading } = useAuth()
  // user is Supabase User object or null
}

// For API calls requiring authentication
import { supabase } from '../lib/supabase/client'

const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

---

## Styling

- Tailwind CSS with custom cyber-themed colors
- Dark mode only (cyber aesthetic)
- Custom classes in `src/index.css`:
  - `.cyber-card` - Standard card component
  - `.cyber-glow` - Accent border with glow
  - `.badge-*` - Severity badges (critical, high, medium, low, info)
  - `.cyber-button`, `.cyber-button-primary` - Button styles
  - `.cyber-input` - Form inputs
  - `.cyber-table` - Table styling

---

## Component Patterns

### TrendBadge Component
```jsx
import TrendBadge from '../components/TrendBadge'

<TrendBadge status="ESCALATING" />           // Full badge with label
<TrendBadge status="ESCALATING" showLabel={false} />  // Icon only
```

### Page Structure

```jsx
export default function PageName() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => {
    loadData()
  }, [/* filters */])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Page Title</h1>
        <p className="text-gray-400 text-sm mt-1">Description</p>
      </div>

      {/* Filters */}
      {/* Stats */}
      {/* Content + Detail Panel */}
    </div>
  )
}
```

---

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anonymous key (public)
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role key (server-side only)
```

Server-side only (set in Vercel, not exposed to client):
```
GROQ_API_KEY               # AI summaries (via /api/generate-summary)
RESEND_API_KEY             # Email alerts (via /api/send-email)
VAPID_PUBLIC_KEY           # Push notifications
VAPID_PRIVATE_KEY          # Push notifications (server only)
VITE_ADMIN_EMAILS          # Comma-separated admin emails
```

---

## Common Tasks

### Add a new data source
1. Create ingestion script in `scripts/ingest-{source}.mjs`
2. Add npm script to `package.json`
3. Add table/columns if needed in migrations
4. Add query functions to `src/lib/supabase.js`
5. Create UI components to display data

### Add a new page
1. Create page in `src/pages/`
2. Add route in `src/App.jsx`
3. Add nav item in `src/components/Sidebar.jsx`

### Modify schema
1. Create new migration file in `supabase/migrations/`
2. Update query functions in `src/lib/supabase.js`
3. Update affected components

---

## Critical Patterns & Common Pitfalls

### Supabase Client: Single Instance Pattern

**CRITICAL**: Only ONE Supabase client should be created in the entire application.

```javascript
// ✅ CORRECT: Import from the centralized client
import { supabase } from '../lib/supabase/client'
// or
import { supabase } from '../lib/supabase'  // Re-exports the same client

// ❌ WRONG: Creating a new client
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)  // DON'T DO THIS
```

**The single source of truth is:** `src/lib/supabase/client.js`

### Optional Tables: Graceful 404 Handling

Some tables are optional (may not exist in all environments). Always handle missing tables gracefully:

```javascript
// ✅ CORRECT: Handle missing table gracefully
const { data, error } = await supabase.from('optional_table').select('*')
if (error && !error.message?.includes('does not exist')) {
  console.error('Unexpected error:', error)
}
// Continue with empty data if table missing
```

**Optional tables:** `analytics_events`, `mitre_techniques`

### Vite Chunk Configuration

**CRITICAL**: Avoid splitting related libraries into separate chunks that can create circular dependencies.

```javascript
// ✅ CORRECT: Group related libraries together
manualChunks: (id) => {
  if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
  if (id.includes('node_modules/firebase')) return 'vendor-firebase'
  if (id.includes('node_modules')) return 'vendor'  // All others together
}
```

### API Library Files: Vercel Deployment

**CRITICAL**: API helper files in `api/` must be in a directory starting with `_` to avoid being deployed as serverless functions.

```
api/
├── _lib/              ✅ Helper files (NOT deployed as functions)
│   ├── auth.js
│   ├── cors.js
│   └── validators.js
├── v1/
│   └── actors.js      ✅ Deployed as serverless function
```

### Component Organization: Barrel Exports

Components are organized in subdirectories with barrel exports (index.js files):

```
src/components/
├── index.js              # Main barrel - re-exports from subdirectories
├── common/
│   ├── index.js          # Exports: StatCard, EmptyState, Skeleton, etc.
│   └── StatCard.jsx
├── panels/
│   ├── index.js          # Exports: CorrelationPanel, EnrichmentPanel, etc.
│   └── CorrelationPanel.jsx
├── widgets/
│   └── ...
└── actions/
    └── ...
```

```javascript
// ✅ CORRECT: Import from main barrel or subdirectory barrel
import { CorrelationPanel } from '../components'
import { CorrelationPanel } from '../components/panels'

// ❌ WRONG: Import from root (old location, no longer exists)
import CorrelationPanel from '../components/CorrelationPanel'
```

### Pre-commit Hooks

Husky + lint-staged runs before every commit:
- ESLint with auto-fix on staged JS/JSX files
- Prettier formatting on staged files
- Commit blocked if lint errors remain

Bypass (emergency only): `git commit --no-verify -m "message"`

See `docs/SECURITY.md` for details.

---

## Quick Reference

### Key Modules

| Module | Import | Purpose |
|--------|--------|---------|
| `threatActors` | `from '../lib/supabase'` | Actor queries |
| `incidents` | `from '../lib/supabase'` | Incident queries |
| `iocs` | `from '../lib/supabase'` | IOC queries |
| `correlations` | `from '../lib/supabase'` | Correlation queries |
| `relevance` | `from '../lib/supabase'` | Relevance scoring |
| `trendAnalysis` | `from '../lib/supabase'` | Trend data |
| `orgProfile` | `from '../lib/supabase'` | Organization profile |

### Trend Status Logic

```
ESCALATING: incidents_7d > incidents_prev_7d * 1.25 (25% increase)
DECLINING:  incidents_7d < incidents_prev_7d * 0.75 (25% decrease)
STABLE:     everything else
```

### Key NPM Scripts

```bash
npm run dev                 # Start dev server
npm run build               # Production build
npm run test                # Run tests
npm run lint                # Run ESLint
npm run ingest              # All data sources
npm run ingest:kev          # CISA KEV only
npm run process:alerts      # Process alert queue
npm run send:digests        # Send email digests
npm run reclassify:sectors  # Reclassify incident sectors
```

### Deployment

```bash
npm run build
npx vercel --prod --yes
```

Domain: vigil.theintelligence.company
