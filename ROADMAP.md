# Vigil - Product Roadmap

> Cyber Threat Intelligence Platform for The Intelligence Company
> https://vigil.theintelligence.company

---

## Current State (v0.4.0)

### Data Sources Integrated (11 Automated)
- [x] RansomLook - Ransomware groups (~600 groups)
- [x] Ransomware.live - Ransomware attacks (16,000+ incidents)
- [x] MITRE ATT&CK - APT groups & techniques (172 groups, 691 techniques)
- [x] Malpedia - Malware families & actors (864 actors, 3,638 families)
- [x] MISP Galaxy - Community threat actor data (2,940 actors)
- [x] CISA KEV - Known Exploited Vulnerabilities (1,100+ CVEs)
- [x] CISA Alerts - Security advisories
- [x] NVD - National Vulnerability Database CVEs
- [x] Abuse.ch ThreatFox - IOCs (malware indicators)
- [x] Abuse.ch URLhaus - Malicious URLs
- [x] Abuse.ch Feodo Tracker - Botnet C2 IPs

### Threat Actor Taxonomy (1,000+ actors)
| Category | Count | Description |
|----------|-------|-------------|
| Ransomware | 578 | Encrypt & extort groups |
| APT | 362 | State-sponsored espionage |
| Cybercrime | 25 | Financial fraud |
| Hacktivism | 23 | Political motivation |
| Initial Access Broker | 9 | Sell network access |
| Data Extortion | 3 | Steal without encrypting |

### Features Implemented
- [x] Dashboard with AI-generated threat summary
- [x] Threat Actors list with trend status (ESCALATING/STABLE/DECLINING)
- [x] Incidents page with time filtering and sector classification
- [x] Vulnerabilities page with KEV data and CVSS scores
- [x] IOC Search with external enrichment links
- [x] Advanced Search query language
- [x] ATT&CK Matrix browser with heatmap view
- [x] Organization Profile for personalized intelligence
- [x] Relevance scoring based on sector/tech stack
- [x] Trend Analysis with week-over-week comparisons
- [x] Actor trajectory charts
- [x] Keyboard shortcuts (press ? for help)
- [x] Dark cyber-themed UI
- [x] STIX 2.1 export format
- [x] Deployed to vigil.theintelligence.company

---

## Phase 2: Additional Data Sources

### High-Value Free Sources (No Auth Required)

| Source | Data Type | Value | Priority |
|--------|-----------|-------|----------|
| MITRE ATT&CK | TTPs, techniques | Map actors to attack patterns | High |
| AlienVault OTX | IOCs, pulses | Community-sourced threat intel | High |
| Shodan (limited) | Exposed services | Infrastructure reconnaissance | Medium |
| GreyNoise | Mass scanner IPs | Filter noise from real threats | Medium |
| Phishtank | Phishing URLs | Credential theft tracking | Medium |
| Spamhaus DROP | Malicious IP ranges | Network blocklists | Low |
| MalwareBazaar | Malware samples | File hashes, YARA rules | Medium |
| OpenPhish | Phishing feeds | Real-time phishing URLs | Medium |
| Emerging Threats | Suricata rules | IDS/IPS signatures | Low |

### Premium Sources (API Key Required)

| Source | Value | Cost |
|--------|-------|------|
| VirusTotal | File/URL reputation, sandbox analysis | Free tier available |
| Recorded Future | Finished intelligence, risk scores | Enterprise |
| Mandiant | APT tracking, attribution | Enterprise |
| Censys | Attack surface mapping | Free tier available |
| Shodan (full) | Complete internet scanning data | $59/mo |
| Have I Been Pwned | Breach data correlation | Free for domain search |
| Hybrid Analysis | Malware sandbox reports | Free tier available |

### Government/Official Sources

| Source | Data Type | Notes |
|--------|-----------|-------|
| US-CERT Alerts | Security advisories | RSS feed |
| NCSC (UK) | Threat reports | RSS feed |
| ENISA (EU) | Threat landscape | Annual reports |
| FIRST | Vulnerability coordination | EPSS scores |

