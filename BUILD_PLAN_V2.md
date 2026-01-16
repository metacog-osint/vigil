# Vigil Build Plan v2.0

> Comprehensive development plan consolidating all roadmaps and technical debt items.
>
> **Created:** January 15, 2026
> **Status:** Planning
> **Version:** 2.19

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [What's Complete](#whats-complete)
3. [Phase A: Technical Debt & Quality](#phase-a-technical-debt--quality)
4. [Phase B: Data Source Expansion](#phase-b-data-source-expansion)
5. [Phase C: SaaS Product Features](#phase-c-saas-product-features)
6. [Phase D: Enterprise Features](#phase-d-enterprise-features)
7. [Phase E: Advanced Intelligence](#phase-e-advanced-intelligence)
8. [Performance Targets](#performance-targets)
9. [Priority Matrix](#priority-matrix)

---

## Executive Summary

This document consolidates all planned work from:
- `CORRECTIVE_ACTION_PLAN.md` - Technical debt and code quality
- `ROADMAP.md` - Product roadmap phases 7-9
- `NEXT_PHASE_PLAN.md` - Completed phase 7 work
- `DATA_SOURCES.md` - Data integration roadmap
- `SAAS_ROADMAP.md` - SaaS monetization features

### Key Stats
- **Current Version:** 1.1.0
- **Unit Tests:** 632 passing
- **Test Coverage:** 50.7% statements, 43% branches
- **E2E Tests:** 19-20 passing
- **Active Data Sources:** 29 (added Exploit-DB)
- **Component Organization:** 40 components in 6 subdirectories
- **Supabase Modules:** 25 domain-specific modules
- **Frontend Modules:** 30+ feature modules (added TAXII, predictive modeling, shadow IT, benchmarking, multi-tenancy, status page)

---

## What's Complete

### Corrective Action Plan (Phases 1-9)
| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Documentation | 90% | Minor cross-refs remaining |
| Phase 2: Constants | 95% | Shared script utils deferred |
| Phase 3: Supabase | 100% | 22 modules extracted |
| Phase 4: Components | 100% | 39 components organized |
| Phase 5: Large Pages | 100% | 6 pages refactored |
| Phase 6: Large Components | 100% | Reviewed, acceptable |
| Phase 7: CI/CD | 85% | E2E in CI deferred |
| Phase 8: Testing | 100% | 563 tests, 50.7% coverage ✅ |
| Phase 9: Performance/A11y | 85% | Audit tools needed |

### Next Phase Plan (Phase 7)
| Section | Status |
|---------|--------|
| Data Sources (Enrichment) | Complete |
| Team Features | Complete |
| Security (2FA, Sessions) | Complete |
| Performance (Offline) | Complete |
| Documentation (Help) | Complete |

### SaaS Roadmap (Phase 1)
| Feature | Status |
|---------|--------|
| Scheduled Reports | Complete |
| Alert Rules Engine | Complete |
| Usage Analytics | Complete |
| Feature Gating | Complete |

### Real-Time Alerting System (v0.3.0)
Fully documented in `ALERTING_SYSTEM.md`. Implementation status:

| Component | File | Status |
|-----------|------|--------|
| Database migration | `supabase/migrations/028_realtime_alerts.sql` | Complete |
| Push subscriptions | `src/lib/alerts.js` | Complete |
| Webhook CRUD (Slack/Discord/Teams) | `src/lib/alerts.js` | Complete |
| Email templates | `src/lib/email.js` (Resend API) | Complete |
| Alert Settings UI | `src/components/AlertSettingsSection.jsx` | Complete |
| Alert queue processor | `scripts/process-alerts.mjs` | Complete |
| Push notification handlers | `public/sw.js` | Complete |
| Fast ingestion workflow | `.github/workflows/critical-alerts-ingestion.yml` | Complete (30-min) |

Database tables: `push_subscriptions`, `alert_webhooks`, `alert_queue`, `alert_deliveries`
Database triggers: `auto_queue_incident_alert`, `auto_queue_kev_alert`

**Remaining from ALERTING_SYSTEM.md Phase 4** (see section D.2):

---

## Phase A: Technical Debt & Quality

> Items remaining from CORRECTIVE_ACTION_PLAN.md

### A.1 Documentation Cleanup (LOW PRIORITY) ✅ COMPLETE
- [x] Trim `CLAUDE.md` - remove duplicated schema/architecture content
- [x] Update `docs/DATA_INGESTION.md` to reference `DATA_SOURCES.md`
- [x] Update `README.md` to link to new docs structure
- [x] Add consistent headers and last-updated dates to all docs

### A.2 Shared Script Utilities (LOW PRIORITY) ✅ COMPLETE
- [x] Create `scripts/lib/http.mjs` with fetchJSON, fetchWithRetry, fetchWithAuth
- [x] Update ingestion scripts to use shared HTTP module
- [x] Remove inline sector classification from `ingest-ransomwatch.mjs`

### A.3 Custom Hooks (MEDIUM PRIORITY) ✅ COMPLETE
Create standardized hooks for page components:
- [x] `src/hooks/useFilters.js` - standardized filter state management, URL sync, search debounce
- [x] `src/hooks/useDataLoading.js` - data fetching with caching, pagination, infinite scroll
- [x] `src/hooks/useTableState.js` - sorting, selection, pagination, keyboard navigation
- [x] `src/hooks/index.js` - barrel export updated

### A.4 Testing Improvements (HIGH PRIORITY) - PARTIAL ✅
Unit tests for core modules:
- [x] `src/lib/supabase/threatActors.js` tests (18 tests)
- [x] `src/lib/supabase/incidents.js` tests (31 tests)
- [x] `src/lib/supabase/iocs.js` tests (49 tests)
- [x] `src/lib/ai.js` tests (69 tests)
- [x] `src/lib/analytics.js` tests (28 tests)
- [x] `src/lib/supabase.js` tests (71 tests - main exports)

E2E test expansion:
- [ ] Add Firefox browser to Playwright config
- [ ] Add Safari/WebKit browser to Playwright config
- [ ] Add mobile viewport testing
- [ ] Add watchlist management flow test
- [ ] Add export functionality test

Test infrastructure:
- [x] Add test coverage reporting to CI (Codecov integration)
- [x] Set coverage threshold (35% statements, 25% branches/functions)

### A.5 Performance & Accessibility (MEDIUM PRIORITY) ✅ MOSTLY COMPLETE
- [x] Add React.memo to expensive components
  - SeverityBadge, SeverityDot, SeverityBar, EPSSBadge (badges)
  - TrendBadge, TrendIndicator (badges)
  - StatCard (dashboard)
  - TimeAgo, SmartTime, DateBadge, FullDate, Timestamp (time displays)
- [x] Review dependencies - all necessary, no unused found
- [x] Run axe-core audit and fix critical issues
  - Added 13 accessibility E2E tests using @axe-core/playwright
  - All core pages pass: no critical a11y violations
  - All links and buttons have accessible names
  - Forms have proper labels
  - Color contrast within acceptable range for dark theme
- [x] Add keyboard handlers to remaining interactive elements
  - Added Escape key handlers to WatchButton and TagSelector
  - Added aria-expanded, aria-haspopup, aria-label attributes
  - Added role="listbox" to dropdown menus
  - Added aria-hidden to backdrop elements

### A.6 CI/CD Improvements (LOW PRIORITY) - PARTIAL ✅
- [x] Fix Malpedia/MISP Galaxy trigger conditions in `data-ingestion.yml`
  - Malpedia now uses 'malpedia' filter option
  - MISP Galaxy now uses 'misp-galaxy' filter option
  - Added 'all-actors' option to run both together
- [ ] Add E2E tests to CI pipeline
- [ ] Change `no-unused-vars` from warn to error (after cleanup)

### A.7 Ops Dashboard & Production Hardening (MEDIUM PRIORITY)
Internal operational monitoring and Stripe edge cases:

**Ops Dashboard** ✅ COMPLETE
- [x] Create internal ops dashboard (`src/pages/admin/OpsDashboard.jsx`)
- [x] Sync status monitoring (last successful ingest per source)
- [x] Error rate tracking and alerts
- [x] Data freshness monitoring (stale source detection)
- [x] Source history modal with detailed sync logs
- [x] Route at `/ops` with sidebar navigation

**Stripe Production Hardening**
- [ ] Payment failure handling (past_due status)
- [ ] Grace period logic for failed payments
- [ ] Dunning email sequence
- [ ] Access revocation timing after payment failure
- [ ] Webhook retry handling

**Tier Propagation Audit** ✅ COMPLETE
- [x] Audit all pages for proper feature gating
- [x] Added FeatureGate to Watchlists.jsx (professional: watchlist)
- [x] Added FeatureGate to ThreatHunts.jsx (professional: threat_hunts)
- [x] Added FeatureGate to BulkSearch.jsx (team: bulk_search)
- [x] Added FeatureGate to AdvancedSearch.jsx (team: advanced_search)
- [x] Added FeatureGate to AuditLogs.jsx (enterprise: audit_logs)
- [x] Verified Assets.jsx and CustomIOCs.jsx already have FeatureGate
- [ ] Test tier upgrade/downgrade flow end-to-end (manual testing)

---

## Phase B: Data Source Expansion

> Items from DATA_SOURCES.md revised rollout plan

### B.1 Critical Priority Data Sources ✅ COMPLETE
**Must-have sources for core functionality**

| Source | Script | Effort | Status |
|--------|--------|--------|--------|
| EPSS | `ingest-epss.mjs` | 3 hours | ✅ Complete |
| GitHub GHSA | `ingest-ghsa.mjs` | 4 hours | ✅ Complete |

Database changes:
- ✅ `epss_score` FLOAT exists in `vulnerabilities` table
- ✅ `epss_percentile` FLOAT exists in `vulnerabilities` table
- ✅ `advisories` table created (migration 029)
- ✅ Advisories page added to UI

### B.2 High Priority Data Sources ✅ COMPLETE
**Quick wins - free, simple JSON/text feeds**

| Source | Script | Effort | Status |
|--------|--------|--------|--------|
| Tor Exit Nodes | `ingest-tor-exits.mjs` | 2 hours | ✅ Complete |
| Firehol Level 1 | `ingest-firehol.mjs` | 2 hours | ✅ Complete |
| OpenPhish | `ingest-openphish.mjs` | 2 hours | ✅ Complete |
| C2-Tracker | `ingest-c2-tracker.mjs` | 4 hours | ✅ Complete |
| crt.sh | `ingest-crtsh.mjs` | 4 hours | ✅ Complete |
| Maltrail | `ingest-maltrail.mjs` | 3 hours | ✅ Complete |

### B.3 High-Value Additions
**Exploit and attack intelligence**

| Source | Script | Effort | Status |
|--------|--------|--------|--------|
| Exploit-DB | `ingest-exploitdb.mjs` | 6 hours | ✅ Complete |
| Blocklist.de | `ingest-blocklist-de.mjs` | 3 hours | ✅ Complete |
| Emerging Threats | `ingest-emerging-threats.mjs` | 4 hours | ✅ Complete |
| Nuclei Templates | `ingest-nuclei-templates.mjs` | 5 hours | ✅ Complete |
| Pulsedive | `ingest-pulsedive.mjs` | 4 hours | Pending (API key) |

Database changes:
- ✅ `exploits` table created (migration 031)
- ✅ Added `exploit_count`, `exploit_types`, `exploit_platforms`, `has_public_exploit` to `vulnerabilities`
- ✅ Added exploit filter and display to Vulnerabilities UI
- Add `source_feed` tracking for IOC deduplication

### B.4 DNS & Certificate Intelligence ✅ MOSTLY COMPLETE
**Domain monitoring capabilities**

| Source | Script | Effort | Status |
|--------|--------|--------|--------|
| CIRCL Passive DNS | `enrich-circl-pdns.mjs` | 6 hours | ✅ Complete |
| Censys Certificates | `ingest-censys.mjs` | 8 hours | Pending (API key) |
| Certificate Alerting | `monitor-certificates.mjs` | 6 hours | ✅ Complete (via crt.sh) |

Database changes (migration 033):
- ✅ `dns_records` table - CIRCL passive DNS data
- ✅ `certificates` table - SSL/TLS certificate tracking
- ✅ `certificate_hosts` table - IP/certificate associations
- ✅ `certificate_alerts` table - New/expiring cert alerts
- ✅ `monitored_domains` table - User domain configuration

### B.5 Enhanced Sandbox Integration
**Malware analysis expansion**

| Source | Script | Effort | Prerequisites |
|--------|--------|--------|---------------|
| ANY.RUN Public | `ingest-anyrun.mjs` | 6 hours | API key |
| Triage | `ingest-triage.mjs` | 6 hours | API key |
| Sandbox Correlation | `correlate-sandbox.mjs` | 8 hours | B.5.1 & B.5.2 |

Database changes:
- New `sandbox_reports` table

### B.6 Vulnerability Prioritization ✅ MOSTLY COMPLETE
**Risk-based vulnerability scoring**

| Source | Script | Effort | Status |
|--------|--------|--------|--------|
| VulnCheck KEV | `enrich-vulncheck.mjs` | 6 hours | Pending (API key) |
| Vulnerability Prioritization | `prioritize-vulnerabilities.mjs` | 6 hours | ✅ Complete |

Database changes (migration 035):
- ✅ `priority_score` - Weighted 0-100 score
- ✅ `priority_level` - critical/high/medium/low/info
- ✅ `priority_factors` - Breakdown of contributing factors
- [x] Add `exploit_maturity` enum to vulnerabilities (migration 039)

### B.7 Future Considerations (Backlog)

| Source | Value | Blocker |
|--------|-------|---------|
| UMD Cyber Events Database | Nation-state attribution | Registration required |
| GDELT Project | Real-time news monitoring | Complex implementation |
| IntelOwl Integration | Aggregated enrichment | Self-hosting |
| Dark Web Monitoring | Early breach warning | Complex implementation |
| Shodan Full API | Deep infrastructure intel | Paid tier |

---

## Phase C: SaaS Product Features

> Items from SAAS_ROADMAP.md Phase 2-4

### C.1 Retention & Stickiness Features

#### Investigation Notebooks Enhancement ✅ COMPLETE
Current: Basic investigations page exists
- [x] Rich text notes with markdown editor (migration 040)
- [x] Entity attachment UI improvements (InvestigationNotebook.jsx)
- [x] Timeline of investigation activity (investigation_activities table)
- [x] Investigation templates (investigation_templates table)
- [x] Export to PDF with formatting - `src/lib/investigationExport.js`

#### Attack Surface Monitoring ✅ COMPLETE
- [x] Asset inventory (domains, IPs, email domains) - Assets page + migration 017
- [x] Continuous matching against IOC feeds - monitor-assets.mjs script
- [x] Alerts when assets are mentioned - trigger + alert queue integration (migration 032)
- [ ] Breach notification (HIBP integration enhanced)
- [ ] Certificate transparency monitoring

#### Custom IOC Lists Enhancement ✅ COMPLETE
Current: CustomIOCs page exists
- [x] STIX/MISP JSON import support - `src/lib/iocImport.js`
- [x] OpenIOC XML import - `src/lib/iocImport.js`
- [x] IOC import UI in CustomIOCs page - Enhanced ImportModal with file upload
- [x] Auto-enrichment on import - `src/lib/iocImport.js` enrichment functions
- [x] Correlation with public IOCs visualization - IOCCorrelationGraph.jsx

#### Saved Searches & Views ✅ COMPLETE
Current: Basic saved searches exist with alerting
- [x] Share views with team (migration 042)
- [x] Set default view per page (user_default_views table)
- [x] Quick access from sidebar (user_pinned_views table)
- [x] View sharing permissions (saved_search_permissions table)
- [x] **Search alerting** - Notify users when saved search has new results
  - Migration 036 adds alert fields to saved_searches
  - `process-search-alerts.mjs` script for scheduled processing
  - savedSearches.js methods: enableAlert, disableAlert, getAlertHistory

### C.2 API & Webhooks ✅ COMPLETE

#### Webhook System
Current: `alert_webhooks` table and CRUD in `src/lib/alerts.js`
- [x] Webhook URL registration UI in Settings
- [x] Event type filtering UI
- [x] Retry logic with exponential backoff (in migration 024)
- [x] **Webhook testing button** - Test button in AlertSettingsSection.jsx
- [x] **Webhook delivery log viewer** - Modal with status, response codes, retries
- [x] Signature verification (HMAC) - migration 030, UI for generic webhooks

Webhook events:
```javascript
const WEBHOOK_EVENTS = [
  'incident.created',
  'actor.trend_changed',
  'vulnerability.kev_added',
  'ioc.matched_asset',
  'alert.triggered',
  'report.generated',
]
```

#### API Enhancements ✅ COMPLETE
- [x] API versioning (v2) - migration 041, api_versions table
- [x] Rate limit headers - check_api_rate_limit() function
- [x] Pagination cursors in response - api_pagination_cursors table
- [x] Bulk endpoints for efficiency - api_bulk_operations table

### C.3 Interactive Chat Bots ✅ COMPLETE
- [x] Slack interactive commands (`/vigil search`, `/vigil actor`) - `src/lib/chatBots.js`
- [x] Teams bot with card responses - Adaptive Cards formatting
- [x] Discord bot support - Embed formatting
- [x] Command handlers for search, actor, ioc, cve, stats, help
- [x] Platform-specific formatting (Slack Block Kit, Teams Adaptive Cards, Discord Embeds)

### C.4 Vendor Risk Monitoring ✅ COMPLETE
- [x] Vendor inventory management - `src/lib/vendors.js` + migration 025
- [x] Automatic breach monitoring per vendor - `monitor-vendors.mjs`
- [x] Vulnerability correlation by vendor tech - `monitor-vendors.mjs`
- [x] Risk scoring per vendor - `calculate_vendor_risk_score()` function
- [x] Vendor security questionnaire tracking - `vendor_assessments` table
- [x] Vendor management UI page - `src/pages/Vendors.jsx`

### C.5 Industry Benchmarking ✅ COMPLETE
- [x] Anonymized aggregate statistics - migration 048, `src/lib/benchmarking.js`
- [x] Sector comparison charts - `compareSectors()`, `getMetricTrend()`
- [x] Trend analysis vs industry - `calculateComparisonStatus()`, percentile ranking
- [x] Monthly benchmark reports - `benchmark_reports` table with report types
- [x] Opt-in data sharing - `benchmark_participants` table with share levels
- [x] Sector rankings - `get_sector_rankings()` function
- [x] Anonymous contribution tracking - `benchmark_contributions` table

---

## Phase D: Enterprise Features

> Items from ROADMAP.md Phase 7 and SAAS_ROADMAP.md Phase 3

### D.1 SSO & Identity ✅ COMPLETE
Current: Firebase Auth with Google SSO, SMS 2FA, TOTP

**Complete:**
- [x] SAML 2.0 support (Okta, Azure AD, OneLogin, Google Workspace, Generic SAML)
  - Full UI in `src/components/settings/SSOConfigSection.jsx` (757 lines)
  - Backend library in `src/lib/sso.js` (407 lines)
  - Database schema in `supabase/migrations/023_sso_config.sql`
  - Metadata parsing, certificate validation, provider-specific docs
- [x] OIDC integration (discovery URL, client ID, scopes)
- [x] Session management enhancements (force logout via `ssoSessions.logoutAll()`)
- [x] SMS-based 2FA in `src/components/settings/SecuritySettings.jsx` (Firebase MFA)
- [x] TOTP authenticator apps (Google Authenticator, Authy support)
  - TotpMultiFactorGenerator integration
  - QR code generation for authenticator app enrollment

**Remaining (Optional):**
- [ ] SCIM provisioning (enterprise auto user sync)

### D.2 Advanced Alerting Engine ✅ MOSTLY COMPLETE
Current: Real-time alerting infrastructure complete (see ALERTING_SYSTEM.md)

**Core Features (Complete):**
- [x] Daily/weekly digest emails - `scripts/send-daily-digest.mjs` (347 lines)
  - Personalized digests based on org profile (sector, vendors)
  - Watchlist updates included
  - Priority scoring (critical/high items)
- [x] Quiet hours implementation
  - `user_preferences`: quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
  - `get_users_for_alert()` function checks `in_quiet_hours` (migration 028:332-334)
  - `process-alerts.mjs` skips users in quiet hours unless critical (lines 103-107)
- [x] Alert deduplication logic
  - `UNIQUE(event_type, event_id)` constraint on alert_queue (migration 028:114)
  - `ON CONFLICT DO UPDATE` in queue_alert_event() function (lines 135-139)
- [x] Email, push, and webhook delivery - `process-alerts.mjs` (598 lines)

**Remaining (Optional/Enterprise):**
- [ ] Mobile app push via FCM (requires mobile app - 20 hours)

**Advanced Features (Future):**
- [x] Complex alert rule builder (AND/OR conditions) - migration 043, AlertRuleBuilder.jsx
- [x] Alert grouping and batching - alert_batch_queue table
- [x] Escalation policies - migration 044, escalationPolicies.js
- [x] On-call scheduling integration - oncall_schedules, schedule_participants tables
- [x] Alert fatigue management dashboard - AlertAnalyticsDashboard.jsx
- [x] Alert analytics dashboard (open rates, click-through) - AlertAnalyticsDashboard.jsx

### D.3 Reporting Suite Enhancement ✅ COMPLETE
Current: Scheduled reports with templates, branding, compliance sections

- [x] Executive summary templates (6 pre-built templates)
- [x] Custom report builder (drag-drop sections) - ReportBuilder.jsx
- [x] Branded report output (custom logos, colors) - Enterprise tier
- [x] Historical trend reports (historical section)
- [x] Compliance report templates (SOC 2 Summary, PCI-DSS Summary sections)

### D.4 Audit Logs & Compliance ✅ MOSTLY COMPLETE
Current: Team activity logging with compliance export

- [x] Comprehensive audit log export (CSV/JSON)
- [x] Retention configuration (30 days to 2 years)
- [x] Search and filter logs UI
- [x] Automated compliance reports (SOC 2 Type II, PCI-DSS evidence)
- [x] SOC2 evidence collection (exportComplianceReport function)

### D.5 White-Label / Multi-Tenancy ✅ COMPLETE
- [x] Custom logo and colors per tenant - migration 049, `tenant_branding` table
- [x] Custom domain (CNAME) support - `tenant_domains` table with verification
- [x] Remove Vigil branding option - `hide_powered_by` flag
- [x] Per-tenant data isolation - RLS policies on all tenant tables
- [x] Tenant management portal - `src/lib/multitenancy.js`
- [x] Tenant settings and features - `tenant_settings` table
- [x] Member management with roles - `tenant_members` (owner/admin/member/viewer)
- [x] Audit logging - `tenant_audit_log` with action tracking
- [x] Dynamic branding application - `branding.applyToDocument()` function

### D.6 SLA & Status ✅ COMPLETE
- [x] Public status page - migration 050, `src/lib/statusPage.js`
- [x] Historical uptime data - `status_uptime_records` table, `get_uptime_history()`
- [x] Incident history - `status_incidents` with updates, `status_incident_updates` table
- [x] Planned maintenance calendar - `scheduleMaintenance()`, `getScheduled()`
- [x] Service components with groups - `status_components` table with `group_name`
- [x] Real-time status monitoring - `record_status_check()`, `calculate_component_uptime()`
- [x] Subscriber notifications - `status_subscribers` with email verification
- [x] Configurable status page branding - `status_page_config` table

---

## Phase E: Advanced Intelligence

> Items from ROADMAP.md Phases 8-9

### E.1 Automated Enrichment Pipeline ✅ COMPLETE
- [x] IP reputation scoring aggregation - `aggregate-ip-reputation.mjs` + migration 037
- [x] IP reputation display in IOC details - ReputationSection in EnrichmentPanel.jsx
- [x] Domain age and registration data - `enrich-domain-whois.mjs` RDAP lookup
- [x] SSL certificate analysis - `enrich-ssl.mjs` with risk indicators
- [x] WHOIS data integration - `enrich-domain-whois.mjs`
- [x] Passive DNS history display - `enrich-passive-dns.mjs`

### E.2 Threat Scoring ✅ COMPLETE
- [x] Custom risk scoring models - `src/lib/threatScoring.js`
- [x] Industry-specific threat scores - orgProfile-based weighting
- [x] Confidence-weighted scoring - per-factor weights with normalization
- [x] Time-decay factors - exponential decay with configurable half-life
- [x] Scoring explanation UI - ScoringExplanation.jsx with gauge and breakdown

### E.3 AI-Powered Analysis Enhancement ✅ MOSTLY COMPLETE
Current: Groq-powered BLUF generation exists

- [x] Automated threat summaries per entity - EntityThreatSummary.jsx
- [x] Pattern detection across incidents - `src/lib/patternDetection.js`
- [x] Anomaly detection alerts - `detectAnomalies()` in patternDetection.js
- [x] Natural language querying - `parseNaturalQuery()` in `src/lib/ai.js`
- [x] Natural language search UI integration - SearchModal.jsx with NL mode
- [x] Predictive threat modeling - `src/lib/predictiveModeling.js`
  - Sector risk prediction with historical analysis
  - Actor activity forecasting with exponential moving average
  - Vulnerability exploitation likelihood prediction
  - Attack vector trend prediction
  - Geographic targeting predictions
  - Statistical methods: linear regression, EMA, seasonality detection

### E.4 SOAR Integration
- [ ] Playbook templates library
- [ ] Automated response action triggers
- [ ] Case management integration
- [ ] Evidence collection automation
- [ ] Integration with common SOAR platforms

### E.5 Threat Intelligence Sharing ✅ MOSTLY COMPLETE
- [x] TAXII server implementation - migration 046, `src/lib/taxii.js`
  - TAXII 2.1 protocol compliant (discovery, API roots, collections, objects, manifest)
  - Collection management with access controls
  - Object search with filtering and pagination
  - Subscription support for updates
- [x] STIX 2.1 export - `src/lib/stixExport.js`
- [x] STIX 2.1 import - `src/lib/iocImport.js`
- [ ] ISAC/ISAO integration (requires external partnerships)
- [ ] Private sharing circles (future)
- [ ] Contribution tracking (future)

### E.6 Asset Discovery ✅ COMPLETE
- [x] Asset inventory integration - Assets page exists
- [x] Attack surface mapping visualization - EntityRelationshipGraph.jsx
- [x] Vulnerability-to-asset correlation - migration 045, `correlate-vulnerabilities-assets.mjs`
- [x] Exposure scoring - `src/lib/exposureScoring.js`
- [x] Shadow IT detection - migration 047, `src/lib/shadowIT.js`
  - Discovered asset tracking with status management
  - Known cloud services database (26 pre-populated services)
  - Shadow IT detection rules engine
  - Alert generation for unapproved services
  - Approved services whitelist management
  - Risk level classification (critical/high/medium/low)

---

## Performance Targets

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| Page load (P95) | ~2.5s | <2s | HIGH |
| Search latency | ~600ms | <500ms | MEDIUM |
| Test coverage | 50.7% | 50%+ | ✅ ACHIEVED |
| Bundle size | 1.2MB | <1MB | MEDIUM |
| Data freshness | 6 hours | <6 hours | MAINTAIN |
| API response (P95) | ~500ms | <500ms | MAINTAIN |
| Uptime | 99.9% | 99.9% | MAINTAIN |

---

## Priority Matrix

### CRITICAL (Do First)
1. ~~**B.1 EPSS + GHSA**~~ ✅ COMPLETE
2. ~~**A.4 Testing**~~ ✅ COMPLETE - 50.7% coverage achieved
3. ~~**C.2 Webhooks**~~ ✅ COMPLETE

### HIGH PRIORITY
1. ~~**B.2 Quick Win Data Sources**~~ ✅ COMPLETE (all 6 sources)
2. ~~**B.3 Exploit-DB**~~ ✅ COMPLETE - CVE exploit correlation
3. ~~**C.1 Attack Surface Monitoring**~~ ✅ COMPLETE - Asset monitoring + alerts
4. ~~**D.1 SSO/SAML**~~ ✅ COMPLETE (SCIM optional)

### MEDIUM PRIORITY
1. ~~**A.7 Ops Dashboard**~~ ✅ COMPLETE - Internal operational visibility
2. ~~**A.7 Tier Propagation Audit**~~ ✅ COMPLETE - Proper feature gating
3. ~~**A.3 Custom Hooks**~~ ✅ COMPLETE - Code maintainability
4. ~~**A.5 Performance/A11y**~~ ✅ MOSTLY COMPLETE - React.memo + axe-core audit
5. ~~**D.2 Advanced Alerting**~~ ✅ MOSTLY COMPLETE - Digests, quiet hours, dedup
6. ~~**B.4 DNS Intelligence**~~ ✅ MOSTLY COMPLETE - CIRCL PDNS, crt.sh monitoring

### LOW PRIORITY (Backlog)
1. ~~**A.1 Documentation Cleanup**~~ ✅ COMPLETE
2. ~~**A.2 Script Utilities**~~ ✅ COMPLETE
3. ~~**B.3 Blocklist.de**~~ ✅ COMPLETE
4. **B.7 Future Data Sources** - After demand
5. ~~**D.5 White-Label**~~ ✅ COMPLETE
6. ~~**D.6 Status Page**~~ ✅ COMPLETE
7. ~~**E.6 Asset Discovery**~~ ✅ COMPLETE

### ENTERPRISE FEATURES (Complete)
1. ~~**C.3 Interactive Chat Bots**~~ ✅ COMPLETE
2. ~~**C.5 Industry Benchmarking**~~ ✅ COMPLETE
3. ~~**E.5 TAXII Server**~~ ✅ COMPLETE
4. ~~**E.3 Predictive Modeling**~~ ✅ COMPLETE

---

## Environment Variables Required

### New Keys by Phase

| Phase | Source | Variable |
|-------|--------|----------|
| B.1 | EPSS | None required |
| B.1 | GitHub GHSA | `GITHUB_TOKEN` (optional, higher rate limits) |
| B.3 | Pulsedive | `PULSEDIVE_API_KEY` |
| B.4 | CIRCL | `CIRCL_API_KEY` |
| B.4 | Censys | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| B.5 | ANY.RUN | `ANYRUN_API_KEY` |
| B.5 | Triage | `TRIAGE_API_KEY` |
| B.6 | VulnCheck | `VULNCHECK_API_KEY` |

### Stripe Keys (Already Documented)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_STRIPE_PRICE_PRO_MONTHLY=price_xxx
VITE_STRIPE_PRICE_PRO_ANNUAL=price_xxx
VITE_STRIPE_PRICE_TEAM_MONTHLY=price_xxx
VITE_STRIPE_PRICE_TEAM_ANNUAL=price_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Success Metrics

### Product Metrics (6-Month Targets)
| Metric | Target |
|--------|--------|
| Registered Users | 500 |
| Paying Customers | 50 |
| MRR | $5,000 |
| DAU/MAU Ratio | 30% |
| Churn Rate | <5%/mo |

### Feature Adoption (12-Month Targets)
| Feature | Success Indicator |
|---------|-------------------|
| Scheduled Reports | >50% of paid users configure |
| Alert Rules | Avg 3+ rules per paid user |
| Watchlists | Avg 5+ items per user |
| Team Collaboration | >30% of teams have 3+ members |
| API Usage | >20% of Team+ users active |

---

## Document References

- `CORRECTIVE_ACTION_PLAN.md` - Original technical debt tracking
- `ROADMAP.md` - Product roadmap phases 7-9
- `NEXT_PHASE_PLAN.md` - Completed phase 7 items
- `DATA_SOURCES.md` - Detailed data source documentation
- `SAAS_ROADMAP.md` - SaaS monetization strategy
- `ALERTING_SYSTEM.md` - Real-time alerting architecture and implementation status
- `CHANGELOG.md` - Version history
- `FEATURES.md` - Current feature documentation

---

## Changelog

### v2.19 (January 16, 2026)
- ✅ E.5 TAXII 2.1 Server Implementation
  - Created migration 046_taxii_server.sql
  - Added `taxii_api_roots`, `taxii_collections`, `taxii_objects` tables
  - Added `taxii_manifests`, `taxii_status`, `taxii_subscriptions` tables
  - Created `src/lib/taxii.js` module with full TAXII 2.1 protocol support
  - Functions: discovery, API root info, collections, objects, manifest, status
  - Collection management with access controls (read/write permissions)
  - Object search with type and version filtering
  - Subscription support for collection updates
- ✅ E.3 Predictive Threat Modeling
  - Created `src/lib/predictiveModeling.js`
  - Sector risk prediction with historical incident analysis
  - Actor activity forecasting using exponential moving average
  - Vulnerability exploitation likelihood scoring
  - Attack vector trend prediction
  - Geographic targeting predictions
  - Statistical methods: linear regression, EMA, seasonality detection
  - Threat forecast generation with recommendations
- ✅ E.6 Shadow IT Detection
  - Created migration 047_shadow_it_detection.sql
  - Added `discovered_assets` table for tracking unknown assets
  - Added `known_cloud_services` with 26 pre-populated services
  - Added `shadow_it_rules` for custom detection rules
  - Added `shadow_it_alerts` for rule-triggered alerts
  - Added `approved_services` whitelist management
  - Created `src/lib/shadowIT.js` module
  - Functions: `analyzeForShadowIT()`, `batchAnalyze()`, rules CRUD
  - Risk level classification (critical/high/medium/low/unknown)
- ✅ C.3 Interactive Chat Bot Handlers
  - Created `src/lib/chatBots.js`
  - Platform support: Slack, Microsoft Teams, Discord
  - Commands: /search, /actor, /ioc, /cve, /stats, /help
  - Slack Block Kit formatting with rich message layouts
  - Microsoft Teams Adaptive Cards support
  - Discord Embed formatting
  - Command parsing with argument extraction
- ✅ C.5 Industry Benchmarking System
  - Created migration 048_industry_benchmarking.sql
  - Added `benchmark_metrics` for aggregated sector statistics
  - Added `benchmark_participants` for opt-in tracking
  - Added `benchmark_contributions` for anonymized data
  - Added `benchmark_reports` for published reports
  - Created `src/lib/benchmarking.js` module
  - Functions: participation opt-in/out, sector benchmarks, rankings
  - Comparison helpers: percentile calculation, status determination
  - Trend analysis: `getMetricTrend()`, `compareSectors()`
  - Minimum participant thresholds for anonymity (3+ orgs)
- ✅ D.5 White-Label / Multi-Tenancy System
  - Created migration 049_white_label_multitenancy.sql
  - Added `tenants` table with plan/status/limits
  - Added `tenant_branding` for custom logos, colors, fonts
  - Added `tenant_domains` with verification support
  - Added `tenant_settings` for features and compliance
  - Added `tenant_members` with role hierarchy
  - Added `tenant_audit_log` for action tracking
  - Created `src/lib/multitenancy.js` module
  - Functions: tenant CRUD, branding management, domain verification
  - Member management with invitations and role updates
  - Dynamic CSS variable injection for branding
  - Domain-based tenant resolution
- ✅ D.6 Public Status Page
  - Created migration 050_public_status_page.sql
  - Added `status_page_config` for page customization
  - Added `status_components` with grouping support
  - Added `status_incidents` with impact/status tracking
  - Added `status_incident_updates` for timeline
  - Added `status_uptime_records` for historical data
  - Added `status_subscribers` for notifications
  - Created `src/lib/statusPage.js` module
  - Functions: components CRUD, incidents management, uptime monitoring
  - Status calculation: overall status from component states
  - Uptime history and trend visualization helpers
  - Subscriber management with verification
- Database migrations: 046-050 (5 new migrations)
- Frontend modules: 6 new feature modules
- All 632 unit tests passing
- Build successful with all new modules

### v2.18 (January 16, 2026)
- ✅ D.2 Escalation Policies & On-Call Scheduling
  - Created migration 044_escalation_policies.sql
  - Added `escalation_policies` table with multi-level escalation chains
  - Added `escalation_levels` and `escalation_targets` tables
  - Added `oncall_schedules` with daily/weekly rotation support
  - Added `schedule_participants` and `schedule_overrides`
  - Added `alert_escalations` tracking with acknowledgment/resolution
  - Created `src/lib/supabase/escalationPolicies.js` module
  - Functions: `get_current_oncall()`, `process_escalation()`, `acknowledge_escalation()`, `resolve_escalation()`
- ✅ D.2 Alert Analytics Dashboard
  - Created AlertAnalyticsDashboard.jsx component
  - Alert fatigue scoring with health indicators
  - Channel effectiveness metrics (email, push, webhook, Slack, etc.)
  - Response time tracking by severity
  - Noisy rules detection and review
  - Alert volume trends visualization
  - Open rate and click-through analytics
- ✅ E.3 Pattern Detection Module
  - Created `src/lib/patternDetection.js`
  - Actor-sector targeting pattern detection
  - Actor-technique usage pattern detection
  - Temporal clustering (activity burst detection)
  - Geographic targeting pattern detection
  - Campaign detection (related incident grouping)
  - Anomaly detection with statistical analysis
  - Pattern recommendations generation
- ✅ E.6 Vulnerability-to-Asset Correlation
  - Created `scripts/correlate-vulnerabilities-assets.mjs`
  - Matches vulnerabilities to assets by vendor, product, CPE
  - Correlation scoring with confidence levels
  - Automatic alert generation for critical findings
  - Created migration 045_vulnerability_asset_correlation.sql
  - Added `asset_vulnerability_correlations` table
  - Added exposure tracking fields to assets table
  - Added `asset_exposure_history` for trending
  - Functions: `calculate_asset_exposure()`, `get_exposed_assets()`
- ✅ E.6 Exposure Scoring Module
  - Created `src/lib/exposureScoring.js`
  - Asset exposure scoring with vulnerability weights
  - Organization-wide exposure calculation
  - Exposure level thresholds (critical/high/medium/low/none)
  - Asset criticality multipliers
  - Exposure trend tracking over time
  - Automated remediation recommendations
- ✅ C.1 Investigation PDF Export
  - Created `src/lib/investigationExport.js`
  - HTML report generation with print-to-PDF support
  - Markdown rendering in notes
  - Includes: notes, activity, checklist, comments, entities
  - Custom branding support (logo, colors)
  - JSON export for data backup
  - Clipboard copy for quick sharing
- Added npm script: `correlate:vuln-assets`
- Updated components/index.js with AlertAnalyticsDashboard exports
- Supabase modules: 25 total (added escalationPolicies.js)

### v2.17 (January 16, 2026)
- ✅ B.6 Exploit Maturity Enum
  - Created migration 039_exploit_maturity.sql with enum type
  - Added `exploit_maturity` field to vulnerabilities table
  - Added `exploit_maturity_date`, `exploit_sources` tracking
  - Updated priority scoring to include exploit maturity
- ✅ C.1 Investigation Notebooks Enhancement
  - Created migration 040_investigation_notebooks.sql
  - Added markdown notes, templates, activity timeline
  - Added `investigation_activities`, `investigation_comments`, `investigation_checklist` tables
  - Added priority, due date, assignment tracking
  - Created InvestigationNotebook.jsx component with tabs
- ✅ C.2 API Enhancements
  - Created migration 041_api_enhancements.sql
  - Added API versioning (v1, v2) with sunset tracking
  - Added rate limit tracking per API key (minute/day windows)
  - Added bulk operation tracking for async exports
  - Added pagination cursor support for stable pagination
- ✅ C.1 Saved View Sharing
  - Created migration 042_saved_view_sharing.sql
  - Added view sharing with team/user permissions
  - Added default view per page, pinned views
  - Added `share_saved_search()`, `toggle_pin_view()` functions
- ✅ D.2 Alert Rule Builder
  - Created migration 043_alert_rule_builder.sql
  - Complex AND/OR/NOT conditions with nested groups
  - Alert batching with configurable windows
  - Cooldown tracking per entity
  - Created AlertRuleBuilder.jsx visual builder component
- ✅ D.3 Custom Report Builder
  - Created ReportBuilder.jsx with drag-drop sections
  - Supports: title, summary, metrics, charts, tables, text, images
  - Schedule configuration (daily/weekly/monthly)
  - Data source binding and column selection
- ✅ E.2 Threat Scoring Module
  - Created `src/lib/threatScoring.js`
  - Scoring functions for actors, vulnerabilities, IOCs, incidents
  - Configurable weights with normalization
  - Time decay factors for recency
  - Created ScoringExplanation.jsx with score gauge and factor breakdown
- ✅ E.3 Entity Threat Summaries
  - Created EntityThreatSummary.jsx component
  - AI-powered summaries using Groq llama-3.3-70b
  - Template-based fallback when API unavailable
  - Risk indicators and recommendations
- ✅ E.5 STIX Export
  - Created `src/lib/stixExport.js`
  - Converts IOCs, actors, vulnerabilities, incidents to STIX 2.1
  - Creates STIX bundles with proper identities
  - Download function for JSON export
- ✅ C.1 IOC Correlation Visualization
  - Created IOCCorrelationGraph.jsx with force-directed layout
  - Node types: IOC, actor, malware, campaign, vulnerability
  - Interactive legend and node details panel
  - Search/filter and zoom controls
- ✅ E.6 Entity Relationship Graph
  - Created EntityRelationshipGraph.jsx
  - Hierarchical and circular layouts
  - Relationship types: attributed_to, uses, targets, exploits
  - Entity filtering and search
- ✅ C.1 Bulk IOC Import UI
  - Created BulkIOCImport.jsx component
  - Paste or upload IOCs with auto-detection
  - Preview with type correction
  - Defanging support (hxxp, [.])
  - Source/confidence/tags configuration
- ✅ E.1 Domain Enrichment
  - Created `scripts/enrich-domain-whois.mjs` for RDAP/WHOIS
  - Created `scripts/enrich-ssl.mjs` for SSL certificate analysis
  - Created `scripts/enrich-passive-dns.mjs` for DNS analysis
  - Domain age risk scoring (suspicious if < 30 days)
  - SSL indicators: self-signed, expired, domain mismatch
  - DNS indicators: DGA patterns, fast-flux, bulletproof hosting
- ✅ C.1 Auto-enrichment on IOC Import
  - Enhanced `src/lib/iocImport.js` with enrichment functions
  - Shodan InternetDB for IPs
  - DNS lookup for domains
  - File hash checks (placeholder for VirusTotal)
- Added npm scripts: `enrich:domain-whois`, `enrich:ssl`, `enrich:passive-dns`

### v2.16 (January 16, 2026)
- ✅ A.4 AI Module Tests
  - Added 69 unit tests for `src/lib/ai.js`
  - Tests for `generateBLUF()`, `generateActorSummary()`, `parseNaturalQuery()`, `queryToFilters()`
  - Covers API key handling, Groq API calls, error handling, throttling
  - Comprehensive keyword parsing tests for fallback mode
  - Entity type, sector, severity, trend, IOC type detection tests
- ✅ E.3 Natural Language Search UI
  - Enhanced SearchModal.jsx with natural language query detection
  - Added `isNaturalLanguageQuery()` function for NL detection
  - Purple-themed NL mode indicator with AI badge
  - Displays interpreted filters (type, trend, severity, sectors, actor)
  - Supports queries like "show escalating actors" or "critical CVEs with exploits"
  - Falls back to keyword parsing when Groq API unavailable

### v2.15 (January 16, 2026)
- ✅ E.1 IP Reputation Aggregation
  - Created `aggregate-ip-reputation.mjs` with multi-source reputation scoring
  - Source weights: cisa_kev (25), blocklist_de (15), emerging_threats (15), etc.
  - Migration 037 adds `reputation_score`, `reputation_level`, `reputation_factors` to IOCs
  - Reputation levels: malicious (70+), suspicious (50-70), risky (30-50), low_risk, unknown
- ✅ C.4 Vendor Risk Monitoring Integration
  - Created `monitor-vendors.mjs` for automated breach/vulnerability monitoring
  - Integrates with existing migration 025 (vendors, vendor_risk_events, vendor_assessments)
  - UI already complete in `src/pages/Vendors.jsx`
- ✅ C.1 STIX/MISP/OpenIOC Import Library
  - Created `src/lib/iocImport.js` with format detection and parsing
  - Supports STIX 2.1 bundles, MISP JSON events, OpenIOC XML
  - Auto-mapping of indicator types to internal IOC format
  - Database import with duplicate handling
- ✅ E.3 Natural Language Query Parsing
  - Added `parseNaturalQuery()` to `src/lib/ai.js` using Groq llama-3.1-8b-instant
  - Keyword fallback for when API key not available
  - Parses queries like "show me ransomware in healthcare" to structured filters
  - Added `queryToFilters()` for Supabase filter conversion
- ✅ C.1 IOC Import UI Enhancement
  - Enhanced ImportModal with file upload support
  - Added paste modes for STIX 2.1 and MISP JSON formats
  - Drag-and-drop file upload for STIX/MISP/OpenIOC files
  - Auto-format detection and parsing preview
- Fixed duplicate vendor files (removed conflicting migration 038 and supabase/vendors.js)
- Updated monitor-vendors.mjs to use correct table names from migration 025

### v2.14 (January 16, 2026)
- ✅ B.3 Emerging Threats Data Source
  - Created `ingest-emerging-threats.mjs` with 5 feed types
  - Supports block_ips, compromised, tor_exit, botcc, ciarmy feeds
  - Multiple parser modes for IP lists, rules files, PIX rules
- ✅ B.3 Nuclei Templates Integration
  - Created `ingest-nuclei-templates.mjs` for Project Discovery templates
  - CVE-to-template mapping for vulnerability detection coverage
  - Migration 034 adds `has_nuclei_template`, `nuclei_templates` fields
- ✅ B.6 Vulnerability Prioritization
  - Created `prioritize-vulnerabilities.mjs` with weighted scoring
  - EPSS (35%) + CVSS (20%) + KEV (20%) + Exploit (15%) + Recency (10%)
  - Migration 035 adds `priority_score`, `priority_level`, `priority_factors`
  - Priority levels: critical (70+), high (50-70), medium (30-50), low (15-30), info
- ✅ C.1 Search Alerting
  - Migration 036 adds alerting fields to saved_searches
  - Created `process-search-alerts.mjs` for saved search monitoring
  - Supports realtime, hourly, daily, weekly alert frequencies
  - Updated savedSearches.js with alert management methods
  - New `search_alert_history` table for tracking notifications
- ✅ A.6 CI/CD Workflow Fix
  - Fixed Malpedia trigger: now uses 'malpedia' filter instead of 'mitre'
  - Fixed MISP Galaxy trigger: now uses 'misp-galaxy' filter
  - Added 'all-actors' option to run both actor sources together
  - Added Malpedia and MISP Galaxy to notification job dependencies

### v2.13 (January 16, 2026)
- ✅ A.1 Documentation Cleanup
  - Trimmed CLAUDE.md - removed duplicated schema/data source content
  - Added cross-references to DATA_SOURCES.md and docs/DATA_INGESTION.md
  - Added last-updated headers to documentation files
- ✅ A.2 Script Utilities
  - Created `scripts/lib/http.mjs` with fetchJSON, postJSON, fetchWithRetry, fetchWithAuth
  - Updated ingest-ransomlook.mjs, ingest-threatfox.mjs, ingest-ransomwatch.mjs to use shared module
  - Removed inline sector classification from ingest-ransomwatch.mjs (uses shared module)
- ✅ D.1 TOTP Authenticator Support - **NOW COMPLETE**
  - Added TOTP enrollment to SecuritySettings.jsx with TotpMultiFactorGenerator
  - QR code generation for Google Authenticator, Authy, etc.
  - Method selection modal (TOTP vs SMS)
  - Updated enrolled factors display to show TOTP type
- ✅ D.3 Reporting Suite Enhancement
  - Added 6 pre-built report templates (Executive, Security Ops, Threat Intel, Compliance, Vulnerability, Custom)
  - Added compliance report sections (SOC 2 Summary, PCI-DSS Summary, Historical Trends)
  - Added enterprise branding options (logo URL, primary color)
  - Template selection flow in report creation modal
- ✅ D.4 Audit Logs & Compliance
  - Added compliance export (SOC 2 and PCI-DSS evidence reports)
  - Added retention configuration UI (30 days to 2 years)
  - Added settings modal with event type filtering
  - Added compliance note about retention requirements
- ✅ B.4 DNS Intelligence
  - Created migration 033_dns_intelligence.sql (dns_records, certificates, certificate_hosts, certificate_alerts, monitored_domains)
  - Created enrich-circl-pdns.mjs for CIRCL Passive DNS enrichment
  - Created monitor-certificates.mjs for Certificate Transparency monitoring via crt.sh
- ✅ B.7 Blocklist.de Data Source
  - Created ingest-blocklist-de.mjs with 10 feed types (SSH, Apache, mail, bots, etc.)
  - Batch processing with rate limiting
  - Support for selective feed ingestion

### v2.12 (January 16, 2026)
- ✅ D.1 SSO/SAML audit - discovered implementation is ~85% complete
  - SAML 2.0: Full UI (757 lines) + library (407 lines) + migration
  - Supports: Okta, Azure AD, Google Workspace, OneLogin, Generic SAML
  - OIDC: Discovery URL, Client ID, Scopes configuration
  - Session management: Force logout via ssoSessions.logoutAll()
  - SMS 2FA: Firebase MFA enrollment/unenrollment
  - **Remaining only:** SCIM provisioning, TOTP authenticator apps
- ✅ A.5 Performance/A11y improvements
  - Added React.memo to 11 frequently-rendered components:
    - SeverityBadge, SeverityDot, SeverityBar, EPSSBadge
    - TrendBadge, TrendIndicator
    - StatCard
    - TimeAgo, SmartTime, DateBadge, FullDate, Timestamp
  - Added 13 accessibility E2E tests using @axe-core/playwright
  - All core pages pass a11y audit (no critical violations)
  - Installed @axe-core/playwright package
- ✅ D.2 Advanced Alerting audit - discovered implementation is ~90% complete
  - Daily digest emails: `send-daily-digest.mjs` (347 lines)
  - Quiet hours: user_preferences + get_users_for_alert() + process-alerts.mjs
  - Alert deduplication: UNIQUE constraint + ON CONFLICT DO UPDATE
  - **Remaining only:** Mobile FCM push (requires mobile app)

### v2.11 (January 16, 2026)
- ✅ A.4 Testing COMPLETE: 563 tests, 50.7% coverage 🎯
  - Enhanced apiKeys.test.js with CRUD tests (51 tests total)
  - Enhanced integrations.test.js with CRUD tests (61 tests total)
  - Enhanced customIocs.test.js with CRUD tests (72 tests total)
  - Added relativeTime tests to utils.test.js (+13 tests)
  - Module coverage improvements:
    - apiKeys.js: 29% → 89%
    - integrations.js: 19% → 46%
    - customIocs.js: 38% → 68%
    - utils.js: 67% → 99%
  - Total tests increased from 489 to 563 (+74 tests)
  - **50% coverage target achieved!**

### v2.10 (January 16, 2026)
- ✅ A.4 Testing Progress: 489 tests, 42% coverage
  - Added vulnerabilities.test.js (25 tests)
  - Added watchlists.test.js (13 tests)
  - Added alerts.test.js (14 tests)
  - Added trendAnalysis.test.js (18 tests)
  - Supabase modules now at 97.72% coverage
  - Total tests increased from 419 to 489 (+70 tests)

### v2.9 (January 15, 2026)
- ✅ Partial A.5: Accessibility Improvements
  - Added Escape key handlers to WatchButton and TagSelector dropdowns
  - Added ARIA attributes (aria-expanded, aria-haspopup, aria-label)
  - Added role="listbox" to dropdown menus
  - Added aria-hidden to backdrop elements
  - Reviewed dependencies - no unused found
  - Bundle size: 513 kB main chunk (gzip: 145 kB)

### v2.8 (January 15, 2026)
- ✅ Completed A.7: Tier Propagation Audit
  - Added FeatureGate to Watchlists.jsx (professional: watchlist)
  - Added FeatureGate to ThreatHunts.jsx (professional: threat_hunts)
  - Added FeatureGate to BulkSearch.jsx (team: bulk_search)
  - Added FeatureGate to AdvancedSearch.jsx (team: advanced_search)
  - Added FeatureGate to AuditLogs.jsx (enterprise: audit_logs)
  - Verified Assets.jsx and CustomIOCs.jsx already have FeatureGate
  - All paid features now properly gated with upgrade prompts

### v2.7 (January 15, 2026)
- ✅ Completed A.7: Ops Dashboard
  - Created src/pages/admin/OpsDashboard.jsx with full operational monitoring
  - Enhanced src/lib/supabase/syncLog.js with ops queries (getStatusSummary, getErrorRates, getDataFreshness)
  - Added summary stats (total syncs, success/fail rates, healthy/stale sources)
  - Added data sources table with status badges and history modal
  - Added recent errors panel with timestamps
  - Added stale source warnings (>24 hours since last sync)
  - Added route at /ops with sidebar navigation

### v2.6 (January 15, 2026)
- ✅ Completed A.3: Custom Hooks
  - Created useFilters.js with URL sync, search debounce, date range filtering
  - Created useDataLoading.js with caching, pagination, infinite scroll support
  - Created useTableState.js with sorting, selection, pagination, keyboard nav
  - Updated hooks/index.js barrel export

### v2.5 (January 15, 2026)
- ✅ Completed C.1: Attack Surface Monitoring
  - Created supabase/assets.js module with CRUD operations
  - Created monitor-assets.mjs script for scheduled monitoring
  - Created migration 032_asset_monitoring.sql with increment function and alert trigger
  - Integrated with existing alert queue system (ioc.matched_asset events)
  - Added asset monitoring to CI workflow
  - Supabase modules: 24 total

### v2.4 (January 15, 2026)
- ✅ Completed B.3: Exploit-DB Integration
  - Created ingest-exploitdb.mjs script (GitLab mirror CSV)
  - Created migration 031_exploit_db.sql
  - Added exploits table with CVE correlation
  - Added exploit fields to vulnerabilities table
  - Updated Vulnerabilities page with exploit filter and display
  - Added Exploit-DB to CI workflow (weekly on Mondays)
  - Data sources: 29 total

### v2.3 (January 15, 2026)
- ✅ A.4 Testing improvements (partial)
  - Added 197 new tests (222 → 419 total)
  - Created iocs.test.js (49 tests)
  - Created analytics.test.js (28 tests)
  - Created supabase.test.js (71 tests for main exports)
  - Added test coverage reporting to CI (Codecov)
  - Configured coverage thresholds (35% statements, 25% branches)
  - Coverage: 36% statements, 31% branches

### v2.2 (January 15, 2026)
- ✅ Completed B.1: EPSS + GHSA integration
  - Created ingest-epss.mjs and ingest-ghsa.mjs scripts
  - Created Advisories page and supabase module
  - Added EPSS display to Vulnerabilities page
- ✅ Completed C.2: Webhooks
  - Added webhook test button to AlertSettingsSection
  - Added webhook delivery log viewer modal
  - Added HMAC signature verification (migration 030)
- ✅ Completed B.2: Quick Win Data Sources (6/6)
  - Created ingest-tor-exits.mjs (Tor exit nodes)
  - Created ingest-firehol.mjs (Firehol Level 1)
  - Created ingest-openphish.mjs (OpenPhish phishing URLs)
  - Created ingest-c2-tracker.mjs (Cobalt Strike, Metasploit, etc.)
  - Created ingest-maltrail.mjs (Malware indicators)
  - Created ingest-crtsh.mjs (Certificate transparency)
  - Added all to CI workflow

### v2.1 (January 15, 2026)
- Added Real-Time Alerting System to "What's Complete" section with full detail from ALERTING_SYSTEM.md
- Added database triggers (`auto_queue_incident_alert`, `auto_queue_kev_alert`) documentation
- Added A.7: Ops Dashboard & Production Hardening (from other session review)
- Added Search Alerting to C.1 Saved Searches
- Added Webhook Testing Button and Delivery Log Viewer to C.2
- Updated D.2 with remaining ALERTING_SYSTEM.md Phase 4 items (digests, quiet hours, deduplication)
- Added ALERTING_SYSTEM.md to document references
- Updated Priority Matrix with new items

### v2.0 (January 15, 2026)
- Initial consolidated build plan from all roadmap documents

---

*Last Updated: January 16, 2026*
*Next Review: After completing Phase E Advanced Intelligence or customer feedback*
