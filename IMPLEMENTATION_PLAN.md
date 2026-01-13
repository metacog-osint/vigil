# Vigil - Implementation Plan

> Structured development plan for all roadmap features
> Reference: ROADMAP.md

---

## Implementation Principles

1. **Ship incrementally** - Each sprint delivers usable features
2. **Data first** - New data sources before new visualizations
3. **Foundation before features** - Infrastructure enables everything else
4. **User value drives priority** - Features that help analysts come first

---

## Sprint 0: Foundation & Infrastructure

> Prerequisites for all other work

### 0.1 Development Environment
- [ ] Initialize Git repository
- [ ] Set up branch strategy (main, develop, feature/*)
- [ ] Configure ESLint + Prettier
- [ ] Add .editorconfig for consistency

### 0.2 Testing Infrastructure
- [ ] Install Vitest for unit tests
- [ ] Install Playwright for E2E tests
- [ ] Create test utilities and mocks
- [ ] Add test scripts to package.json

### 0.3 CI/CD Pipeline
- [ ] GitHub Actions workflow for:
  - [ ] Lint on PR
  - [ ] Test on PR
  - [ ] Build on merge to main
  - [ ] Auto-deploy to Vercel on main
- [ ] Branch protection rules

### 0.4 Scheduled Data Ingestion
- [ ] Set up GitHub Actions cron job for daily ingestion
- [ ] Or: Vercel Cron (if on Pro plan)
- [ ] Or: External cron service (cron-job.org, free)
- [ ] Monitoring/alerting for failed ingestion

### 0.5 Database Optimization
- [ ] Review and add missing indexes
- [ ] Set up database backups (Supabase dashboard)
- [ ] Create database documentation
- [ ] Add migration for any schema fixes

**Deliverables:**
- Automated testing pipeline
- Automated deployments
- Daily data refresh
- Stable foundation for development

---

## Sprint 1: Quick Wins & Polish

> High-impact, low-effort improvements

### 1.1 UI Polish
- [ ] Add loading skeletons (replace spinners)
- [ ] Improve empty states with helpful messages
- [ ] Add error boundaries for graceful failures
- [ ] Implement collapsible sidebar
- [ ] Add keyboard shortcuts (?, /, Esc)

### 1.2 Severity Badges Enhancement
- [ ] Create `SeverityBadge` component
- [ ] Color coding: Critical (red), High (orange), Medium (yellow), Low (blue)
- [ ] Add to Vulnerabilities page
- [ ] Add to Dashboard KEV section

### 1.3 "New" Indicators
- [ ] Track user's last visit (localStorage)
- [ ] Add "NEW" badge to items since last visit
- [ ] Highlight new items in lists
- [ ] Show count of new items in nav

### 1.4 Improved Time Display
- [ ] Relative time for recent ("2 hours ago")
- [ ] Absolute time for older ("Jan 15, 2026")
- [ ] Hover tooltip shows full timestamp
- [ ] Timezone-aware display

**Deliverables:**
- More polished, professional UI
- Better user orientation
- Improved perceived performance

---

## Sprint 2: Search & Navigation

> Core functionality for analysts

### 2.1 Unified Search
- [ ] Create `SearchModal` component (Cmd+K trigger)
- [ ] Search across all entity types
- [ ] Auto-detect input type:
  - IP regex → search IOCs
  - CVE-YYYY-* → search vulnerabilities
  - Hash (32/64 char) → search IOCs
  - Default → search actors + incidents
- [ ] Recent searches history
- [ ] Keyboard navigation in results

### 2.2 Advanced Filtering
- [ ] Filter builder component
- [ ] Save filter combinations
- [ ] URL-based filters (shareable links)
- [ ] Filter presets (Critical CVEs, Recent IOCs, etc.)

### 2.3 Bulk Search
- [ ] Create `BulkSearchPage`
- [ ] Text area for pasting multiple IOCs
- [ ] File upload (CSV, TXT)
- [ ] Results table with match/no-match
- [ ] Export results

### 2.4 Search Results Page
- [ ] Dedicated `/search` route
- [ ] Tabbed results by type
- [ ] Result count per type
- [ ] Pagination for large results

**Deliverables:**
- Fast IOC lookup
- Shareable searches
- Bulk investigation capability

---

## Sprint 3: Data Sources - Tier 1

> High-value free sources

### 3.1 MITRE ATT&CK Integration
- [ ] Create `scripts/ingest-mitre.mjs`
- [ ] Fetch ATT&CK Enterprise matrix (STIX JSON)
- [ ] Create `techniques` table:
  ```sql
  CREATE TABLE techniques (
    id TEXT PRIMARY KEY,  -- T1059.001
    name TEXT,
    tactic TEXT,
    description TEXT,
    platforms TEXT[],
    detection TEXT,
    mitigations TEXT[]
  );
  ```
- [ ] Create `actor_techniques` junction table
- [ ] Map existing actors to techniques
- [ ] Add techniques tab to Actor detail view

### 3.2 AlienVault OTX
- [ ] Create `scripts/ingest-otx.mjs`
- [ ] Fetch public pulses (no API key needed for public)
- [ ] Parse IOCs from pulses
- [ ] Store pulse metadata for context
- [ ] Add OTX source badge to IOCs

### 3.3 GreyNoise Community
- [ ] Create `scripts/ingest-greynoise.mjs`
- [ ] Fetch community API data
- [ ] Tag known scanners/noise
- [ ] Add "Known Scanner" indicator to IP IOCs
- [ ] Filter option: "Hide noise"

### 3.4 Phishtank
- [ ] Create `scripts/ingest-phishtank.mjs`
- [ ] Fetch verified phishing URLs
- [ ] Add to IOCs with type "phishing_url"
- [ ] Add phishing category to IOC search

**Deliverables:**
- ATT&CK technique mapping
- Richer IOC context
- Noise filtering capability
- Phishing tracking

---

## Sprint 4: Visualizations - Dashboard

> Transform dashboard into command center

### 4.1 Geographic Heatmap
- [ ] Install `react-simple-maps` or `leaflet`
- [ ] Create `GeoHeatmap` component
- [ ] Aggregate incidents by country
- [ ] Color scale by incident count
- [ ] Click country → filter incidents
- [ ] Toggle: victim location vs actor origin
- [ ] Add to dashboard (prominent placement)

### 4.2 Threat Level Gauge
- [ ] Create `ThreatGauge` component
- [ ] Calculate score based on:
  - New KEVs this week (weighted high)
  - IOC volume change
  - Incident velocity
  - Critical CVE count
- [ ] Visual gauge (Low → Critical)
- [ ] Trend indicator (↑ ↓ →)
- [ ] Tooltip explains contributing factors

### 4.3 IOC Sparklines
- [ ] Create `Sparkline` component (tiny line chart)
- [ ] Calculate daily IOC counts (last 7 days)
- [ ] Add sparkline next to each IOC type stat
- [ ] Color: green (declining), red (rising)

### 4.4 Activity Calendar
- [ ] Create `ActivityCalendar` component
- [ ] GitHub-style contribution grid
- [ ] Shows incident count per day
- [ ] Last 90 days visible
- [ ] Click day → filter to that date

**Deliverables:**
- Visual threat landscape
- At-a-glance trend awareness
- Geographic context

---

## Sprint 5: Visualizations - Analysis

> Deep-dive analytical tools

### 5.1 Actor Relationship Graph
- [ ] Install `react-force-graph` or `vis-network`
- [ ] Create `ActorGraph` component
- [ ] Nodes: threat actors
- [ ] Edges based on:
  - Shared TTPs
  - Shared IOCs
  - Same target sectors
  - Temporal correlation
- [ ] Click node → actor detail
- [ ] Filter by actor type
- [ ] Cluster detection

### 5.2 ATT&CK Matrix Heatmap
- [ ] Create `AttackMatrix` component
- [ ] Grid: Tactics (columns) × Techniques (rows)
- [ ] Cell color: frequency of use
- [ ] Click cell → related actors/incidents
- [ ] Filter by time period
- [ ] Export as image

### 5.3 Vulnerability Treemap
- [ ] Install `recharts` treemap (already have recharts)
- [ ] Create `VulnTreemap` component
- [ ] Size: CVSS score
- [ ] Color: exploitation status
- [ ] Group by: vendor or product
- [ ] Click → vulnerability detail

### 5.4 Incident Sankey Diagram
- [ ] Create `IncidentSankey` component
- [ ] Flow: Actor → Sector → Country
- [ ] Width proportional to count
- [ ] Click segment → filter
- [ ] Time period selector

**Deliverables:**
- Relationship discovery
- Attack pattern analysis
- Visual vulnerability prioritization

---

## Sprint 6: User Features

> Personalization and workflow

### 6.1 Watch Lists
- [ ] Create `watchlists` table:
  ```sql
  CREATE TABLE watchlists (
    id UUID PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    entity_type TEXT,  -- actor, cve, ioc
    entity_ids TEXT[],
    created_at TIMESTAMPTZ
  );
  ```
- [ ] "Add to watchlist" button on entities
- [ ] Watchlist management page
- [ ] Dashboard widget: "Watchlist updates"
- [ ] Filter views by watchlist

### 6.2 Saved Searches
- [ ] Create `saved_searches` table
- [ ] Save current filter state
- [ ] Name and organize searches
- [ ] Quick access in sidebar
- [ ] Share search via URL

### 6.3 User Preferences
- [ ] Create `user_preferences` table
- [ ] Settings page:
  - Default time range
  - Default severity filter
  - Items per page
  - Notification preferences
- [ ] Persist in Supabase (or Firebase if using auth)

### 6.4 Tagging System
- [ ] Create `tags` and `entity_tags` tables
- [ ] Tag any entity (actor, incident, CVE, IOC)
- [ ] Color picker for tags
- [ ] Filter by tags
- [ ] Bulk tagging

**Deliverables:**
- Personalized experience
- Faster repeated workflows
- Custom organization

---

## Sprint 7: Data Sources - Tier 2

> Additional valuable sources

### 7.1 Spamhaus DROP
- [ ] Create `scripts/ingest-spamhaus.mjs`
- [ ] Fetch DROP list (don't route or peer)
- [ ] Store as IP range IOCs
- [ ] Add blocklist category

### 7.2 Emerging Threats
- [ ] Create `scripts/ingest-et.mjs`
- [ ] Fetch open ruleset
- [ ] Parse Suricata rules
- [ ] Create `ids_rules` table
- [ ] Link rules to CVEs where possible

### 7.3 US-CERT / CISA Alerts
- [ ] Create `scripts/ingest-uscert.mjs`
- [ ] Fetch RSS feed
- [ ] Create `alerts` table
- [ ] Parse referenced CVEs
- [ ] Display on dashboard

### 7.4 MalwareBazaar (expanded)
- [ ] Enhance existing abuse.ch script
- [ ] Fetch more sample metadata
- [ ] Link samples to actors
- [ ] Add malware samples page

**Deliverables:**
- Blocklist data
- IDS rule coverage
- Official advisories
- Malware tracking

---

## Sprint 8: Export & Integration

> Connect to analyst workflows

### 8.1 Export Functionality
- [ ] CSV export for all list views
- [ ] PDF report generation (actor profiles, incident summaries)
- [ ] STIX 2.1 export for IOCs
- [ ] JSON export for raw data

### 8.2 REST API
- [ ] Create `/api` routes (Vercel serverless functions)
- [ ] Endpoints:
  - GET /api/actors
  - GET /api/incidents
  - GET /api/iocs
  - GET /api/vulnerabilities
  - POST /api/search
- [ ] API key authentication
- [ ] Rate limiting
- [ ] OpenAPI documentation

### 8.3 Webhook Notifications
- [ ] Create `webhooks` table
- [ ] Webhook configuration UI
- [ ] Trigger on:
  - New critical CVE
  - New KEV
  - Watchlist updates
- [ ] Retry logic for failures

### 8.4 Email Digests
- [ ] Integrate email service (Resend, SendGrid)
- [ ] Daily digest template
- [ ] Weekly summary template
- [ ] User subscription management
- [ ] Unsubscribe handling

**Deliverables:**
- Data portability
- SIEM integration capability
- Proactive alerting

---

## Sprint 9: Advanced Features

> Power user capabilities

### 9.1 Correlation Engine
- [ ] Auto-link IOCs to actors
- [ ] Identify infrastructure overlaps
- [ ] Campaign clustering algorithm
- [ ] Confidence scoring
- [ ] "Related entities" panel

### 9.2 Advanced Query Language
- [ ] Define query syntax:
  ```
  type:ip country:RU first_seen:>2024-01-01
  actor:lockbit AND sector:healthcare
  cvss:>=9.0 AND kev:true
  ```
- [ ] Query parser
- [ ] Query builder UI
- [ ] Query validation and suggestions

### 9.3 Timeline Reconstruction
- [ ] Create `TimelineView` component
- [ ] Aggregate events for an actor/campaign
- [ ] Chronological visualization
- [ ] Event type icons
- [ ] Zoom and filter

### 9.4 Attribution Analysis
- [ ] Confidence indicators for actor attribution
- [ ] Evidence linking
- [ ] Alternative hypothesis tracking
- [ ] Attribution changelog

**Deliverables:**
- Automated intelligence
- Flexible querying
- Investigation tools

---

## Sprint 10: Performance & Scale

> Production hardening

### 10.1 Performance Optimization
- [ ] Implement cursor-based pagination
- [ ] Add Redis caching layer (optional)
- [ ] Optimize slow queries
- [ ] Lazy load heavy components
- [ ] Image optimization

### 10.2 Code Splitting
- [ ] Route-based code splitting
- [ ] Lazy load visualization libraries
- [ ] Reduce initial bundle size
- [ ] Preload critical routes

### 10.3 Monitoring
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Uptime monitoring
- [ ] Database query analytics

### 10.4 Security Hardening
- [ ] Security headers
- [ ] Input sanitization audit
- [ ] SQL injection prevention review
- [ ] Rate limiting on all endpoints
- [ ] CORS configuration

**Deliverables:**
- Sub-2s page loads
- Smaller bundles
- Production reliability
- Security confidence

---

## Implementation Order Summary

```
Sprint 0: Foundation (do first - enables everything)
    ↓
Sprint 1: Quick Wins (immediate user value)
    ↓
Sprint 2: Search (core analyst workflow)
    ↓
Sprint 3: Data Sources Tier 1 (more data = more value)
    ↓
Sprint 4: Dashboard Visualizations (visual impact)
    ↓
Sprint 5: Analysis Visualizations (deep insights)
    ↓
Sprint 6: User Features (personalization)
    ↓
Sprint 7: Data Sources Tier 2 (expanded coverage)
    ↓
Sprint 8: Export & Integration (workflow connection)
    ↓
Sprint 9: Advanced Features (power users)
    ↓
Sprint 10: Performance & Scale (production ready)
```

---

## Parallel Workstreams

Some work can happen in parallel:

| Workstream A (Frontend) | Workstream B (Data) | Workstream C (Infrastructure) |
|------------------------|---------------------|------------------------------|
| Sprint 1: UI Polish | Sprint 3: Data Sources | Sprint 0: CI/CD |
| Sprint 4: Visualizations | Sprint 7: More Sources | Sprint 10: Performance |
| Sprint 6: User Features | Sprint 8: API | Sprint 10: Monitoring |

---

## Dependencies

```
Search (Sprint 2) → Advanced Query (Sprint 9)
MITRE ATT&CK (Sprint 3) → ATT&CK Heatmap (Sprint 5)
Watch Lists (Sprint 6) → Email Digests (Sprint 8)
User Preferences (Sprint 6) → All personalization features
API (Sprint 8) → Webhook Notifications (Sprint 8)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API rate limits | Implement caching, respect rate limits, use bulk endpoints |
| Data source changes | Abstract data fetching, monitor for changes, fallback sources |
| Performance degradation | Pagination, indexing, caching, lazy loading |
| Scope creep | Strict sprint boundaries, MVP for each feature |
| Single point of failure | Redundant data sources, error handling, graceful degradation |

---

## Success Criteria Per Sprint

| Sprint | Success Criteria |
|--------|-----------------|
| 0 | CI/CD passing, daily data refresh working |
| 1 | Lighthouse score > 80, loading states smooth |
| 2 | Search returns results in < 500ms |
| 3 | 4+ new data sources integrated |
| 4 | Dashboard has 3+ visualizations |
| 5 | Can explore actor relationships visually |
| 6 | Users can create and use watchlists |
| 7 | 8+ total data sources |
| 8 | API documented and functional |
| 9 | Complex queries possible |
| 10 | P95 page load < 2s |

---

## Getting Started

To begin implementation:

1. **Review this plan** - Adjust priorities as needed
2. **Start Sprint 0** - Foundation enables everything
3. **Track progress** - Check off items as completed
4. **Ship incrementally** - Deploy after each sprint
5. **Gather feedback** - Adjust based on usage

---

*Implementation plan created: January 2026*
*Reference: ROADMAP.md for feature details*
