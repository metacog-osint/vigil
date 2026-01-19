# CLAUDE.md - AI Assistant Context

> **Last Updated:** January 18, 2026 | **Version:** 0.4.2

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

### Supabase-First Architecture

Vigil uses Supabase as the primary backend:

1. **PostgreSQL for all data**: Enables complex queries like:
   - "Show all actors targeting healthcare with >5 incidents in 30 days"
   - "Find IOCs associated with actors in my watchlist"
   - JOINs across actors, incidents, and IOCs

2. **Supabase Auth**: Handles authentication with:
   - Email/password and Google OAuth
   - JWT tokens for API authentication
   - Row-level security (RLS) for data isolation

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
VITE_SUPABASE_URL          # Supabase project URL
VITE_SUPABASE_ANON_KEY     # Supabase anonymous key (public)
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role key (server-side only)
```

Optional (Firebase for user prefs if enabled):
```
VITE_FIREBASE_API_KEY      # Optional - for Firestore user prefs
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
```

Server-side only (set in Vercel, not exposed to client):
```
GROQ_API_KEY               # AI summaries (via /api/generate-summary)
RESEND_API_KEY             # Email alerts (via /api/send-email)
VAPID_PUBLIC_KEY           # Push notifications
VAPID_PRIVATE_KEY          # Push notifications (server only)
```

## AI Integration

The `src/lib/ai.js` module provides AI-powered summaries via the `/api/generate-summary` endpoint, which securely calls Groq API server-side.

### Setup

```bash
# Get free API key from https://console.groq.com/keys
# Set in Vercel environment variables (NOT prefixed with VITE_)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
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

---

## Security & Code Quality (v0.4.1)

### Logger Utility

Environment-aware logging that suppresses debug/info logs in production:

```javascript
import { logger } from '../lib/logger'

logger.debug('Debug info')  // Only in development
logger.info('Info message') // Only in development
logger.warn('Warning')      // Always logged
logger.error('Error', err)  // Always logged
```

### API Query Validation

All API endpoints use validated query parameters via `api/lib/validators.js`:

```javascript
import {
  validateSortField,
  validateSortOrder,
  validatePagination,
  sanitizeSearch,
  isValidUUID,
  isValidCVE,
  validateDateRange,
  validateIOCType
} from '../lib/validators.js'

// Whitelist-based sort field validation
const sortBy = validateSortField('actors', params.get('sort_by'))

// Sanitize search strings (removes special chars, limits length)
const search = sanitizeSearch(params.get('search'))

// Validate pagination bounds (max 100 per page, max 1000 pages)
const { page, limit, offset } = validatePagination(params.get('page'), params.get('limit'))
```

### CORS Configuration

Restricted CORS via `api/lib/cors.js`:

```javascript
import { getCorsHeaders, handleCorsPreflightRequest } from '../lib/cors.js'

// Handle preflight
const preflightResponse = handleCorsPreflightRequest(request)
if (preflightResponse) return preflightResponse

// Get origin-specific headers
const headers = getCorsHeaders(request.headers.get('origin'))
```

Allowed origins:
- `https://vigil.theintelligence.company`
- `https://www.vigil.theintelligence.company`
- `*.vercel.app` (preview deployments)
- `http://localhost:5173` (development only)

### Security Headers

Production security headers are configured in `vercel.json`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricts camera, microphone, geolocation)

### CI/CD Updates

E2E tests now run on multiple browsers via matrix strategy:

```yaml
# .github/workflows/ci.yml
e2e-tests:
  strategy:
    fail-fast: false
    matrix:
      browser: [chromium, firefox, webkit]
```

---

## Secure API Endpoints (v0.4.2)

### Overview

API keys are now protected via Vercel serverless functions. The frontend no longer has access to sensitive keys like `RESEND_API_KEY` or `GROQ_API_KEY`.

### API Files

```
api/lib/supabase-auth.js    # Supabase JWT token verification
api/lib/cors.js             # CORS configuration
api/lib/validators.js       # Query parameter validation
api/send-email.js           # Secure email sending via Resend
api/generate-summary.js     # Secure AI summaries via Groq
```

### Supabase Token Verification

All authenticated endpoints verify Supabase JWT tokens:

```javascript
import { verifyRequest } from './lib/supabase-auth.js'

export default async function handler(request) {
  const { user, error } = await verifyRequest(request)
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 401 })
  }
  // user.id is now available
}
```

