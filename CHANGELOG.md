# Changelog

All notable changes to Vigil are documented in this file.

---

## [2.6.0] - 27 November 2026

Numbers in brackets are this repository's pull requests; three-digit numbers after "migration" are files in
`supabase/migrations/`.

### Added

- A "What Vigil does not cover" page at `/coverage`, linked from the footer of every page: for each area, what Vigil
  reads and what that leaves out. The cadence beside each source is read from the feed registry the site was built
  with.
- The site version and the feed registry it was built with, in the footer and on `/status`. `/status` lists the
  registry's jobs with how often each is due, and says that the ingestion worker is deployed separately and may run an
  earlier registry.
- Feed: breach notices a registry posts late are listed (#61); CISA's ICS advisories (#58); breach notices are counted
  by filing date, and each state notice is labelled with its own state (#56).
- CIRCL sightings, a separate reported-exploited signal from an allow-list of CIRCL's sources (#26).
- A public STIX 2.1 feed at `/api/feed?format=stix` (#20).
- Feed contract 2.1: stable subjects, event times, last change and signal (#30). A surge item states when the surge
  was first flagged (migration 196, #33).
- Upper Midwest page: Minnesota, Wisconsin, Iowa, North Dakota and South Dakota (#16).
- HHS Office for Civil Rights breach portal, as a source the victim files (migration 192, #12).
- Five more state breach registries: Vermont, Montana, South Carolina, Idaho and Delaware. Every count states its
  scope, and old notices are not queued for review (migration 190, #9).
- Android's and Mozilla's own statements that a flaw was or may be exploited, and CERT-FR's alerts, kept apart from
  KEV (migrations 187 and 188, #7) and shown on the vulnerability panel (migration 191, #10). Statements are re-read,
  and a CVE named only in Google's note is marked (migration 193, #15); panel wording and tests (#14).
- CISA Vulnrichment's SSVC assessments, stored apart from KEV (migration 176, #1), on `/api/feed` and the
  vulnerability panel (migration 177, #2).
- A weekly history dump of the database to an archive, with a restore test that checks every table (#29, #44, #45,
  #62).
- A not-found page and a skip link on public pages (#40); pinch-zoom allowed and a line for browsers without
  JavaScript (#38).

### Changed

- A group's surge is judged against its own previous eight weeks (warning problem VG-WP-1, migration 179, #4), and the
  site's "Escalating" label follows the same rule (migration 189, #8).
- KEV is CISA's catalog as it stands: a row CISA no longer lists loses its KEV columns, and the old values are archived
  (migration 180, #5).
- EPSS runs after FIRST's daily release (#49), and the method states the whole EPSS alert rule (#47).
- A feed run far under its usual size no longer reads as healthy (#35).
- ThreatCluster's two licences are recorded apart, with the victim-country backfill from its last GPL-3.0 file (#51).
- The public dashboard's caveat line and terms are in plain language (#36). Contrast, label size, link underlines and
  page titles are improved (#43).
- Long tables and lists open in windows about ten rows tall that scroll, with "Show all" (#17, #18, #19, #24).
- `/status`, `/webhooks` and `/chat` say plainly when a feature is not set up (#28).
- "Exit Demo" returns to the landing page (#60).
- The house bar and shared site files are synced from The Intelligence Company's site (#13, #37, #39, #50); doctrine
  kit 0.6.12 (#46).
- Licences: the code is AGPL-3.0 and the shared site scripts are MIT (#6, #23). The UMD Cyber Events Database file is
  no longer kept in the repository (#48). The README has a note on AI assistance (#54).

### Fixed

- `/trends` no longer scrolls sideways on phones (#21), and the year heatmap's month labels stay on the chart (#22).
- The history dump strips a byte-order mark from its database address and gives its scratch database Supabase's roles
  and extensions (#44, #45).
- Tests run the in-process database in UTC, as Supabase does (#59).
- A public read runs as the caller (migration 178), and the end-to-end tests run in Playwright's image (#3).

### Security

- Deletes are allowed only to the service role (migration 195, #32).
- Only named reviewers may rule on review-queue items (migration 198, #42).
- The send-email function sends only to the caller's own confirmed address, and the webhook test refuses private and
  internal addresses (#41).
- A CI check keeps local file paths out of the repository (#31).

---

## Earlier changes, by month

Versions between 1.3.2 and 2.6.0 were not tagged, so these changes are listed by month, newest first.

### November 2026 (1 to 17 November)

- The worker builds the public summary every hour (migration 175), and feed items carry the time they were ingested.
- ThreatFox writes one row per indicator per batch.
- The worker counts every subrequest and has limits set for Workers Paid. The scheduler no longer lets a feed slip a
  tick, and each job declares its measured cost.
- Washington's own record of each breach's cause is on the review card (migration 174).
- Review queue: rulings are carried out for KEV keys, victim names and the audit log (migrations 169 to 171); help for
  reading each marked-up victim name and each reading finding (172, 173); a rule closes what it can settle, and the SEC
  scan is fixed (165); state-notice questions, a kind filter and evidence (166).
- Stall detection beyond RansomLook, counting only new records (migration 167). Feed health says when a feed runs and
  adds nothing (migration 163).
- VulnCheck's KEV is retired: its terms forbid free redistribution (migration 164).
- React Router 7 and Resend 6; dependency audit fixes.
- Feed: who claimed whom, and attributed origins cited to their source.
- Leftover pricing pages and an old project name are removed.
- The worker runs from one cron trigger, twice an hour, instead of four.
- Pages fit the screen on phones and at 1024 px; Advisories fits once advisories load; the house bar is pinned, with
  the sidebar and overlays below it.
- `/api/feed`'s summary states `data_as_of` and counts overlaps.
- House bar and shared time-module updates.

### October 2026

- A public feed in contract v2 at `/api/feed`, with the doctrine kit and warning registers. `/api/summary` gives one
  public sentence about the latest complete day. The feed's summary states database counts and names each window by
  its start date. Doctrine kit 0.3.3.
- Times show in the viewer's own time zone, with a Time button in the header; page dates follow the Time setting, and
  calendar days no longer show the day before.
- The code is licensed AGPL-3.0, and every page credits its data's sources.
- An alert when a KEV entry with known ransomware use reaches an EPSS score of 0.5, on current EPSS.
- A leak-site claim is matched to a watched vendor, with a regression suite of real cases.
- ThreatCluster's fills are logged, and the victim-country gap is measured.
- Vendor research: a page where a proposed actor link can be ruled on, and a reading of a report's attribution can be
  recorded and applied.
- Feed health lets an hourly feed fail once before the check fails.
- Ransom payments by family, with the age of the data first and no single total, from the Ransomwhere archive on
  Zenodo (CC BY 4.0). An unchanged archive counts as a successful check and says how old its data is.
- Four security-definer functions are closed to the API, and grants are checked.
- IP location reads only the indicators that arrived since its last run; its timeout is fixed.
- The sanctions data is shown, with what it does not mean.
- A failure in ingestion now raises an alert.
- The Ransomwatch script is removed: its source was archived in March 2026.
- Censys looks up hosts (an ip:port is not one) and no longer starves lower-priority feeds.
- The OFAC actor match can use an index.

### September 2026

- The ingestion rewrite: a feed registry and scheduler on the worker, and the schema recorded in migrations.
- A review queue for data-quality findings.
- Government attribution on the map, from CISA and from NCSC-UK.
- Where a threat actor is from, cited to its source.
- Vendor research stored as questions rather than answers.
- Group profiles, OFAC sanctions, identity resolution, and a landing page that says what Vigil holds.
- Every indicator located, actor origin kept apart from targeting, and the map fixed; indicator search shows where the
  infrastructure is.
- Three state breach registries: California, Washington and Oregon.
- A page for regulator filings, and FinCEN's register with a page that renders it (archive from 2007).
- A tier for every source, and a page for figures that disagree.
- 5,302 incidents that are not ransomware are marked as such; four unused functions are removed.
- One query layer; country filters; the Operations page shows sync data.
- Alerts reach a person, and the queue nobody read is retired.
- The subscription tier system is removed, and the remaining Firebase code with it, including three CSP origins.
- OFAC is fetched from where Treasury can be reached.
- Fixes: dashboard zeros after a reload (an authentication deadlock), API functions that crashed on every request, and
  AI summaries moved to Groq's replacement model; security and data-integrity hardening.

### January 2026 (19 and 20 January)

- Authentication moved from Firebase to Supabase, with branded email templates.
- Sign-in gate, admin tools and correlation improvements.
- An interactive demo on the landing page.
- A password strength indicator and support for browser password managers.
- Terms of Service and a Privacy Policy, accepted before registration, with re-acceptance and session timeouts.
- Pre-commit hooks and Prettier formatting.
- Schema and code mismatches fixed across 22 files; optional tables handled when they are missing.

---

## [1.3.2] - January 18, 2026

### Documentation Consolidation

Cleaned up project documentation structure, reducing 34 markdown files to 12 active docs.

**Archived to `docs/archive/`:**
- `ALERTING_SYSTEM.md` - Superseded by BUILD_PLAN_V2
- `AUDIT_REPORT.md` - Historical baseline
- `COST_ANALYSIS.md` - Reference material
- `DATA_QUALITY_REPORT.md` - Time-stamped snapshot
- `FEATURE_FIX_PLAN.md` - All 6 issues resolved
- `PERFORMANCE_OPTIMIZATION_PLAN.md` - Merged into BUILD_PLAN_V2
- `SAAS_ROADMAP.md` - Superseded by BUILD_PLAN_V2
- `TESTING_EXPANSION_PLAN.md` - Merged into BUILD_PLAN_V2
- `docs/SPRINT2_SETUP.md` - Historical
- `docs/SECURITY_AUDIT.md` - Findings addressed

**Moved to `docs/`:**
- `DEPENDENCY_AUDIT.md` - Security reference
- `FEATURES.md` - Feature documentation
- `THREAT_COVERAGE_GAPS.md` - Strategic planning
- `DATABASE.md` - Schema reference

**Root directory now contains only:**
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` - Standard project files
- `CLAUDE.md` - AI assistant context
- `ROADMAP.md`, `BUILD_PLAN_V2.md` - Planning documents
- `DATA_SOURCES.md` - Data feed documentation

### Feature Fixes

Six modules with data/logic issues identified and resolved:

1. **Compare Page** - Replaced `Math.random()` with real database queries
   - New: `src/lib/supabase/compare.js` - Incident trends, region/sector breakdowns
   - Fixed: `src/pages/Compare.jsx` - Uses real data from Supabase

2. **Webhook Test** - Now actually sends HTTP requests
   - New: `api/webhooks/test.js` - Edge function for webhook testing
   - Fixed: `src/lib/webhooks.js` - Calls API endpoint instead of returning mock data

3. **Stripe Checkout** - Implemented payment flow
   - Fixed: `src/pages/Pricing.jsx` - Proper Stripe redirect, shows current tier

4. **Score Trend Calculation** - Uses historical data
   - Fixed: `src/lib/predictions.js` - Compares 7-day periods for trend direction

5. **Variable Naming** - Fixed misleading dashboard variable names
   - Fixed: `src/lib/supabase/dashboard.js` - Deprecated `incidents24h` (was 30d data)
   - Fixed: `src/pages/dashboard/AboveFoldSection.jsx` - Uses correct property names

6. **SSO Validation** - Added proper configuration checks
   - Fixed: `src/lib/sso.js` - URL validation, certificate base64, domain format

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
