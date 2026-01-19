# Changelog

All notable changes to Vigil are documented in this file.

---

## [0.4.2] - January 18, 2026

### Bug Fixes

**Critical Production Fixes:**
- Fixed "Cannot access 'T' before initialization" crash caused by circular chunk dependencies in Vite build
- Fixed "Multiple GoTrueClient instances" warning by consolidating to single Supabase client
- Fixed CSP blocking world map data from cdn.jsdelivr.net
- Fixed `vulnerabilities.published_date does not exist` error (changed to `created_at`)
- Fixed service worker failing to cache partial (206) responses

**Code Quality:**
- Consolidated Supabase client creation to single source (`src/lib/supabase/client.js`)
- `src/lib/supabase.js` now re-exports from centralized client instead of creating duplicate
- Added graceful 404 handling for optional tables (analytics_events, mitre_techniques)
- Updated deprecated `apple-mobile-web-app-capable` meta tag

**Database:**
- Created migration `067_analytics_and_techniques.sql` with:
  - `analytics_events` table for user analytics
  - `mitre_techniques` table for MITRE ATT&CK data

**Vite Configuration:**
- Simplified chunk splitting to avoid circular dependencies
- Combined react/recharts/d3 into single vendor chunk

**Vercel Configuration:**
- Renamed `api/lib/` to `api/_lib/` to prevent files being deployed as serverless functions
- Added `https://cdn.jsdelivr.net` to CSP connect-src

**Documentation:**
- Added "Critical Patterns & Common Pitfalls" section to CLAUDE.md
- Documented single Supabase client pattern
- Documented optional table handling pattern
- Documented Vite chunk configuration gotchas
- Documented API lib directory naming convention

---

## [1.2.1] - January 18, 2026

### Architecture Improvements

Comprehensive architectural improvements addressing 11 critical issues identified during code review.