### Email API (`/api/send-email`)

```javascript
// Frontend usage (src/lib/email.js)
import { supabase } from './supabase/client'

const { data: { session } } = await supabase.auth.getSession()
const response = await fetch('/api/send-email', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to, subject, html, text }),
})
```

Rate limit: 10 emails per minute per user.

### AI Summary API (`/api/generate-summary`)

```javascript
// Frontend usage (src/lib/ai.js)
import { supabase } from './supabase/client'

const { data: { session } } = await supabase.auth.getSession()
const response = await fetch('/api/generate-summary', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'bluf',  // or 'actor'
    data: { incidents30d, topActors, topSectors, recentIncidents }
  }),
})
```

Rate limit: 5 requests per minute per user.

### Required Environment Variables (Vercel)

These must be set in Vercel project settings:

```
# Supabase (required for API auth)
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys (server-side only)
RESEND_API_KEY=re_xxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxx
```

### Getting API Keys

1. **Supabase Service Role Key**: Supabase Dashboard > Settings > API > service_role key
2. **Resend API Key**: https://resend.com/api-keys
3. **Groq API Key**: https://console.groq.com/keys (free tier available)

---

## Infrastructure Modules (v1.2.1)

### Error Tracking (Sentry)

Sentry is initialized in production for error tracking:

```javascript
// src/lib/sentry.js
import { initSentry, captureException } from '../lib/sentry'

// Initialize on app startup (done in main.jsx)
if (import.meta.env.PROD) {
  initSentry()
}

// Capture errors manually
try {
  await riskyOperation()
} catch (error) {
  captureException(error, { extra: { context: 'additional info' } })
}
```

Environment variable: `VITE_SENTRY_DSN` (set in Vercel)

### Retry Utility

Exponential backoff retry for API calls:

```javascript
import { withRetry } from '../lib/retry'

// Wrap any async operation
const result = await withRetry(
  () => supabase.from('actors').select('*'),
  { maxRetries: 3, baseDelay: 1000 }
)

// With custom retry conditions
const result = await withRetry(fn, {
  shouldRetry: (error) => error.status >= 500,
  onRetry: (attempt, error) => console.log(`Retry ${attempt}`)
})
```

### Environment Validation

Startup validation for required environment variables:

```javascript
// src/lib/env.js
import { validateEnv } from '../lib/env'

// Called in main.jsx before app renders
try {
  validateEnv()
} catch (error) {
  // Shows clear error message with missing variables
}
```

### Loading State Component

Standardized loading/error/empty state wrapper:

```jsx
import { LoadingState } from '../components/common/LoadingState'

<LoadingState
  loading={isLoading}
  error={error}
  data={items}
  onRetry={refetch}
  emptyMessage="No items found"
  skeleton={<TableSkeleton rows={5} />}
>
  {/* Render data here */}
  <DataTable data={items} />
</LoadingState>
```

### Distributed Rate Limiting

Redis-based rate limiting for API endpoints (works across Vercel instances):

```javascript
// api/lib/rateLimit.js
import { checkRateLimit } from './rateLimit.js'

export default async function handler(request) {
  const rateLimitResult = await checkRateLimit(apiKeyId, rateLimit)
  if (!rateLimitResult.allowed) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  // Continue with request...
}
```

Environment variables (for Upstash Redis):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### API Key Rotation

Rotate API keys with grace period:

```javascript
import { apiKeys } from '../lib/apiKeys'

// Rotate a key (old key works for 7 days by default)
const { newKey, oldKey } = await apiKeys.rotate(keyId, {
  gracePeriodDays: 7
})

// Check rotation status
const status = await apiKeys.getRotationStatus(keyId)
// { isRotated: true, gracePeriodEnds: '2026-01-25T...' }
```

### State Management Documentation

See `docs/STATE_MANAGEMENT.md` for patterns:
- React Context usage
- Data fetching patterns
- Real-time subscription cleanup
- URL state management
- Anti-patterns to avoid

---

## Critical Patterns & Common Pitfalls (v0.4.2)

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

**Why?** Creating multiple clients causes "Multiple GoTrueClient instances" warnings and can lead to:
- Inconsistent authentication state
- Race conditions with session tokens
- Undefined behavior with storage keys

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

