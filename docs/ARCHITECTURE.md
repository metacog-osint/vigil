# Vigil Architecture

> System design and technical decisions for the Vigil CTI platform.
> **Last Updated:** January 19, 2026

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIGIL ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   External   │    │   GitHub     │    │  Cloudflare  │       │
│  │ Data Sources │───▶│   Actions    │───▶│   Workers    │       │
│  │  (32 feeds)  │    │  (6hr cycle) │    │ (30min cycle)│       │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘       │
│                             │                    │               │
│                             ▼                    ▼               │
│                      ┌──────────────────────────────┐           │
│                      │         SUPABASE             │           │
│                      │  ┌──────────────────────────┐│           │
│                      │  │      PostgreSQL          ││           │
│                      │  │  (Threat Data + Auth)    ││           │
│                      │  └──────────────────────────┘│           │
│                      │  ┌──────────────────────────┐│           │
│                      │  │     Supabase Auth        ││           │
│                      │  │  (Email, OAuth, JWT)     ││           │
│                      │  └──────────────────────────┘│           │
│                      └──────────────────────────────┘           │
│                                    │                             │
│                                    ▼                             │
│                      ┌──────────────────────────────┐           │
│                      │          VERCEL              │           │
│                      │  ┌──────────────────────────┐│           │
│                      │  │    React Frontend        ││           │
│                      │  │    API Functions         ││           │
│                      │  └──────────────────────────┘│           │
│                      └──────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Architecture

### Supabase as Primary Backend

Vigil uses **Supabase exclusively** for all data and authentication:

| Component | Purpose | Notes |
|-----------|---------|-------|
| **PostgreSQL** | Threat data storage | Complex queries, JOINs, full-text search |
| **Supabase Auth** | User authentication | Email/password, Google OAuth, JWT |
| **Row Level Security** | Data isolation | User-specific data protection |

### Why PostgreSQL for Threat Data?

PostgreSQL enables complex queries that would be difficult in NoSQL:

```sql
-- "Show all actors targeting healthcare with >5 incidents in 30 days"
SELECT ta.* FROM threat_actors ta
JOIN incidents i ON i.threat_actor_id = ta.id
WHERE 'healthcare' = ANY(ta.target_sectors)
  AND i.discovered_at > NOW() - INTERVAL '30 days'
GROUP BY ta.id
HAVING COUNT(i.id) > 5;

-- "Find IOCs associated with actors in my watchlist"
SELECT iocs.* FROM iocs
JOIN threat_actors ta ON iocs.threat_actor_id = ta.id
JOIN watchlist_items wi ON wi.entity_id = ta.id
WHERE wi.user_id = $1;
```

---

## Data Flow

### Ingestion Pipeline

```
External API/Feed
       │
       ├───────────────────┬───────────────────┐
       ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ GitHub Actions  │ │Cloudflare Workers│ │ Manual Scripts  │
│  (6hr cycle)    │ │  (30min cycle)   │ │  (on-demand)    │
│  Tier 1 feeds   │ │  Critical feeds  │ │  Full refresh   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                   ┌─────────────────┐
                   │    Supabase     │
                   │  - Upsert data  │
                   │  - Log to sync_log │
                   │  - Trigger alerts │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Post-Processing │
                   │  - Correlations  │
                   │  - Trend calc    │
                   │  - Enrichment    │
                   └─────────────────┘
```

### Scheduling Tiers

| Tier | Frequency | Method | Sources | Rationale |
|------|-----------|--------|---------|-----------|
| Critical | 30 min | Cloudflare Workers | Ransomware, KEV | Time-sensitive alerts |
| Tier 1 | 6 hours | GitHub Actions | MITRE, Core IOCs, Malware | Frequently updated |
| Tier 2 | Daily | GitHub Actions | OTX, MalwareBazaar, EPSS | Rate-limited APIs |
| Tier 3 | Weekly | Manual | HIBP, Large datasets | Infrequently updated |

---

## Database Schema

### Core Tables

```
threat_actors
├── id (UUID, PK)
├── name (TEXT)
├── actor_type (ENUM: ransomware, apt, cybercrime, etc.)
├── aliases (TEXT[])
├── target_sectors (TEXT[])
├── target_countries (TEXT[])
├── trend_status (ENUM: ESCALATING, STABLE, DECLINING)
├── incidents_7d (INT)
├── incidents_prev_7d (INT)
├── first_seen (TIMESTAMPTZ)
├── last_seen (TIMESTAMPTZ)
└── metadata (JSONB)

incidents
├── id (UUID, PK)
├── threat_actor_id (UUID, FK)
├── victim_name (TEXT)
├── victim_sector (TEXT)
├── victim_country (TEXT)
├── discovered_at (TIMESTAMPTZ)
└── metadata (JSONB)

iocs
├── id (UUID, PK)
├── type (ENUM: ip, domain, url, md5, sha256, etc.)
├── value (TEXT)
├── threat_actor_id (UUID, FK, nullable)
├── malware_family (TEXT)
├── confidence (INT)
├── first_seen (TIMESTAMPTZ)
├── last_seen (TIMESTAMPTZ)
└── tags (TEXT[])

vulnerabilities
├── id (TEXT, PK) -- CVE ID
├── cvss_score (DECIMAL)
├── cvss_vector (TEXT)
├── description (TEXT)
├── affected_vendors (TEXT[])
├── affected_products (TEXT[])
├── kev_date_added (DATE, nullable)
├── kev_due_date (DATE, nullable)
└── ransomware_use (BOOLEAN)
```

