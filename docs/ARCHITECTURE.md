# Vigil Architecture

> System design and technical decisions for the Vigil CTI platform.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIGIL ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   External   │    │   GitHub     │    │   Vercel     │       │
│  │ Data Sources │───▶│   Actions    │    │   Hosting    │       │
│  │  (22 feeds)  │    │  (Ingestion) │    │  (Frontend)  │       │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘       │
│                             │                    │               │
│                             ▼                    ▼               │
│                      ┌──────────────────────────────┐           │
│                      │         SUPABASE             │           │
│                      │  ┌────────┐  ┌────────────┐  │           │
│                      │  │ PostgreSQL │  │ Edge Functions │  │           │
│                      │  │ (Data)  │  │   (API)    │  │           │
│                      │  └────────┘  └────────────┘  │           │
│                      └──────────────────────────────┘           │
│                                    │                             │
│                                    ▼                             │
│                      ┌──────────────────────────────┐           │
│                      │         FIREBASE             │           │
│                      │  ┌────────┐  ┌────────────┐  │           │
│                      │  │  Auth  │  │  Firestore │  │           │
│                      │  │ (SSO)  │  │  (Prefs)   │  │           │
│                      │  └────────┘  └────────────┘  │           │
│                      └──────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hybrid Database Strategy

### Why Supabase + Firebase?

We use a hybrid approach for specific reasons:

| Database | Use Case | Rationale |
|----------|----------|-----------|
| **Supabase (PostgreSQL)** | Threat data | Complex queries, JOINs, full-text search |
| **Firebase (Firestore)** | User preferences | Document model fits, mature auth |

### Supabase for Threat Data

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

### Firebase for User Features

- Auth is mature and handles Google SSO well
- Firestore fits document model for user preferences
- Real-time listeners for notifications

---

## Data Flow

### Ingestion Pipeline

```
External API/Feed
       │
       ▼
┌─────────────────┐
│ Ingestion Script │  (scripts/ingest-*.mjs)
│  - Fetch data    │
│  - Transform     │
│  - Deduplicate   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│  - Upsert data  │
│  - Log to sync_log │
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

| Tier | Frequency | Sources | Rationale |
|------|-----------|---------|-----------|
| Tier 1 | Every 6 hours | Ransomware, KEV, MITRE, Core IOCs | Frequently updated, critical |
| Tier 2 | Daily (2 AM UTC) | OTX, MalwareBazaar, Enrichment | Rate-limited APIs |
| Tier 3 | Weekly | HIBP | Infrequently updated |

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

techniques
├── id (TEXT, PK) -- T1234.001
├── name (TEXT)
├── tactic (TEXT)
├── platforms (TEXT[])
├── detection (TEXT)
└── mitigations (TEXT[])
```

### Junction Tables

```
actor_techniques (threat_actor_id, technique_id)
actor_vulnerabilities (threat_actor_id, vulnerability_id)
incident_iocs (incident_id, ioc_id)
```

### User Tables

```
user_preferences (Firebase)
├── user_id (TEXT, PK)
├── excluded_sectors (TEXT[])
├── severity_threshold (TEXT)
├── digest_frequency (TEXT)
└── notification_settings (OBJECT)

watchlists (Supabase)
├── id (UUID, PK)
├── user_id (TEXT)
├── name (TEXT)
├── entity_type (TEXT)
└── entity_ids (UUID[])

org_profiles (Supabase)
├── user_id (TEXT, PK)
├── sector (TEXT)
├── region (TEXT)
├── tech_vendors (TEXT[])
└── tech_stack (TEXT[])
```

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
│   ├── common/      # Header, Sidebar, etc.
│   ├── charts/      # Visualization components
│   ├── panels/      # Detail panels
│   └── badges/      # Status badges
├── pages/           # Route components
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
├── lib/             # Business logic
│   ├── supabase/    # Database queries
│   ├── constants/   # Shared constants
│   └── utils.js     # Utility functions
└── main.jsx         # App entry point
```

### Data Fetching Pattern

```javascript
// Custom hook pattern
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

### REST API Endpoints

```
GET  /api/v1/actors           # List threat actors
GET  /api/v1/actors/:id       # Get actor details
GET  /api/v1/incidents        # List incidents
GET  /api/v1/vulnerabilities  # List vulnerabilities
GET  /api/v1/iocs             # List IOCs
POST /api/v1/iocs/lookup      # Bulk IOC lookup
GET  /api/v1/events           # Unified timeline
GET  /api/v1/techniques       # ATT&CK techniques
POST /api/v1/search           # Advanced search
```

### Authentication

- API keys for programmatic access
- JWT tokens for user sessions
- Rate limiting per tier

---

## Security Considerations

### Data Security
- All API keys stored in environment variables
- Supabase Row Level Security (RLS) policies
- Input sanitization on all queries

### Authentication
- Firebase Auth for user management
- Google SSO support
- Session management

### Infrastructure
- HTTPS everywhere
- CORS configured for allowed origins
- Rate limiting on all endpoints

---

## Monitoring & Observability

### Error Tracking
- Sentry for error capture
- Source maps for stack traces

### Performance
- Core Web Vitals monitoring
- Database query analytics
- API response time tracking

### Data Quality
- Sync log for ingestion status
- Deduplication tracking
- Data freshness alerts

---

## Deployment

### Production
- **Frontend:** Vercel (auto-deploy on main)
- **Database:** Supabase Cloud
- **Auth:** Firebase
- **Domain:** vigil.theintelligence.company

### CI/CD Pipeline
```
Push to main
    │
    ▼
GitHub Actions
├── Lint check
├── Unit tests
├── Build
└── Deploy to Vercel
```

---

*Last Updated: January 2026*
*See also: DATABASE.md for detailed schema, DATA_SOURCES.md for ingestion details*