// ❌ WRONG: Let 404 errors propagate to console
const { data } = await supabase.from('optional_table').select('*')
// This logs "404 Not Found" if table doesn't exist
```

**Optional tables in Vigil:**
- `analytics_events` - User tracking (requires `VITE_ENABLE_ANALYTICS=true`)
- `mitre_techniques` - MITRE ATT&CK data (requires `VITE_ENABLE_MITRE=true`)

These features are **disabled by default** to prevent 404 console errors. Enable them only after running the `067_analytics_and_techniques.sql` migration.

### Vite Chunk Configuration

**CRITICAL**: Avoid splitting related libraries into separate chunks that can create circular dependencies.

```javascript
// ✅ CORRECT: Group related libraries together
manualChunks: (id) => {
  if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
  if (id.includes('node_modules/firebase')) return 'vendor-firebase'
  if (id.includes('node_modules')) return 'vendor'  // All others together
}

// ❌ WRONG: Splitting interdependent libraries
manualChunks: (id) => {
  if (id.includes('react')) return 'vendor-react'
  if (id.includes('recharts')) return 'vendor-charts'  // Depends on react!
  if (id.includes('d3')) return 'vendor-charts'
  // This causes "Cannot access 'X' before initialization" errors
}
```

**Why?** Recharts depends on React; D3 has internal dependencies. Splitting them causes circular chunk issues that crash the app with "Cannot access 'T' before initialization".

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
└── stripe/
    └── webhook.js     ✅ Deployed as serverless function
```

**Why?** Vercel treats every `.js` file in `api/` as a serverless function. The Hobby plan limits this to 12 functions. Using `_lib/` prefix tells Vercel to exclude those files.

### Database Column Names

Always verify column names exist before using in queries:

```javascript
// ✅ CORRECT: Use columns that exist in the schema
.order('created_at', { ascending: false })

// ❌ WRONG: Assuming column names
.order('published_date', { ascending: false })  // Column may not exist!
```

**Check migrations in `supabase/migrations/` to verify column names.**

### Content Security Policy (CSP)

When adding external resources, update CSP in `vercel.json`:

```json
{
  "headers": [{
    "key": "Content-Security-Policy",
    "value": "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net ..."
  }]
}
```

**Common CSP additions needed:**
- `https://cdn.jsdelivr.net` - For world-atlas map data
- External API endpoints for data fetching

### Service Worker Caching

Don't cache partial responses (HTTP 206):

```javascript
// ✅ CORRECT: Check for partial responses
if (response.ok && response.status !== 206) {
  cache.put(request, response.clone())
}

// ❌ WRONG: Cache all successful responses
if (response.ok) {
  cache.put(request, response.clone())  // Fails on 206 partial responses
}
```

### Component Organization: Barrel Exports

Components are organized in subdirectories with barrel exports (index.js files). When git shows "deleted" component files, verify the actual location:

```
src/components/
├── index.js              # Main barrel - re-exports from subdirectories
├── common/
│   ├── index.js          # Exports: StatCard, EmptyState, Skeleton, etc.
│   └── StatCard.jsx      ✅ Actual file location
├── panels/
│   ├── index.js          # Exports: CorrelationPanel, EnrichmentPanel, etc.
│   └── CorrelationPanel.jsx  ✅ Actual file location
├── widgets/
│   ├── index.js          # Exports: ChangeSummaryCard, ThreatHuntCard, etc.
│   └── ChangeSummaryCard.jsx  ✅ Actual file location
└── actions/
    ├── index.js          # Exports: ExportIOCsButton, CreateAlertButton, etc.
    └── ExportIOCsButton.jsx
```

**Common confusion:** Git may show deletions like `D src/components/CorrelationPanel.jsx` (root level). This is correct - the file was moved to `src/components/panels/CorrelationPanel.jsx`. The barrel exports handle the re-mapping.

```javascript
// ✅ CORRECT: Import from main barrel or subdirectory barrel
import { CorrelationPanel } from '../components'
import { CorrelationPanel } from '../components/panels'

// ❌ WRONG: Import from root (old location, no longer exists)
import CorrelationPanel from '../components/CorrelationPanel'
```

---

## UX Improvements System (v1.3.0)

### Overview

A comprehensive set of UX improvements implemented across 5 phases to transform Vigil into an analyst's daily command center.

### Phase 1: Quick Wins

#### What's New Badge

Track new items since the user's last visit:

```javascript
import { useLastVisit } from '../hooks/useLastVisit'
import { getNewItemsSince } from '../lib/whatsNew'

const { lastVisit, updateLastVisit } = useLastVisit()
const newItems = await getNewItemsSince(lastVisit)
// Returns: { incidents: 5, actors: 3, kevs: 2, total: 10 }
```