**Infrastructure:**
- Redis-based distributed rate limiting via Upstash Redis (replaces in-memory rate limiting that didn't work across Vercel Edge instances)
- Sentry error tracking integration with source maps and user context
- Environment variable validation on startup with clear error messages
- Exponential backoff retry logic for API calls

**API Enhancements:**
- API key rotation mechanism with configurable grace period
- Rotation warning headers (`X-API-Key-Deprecated`, `X-API-Key-Expires`)
- Database migration `063_api_key_rotation.sql` with rotation functions

**Developer Experience:**
- Standardized `LoadingState` component for consistent loading/error/empty states
- `withRetry()` utility for resilient API calls
- State management documentation (`docs/STATE_MANAGEMENT.md`)
- Real-time subscription audit confirming proper cleanup in all components

**Code Quality:**
- Component tests for TrendBadge, SeverityBadge, ErrorBoundary, LoadingState (96 new tests)
- Test utilities in `src/test/utils.jsx`
- All 727 tests passing

**Bundle Optimization:**
- Improved Vite code splitting (vendor-react, vendor-charts, vendor-supabase, vendor-sentry, vendor-firebase, vendor-dates)
- Bundle analyzer configuration (`vite.config.analyze.js`)
- ES2020 target for smaller bundles

**New Files:**
- `api/lib/rateLimit.js` - Distributed rate limiting
- `src/lib/sentry.js` - Error tracking
- `src/lib/retry.js` - Retry utility
- `src/lib/env.js` - Environment validation
- `src/components/common/LoadingState.jsx` - Loading states
- `docs/STATE_MANAGEMENT.md` - State patterns

**Documentation:**
- `ARCHITECTURE_IMPROVEMENTS.md` - Detailed plan and implementation status

---

## [1.2.0] - January 2026

### Infrastructure - Cloudflare Workers Migration

Migrated all data ingestion from GitHub Actions to Cloudflare Workers for improved reliability and reduced latency.

**New Architecture:**
- 15 threat intel feeds running on Cloudflare Workers with Cron Triggers
- Edge-based execution for faster response times
- Automatic retries and error handling
- Reduced dependency on GitHub Actions minutes

**Worker Schedules:**
| Schedule | Feeds |
|----------|-------|
| Every 30 min | Ransomlook, CISA KEV, ThreatFox, Feodo, URLhaus |
| Every 6 hours | NVD, VulnCheck, EPSS |
| Daily (00:00 UTC) | Malpedia, MISP Galaxy, MITRE ATT&CK |
| Daily (06:00 UTC) | MalwareBazaar, Tor Exits |
| Daily (12:00 UTC) | Pulsedive, Censys |

**Feeds Fixed:**
- CISA KEV: Updated schema mapping (removed non-existent columns)
- NVD: Moved `references` to metadata (SQL reserved keyword issue)
- VulnCheck: Fixed array handling for `cve` field, added pagination limits
- Ransomlook: Fixed column names (`actor_id`, `victim_sector`), date parsing
- Malpedia/MISP/MITRE: Fixed `actor_type` column, array normalization
- ThreatFox/URLhaus/MalwareBazaar: Added `Auth-Key` header for abuse.ch APIs

**Database Migrations:**
- `053_fix_alert_triggers.sql` - Fixed incident alert trigger column references
- `054_fix_changelog_vulnerabilities.sql` - Updated changelog for TEXT primary keys
- `055_disable_vuln_changelog.sql` - Disabled changelog for vulnerabilities table

**Environment:**
- Added `ABUSECH_API_KEY` to Cloudflare secrets (required for abuse.ch APIs)
- Worker deployed at: `vigil-ingest.theintelligencecompany.workers.dev`

---

## [1.1.0] - January 2026

### Code Quality - Large Page Refactoring
Major refactoring of 6 large page components for improved maintainability:

| Page | Before | After | Reduction |
|------|--------|-------|-----------|
| ThreatActors.jsx | 1,604 lines | 450 lines | 72% |
| Incidents.jsx | 1,395 lines | 543 lines | 61% |
| Assets.jsx | 911 lines | 282 lines | 69% |
| Investigations.jsx | 901 lines | 206 lines | 77% |
| CustomIOCs.jsx | 849 lines | 325 lines | 62% |
| Settings.jsx | 753 lines | 360 lines | 52% |

Each page now has extracted modules in dedicated subdirectories with:
- Custom React hooks for data loading and actions
- Extracted modal components
- Extracted table/list view components
- Separated constants and utility functions

### Testing Improvements
- Added 48 new unit tests for `customIocs.js` module
- Added E2E tests for Vulnerabilities, Incidents, and IOC Search pages
- Total: 222 unit tests passing

### Accessibility Improvements
- Added skip-to-content link for keyboard navigation
- Added ARIA labels to all icon buttons
- Added `aria-expanded`/`aria-haspopup` to dropdown menus
- Added proper navigation landmarks with roles
- Added `aria-hidden` to decorative SVG icons

### Infrastructure
- Supabase module split into 22 domain-specific modules
- Components organized into 6 subdirectories (common, charts, panels, badges, widgets, settings)
- Shared constants extracted to `src/lib/constants/`

---

## [1.0.0] - January 2026

### Build Plan Complete
All 6 core sprints successfully implemented. Vigil is now a subscription-ready CTI platform.

### Added - Sprint 6: Polish & Scale
- Database indexes for common queries
- Cursor-based pagination
- Sentry performance monitoring
- Unit tests for core modules
- In-app onboarding tour
- Service worker for offline capability

### Added - Sprint 5: Integrations
- SIEM export formats (Splunk, Elastic, Sentinel, STIX 2.1)
- Slack integration with slash commands
- Microsoft Teams connector
- Jira ticket creation
- ServiceNow integration
- PagerDuty alerts
- Outbound webhooks

### Added - Sprint 4: Subscription & API
- Stripe subscription integration
- Feature gating by tier (Free, Professional, Team, Enterprise)
- REST API with 9 endpoints
- API key management
- Pricing page
- API documentation (OpenAPI)

### Added - Sprint 3: Visualizations
- Interactive threat attribution map
- Calendar heatmap (GitHub-style)
- Actor relationship graph
- Vulnerability treemap
- Kill chain visualization
- Attack path diagrams

### Added - Sprint 2: Email & Notifications
- Email digests via Resend
- Vendor-specific alert rules
- In-app notification system
- Threat hunt guides with copy-paste queries

### Added - Sprint 1: Personalization & UX
- Sector drill-down cards
- Targeted services widget
- Active exploitation tracker
- User filter preferences
- Enhanced organization profile

---

## [0.5.0] - January 2026

### Added - Data Sources
- AlienVault OTX integration (community threat pulses)
- MalwareBazaar integration (malware samples)
- GreyNoise integration (mass scanner detection)
- Have I Been Pwned integration (breach correlation)
- IP Geolocation enrichment
- Malpedia integration (864 actors, 3,638 malware families)
- MISP Galaxy integration (2,940 actors)

### Added - Automation
- GitHub Actions workflow for 6-hour data ingestion
- Automated trend calculation
- Daily actor trend snapshots
- Weekly summary generation

---

## [0.4.1] - January 2026

### Added - Threat Actors Page Enhancements
- Load More pagination (50 at a time)
- CSV export for filtered results
- Saved filters functionality
- Activity sparklines
- Related actors based on TTPs/sectors
- Quick watchlist (Shift+click multi-select)
- Keyboard navigation
- Map view toggle
- Risk score column with org profile relevance
- Column menu dropdowns
- Color-coded actor type badges

---

## [0.4.0] - January 2026

### Added - Differentiating Features
- Organization profile wizard
- Relevance scoring algorithm
- RelevanceBadge component
- IOC Quick Lookup with type detection
- External enrichment links (VirusTotal, Shodan, AbuseIPDB)
- Actor correlation panel (TTPs, CVEs, IOCs)
- Trend Analysis page
- Week-over-week comparison
- Sector trend charts

### Added - Visualization Components
- ActorTrajectoryChart (multi-actor comparison)
- AttackPathDiagram (Actor → Technique → Vulnerability → IOC)
- Incident flow Sankey diagram
- ATT&CK Matrix heatmap toggle
- Smart time display components

### Added - UX
- Keyboard shortcuts modal (press ?)
- Navigation shortcuts (g+d, g+a, g+i)
- Collapsible sidebar

---

## [0.3.0] - January 2026

### Added - Core Features
- MITRE ATT&CK integration (172 groups, 691 techniques)
- Advanced search query language
- Unified search (Cmd+K)
- Bulk IOC search
- Saved searches
- Watch lists
- User preferences
- Tagging system

### Added - Data Sources
- CISA KEV (1,100+ CVEs)
- CISA Alerts RSS
- NVD CVE database
- ThreatFox IOCs
- URLhaus malicious URLs
- Feodo Tracker botnet C2s

---

## [0.2.0] - January 2026

### Added - Foundation
- Dashboard with AI-generated threat summary (Groq)
- Threat Actors page with trend status
- Incidents page with sector classification
- Vulnerabilities page with CVSS scores
- IOC Search page
- Dark cyber-themed UI
- Firebase authentication
- Supabase database

### Added - Data Ingestion
- RansomLook integration
- Ransomware.live integration (24,000+ incidents)
- Automated ingestion scripts

---

## [0.1.0] - December 2025

### Added
- Initial project setup
- Vite + React configuration
- Tailwind CSS styling
- Basic routing structure

---

*For detailed feature documentation, see FEATURES.md*
*For planned features, see ROADMAP.md*
