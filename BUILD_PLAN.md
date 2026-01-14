# Vigil - Build & Rollout Plan

> Comprehensive development guide for completing Vigil's feature set
> Incorporates user feedback and roadmap items
> Created: January 2026

---

## ✅ BUILD PLAN COMPLETED - January 14, 2026

All 6 sprints have been successfully implemented. Vigil is now a subscription-ready CTI platform.

| Sprint | Status | Completion Date |
|--------|--------|-----------------|
| Sprint 1: Personalization & UX | ✅ Complete | January 2026 |
| Sprint 2: Email & Notifications | ✅ Complete | January 2026 |
| Sprint 3: Visualizations | ✅ Complete | January 2026 |
| Sprint 4: Subscription & API | ✅ Complete | January 2026 |
| Sprint 5: Integrations | ✅ Complete | January 2026 |
| Sprint 6: Polish & Scale | ✅ Complete | January 2026 |

**Key Deliverables:**
- 54 React components
- 16 pages
- 13 database migrations
- 13 library modules
- 35+ data ingestion scripts
- 9 REST API endpoints
- Stripe subscription integration
- SIEM export formats (Splunk, Elastic, Sentinel, STIX)
- Slack, Teams, Jira integrations
- In-app onboarding tour
- Performance monitoring with Sentry

---

## Executive Summary

This plan transforms Vigil from a portfolio project into a subscription-ready CTI platform. Key themes:

1. **Personalization** - Users get intelligence relevant to THEIR stack, not "cover it all"
2. **Actionable TL;DR** - Summarized, prioritized intelligence with clear next steps
3. **Proactive Alerts** - Email notifications before it hits the news
4. **Visualizations** - Geographic, temporal, and relationship views
5. **Monetization** - Subscription tiers for sustainable growth

---

## User Feedback Integration (Jake B.)

| Feedback | Solution | Phase |
|----------|----------|-------|
| "Make targeted sectors expandable to show incident activity" | Expandable sector cards with drill-down | Sprint 1 |
| "Subscription-based, tailor to industry" | Stripe integration + tier system | Sprint 4 |
| "I don't care about ICS stuff" | User preferences to exclude sectors/types | Sprint 1 |
| "TL;DR tailored to what I want" | Personalized daily digest based on profile | Sprint 2 |
| "Email notifications based on importance" | Priority-based email alerts | Sprint 2 |
| "I have Cisco products, I want Cisco zero-days" | Vendor-specific alert rules | Sprint 2 |
| "And I want it before BleepingComputer posts it" | Already done - primary source feeds | Current |
| "Simplifying it to someone's stack and preference" | Enhanced org profile + relevance filtering | Sprint 1 |
| "Heat map with attribution - who's attacking what, by industry" | Interactive threat map with actor drill-down | Sprint 3 |
| "Click attacker for TTPs and tradecraft to harden infrastructure" | Actor profile with active TTPs and defensive guidance | Sprint 3 |
| "Services being targeted (email, VPN, cloud)" | Targeted Services dashboard widget | Sprint 1 |
| "CVE/CWEs being targeted" | Active Exploitation tracker widget | Sprint 1 |
| "Provide threat hunts - not YARA rules, actual steps to check logs/settings" | Actionable Threat Hunt Guides | Sprint 2 |

---

## Sprint Overview

| Sprint | Theme | Status | Key Deliverables |
|--------|-------|--------|------------------|
| 1 | Personalization & UX | ✅ | Sector drill-down, filter preferences, expandable cards |
| 2 | Email & Notifications | ✅ | Email digests, vendor alerts, notification preferences |
| 3 | Visualizations | ✅ | Geographic map, calendar heatmap, relationship graphs |
| 4 | Subscription & API | ✅ | Stripe, tiers, REST API, OpenAPI docs |
| 5 | Integrations | ✅ | SIEM connectors, ticketing, Slack/Teams |
| 6 | Polish & Scale | ✅ | Performance, tests, monitoring |

---

## Sprint 1: Personalization & UX

### 1.1 Expandable Sector Cards
**Goal:** Click a sector to see all incidents targeting it

**Implementation:**
```
Dashboard/Events → Sector stat card → Click → Expand to show:
├── Incident list for that sector
├── Top actors targeting sector
├── Trend chart for sector
└── Quick filter to full incidents page
```