**Component:**
```jsx
import WhatsNewBadge from '../components/common/WhatsNewBadge'

<WhatsNewBadge /> // Shows badge with dropdown in header
```

#### Keyboard Shortcuts

Global keyboard navigation system:

```javascript
import { SHORTCUTS } from '../lib/shortcuts'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

// Register shortcuts
useKeyboardShortcuts({
  onToggleSidebar: () => setSidebarCollapsed(!collapsed),
  onOpenSearch: () => setSearchOpen(true),
  onShowHelp: () => setHelpOpen(true),
})
```

**Key shortcuts:**
| Shortcut | Action |
|----------|--------|
| `?` | Show shortcuts help |
| `Ctrl+K` | Open search |
| `G then D` | Go to Dashboard |
| `G then A` | Go to Actors |
| `F` | Toggle Focus Mode |

#### One-Click Actions

Quick action components:

```jsx
import { ExportIOCsButton, CreateAlertButton, BulkActionBar } from '../components/actions'

<ExportIOCsButton entityType="incident" entityId={incidentId} />
<CreateAlertButton entityType="actor" entityId={actorId} />
<BulkActionBar selectedIds={selectedIds} entityType="iocs" />
```

### Phase 2: Focus Mode & Quick IOC

#### Focus Mode

Filter entire application to user's organization context:

```jsx
import { useFocusMode, FocusModeProvider } from '../hooks/useFocusMode'

// Wrap app with provider
<FocusModeProvider>
  <App />
</FocusModeProvider>

// Use in components
const { enabled, toggle, filters, profile } = useFocusMode()

// Build focus filters from profile
import { buildFocusFilters } from '../lib/focusFilters'
const filters = buildFocusFilters(profile)
```

**Component:**
```jsx
import FocusModeToggle from '../components/common/FocusModeToggle'

<FocusModeToggle /> // Toggle button for header
```

#### Quick IOC Check

Inline IOC lookup in header:

```jsx
import QuickIOCInput from '../components/common/QuickIOCInput'
import { detectIOCType } from '../lib/iocDetection'

// Auto-detect IOC type
const { type, confidence, meta } = detectIOCType('8.8.8.8')
// Returns: { type: 'ipv4', confidence: 100, meta: { color: 'text-blue-400' } }

<QuickIOCInput /> // Search input with inline results
```

**Supported IOC types:** IPv4, IPv6, MD5, SHA1, SHA256, Domain, URL, Email, CVE

### Phase 3: Digests & Comparisons

#### Comparison Dashboard

Time-based comparison analysis:

```jsx
import Compare from '../pages/Compare'
import {
  TimeRangeSelector,
  ComparisonCard,
  TrendChart,
  SectorComparison,
  RegionComparison,
} from '../components/compare'

<TimeRangeSelector value={range} onChange={setRange} />
<ComparisonCard
  title="Incidents"
  currentValue={47}
  previousValue={42}
  inverted={true} // Lower is better
/>
```

**Route:** `/compare`

#### Digest Emails

Automated digest generation and sending:

```javascript
import { generateDigest, getDigestRecipients } from '../lib/digestGenerator'
import { generateDigestEmail } from '../lib/digestTemplates'

// Generate digest content
const digest = await generateDigest(userId, 'weekly')

// Generate email
const { html, text, subject } = generateDigestEmail(digest)
```

**NPM Scripts:**
```bash
npm run send:digests              # Send digests (auto-detects type)
npm run send:digests:daily        # Send daily digests
npm run send:digests:weekly       # Send weekly digests
```

**GitHub Actions:** `.github/workflows/send-digests.yml` runs daily at 8 AM UTC.

### Phase 4: Customization & Collaboration

#### Widget Registry

Dashboard customization system:

```javascript
import { WIDGETS, WIDGET_TYPES, DEFAULT_LAYOUT, getWidgetById } from '../lib/widgetRegistry'

// Available widget types
WIDGET_TYPES.BLUF           // AI Summary
WIDGET_TYPES.PRIORITIES     // Priorities for You
WIDGET_TYPES.ESCALATING     // Escalating Actors
WIDGET_TYPES.STATS          // Stats Row
WIDGET_TYPES.ACTIVITY_CHART // Activity Chart
WIDGET_TYPES.TOP_ACTORS     // Top Actors
// ... and more
```