---

## Phase 3: Visualizations

### Dashboard Enhancements

#### Geographic Attack Heatmap
- World map showing attack distribution by country
- Color intensity based on incident count
- Click country to filter incidents
- Toggle between victim location and actor origin

#### Attack Timeline
- Gantt-style horizontal timeline
- Shows campaign duration per actor
- Hover for incident details
- Zoom in/out for different time scales

#### Sector Risk Gauge
- Radial gauge or bar chart
- Shows which industries are most targeted
- Time-based comparison (this week vs last week)
- Click to drill into sector-specific incidents

#### IOC Trend Sparklines
- Mini inline charts next to each IOC type
- Shows volume over last 7/30 days
- Visual indicator of trending up/down
- Helps identify emerging threats

#### Threat Level Indicator
- Overall threat level gauge (Low/Medium/High/Critical)
- Based on: new KEVs, IOC volume, incident count
- Historical comparison

### Analysis Views

#### Actor Relationship Graph
- Network diagram visualization
- Nodes: Threat actors
- Edges: Shared TTPs, infrastructure, targets
- Clustering by actor type or region
- Interactive zoom and filter

#### MITRE ATT&CK Coverage Matrix
- Heatmap of ATT&CK techniques
- Color by frequency of use
- Filter by actor or time period
- Click cell to see related incidents

#### Kill Chain Visualization
- Lockheed Martin kill chain stages
- Show which stages are most active
- Map incidents to kill chain phases
- Identify defensive gaps

#### Vulnerability Treemap
- CVEs sized by CVSS score
- Colored by exploitation status (KEV vs theoretical)
- Group by vendor or product
- Click to expand/drill down

### Incident Analysis

#### Sankey Diagram
- Flow visualization: Actor → Sector → Country
- Width proportional to incident count
- Interactive filtering
- Export as image

#### Calendar Heatmap
- GitHub-style contribution grid
- Shows attack frequency by day
- Color intensity = incident count
- Quick identification of attack patterns

#### Incident Cluster Analysis
- Group similar incidents
- Based on: actor, sector, timing, TTPs
- Identify campaign patterns
- Machine learning opportunity

---

## Phase 4: UX Improvements

### Progressive Disclosure

```
Level 1: Dashboard
├── High-level stats and trends
├── Quick glance at critical items
└── Entry points to detailed views

Level 2: List Views
├── Scannable tables with key columns
├── Inline filtering and sorting
├── Quick actions (bookmark, export)
└── Preview panel on hover/click

Level 3: Detail Views
├── Full entity information
├── Related items and context
├── Historical timeline
└── Raw data access
```

### Smart Defaults

| Setting | Default Value | Rationale |
|---------|---------------|-----------|
| Time range | Last 30 days | Recent is relevant |
| Severity filter | High + Critical | Reduce noise |
| Sort order | Most recent first | Latest threats matter |
| Page size | 50 items | Balance speed and content |
| Auto-refresh | 5 minutes | Keep data current |

### Actionable Alerts

**Current (passive):**
> CVE-2025-1234 was added to the KEV catalog

**Improved (actionable):**
> CVE-2025-1234 (Apache HTTP Server) added to KEV
> - Severity: Critical (9.8)
> - Exploitation: Active in ransomware campaigns
> - Action: Patch to version 2.4.58+
> - Your exposure: [Check Now]

### Key Features to Add

#### Saved Searches
- Save filter combinations
- Name and organize searches
- Quick access from sidebar
- Share with team members

#### Watch Lists
- Track specific actors, CVEs, IOCs
- Get notified on updates
- Custom groupings
- Export watch list data

#### Export Capabilities
- CSV export for all views
- STIX 2.1 format for IOCs
- PDF reports for executives
- API access for integrations

#### Email Digests
- Daily threat summary
- Weekly trend report
- Instant alerts for critical items
- Customizable frequency and content

