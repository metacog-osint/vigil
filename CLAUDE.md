# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on this codebase.

## Project Overview

**Vigil** is a cyber threat intelligence dashboard by The Intelligence Company. It aggregates data from multiple public threat feeds and presents it in an analyst-friendly interface.

- **Live URL:** https://vigil.theintelligence.company
- **Brand:** The Intelligence Company
- **Roadmap:** See `ROADMAP.md` for planned features, data sources, and visualizations
- **Implementation Plan:** See `IMPLEMENTATION_PLAN.md` for sprint-by-sprint development guide

## Architecture Decisions

### Hybrid Firebase + Supabase

We chose a hybrid approach for specific reasons:

1. **Supabase for threat data**: PostgreSQL enables complex queries like:
   - "Show all actors targeting healthcare with >5 incidents in 30 days"
   - "Find IOCs associated with actors in my watchlist"
   - JOINs across actors, incidents, and IOCs

2. **Firebase for user features**:
   - Auth is mature and handles Google SSO well
   - Firestore is fine for user prefs/watchlists (document model fits)

### Data Ingestion Strategy

Edge Functions run on schedule to pull from APIs:
- **Ransomwatch**: 30 min (posts.json from GitHub)
- **CISA KEV**: 6 hours (JSON feed)
- **Abuse.ch**: 1 hour (ThreatFox API + MalwareBazaar API)
- **Trend calculation**: 1 hour (updates ESCALATING/STABLE/DECLINING)

Each function:
1. Logs to `sync_log` table
2. Upserts data (deduplication via unique constraints)
3. Updates sync status on completion

### Schema Design

Key relationships:
- `threat_actors` ← one-to-many → `incidents`
- `threat_actors` ← one-to-many → `iocs`
- `incidents` ← one-to-many → `iocs`

Arrays used for:
- `aliases`, `target_sectors`, `target_countries`, `ttps`, `tags`

JSONB `metadata` column on each table for flexible extension.

## Trend Calculation System

Vigil calculates ESCALATING/STABLE/DECLINING status for threat actors:

### Trend Status Logic
```
ESCALATING: incidents_7d > incidents_prev_7d * 1.25 (25% increase)
DECLINING:  incidents_7d < incidents_prev_7d * 0.75 (25% decrease)
STABLE:     everything else
```

### Key Fields on `threat_actors`
- `trend_status`: ESCALATING | STABLE | DECLINING
- `incident_velocity`: incidents per day (last 7 days / 7)
- `incidents_7d`: count of incidents in last 7 days
- `incidents_prev_7d`: count in previous 7-day window
- `ai_summary`: AI-generated summary (future Vertex AI integration)

### Updating Trends
Run hourly via cron or manually:
```sql
SELECT apply_actor_trends();
```

Or call the edge function:
```bash
curl https://your-project.supabase.co/functions/v1/calculate-trends
```

### Sector Inference
Incidents without explicit sectors are auto-classified via keyword matching:
- "hospital", "medical", "health" → healthcare
- "bank", "financial", "insurance" → finance
- "university", "school", "college" → education
- etc.

See `sector_keywords` table for full mapping.

### Actor Alias Resolution
Known aliases are stored in `actor_aliases` table. Use:
```sql
SELECT resolve_actor_alias('ALPHV');  -- Returns BlackCat's UUID
```

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

### Firebase Auth

```javascript
import { useAuth } from '../hooks/useAuth'

function Component() {
  const { user, preferences, loading } = useAuth()
  // user is Firebase User object or null
}
```

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

## Data Source APIs

### Ransomwatch
- URL: `https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json`
- Format: Array of posts with `group_name`, `post_title`, `discovered`

### CISA KEV
- URL: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- Format: `{ vulnerabilities: [...] }` with CVE details

### Abuse.ch ThreatFox
- URL: `https://threatfox-api.abuse.ch/api/v1/`
- Method: POST with `{ query: 'get_iocs', days: 7 }`

### Abuse.ch MalwareBazaar
- URL: `https://mb-api.abuse.ch/api/v1/`
- Method: POST with `query=get_recent&selector=100`

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Data Ingestion Scripts

Local Node.js scripts for data ingestion (in `scripts/` folder):

```bash
# Run all ingestion
npm run ingest

# Individual sources
npm run ingest:kev       # CISA KEV vulnerabilities
npm run ingest:nvd       # NVD CVEs
npm run ingest:abusech   # URLhaus, Feodo, ThreatFox IOCs
```

Scripts read credentials from `.env` file automatically.

## Deployment

Hosted on Vercel. To redeploy:

```bash
npm run build
npx vercel --prod --yes
```

Domain: vigil.theintelligence.company (DNS via Squarespace/Google Domains)

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