**Files to modify:**
- `src/pages/Dashboard.jsx` - Add expandable sector section
- `src/pages/Events.jsx` - Add sector drill-down cards
- `src/components/SectorDrilldown.jsx` (new) - Expandable sector detail

**Tasks:**
- [ ] Create `SectorDrilldown` component with collapsible accordion
- [ ] Add incident list grouped by sector on Dashboard
- [ ] Link sector cards to filtered Events page
- [ ] Show "Top actors targeting [sector]" in expanded view

### 1.2 User Filter Preferences
**Goal:** Users can exclude irrelevant content (e.g., "I don't care about ICS")

**Implementation:**
```javascript
// user_preferences table additions
{
  excluded_sectors: ['ics', 'agriculture'], // Hide these
  excluded_event_types: ['ioc'],            // Only show what matters
  severity_threshold: 'medium',             // Hide low/info
  preferred_regions: ['north_america'],     // Prioritize these
}
```

**Files to modify:**
- `supabase/migrations/010_user_filter_preferences.sql` (new)
- `src/lib/supabase.js` - Add userPreferences module
- `src/pages/Settings.jsx` - Add "Content Preferences" section
- All list pages - Apply filters from preferences

**Tasks:**
- [ ] Create migration for user_preferences table extension
- [ ] Add "Content Preferences" UI in Settings
  - [ ] Multi-select for excluded sectors
  - [ ] Multi-select for excluded event types
  - [ ] Severity threshold slider
  - [ ] Preferred regions checkboxes
- [ ] Apply filters globally across all pages
- [ ] Add "Show hidden" toggle for temporarily viewing excluded content

### 1.3 Enhanced Org Profile
**Goal:** Deeper personalization based on tech stack

**Current state:** Org profile exists with sector, region, tech_vendors, tech_stack

**Enhancements:**
- [ ] Add specific product versions (e.g., "Windows Server 2019")
- [ ] Add network equipment (firewalls, routers)
- [ ] Add cloud providers (AWS, Azure, GCP)
- [ ] Add CVE matching to specific product versions
- [ ] Improve relevance scoring algorithm

**Files to modify:**
- `src/components/OrganizationProfileSetup.jsx` - Add more fields
- `src/lib/supabase.js` (relevance module) - Enhanced scoring

### 1.4 Smart Defaults
**Goal:** Reduce clicks to get useful information

**Implementation:**
- [ ] Default Events page to last 7 days, High+ severity
- [ ] Auto-select user's sector in filters when profile exists
- [ ] Remember last-used filters per page (localStorage)
- [ ] "Reset to my defaults" button