#### Tagging System
- Custom tags on any entity
- Color-coded labels
- Filter by tags
- Bulk tagging operations

#### User Preferences
- Dark/light theme toggle
- Default time zone
- Notification settings
- Dashboard widget arrangement

---

## Phase 5: Advanced Features

### Search Improvements

#### Unified Search
- Single search box for all entity types
- Auto-detect search type (IP, hash, CVE, name)
- Search suggestions and autocomplete
- Recent searches history

#### Advanced Query Language
```
type:ip country:RU first_seen:>2024-01-01
actor:lockbit sector:healthcare
cve:2024-* cvss:>=9.0 kev:true
```

#### Bulk Search
- Upload file with IOCs
- Paste multiple values
- Get consolidated results
- Export matches

### Correlation Engine

#### Automatic Linking
- Link IOCs to actors automatically
- Connect CVEs to incidents
- Identify infrastructure overlaps
- Surface hidden relationships

#### Campaign Detection
- Group related incidents
- Identify attack patterns
- Timeline reconstruction
- Attribution confidence scoring

### API & Integrations

#### REST API
- Full CRUD for all entities
- Webhook notifications
- Rate limiting and auth
- OpenAPI documentation

#### SIEM Integration
- Splunk app
- Elastic SIEM connector
- Microsoft Sentinel playbook
- QRadar integration

#### Ticketing Integration
- Jira ticket creation
- ServiceNow integration
- PagerDuty alerts
- Slack notifications

---

## Technical Debt & Improvements

### Performance
- [ ] Implement pagination properly (offset-based → cursor-based)
- [ ] Add database indexes for common queries
- [ ] Lazy load components
- [ ] Code split large bundles

### Code Quality
- [ ] Add TypeScript types
- [ ] Unit tests for utilities
- [ ] E2E tests for critical flows
- [ ] Error boundary components

### Infrastructure
- [x] Set up CI/CD pipeline (Vercel)
- [x] Automated data ingestion (GitHub Actions every 6 hours)
- [ ] Database backups
- [ ] Monitoring and alerting

---

## Quick Wins (Can Implement Immediately)

1. **Geographic heatmap** - High visual impact for dashboard
2. **Severity badges** - Color-coded CVE severity indicators
3. **"New since yesterday"** - Highlight fresh data
4. **Unified search** - Search across all data types
5. **Collapsible sidebar** - More screen real estate
6. **Keyboard shortcuts** - Power user efficiency
7. **Loading skeletons** - Better perceived performance
8. **Empty states** - Helpful messages when no data

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data freshness | < 24 hours | Time since last ingest |
| Page load time | < 2 seconds | Lighthouse score |
| Search latency | < 500ms | P95 response time |
| User engagement | > 5 min/session | Analytics |
| Data coverage | > 90% KEV | Comparison with source |

---

## Notes

- Ransomwatch data is historical (last updated June 2025)
- Consider alternative ransomware tracking sources
- MITRE ATT&CK integration would significantly enhance actor profiles
- Geographic visualization requires country data enrichment
- Email digests require email service (SendGrid, Resend, etc.)

---

*Last updated: January 2026*
*Platform: https://vigil.theintelligence.company*
*Repository: C:\Users\metac\Documents\Vigil*

---

## Completed: Differentiating Features (January 2026)

### Organization Profile & Relevance Scoring
- [x] Organization profile wizard (sector, geography, tech stack)
- [x] Relevance scoring algorithm
- [x] RelevanceBadge component
- [x] Integration in Settings page

### IOC Quick Lookup
- [x] Enhanced search with IOC type detection
- [x] External enrichment links (VirusTotal, Shodan, AbuseIPDB, etc.)
- [x] IOCQuickLookupCard component

### Actor Correlations
- [x] CorrelationPanel showing TTPs, CVEs, IOCs
- [x] Correlation queries in supabase.js

### Trend Analysis
- [x] TrendAnalysis page
- [x] Week-over-week comparison
- [x] Change summary ("what's new")
- [x] Sector trend charts
- [x] Activity trend visualization