**Layout Hook:**
```javascript
import { useDashboardLayout } from '../hooks/useDashboardLayout'

const {
  layout,
  loading,
  addWidget,
  removeWidget,
  updateWidgetConfig,
  resetLayout,
} = useDashboardLayout()
```

**Widget Picker:**
```jsx
import WidgetPicker from '../components/dashboard/WidgetPicker'

<WidgetPicker
  isOpen={showPicker}
  onClose={() => setShowPicker(false)}
  onSelectWidget={handleAddWidget}
  existingWidgets={layout.widgets}
/>
```

#### Collaboration Features

**Share Links:**
```javascript
import { createShareLink, getShareLinks, copyToClipboard } from '../lib/sharing'

const link = await createShareLink('actor', actorId, { expiresInDays: 7 })
// Returns: { url: 'https://vigil.../s/abc123', token: 'abc123' }

await copyToClipboard(link.url)
```

**Entity Notes:**
```javascript
import { createNote, getNotes, updateNote, deleteNote } from '../lib/notes'

await createNote('actor', actorId, 'Investigation notes...', { isTeamVisible: true })
const notes = await getNotes('actor', actorId)
```

**Components:**
```jsx
import { ShareButton, NoteEditor } from '../components/collaboration'

<ShareButton entityType="actor" entityId={actorId} entityName="LockBit" />
<NoteEditor entityType="actor" entityId={actorId} />
```

### Phase 5: Predictive Intelligence

#### Predictions Library

Predictive analytics for threat intelligence:

```javascript
import {
  getActorEscalationRisk,
  getSectorTargetingPrediction,
  getVulnExploitationPrediction,
  getOrgRiskScore,
  getPredictiveAlerts,
  RISK_LEVELS,
} from '../lib/predictions'

// Actor escalation risk
const risk = await getActorEscalationRisk(actorId)
// Returns: { risk: 'high', increase: 75, signal: 'Pre-campaign pattern detected', confidence: 85 }

// Sector targeting prediction
const prediction = await getSectorTargetingPrediction('healthcare')
// Returns: { risk: 'medium', isSeasonalPeak: true, prediction: 'Flu season targeting expected' }

// Vulnerability exploitation prediction
const vulnRisk = await getVulnExploitationPrediction('CVE-2026-1234')
// Returns: { risk: 'critical', daysToExploit: '0-3', score: 75, reasons: [...] }

// Organization risk score
const orgRisk = await getOrgRiskScore(profile)
// Returns: { score: 65, risk: 'high', factors: [...], trend: 'increasing' }

// Get all predictive alerts
const alerts = await getPredictiveAlerts(profile)
```

#### Similarity Engine

Find related items:

```javascript
import {
  getSimilarIncidents,
  getSimilarActors,
  getSimilarVulnerabilities,
} from '../lib/similarity'

const similar = await getSimilarIncidents(incidentId, 5)
// Returns: [{ ...incident, similarity: { score: 75, factors: [...] } }, ...]
```

**Components:**
```jsx
import { PredictiveAlert, RiskIndicator, SimilarItems } from '../components/insights'

<PredictiveAlert
  type="actor_escalation"
  entity="LockBit"
  risk="high"
  message="Pre-campaign pattern detected"
  confidence={85}
/>

<RiskIndicator
  score={65}
  risk="high"
  factors={factors}
  showDetails={true}
/>

<SimilarItems
  type="incident"
  entityId={incidentId}
  limit={5}
/>
```

### Database Tables (Migration 068)

```sql
-- Digest preferences
CREATE TABLE digest_preferences (
  user_id UUID REFERENCES auth.users(id),
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'none')),
  send_time TIME DEFAULT '08:00',
  timezone TEXT DEFAULT 'UTC',
  include_sections JSONB
);

-- Digest history
CREATE TABLE digest_history (
  user_id UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  digest_type TEXT,
  content_hash TEXT
);

-- Entity notes
CREATE TABLE entity_notes (
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id TEXT,
  content TEXT,
  is_team_visible BOOLEAN
);

-- Share links
CREATE TABLE share_links (
  created_by UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id TEXT,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  view_count INTEGER
);

-- Dashboard layouts
CREATE TABLE dashboard_layouts (
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  layout JSONB,
  is_default BOOLEAN
);

-- Team watchlists
CREATE TABLE team_watchlists (
  team_id UUID REFERENCES teams(id),
  name TEXT,
  description TEXT
);
```

