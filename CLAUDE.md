# CLAUDE.md - AI Assistant Context

> **Last Updated:** January 2026 | **Version:** 0.4.0

This file provides context for AI assistants working on this codebase. For detailed documentation, see:
- **Data Sources:** `DATA_SOURCES.md` - All threat intel feeds and rollout plan
- **Data Ingestion:** `docs/DATA_INGESTION.md` - Scripts, scheduling, and troubleshooting
- **Database Schema:** `docs/DATABASE.md` - Table definitions and relationships
- **API Documentation:** `docs/API.md` - REST API reference

## Project Overview

**Vigil** is a cyber threat intelligence dashboard by The Intelligence Company. It aggregates data from multiple public threat feeds and presents it in an analyst-friendly interface.

- **Live URL:** https://vigil.theintelligence.company
- **Brand:** The Intelligence Company
- **Roadmap:** See `ROADMAP.md` for planned features
- **Build Plan:** See `BUILD_PLAN_V2.md` for current development tasks

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

## Data Sources & Ingestion

> **Full documentation:** See `DATA_SOURCES.md` for all feeds and `docs/DATA_INGESTION.md` for scripts.

**Quick Reference:**
```bash
npm run ingest              # All sources
npm run ingest:ransomlook   # Ransomware data
npm run ingest:kev          # CISA KEV vulnerabilities
npm run ingest:threatfox    # ThreatFox IOCs
```

**Automated:** GitHub Actions runs every 6 hours via `.github/workflows/data-ingestion.yml`

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
```

Optional for enrichment:
```
VITE_GROQ_API_KEY          # AI summaries
VIRUSTOTAL_API_KEY         # IOC enrichment
RESEND_API_KEY             # Email alerts
VAPID_PUBLIC_KEY           # Push notifications
```

## AI Integration

The `src/lib/ai.js` module provides AI-powered summaries via Groq API (free tier).

### Setup

```bash
# Get free API key from https://console.groq.com/keys
VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxx
```

### BLUF Generation

```javascript
import { generateBLUF } from '../lib/ai'

const summary = await generateBLUF({
  incidents30d: 500,
  topActors: [{ name: 'LockBit' }, { name: 'ALPHV' }],
  topSectors: [{ name: 'healthcare', value: 45 }],
  recentIncidents: [{ victim_name: 'Hospital X', threat_actor: { name: 'LockBit' } }]
}, { save: true })
// Returns: "LockBit and ALPHV are driving ransomware activity targeting healthcare..."
```

### Actor Summaries

```javascript
import { generateActorSummary } from '../lib/ai'