---

## Completed: Sprint 14 Features (January 2026)

### Expanded Data Sources
- [x] Malpedia integration (864 actors, 3,638 malware families)
- [x] MISP Galaxy integration (threat-actor.json, ransomware.json)
- [x] MITRE ATT&CK intrusion-sets parsing (172 APT groups)
- [x] Automated 6-hour ingestion via GitHub Actions

### Actor Type Taxonomy
- [x] 6 actor categories: ransomware, apt, cybercrime, hacktivism, initial_access_broker, data_extortion
- [x] seed-actor-types.mjs for curated actor classification
- [x] Actor type detection logic in all ingestion scripts

### Data Sources Panel UI
- [x] DataSourcesPanel component in Settings page
- [x] Shows sync status for all 11 automated sources
- [x] Actor type distribution display
- [x] Manual update instructions for non-automated sources

### Automated Trend Calculation
- [x] calculate-trends job in GitHub Actions workflow
- [x] Calls apply_actor_trends() after ransomware ingestion
- [x] Automatic ESCALATING/STABLE/DECLINING status updates

### Bug Fixes
- [x] Fixed user_preferences 406 error (.single() → .maybeSingle())
- [x] Fixed vulnerabilities 400 error (removed non-existent severity column)
- [x] Fixed MISP Galaxy cfr.some() array check
- [x] Fixed Malpedia supabase.sql() not a function

---

## Completed: Sprint 13 Features (January 2026)

### ActorTrajectoryChart Component
- [x] Multi-actor comparison line chart
- [x] ActorTrajectoryMini for dashboard widgets
- [x] ActorSelector dropdown for choosing actors
- [x] Integration with TrendAnalysis page
- [x] Uses `trendAnalysis.getActorTrajectories(actorIds, days)` function

### AttackPathDiagram Component
- [x] Visual attack path: Actor → Technique → Vulnerability → IOC
- [x] Pure SVG/CSS implementation (no external dependency)
- [x] AttackPathMini for compact display
- [x] Uses `correlations.getAttackPath(actorId)` function

### Incident Flow Visualization
- [x] Sankey-style diagram showing Actor → Sector flows
- [x] Integrated into Incidents page
- [x] Dynamic computation from incident data
- [x] IncidentFlowSimple as fallback

### Keyboard Shortcuts
- [x] KeyboardShortcutsModal component
- [x] Press `?` to show help modal
- [x] Navigation shortcuts (g+d, g+a, g+i, etc.)
- [x] Search shortcuts (/, Cmd+K)
- [x] Interface shortcuts ([, Escape)

### Smart Time Display
- [x] TimeDisplay components (SmartTime, TimeAgo, FullDate, etc.)
- [x] Integrated across Incidents, ThreatActors, Dashboard pages
- [x] Adaptive formatting based on time distance

### ATT&CK Matrix Heatmap
- [x] AttackMatrixHeatmap toggle on Techniques page
- [x] Table/Heatmap view toggle
- [x] Tactic filtering

### Automation
- [x] Daily actor trend snapshots (snapshot-actor-trends.mjs)
- [x] Weekly summary generation (generate-weekly-summary.mjs)
- [x] GitHub Actions workflow for weekly summaries
- [x] Database migration 007 for trend tables

### Supabase Module Completeness
- [x] Added `getAll` functions for incidents, vulnerabilities, iocs, alerts
- [x] Component barrel exports updated

---

## Deferred: Future Enhancements

### Vulnerabilities "Known Actors" Section
**Status:** Deferred
**Rationale:** Most analysts start from actors, not CVEs. The actor → CVE direction (via CorrelationPanel) provides more value than CVE → actor.

### Techniques "Used By" Section
**Status:** Deferred
**Rationale:** The Techniques page (ATT&CK matrix) is already complex. Adding actor lists per technique would clutter the UI.

---

*Last updated: January 2026*
*Version: 0.4.0*