### 1.5 Targeted Services Widget
**Goal:** Show which services/technologies are being actively targeted (per Jake's feedback)

**Categories to track:**
- Email services (Exchange, O365, Gmail)
- VPN/Remote access (Cisco AnyConnect, Fortinet, Pulse Secure)
- Cloud platforms (AWS, Azure, GCP)
- Identity/SSO (Okta, AD, LDAP)
- Web servers (Apache, Nginx, IIS)
- Databases (SQL Server, MySQL, PostgreSQL)
- File sharing (SharePoint, OneDrive, Dropbox)

**Implementation:**
```
Dashboard Widget: "Services Under Attack"
┌─────────────────────────────────────────┐
│ Services Under Attack (Last 7 Days)     │
├─────────────────────────────────────────┤
│ VPN/Remote Access     ████████████  45  │
│ Email Services        ████████     32   │
│ Cloud Platforms       ██████       24   │
│ Identity/SSO          █████        18   │
│ Web Servers           ████         15   │
└─────────────────────────────────────────┘
Click service → See CVEs + actors targeting it
```

**Data source:** Map CVE affected_products to service categories

**Files to create:**
- `src/components/TargetedServicesWidget.jsx`
- `src/lib/service-categories.js` - Category mapping

**Tasks:**
- [ ] Create service category taxonomy
- [ ] Map CVEs to service categories (by product name matching)
- [ ] Create TargetedServicesWidget component
- [ ] Add to Dashboard
- [ ] Click service → filter vulnerabilities page

### 1.6 Active Exploitation Tracker
**Goal:** Show CVEs/CWEs currently being exploited in the wild (per Jake's feedback)

**Implementation:**
```
Dashboard Widget: "Actively Exploited"
┌─────────────────────────────────────────┐
│ Actively Exploited (Last 30 Days)       │
├─────────────────────────────────────────┤
│ CVE-2025-1234  Cisco VPN     CRITICAL   │
│ → Used by: LockBit, ALPHV               │
│ → Your exposure: [Check Now]            │
├─────────────────────────────────────────┤
│ CVE-2025-5678  Exchange      HIGH       │
│ → Used by: APT28                        │
│ → Your exposure: Not affected           │
└─────────────────────────────────────────┘
```

**Data sources:**
- CISA KEV (known exploited)
- IOCs linked to CVEs
- Incident data mentioning CVEs

**Files to create:**
- `src/components/ActiveExploitationWidget.jsx`

**Tasks:**
- [ ] Query KEV + recent CVEs with linked actor activity
- [ ] Show actor attribution per CVE
- [ ] Cross-reference with user's tech stack for "Your exposure"
- [ ] Add to Dashboard

---

## Sprint 2: Email & Notifications

### 2.1 Email Service Setup
**Goal:** Send transactional emails

**Provider options:**
- **Resend** (recommended) - $0 for 3k emails/month, simple API
- **SendGrid** - Free tier available
- **AWS SES** - Cheapest at scale

**Implementation:**
```javascript
// scripts/send-digest.mjs
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendDigest(userId, content) {
  await resend.emails.send({
    from: 'Vigil <alerts@vigil.theintelligence.company>',
    to: userEmail,
    subject: `Vigil Daily Digest - ${criticalCount} critical items`,
    html: renderDigestTemplate(content)
  })
}
```

**Tasks:**
- [ ] Set up Resend account and verify domain
- [ ] Create `scripts/lib/email.mjs` email utility module
- [ ] Create email templates directory `templates/emails/`
- [ ] Add RESEND_API_KEY to environment

### 2.2 Daily Digest Email
**Goal:** Personalized daily threat summary

**Content based on org profile:**
```
Subject: Vigil Daily Digest - 3 Critical Items for Healthcare

Good morning,

CRITICAL (3 items matching your profile):
- CVE-2025-1234: Apache vulnerability affecting your stack
- LockBit claimed 2 new healthcare victims
- New IOC linked to actors targeting your sector

HIGH PRIORITY (5 items):
- ...

WATCHLIST UPDATES (2 items):
- Actor "ALPHV" status changed to ESCALATING
- CVE-2025-5678 added to your watchlist

[View Full Dashboard] [Manage Preferences]
```

**Files to create:**
- `scripts/send-daily-digest.mjs` - Digest generation script
- `templates/emails/daily-digest.html` - Email template
- `.github/workflows/daily-digest.yml` - Scheduled job (6am user timezone)

**Tasks:**
- [ ] Design digest email template (HTML)
- [ ] Create digest content generator
  - [ ] Filter by user's org profile
  - [ ] Prioritize by relevance score
  - [ ] Group by severity
  - [ ] Include watchlist updates
- [ ] Add digest preferences to Settings
  - [ ] Frequency: off / daily / weekly
  - [ ] Time of day preference
  - [ ] Include types: incidents, CVEs, IOCs, etc.
- [ ] Set up GitHub Actions for scheduled sending

### 2.3 Vendor-Specific Alerts
**Goal:** "I have Cisco products, I want Cisco zero-days before BleepingComputer"

**Implementation:**
```javascript
// Alert rules stored in user_alert_rules table
{
  user_id: uuid,
  rule_type: 'vendor_cve',
  conditions: {
    vendors: ['Cisco', 'Microsoft'],
    min_severity: 'high',
    kev_only: false
  },
  notify_via: ['email', 'in_app'],
  enabled: true
}
```

**Trigger:** Run after CVE ingestion, check new CVEs against user rules

**Tasks:**
- [ ] Create `user_alert_rules` table
- [ ] Build alert rule builder UI in Settings
  - [ ] Rule type: vendor CVE, actor activity, sector incident
  - [ ] Conditions builder
  - [ ] Notification channel selection
- [ ] Create `scripts/process-alert-rules.mjs`
- [ ] Add to ingestion workflow

### 2.4 In-App Notifications
**Goal:** Notification bell with unread count

**Implementation:**
- [ ] Create `notifications` table
- [ ] Add NotificationBell component to Header
- [ ] Show unread count badge
- [ ] Notification dropdown with recent items
- [ ] Mark as read on click
- [ ] Link to relevant item

### 2.5 Actionable Threat Hunt Guides
**Goal:** Provide practical threat hunts - not YARA rules, but actual steps to check logs and settings (per Jake's feedback)

**The Problem:**
- Security vendors share YARA rules, but most teams can't deploy them
- IOC lists are useful but don't tell you HOW to hunt
- Users need: "Check this log for this pattern" or "Look for this setting"

**Solution: Threat Hunt Cards**
```
┌─────────────────────────────────────────────────────────────┐
│ Threat Hunt: LockBit 3.0 Indicators                         │
│ Last updated: 2 hours ago | Confidence: High                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ QUICK CHECKS (No tools required):                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ □ Check for unexpected scheduled tasks                  │ │
│ │   → Run: schtasks /query /fo LIST /v                    │ │
│ │   → Look for: Tasks created in last 7 days by SYSTEM    │ │
│ │                                                         │ │
│ │ □ Review recent service installations                   │ │
│ │   → Event Log: System → Event ID 7045                   │ │
│ │   → Look for: Services with random names                │ │
│ │                                                         │ │
│ │ □ Check for disabled security tools                     │ │
│ │   → Run: Get-MpComputerStatus (PowerShell)              │ │
│ │   → Look for: RealTimeProtectionEnabled = False         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ LOG QUERIES (Copy-paste ready):                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Splunk:                                                 │ │
│ │ index=windows EventCode=4688 NewProcessName="*cmd.exe"  │ │
│ │ | where ParentProcessName LIKE "%wmiprvse%"             │ │
│ │                                                 [Copy]  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Elastic/KQL:                                            │ │
│ │ process.name:"cmd.exe" AND                              │ │
│ │ process.parent.name:"wmiprvse.exe"                      │ │
│ │                                                 [Copy]  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Microsoft Sentinel:                                     │ │
│ │ SecurityEvent                                           │ │
│ │ | where EventID == 4688                                 │ │
│ │ | where NewProcessName endswith "cmd.exe"               │ │
│ │                                                 [Copy]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ REGISTRY CHECKS:                                            │
│ • HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run        │
│   → Look for: Entries pointing to %TEMP% or %APPDATA%       │
│                                                             │
│ NETWORK INDICATORS:                                         │
│ • Outbound connections to: 185.x.x.x/24 (C2 range)          │
│ • DNS queries for: *.onion.* domains                        │
│                                                             │
│ [Mark as Completed] [Export to PDF] [Share with Team]       │
└─────────────────────────────────────────────────────────────┘
```

**Data Sources for Hunt Content:**
- CISA advisories (they include detection guidance)
- Vendor blogs (Microsoft, CrowdStrike, Mandiant)
- MITRE ATT&CK detection field
- Community contributions

**Implementation:**
```javascript
// threat_hunts table
{
  id: uuid,
  title: "LockBit 3.0 Indicators",
  actor_id: uuid,                    // Link to threat actor
  cve_ids: ['CVE-2025-1234'],        // Related CVEs
  confidence: 'high',
  quick_checks: [                    // No-tool-required checks
    {
      title: "Check for unexpected scheduled tasks",
      command: "schtasks /query /fo LIST /v",
      look_for: "Tasks created in last 7 days by SYSTEM"
    }
  ],
  log_queries: {                     // Copy-paste ready queries
    splunk: "index=windows EventCode=4688...",
    elastic: "process.name:\"cmd.exe\"...",
    sentinel: "SecurityEvent | where..."
  },
  registry_checks: [...],
  network_indicators: [...],
  created_at: timestamp,
  updated_at: timestamp
}
```

**Files to create:**
- `src/components/ThreatHuntCard.jsx` - Hunt guide display
- `src/components/ThreatHuntChecklist.jsx` - Interactive checklist
- `src/pages/ThreatHunts.jsx` - Browse all hunts
- `supabase/migrations/011_threat_hunts.sql`
- `scripts/ingest-threat-hunts.mjs` - Parse from CISA/vendor sources

**Tasks:**
- [ ] Design threat_hunts table schema
- [ ] Create ThreatHuntCard component with copy-to-clipboard
- [ ] Build interactive checklist (mark items as checked)
- [ ] Create ThreatHunts browse page
- [ ] Link hunts to actors and CVEs
- [ ] Add "Threat Hunt" button on actor detail panel
- [ ] Add "Hunt for this" button on CVE detail
- [ ] Create hunt content for top 10 active actors
- [ ] Add SIEM-specific query templates (Splunk, Elastic, Sentinel)
- [ ] Export hunt as PDF for offline use

**Premium Feature Potential:**
- Free: View hunts, basic checklist
- Pro: Custom SIEM query generation, PDF export
- Team: Team progress tracking, hunt assignment

---

## Sprint 3: Visualizations

### 3.1 Interactive Threat Attribution Map
**Goal:** World map with full attribution - who's attacking, what they're attacking, by industry (per Jake's feedback)

**Library:** `react-simple-maps` (lightweight) or `deck.gl` (powerful)

**Core Features:**
- Color intensity by incident/attack count
- Toggle views: victim location vs actor origin
- Click country to filter
- Tooltip with country stats

**Attribution Features (Jake's Feedback):**
```
Map View Modes:
┌─────────────────────────────────────────────────────────┐
│ [Victims] [Attackers] [By Industry] [By Service]        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│            ┌──── Click country ────┐                    │
│            ▼                       │                    │
│  ┌─────────────────────────────┐  │                    │
│  │ Russia - Attack Origin      │  │                    │
│  │ ─────────────────────────── │  │                    │
│  │ Active Actors:              │  │                    │
│  │ • LockBit (47 attacks)      │◄─┼── Click actor     │
│  │ • ALPHV (23 attacks)        │  │                    │
│  │ • Conti (12 attacks)        │  │                    │
│  │ ─────────────────────────── │  │                    │
│  │ Top Targets:                │  │                    │
│  │ • Healthcare (34%)          │  │                    │
│  │ • Finance (28%)             │  │                    │
│  │ • Manufacturing (18%)       │  │                    │
│  │ ─────────────────────────── │  │                    │
│  │ Services Targeted:          │  │                    │
│  │ • VPN/Remote (45)           │  │                    │
│  │ • Email (32)                │  │                    │
│  └─────────────────────────────┘  │                    │
│                                   │                    │
│            ┌──────────────────────┘                    │
│            ▼                                           │
│  ┌─────────────────────────────────────────────────┐  │
│  │ LockBit - Actor Profile                         │  │
│  │ ───────────────────────────────────────────────  │  │
│  │ Status: ESCALATING  |  Type: Ransomware         │  │
│  │                                                  │  │
│  │ Current TTPs (for infrastructure hardening):    │  │
│  │ • T1566 - Phishing (Initial Access)             │  │
│  │ • T1486 - Data Encrypted for Impact             │  │
│  │ • T1078 - Valid Accounts                        │  │
│  │                                                  │  │
│  │ CVEs Being Exploited:                           │  │
│  │ • CVE-2025-1234 - Cisco VPN (CRITICAL)          │  │
│  │ • CVE-2025-5678 - Exchange (HIGH)               │  │
│  │                                                  │  │
│  │ Defensive Recommendations:                      │  │
│  │ • Patch Cisco AnyConnect to 4.10.x              │  │
│  │ • Enable MFA on all remote access               │  │
│  │ • Monitor for T1566 indicators                  │  │
│  │                                                  │  │
│  │ [View Full Profile] [Add to Watchlist]          │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Industry Segmentation View:**
- Toggle to see attacks grouped by target industry
- Pie chart overlay on map showing sector breakdown per region
- Click sector → filter to incidents in that sector

**Files to create:**
- `src/components/ThreatAttributionMap.jsx` - Main map component
- `src/components/CountryAttackPanel.jsx` - Country detail popup
- `src/components/ActorQuickProfile.jsx` - Actor profile popup with TTPs
- `src/data/world-countries.json` (TopoJSON)

**Tasks:**
- [ ] Install react-simple-maps
- [ ] Create ThreatAttributionMap component
- [ ] Implement country click → CountryAttackPanel
- [ ] Show active actors per country with attack counts
- [ ] Show top targeted industries per country
- [ ] Implement actor click → ActorQuickProfile
- [ ] Display current TTPs with defensive recommendations
- [ ] Show CVEs being actively exploited by actor
- [ ] Add industry segmentation toggle view
- [ ] Add services targeted breakdown
- [ ] Add to Dashboard and Events pages

### 3.2 Calendar Heatmap
**Goal:** GitHub-style activity calendar

**Library:** Custom SVG or `react-calendar-heatmap`

**Features:**
- Daily incident count for past year
- Color intensity = activity level
- Click day to filter to that date
- Tooltip with day details

**Tasks:**
- [ ] Create CalendarHeatmap component
- [ ] Add to Trends page
- [ ] Implement day click interaction
- [ ] Add to actor detail panel (actor-specific activity)

### 3.3 Actor Relationship Graph
**Goal:** Network visualization of actor connections

**Library:** `react-force-graph` or `vis-network`

**Features:**
- Nodes: threat actors
- Edges: shared TTPs, infrastructure, targets
- Clustering by actor type
- Interactive zoom/pan
- Click node for details

**Tasks:**
- [ ] Implement relationship scoring algorithm
- [ ] Create ActorRelationshipGraph component
- [ ] Add to Trends or dedicated "Analysis" page
- [ ] Implement node click interaction

### 3.4 Vulnerability Treemap
**Goal:** CVEs sized by severity, colored by status

**Library:** `recharts` Treemap or `d3-hierarchy`

**Features:**
- Box size = CVSS score
- Color = KEV status (red) vs theoretical (orange)
- Group by vendor
- Click to drill down

**Tasks:**
- [ ] Create VulnerabilityTreemap component
- [ ] Add to Vulnerabilities page as alternate view
- [ ] Implement drill-down by vendor

### 3.5 Kill Chain Visualization
**Goal:** Show attack stages with activity indicators

**Features:**
- Lockheed Martin or MITRE ATT&CK phases
- Heat indicator per phase based on recent activity
- Click phase to see related techniques

**Tasks:**
- [ ] Create KillChainVisualization component
- [ ] Map techniques to kill chain phases
- [ ] Add to Techniques page or Dashboard

---

## Sprint 4: Subscription & Monetization

### 4.1 Tier Structure

| Tier | Price | Limits | Features |
|------|-------|--------|----------|
| **Free** | $0 | View-only | Dashboard, search, basic exports |
| **Professional** | $29/mo | 1 user, 1 org profile | Email digests, vendor alerts, saved filters |
| **Team** | $99/mo | 5 users, 3 profiles | API access, CSV exports, priority support |
| **Enterprise** | Custom | Unlimited | SIEM integration, custom alerts, SLA |

### 4.2 Stripe Integration

**Implementation:**
```javascript
// src/lib/stripe.js
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function createCheckoutSession(userId, priceId) {
  return stripe.checkout.sessions.create({
    customer_email: userEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${APP_URL}/settings?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pricing`,
    metadata: { userId }
  })
}
```

**Tasks:**
- [ ] Set up Stripe account
- [ ] Create products and prices in Stripe dashboard
- [ ] Implement checkout flow
- [ ] Create webhook handler for subscription events
- [ ] Add `subscription_tier` to user profile
- [ ] Create feature gates based on tier
- [ ] Build Pricing page (`src/pages/Pricing.jsx`)
- [ ] Add upgrade prompts in UI

### 4.3 Feature Gating

```javascript
// src/lib/features.js
export const TIER_FEATURES = {
  free: ['view_dashboard', 'basic_search'],
  professional: ['email_digests', 'vendor_alerts', 'saved_filters', 'csv_export'],
  team: ['api_access', 'multiple_profiles', 'bulk_search'],
  enterprise: ['siem_integration', 'custom_alerts', 'priority_support']
}

export function canAccess(userTier, feature) {
  const tierIndex = ['free', 'professional', 'team', 'enterprise'].indexOf(userTier)
  for (let i = tierIndex; i >= 0; i--) {
    if (TIER_FEATURES[Object.keys(TIER_FEATURES)[i]].includes(feature)) {
      return true
    }
  }
  return false
}
```

### 4.4 REST API

**Goal:** Programmatic access for Team+ tiers

**Endpoints:**
```
GET  /api/v1/actors          - List threat actors
GET  /api/v1/actors/:id      - Get actor details
GET  /api/v1/incidents       - List incidents
GET  /api/v1/vulnerabilities - List vulnerabilities
GET  /api/v1/iocs            - List IOCs
POST /api/v1/iocs/lookup     - Bulk IOC lookup
GET  /api/v1/events          - Unified events timeline
```

**Implementation options:**
- Supabase Edge Functions (serverless)
- Vercel API Routes (if staying on Vercel)
- Separate Express server

**Tasks:**
- [ ] Choose API hosting approach
- [ ] Implement API key generation
- [ ] Create rate limiting middleware
- [ ] Build endpoint handlers
- [ ] Generate OpenAPI documentation
- [ ] Create API documentation page

---

## Sprint 5: Integrations

### 5.1 SIEM Integration

**Splunk:**
- [ ] Create Splunk app package
- [ ] Implement HEC (HTTP Event Collector) integration
- [ ] Build saved searches and dashboards

**Elastic SIEM:**
- [ ] Create Elasticsearch connector
- [ ] Build Kibana dashboards

**Microsoft Sentinel:**
- [ ] Create Logic App playbook
- [ ] Implement data connector

### 5.2 Ticketing Integration

**Jira:**
```javascript
// One-click ticket creation
async function createJiraTicket(incident) {
  return jira.createIssue({
    project: userSettings.jira_project,
    summary: `[Vigil] ${incident.title}`,
    description: formatIncidentForJira(incident),
    issuetype: 'Task',
    priority: mapSeverityToJiraPriority(incident.severity)
  })
}
```

**Tasks:**
- [ ] Jira OAuth integration
- [ ] ServiceNow integration
- [ ] PagerDuty integration
- [ ] "Create Ticket" button on incident details

### 5.3 Chat Integration

**Slack:**
- [ ] Create Slack app
- [ ] Implement incoming webhooks
- [ ] Build slash commands (`/vigil search <query>`)
- [ ] Alert channel notifications

**Microsoft Teams:**
- [ ] Teams connector
- [ ] Adaptive cards for alerts
- [ ] Tab app for embedding dashboard

---

## Sprint 6: Polish & Scale

### 6.1 Performance Optimization

**Tasks:**
- [ ] Implement cursor-based pagination (replace offset)
- [ ] Add database indexes for common queries
- [ ] Implement Redis caching for hot data
- [ ] Code split large bundles further
- [ ] Lazy load visualizations
- [ ] Add service worker for offline capability

### 6.2 Testing

**Unit tests:**
- [ ] Test utility functions (date formatting, scoring)
- [ ] Test supabase query functions

**Integration tests:**
- [ ] Test auth flows
- [ ] Test subscription workflows

**E2E tests:**
- [ ] Critical user journeys (Playwright)
- [ ] Search functionality
- [ ] Export functionality

### 6.3 Monitoring & Observability

**Tasks:**
- [ ] Set up error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Create uptime monitoring
- [ ] Build admin dashboard for system health
- [ ] Set up database backup automation
- [ ] Create alerting for ingestion failures

### 6.4 Documentation

**Tasks:**
- [ ] User documentation / help center
- [ ] API documentation (OpenAPI)
- [ ] Video tutorials for key features
- [ ] In-app onboarding tour

---

## Data Sources to Add

### Priority 1 (High Value, Free)

| Source | Data Type | Implementation |
|--------|-----------|----------------|
| Shodan InternetDB | IP enrichment | Already scaffolded |
| Hybrid Analysis | Sandbox reports | Already scaffolded |
| VirusTotal | File/URL reputation | Already scaffolded |
| Phishtank | Phishing URLs | New script needed |

### Priority 2 (Medium Value)

| Source | Data Type | Notes |
|--------|-----------|-------|
| OpenPhish | Phishing URLs | Real-time feed |
| Spamhaus DROP | Malicious IP ranges | Network blocklists |
| US-CERT/NCSC RSS | Advisories | Government alerts |
| FIRST EPSS | Exploit probability | Risk scoring enhancement |

### Priority 3 (Premium/Enterprise)

| Source | Data Type | Cost |
|--------|-----------|------|
| Shodan (full) | Complete scans | $59/mo |
| Censys (full) | Attack surface | Contact sales |
| Recorded Future | Finished intel | Enterprise |

---

## Technical Debt Backlog

| Item | Priority | Effort |
|------|----------|--------|
| TypeScript migration | Medium | High |
| Cursor-based pagination | High | Medium |
| Unit test coverage | Medium | Medium |
| E2E test suite | Medium | High |
| Database backup automation | High | Low |
| Error boundary improvements | Low | Low |
| Accessibility audit (a11y) | Medium | Medium |

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Email open rate | >40% | Resend analytics |
| Daily active users | 100+ | Analytics |
| Paid conversion | 5% | Stripe metrics |
| API requests/day | 10k+ | Rate limit logs |
| Search latency | <500ms | P95 monitoring |
| Data freshness | <6 hours | Sync log timestamps |
| Uptime | 99.9% | Monitoring alerts |

---

## Rollout Strategy

### Phase 1: Internal Beta (Current)
- Feature complete for core functionality
- Manual user management
- Free access for feedback

### Phase 2: Closed Beta
- Invite-only access
- Implement free tier limits
- Gather feedback on pricing

### Phase 3: Public Launch
- Open registration
- Enable paid tiers
- Marketing push
- Support documentation

### Phase 4: Enterprise
- Custom integrations
- SLA agreements
- Dedicated support

---

## Quick Reference: File Locations

### New Files to Create

```
src/
├── components/
│   ├── SectorDrilldown.jsx           # Expandable sector cards
│   ├── TargetedServicesWidget.jsx    # Services under attack widget
│   ├── ActiveExploitationWidget.jsx  # CVEs being exploited widget
│   ├── ThreatAttributionMap.jsx      # Interactive world map with attribution
│   ├── CountryAttackPanel.jsx        # Country detail popup (actors, targets)
│   ├── ActorQuickProfile.jsx         # Actor popup with TTPs for hardening
│   ├── CalendarHeatmap.jsx           # GitHub-style activity calendar
│   ├── ActorRelationshipGraph.jsx    # Network graph of actor connections
│   ├── VulnerabilityTreemap.jsx      # CVEs sized by severity
│   ├── KillChainVisualization.jsx    # Attack phase visualization
│   ├── NotificationBell.jsx          # Header notification dropdown
│   ├── UpgradePrompt.jsx             # Subscription upgrade CTA
│   ├── ThreatHuntCard.jsx            # Actionable threat hunt display
│   └── ThreatHuntChecklist.jsx       # Interactive hunt checklist
├── pages/
│   ├── Pricing.jsx                   # Subscription tiers
│   ├── ApiDocs.jsx                   # API documentation
│   └── ThreatHunts.jsx               # Browse actionable threat hunts
└── lib/
    ├── stripe.js                     # Payment processing
    ├── features.js                   # Tier-based feature gates
    ├── email.js                      # Email sending utilities
    └── service-categories.js         # Service taxonomy mapping

scripts/
├── send-daily-digest.mjs
├── process-alert-rules.mjs
└── lib/
    └── email.mjs

templates/
└── emails/
    ├── daily-digest.html
    ├── weekly-digest.html
    ├── alert-notification.html
    └── welcome.html

supabase/migrations/
├── 010_user_filter_preferences.sql
├── 011_threat_hunts.sql
├── 012_user_alert_rules.sql
├── 013_notifications.sql
└── 014_subscriptions.sql
```

### Files to Modify

```
src/pages/Settings.jsx        - Add notification prefs, alert rules
src/pages/Dashboard.jsx       - Add sector drill-down
src/pages/Events.jsx          - Add geographic heatmap
src/pages/Trends.jsx          - Add calendar heatmap
src/pages/Vulnerabilities.jsx - Add treemap view
src/components/Header.jsx     - Add notification bell
src/lib/supabase.js           - Add new modules
src/App.jsx                   - Add Pricing route
.github/workflows/            - Add digest workflow
```

---

*Last updated: January 14, 2026*
*Maintainer: The Intelligence Company*