const summary = await generateActorSummary(actor, recentIncidents)
// Returns 2-3 sentence threat actor summary
```

### Model Configuration

- Model: `llama-3.3-70b-versatile` (best quality, 128K context)
- Save throttle: 6 hours (prevents API abuse)
- Storage: `ai_summaries` table for historical tracking

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

---

## New Features (v0.2.0)

### Organization Profile Module

Store and retrieve organization profile data for personalized threat intelligence:

\`\`\`javascript
import { orgProfile } from '../lib/supabase'

// Get current profile
const profile = await orgProfile.get()

// Update profile
await orgProfile.update({
  sector: 'healthcare',
  region: 'north_america',
  country: 'United States',
  tech_vendors: ['Microsoft', 'Cisco'],
  tech_stack: ['Windows Server', 'Active Directory']
})

// Check if profile exists
const hasProfile = await orgProfile.hasProfile()
\`\`\`

### Relevance Scoring Module

Calculate relevance scores based on org profile:

\`\`\`javascript
import { relevance } from '../lib/supabase'

// Get actors sorted by relevance
const actors = await relevance.getRelevantActors(profile, limit)

// Get vulnerabilities sorted by relevance
const vulns = await relevance.getRelevantVulnerabilities(profile, limit)

// Calculate individual scores
const actorScore = relevance.calculateActorScore(actor, profile)
const vulnScore = relevance.calculateVulnScore(vuln, profile)
\`\`\`

### Correlations Module

Fetch correlated data for threat actors:

\`\`\`javascript
import { correlations } from '../lib/supabase'

// Get all correlations for an actor
const data = await correlations.getActorCorrelations(actorId)
// Returns: { techniques, vulnerabilities, iocs, malware }

// Get actors exploiting a CVE
const actors = await correlations.getVulnActors(cveId)

// Get actors using a technique
const actors = await correlations.getTechniqueActors(techniqueId)
\`\`\`

### Trend Analysis Module

Get temporal intelligence and trend data:

\`\`\`javascript
import { trendAnalysis } from '../lib/supabase'

// Get week-over-week comparison
const comparison = await trendAnalysis.getWeekOverWeekChange()
// Returns: { currentWeek, previousWeek, incidentChange }

// Get change summary
const changes = await trendAnalysis.getChangeSummary(7)
// Returns: { newIncidents, newActors, newKEVs, escalatingActors }

// Get sector trends over time
const sectorData = await trendAnalysis.getSectorTrends(30)
// Returns: { weeks, sectors, data }
\`\`\`

### IOC Quick Lookup

Enhanced IOC search with enrichment:

\`\`\`javascript
import { iocs } from '../lib/supabase'

// Quick lookup with type detection
const result = await iocs.quickLookup('8.8.8.8')
// Returns: { iocs, malware, vulnerabilities, type, found }

// Get external enrichment links
const links = iocs.getEnrichmentLinks('8.8.8.8', 'ip')
// Returns: [{ name: 'VirusTotal', url: '...' }, ...]
\`\`\`

### New Component Patterns

#### RelevanceBadge Component
\`\`\`jsx
import { RelevanceBadge } from '../components/RelevanceBadge'

<RelevanceBadge score={85} reasons={[{factor: 'Sector match', points: 50}]} />
\`\`\`

#### CorrelationPanel Component
\`\`\`jsx
import { CorrelationPanel } from '../components/CorrelationPanel'

<CorrelationPanel actorId={actorId} actorName={actorName} />
\`\`\`

#### WeekComparisonCard Component
\`\`\`jsx
import WeekComparisonCard from '../components/WeekComparisonCard'

<WeekComparisonCard data={weekComparison} loading={loading} />
\`\`\`

### Route Updates

| Route | Component | Description |
|-------|-----------|-------------|
| /trends | TrendAnalysis | Trend analysis dashboard |

### Sidebar Navigation

Trends page added to sidebar navigation between Alerts and Watchlists.

---

## Real-Time Alerting System (v0.3.0)

### Overview

The alerting system delivers security events to users faster than news outlets by:
- Ingesting critical feeds every 30 minutes (ransomware, KEV, IOCs)
- Automatic alert queuing via database triggers
- Multi-channel delivery (push, email, webhooks)

### Key Files

```
src/lib/alerts.js           # Push subscriptions, webhook CRUD, preferences
src/lib/email.js            # Resend API integration with HTML templates
src/components/AlertSettingsSection.jsx  # Settings UI component
scripts/process-alerts.mjs  # Alert queue processor
public/sw.js                # Push notification handlers
.github/workflows/critical-alerts-ingestion.yml  # 30-min fast ingestion
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `push_subscriptions` | Browser push notification endpoints |
| `alert_webhooks` | Slack/Discord/Teams webhook configs |
| `alert_queue` | Pending alerts for processing |
| `alert_deliveries` | Delivery tracking and history |

### Using the Alerts Library

```javascript
import { subscribeToPush, createWebhook, getAlertPreferences } from '../lib/alerts'

// Subscribe to push notifications
const subscription = await subscribeToPush(userId)

// Create a Slack webhook
await createWebhook(userId, {
  name: 'SOC Slack',
  type: 'slack',
  url: 'https://hooks.slack.com/...',
  eventTypes: ['ransomware', 'kev']
})

// Get user preferences
const prefs = await getAlertPreferences(userId)
```

### Sending Email Alerts

```javascript
import { sendEmail, generateRansomwareAlertEmail } from '../lib/email'

const { html, text, subject } = generateRansomwareAlertEmail({
  victim_name: 'Acme Corp',
  threat_actor: 'LockBit',
  sector: 'healthcare',
  country: 'United States'
})

await sendEmail({ to: 'analyst@company.com', subject, html, text })
```

### Processing Alerts

```bash
# Process pending alerts (runs in GitHub Actions every 30 min)
npm run process:alerts

# Manually trigger the fast ingestion workflow
gh workflow run "Critical Alerts Ingestion (Fast)"
```

### Environment Variables

```
VAPID_PUBLIC_KEY=...        # For web push (server + client)
VAPID_PRIVATE_KEY=...       # For web push (server only)
VITE_VAPID_PUBLIC_KEY=...   # Exposed to client
RESEND_API_KEY=re_...       # Email delivery
```