### Route Updates

| Route | Component | Description |
|-------|-----------|-------------|
| /compare | Compare | Time/sector/region comparison dashboard |

### File Structure

```
src/
├── components/
│   ├── actions/
│   │   ├── ExportIOCsButton.jsx
│   │   ├── CreateAlertButton.jsx
│   │   └── BulkActionBar.jsx
│   ├── collaboration/
│   │   ├── ShareButton.jsx
│   │   └── NoteEditor.jsx
│   ├── common/
│   │   ├── WhatsNewBadge.jsx
│   │   ├── FocusModeToggle.jsx
│   │   └── QuickIOCInput.jsx
│   ├── compare/
│   │   ├── TimeRangeSelector.jsx
│   │   ├── ComparisonCard.jsx
│   │   ├── TrendChart.jsx
│   │   ├── SectorComparison.jsx
│   │   └── RegionComparison.jsx
│   ├── dashboard/
│   │   └── WidgetPicker.jsx
│   └── insights/
│       ├── PredictiveAlert.jsx
│       ├── RiskIndicator.jsx
│       └── SimilarItems.jsx
├── hooks/
│   ├── useLastVisit.js
│   ├── useFocusMode.jsx
│   └── useDashboardLayout.js
├── lib/
│   ├── shortcuts.js
│   ├── whatsNew.js
│   ├── focusFilters.js
│   ├── iocDetection.js
│   ├── digestGenerator.js
│   ├── digestTemplates.js
│   ├── widgetRegistry.js
│   ├── sharing.js
│   ├── notes.js
│   ├── predictions.js
│   └── similarity.js
├── pages/
│   └── Compare.jsx
scripts/
└── send-digests.mjs
.github/workflows/
└── send-digests.yml
supabase/migrations/
└── 068_ux_improvements.sql
```

### Dashboard Data Fixes (v1.3.1)

Three data quality issues were identified and fixed:

#### 1. Global Threat Map "No Data" on Hover

**Problem:** Hovering over countries showed "No data" despite incidents existing.

**Root Cause:** Data stored with ISO-2 codes (US, GB), but map uses ISO-3 codes (USA, GBR). The reverse lookup was incomplete.

**Fix:** Added comprehensive `ISO3_TO_ISO2` mapping with 100+ countries in `src/components/ThreatAttributionMap.jsx`:

```javascript
const ISO3_TO_ISO2 = {
  USA: 'US', GBR: 'GB', DEU: 'DE', FRA: 'FR', CAN: 'CA',
  // ... 100+ mappings
}

// Direct lookup instead of slow reverse search
const iso2 = countryCode?.length === 3 ? ISO3_TO_ISO2[countryCode] : countryCode
```

#### 2. Threat Level Always 100/100

**Problem:** Threat level gauge always showed 100/100 "Critical".

**Root Cause:** Using `log2` scale which maxed out too quickly. ~1000 incidents + 5 escalating actors = 100.

**Fix:** Updated calculation in `src/pages/dashboard/useDashboardData.js` to use `log10` scale:

```javascript
// Old: log2(incidents) * 7, maxed at 70
// New: log10(incidents) * 20, maxed at 60
export function calculateThreatLevel(incidents30d, escalatingActors = 0) {
  const incidentScore = incidents30d > 0
    ? Math.min(60, Math.round(Math.log10(incidents30d + 1) * 20))
    : 0
  const escalationScore = Math.min(20, escalatingActors * 4)
  const escalationBonus = escalatingActors >= 3 ? 10 : (escalatingActors >= 1 ? 5 : 0)
  return Math.min(100, incidentScore + escalationScore + escalationBonus)
}
```

**New scale:**
- 100 incidents → 33 base score
- 500 incidents → 45 base score
- 1000 incidents → 50 base score
- 5000 incidents → 60 base score

#### 3. Targeted Sectors 905 "Unknown"

**Problem:** Most incidents showed "Unknown" sector in the dashboard chart.

**Root Cause:** Sector classification exists but wasn't applied to existing data.

**Fix:**
1. Ingestion scripts already use `classifySector()` for new data
2. Run reclassification for existing data:

```bash
npm run reclassify:sectors
```

The script in `scripts/reclassify-sectors.mjs` uses keyword matching on victim names, websites, and descriptions to classify sectors.

**Classifier location:** `scripts/lib/sector-classifier.mjs`

---