### Junction Tables

```
actor_techniques (threat_actor_id, technique_id)
actor_vulnerabilities (threat_actor_id, vulnerability_id)
incident_iocs (incident_id, ioc_id)
```

### User Tables (All in Supabase)

```
user_profiles
├── id (UUID, PK, FK to auth.users)
├── display_name (TEXT)
├── subscription_tier (TEXT)
└── created_at (TIMESTAMPTZ)

org_profiles
├── user_id (UUID, PK, FK to auth.users)
├── sector (TEXT)
├── region (TEXT)
├── tech_vendors (TEXT[])
└── tech_stack (TEXT[])

watchlists
├── id (UUID, PK)
├── user_id (UUID, FK)
├── name (TEXT)
├── entity_type (TEXT)
└── entity_ids (UUID[])
```

### Optional Tables

Some tables require specific migrations and feature flags:

| Table | Feature Flag | Migration |
|-------|--------------|-----------|
| `analytics_events` | `VITE_ENABLE_ANALYTICS=true` | 067_analytics_and_techniques.sql |
| `mitre_techniques` | `VITE_ENABLE_MITRE=true` | 067_analytics_and_techniques.sql |

---

## Frontend Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | React 18 | UI components |
| Build | Vite | Fast dev/build |
| Styling | Tailwind CSS | Utility-first CSS |
| Charts | Recharts | Data visualization |
| Maps | react-simple-maps | Geographic viz |
| State | React Context + hooks | Local state |
| Routing | React Router v6 | Client routing |

### Directory Structure

```
src/
├── components/      # Reusable UI components
│   ├── common/      # StatCard, EmptyState, Skeleton
│   ├── panels/      # CorrelationPanel, EnrichmentPanel
│   ├── widgets/     # Dashboard widgets
│   ├── actions/     # ExportIOCsButton, CreateAlertButton
│   └── index.js     # Barrel exports
├── pages/           # Route components
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
├── lib/             # Business logic
│   ├── supabase/    # Database queries (single client!)
│   └── *.js         # Utility modules
└── main.jsx         # App entry point
```

### Data Fetching Pattern

```javascript
// Custom hook pattern (see docs/STATE_MANAGEMENT.md)
function useActors(filters) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await threatActors.getAll(filters)
        setData(result.data)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [filters])

  return { data, loading, error }
}
```

---

## API Architecture

### Vercel Serverless Functions

API endpoints are deployed as Vercel serverless functions:

```
api/
├── _lib/              # Shared utilities (NOT deployed as functions)
│   ├── supabase-auth.js
│   ├── cors.js
│   └── validators.js
├── send-email.js      # POST /api/send-email
├── generate-summary.js # POST /api/generate-summary
└── v1/
    └── *.js           # REST API endpoints
```

### REST API Endpoints

```
GET  /api/v1/actors           # List threat actors
GET  /api/v1/actors/:id       # Get actor details
GET  /api/v1/incidents        # List incidents
GET  /api/v1/vulnerabilities  # List vulnerabilities
GET  /api/v1/iocs             # List IOCs
POST /api/v1/iocs/lookup      # Bulk IOC lookup
GET  /api/v1/events           # Unified timeline
POST /api/v1/search           # Advanced search
```

### Authentication

- **Supabase JWT** for user sessions
- **API keys** for programmatic access (future)
- **Rate limiting** per user/tier

---

## Security Considerations

### Data Security
- All API keys stored in environment variables (never in client code)
- Supabase Row Level Security (RLS) policies
- Input sanitization on all queries
- Pre-commit hooks enforce code quality

### Authentication
- Supabase Auth for user management
- Google OAuth support
- JWT token verification on all API routes

### Infrastructure
- HTTPS everywhere
- CORS configured for allowed origins only
- Rate limiting on all endpoints
- Security headers configured in vercel.json

---

## Monitoring & Observability

### Error Tracking
- Sentry for error capture (production only)
- Source maps for stack traces

### Performance
- Core Web Vitals monitoring
- Database query analytics via Supabase
- API response time tracking

### Data Quality
- `sync_log` table for ingestion status
- Deduplication tracking
- Data freshness monitoring

---

## Deployment

### Production Stack
- **Frontend:** Vercel (auto-deploy on main)
- **Database:** Supabase Cloud
- **Auth:** Supabase Auth
- **Workers:** Cloudflare Workers (critical ingestion)
- **Domain:** vigil.theintelligence.company

### CI/CD Pipeline
```
Push to main
    │
    ▼
GitHub Actions
├── Lint check (husky pre-commit also runs locally)
├── Unit tests (Vitest)
├── E2E tests (Playwright - chromium, firefox, webkit)
├── Build verification
└── Auto-deploy to Vercel
```

---

*See also: `docs/DATABASE.md` for detailed schema, `DATA_SOURCES.md` for feed catalog, `docs/DEPLOYMENT.md` for hosting details*
