# Vigil - Feature Documentation

> Detailed documentation of Vigil's key features

---

## Table of Contents

1. [Organization Profile & Relevance Scoring](#1-organization-profile--relevance-scoring)
2. [IOC Quick Lookup](#2-ioc-quick-lookup)
3. [Actor-Vuln-TTP Correlation](#3-actor-vuln-ttp-correlation)
4. [Trend Analysis Dashboard](#4-trend-analysis-dashboard)
5. [Actor Trajectory Charts](#5-actor-trajectory-charts)
6. [Attack Path Visualization](#6-attack-path-visualization)
7. [Incident Flow Visualization](#7-incident-flow-visualization)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)
9. [Smart Time Display](#9-smart-time-display)

---

## 1. Organization Profile & Relevance Scoring

### Purpose
Transform generic CTI data into personalized intelligence by scoring threats based on your organization's sector, tech stack, and geography.

### Setup

1. Navigate to **Settings** from the sidebar
2. Click **Setup Profile** in the Organization Profile section
3. Complete the 4-step wizard:
   - **Step 1**: Select your primary sector (Healthcare, Finance, etc.)
   - **Step 2**: Select your region and country
   - **Step 3**: Choose your tech vendors (Microsoft, Cisco, AWS, etc.)
   - **Step 4**: Select your tech stack (Windows Server, Apache, etc.)

### Relevance Scoring Algorithm

Threats are scored 0-100 based on:

| Factor | Points | Description |
|--------|--------|-------------|
| Sector Match | 50 | Actor targets your sector |
| Country Match | 30 | Actor targets your country/region |
| Escalating Status | 20 | Actor is currently escalating |
| Vendor Match | 40 | CVE affects your vendor products |
| Product Match | 40 | CVE affects specific products in your stack |
| KEV Status | 10 | CVE is in CISA KEV catalog |
| Ransomware Use | 10 | CVE known to be used in ransomware |

### Components

- **OrganizationProfileSetup** - Multi-step wizard for profile configuration
- **OrganizationProfileSummary** - Displays current profile configuration
- **RelevanceBadge** - Shows relevance score (0-100) with color coding:
  - Critical (80-100): Red
  - High (60-79): Orange
  - Medium (40-59): Yellow
  - Low (20-39): Blue
  - Minimal (0-19): Gray

### Files

| File | Purpose |
|------|---------|
| `src/components/OrganizationProfileSetup.jsx` | Profile setup wizard |
| `src/components/RelevanceBadge.jsx` | Score visualization |
| `src/lib/supabase.js` (orgProfile module) | Profile storage |
| `src/lib/supabase.js` (relevance module) | Scoring functions |

---

## 2. IOC Quick Lookup

### Purpose
Single search box for instant IOC enrichment with external links and context.

### How to Use

1. Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) to open search
2. Enter any IOC value:
   - IP address (e.g., `8.8.8.8`)
   - Hash (MD5, SHA1, SHA256)
   - Domain (e.g., `evil.com`)
   - URL (e.g., `http://malware.site/payload`)
   - CVE ID (e.g., `CVE-2024-1234`)
3. View enriched results with:
   - IOC type and confidence
   - Associated threat actor (if known)
   - Malware family
   - External enrichment links

### Enrichment Links by Type

| IOC Type | External Services |
|----------|-------------------|
| IP | VirusTotal, Shodan, AbuseIPDB, Censys |
| Hash | VirusTotal, MalwareBazaar, Hybrid Analysis |
| Domain | VirusTotal, URLhaus, ThreatCrowd |
| URL | VirusTotal, URLhaus |
| CVE | NVD, CISA KEV, CVE.org |

### IOC Type Detection

The system automatically detects IOC types using regex patterns:

- **IP**: IPv4 pattern (e.g., `192.168.1.1`)
- **Hash**: 32-char (MD5), 40-char (SHA1), 64-char (SHA256)
- **CVE**: `CVE-YYYY-NNNNN` pattern
- **URL**: HTTP/HTTPS URLs
- **Domain**: Valid domain patterns

### Components

| File | Purpose |
|------|---------|
| `src/components/IOCQuickLookupCard.jsx` | Rich IOC display card |
| `src/components/SearchModal.jsx` | Enhanced with IOC detection |
| `src/lib/supabase.js` (iocs module) | quickLookup, getEnrichmentLinks |

---

## 3. Actor-Vuln-TTP Correlation

### Purpose
Connect actors to their techniques, exploited vulnerabilities, and IOCs to show attack paths.

### Features

- **Techniques (TTPs)**: MITRE ATT&CK techniques used by the actor
- **Exploited Vulnerabilities**: CVEs known to be exploited by the actor
- **Associated Malware**: Malware samples linked to the actor
- **Indicators of Compromise**: IOCs associated with the actor

### How to Use

1. Navigate to **Threat Actors** page
2. Select an actor to view details
3. The **Correlation Panel** shows:
   - Collapsible sections for TTPs, CVEs, Malware, IOCs
   - Count badges for each category
   - Summary statistics at the bottom
   - Click-through to related entities

### Components

| File | Purpose |
|------|---------|
| `src/components/CorrelationPanel.jsx` | Main correlation display |
| `src/lib/supabase.js` (correlations module) | Correlation queries |

### API Functions

\`\`\`javascript
// Get all correlations for an actor
const data = await correlations.getActorCorrelations(actorId)
// Returns: { techniques, vulnerabilities, iocs, malware }

// Get actors exploiting a CVE
const actors = await correlations.getVulnActors(cveId)

// Get actors using a technique
const actors = await correlations.getTechniqueActors(techniqueId)
\`\`\`

---

## 4. Trend Analysis Dashboard

### Purpose
Week-over-week comparisons, sector trends, actor trajectories, and "what changed" summaries.

### Access

Navigate to **Trends** from the sidebar.

### Features

#### Week-over-Week Comparison
- Current week vs previous week incident counts
- Percentage change indicator (up/down)
- Visual change summary

#### Change Summary ("What's New")
- New incidents in the period
- New actors detected
- New KEVs added
- Escalating actors list

#### Sector Trends
- Multi-line chart showing sector targeting over time
- Top 6 sectors displayed
- Time range selector (30/60/90 days)

#### Activity Trend
- Area chart showing daily incident activity
- Selectable time range

### Time Ranges

| Range | Description |
|-------|-------------|
| 30 days | Last month of activity |
| 60 days | Last 2 months |
| 90 days | Last quarter |

### Components

| File | Purpose |
|------|---------|
| `src/pages/TrendAnalysis.jsx` | Main trends page |
| `src/components/WeekComparisonCard.jsx` | Week-over-week metrics |
| `src/components/ChangeSummaryCard.jsx` | "What changed" summary |
| `src/lib/supabase.js` (trendAnalysis module) | Trend queries |

### API Functions

\`\`\`javascript
// Get week-over-week data
const comparison = await trendAnalysis.getWeekOverWeekChange()

// Get change summary for last N days
const changes = await trendAnalysis.getChangeSummary(7)

// Get sector trends over time
const sectorData = await trendAnalysis.getSectorTrends(30)
\`\`\`

---

## 5. Actor Trajectory Charts

### Purpose
Track and compare threat actor activity over time with historical trend visualization.

### Features

- **Multi-Actor Comparison**: Compare up to 8 actors on the same chart
- **Historical Data**: View incident counts over 30/60/90 day periods
- **Activity Metrics**: Track incidents_7d, incidents_30d, and incident velocity
- **Mini Version**: Compact sparkline-style chart for dashboard widgets

### How to Use

1. Navigate to **Trends** page
2. Scroll to the **Actor Trajectories** section
3. Use the actor selector to choose actors to compare
4. Select time range (30/60/90 days)

### Components

| File | Purpose |
|------|---------|
| `src/components/ActorTrajectoryChart.jsx` | Full trajectory chart with legend |
| `ActorTrajectoryMini` | Compact version for widgets |
| `ActorSelector` | Multi-select dropdown for actor selection |

### Data Source

Historical data is captured daily by `scripts/snapshot-actor-trends.mjs` and stored in the `actor_trend_history` table.

---

## 6. Attack Path Visualization

### Purpose
Visual representation of attack chains showing how actors move from techniques to targets.

### Features

- **Node Types**: Actor (red), Technique (purple), Vulnerability (amber), IOC (blue)
- **Flow Visualization**: Shows connections between attack elements
- **Interactive**: Hover for details on connections
- **Compact Mode**: Mini version for embedding in panels

### Components

| File | Purpose |
|------|---------|
| `src/components/AttackPathDiagram.jsx` | Full attack path diagram |
| `AttackPathMini` | Compact card version |

### How It Works

The attack path shows:
1. **Actor** → entry point
2. **Techniques** → methods used (MITRE ATT&CK)
3. **Vulnerabilities** → CVEs exploited
4. **IOCs** → indicators generated

---

## 7. Incident Flow Visualization

### Purpose
Sankey-style diagram showing attack flows from actors to targeted sectors.

### Features

- **Actor → Sector Flow**: Shows which actors target which sectors
- **Volume Indication**: Link thickness represents incident count
- **Color Coding**: Actors (red), Tactics (purple), Sectors (blue)
- **Legend**: Clear category identification

### How to Use

1. Navigate to **Incidents** page
2. The flow visualization appears automatically when data is loaded
3. Shows top 5 actors and top 5 targeted sectors

### Components

| File | Purpose |
|------|---------|
| `src/components/IncidentFlow.jsx` | Sankey diagram component |
| `IncidentFlowSimple` | Simplified bar-based flow |
| `AttackChain` | Timeline-style attack chain |

---

## 8. Keyboard Shortcuts

### Purpose
Quick navigation and actions without using the mouse.

### Access

Press `?` anywhere in the app to open the keyboard shortcuts help modal.

### Available Shortcuts

#### Navigation (g + key)
| Shortcut | Action |
|----------|--------|
| `g` then `d` | Go to Dashboard |
| `g` then `a` | Go to Actors |
| `g` then `i` | Go to Incidents |
| `g` then `v` | Go to Vulnerabilities |
| `g` then `t` | Go to Techniques |
| `g` then `w` | Go to Watchlists |
| `g` then `r` | Go to Trends |
| `g` then `s` | Go to Settings |

#### Search
| Shortcut | Action |
|----------|--------|
| `/` | Open search / Focus search input |
| `Cmd+K` / `Ctrl+K` | Open quick search modal |

#### Interface
| Shortcut | Action |
|----------|--------|
| `[` | Toggle sidebar collapse |
| `?` | Show keyboard shortcuts help |
| `Escape` | Close modals / Blur input |

### Components

| File | Purpose |
|------|---------|
| `src/components/KeyboardShortcutsModal.jsx` | Help modal with shortcut list |
| `src/hooks/useKeyboardShortcuts.js` | Keyboard event handling |

---

## 9. Smart Time Display

### Purpose
Intelligent time formatting that adapts based on how recent the date is.

### Formats

| Time Distance | Display Format |
|---------------|----------------|
| < 24 hours | "2 hours ago" |
| Today | "Today at 14:30" |
| Yesterday | "Yesterday at 09:15" |
| This week | "Monday" |
| Older | "Jan 5, 2026" |

### Components

| Component | Usage |
|-----------|-------|
| `TimeAgo` | Always shows relative time with full date tooltip |
| `SmartTime` | Adaptive formatting based on age |
| `DateBadge` | Colored badge with smart formatting |
| `FullDate` | Always shows full date (e.g., "January 5, 2026") |
| `Timestamp` | Monospace ISO format for technical display |

### Usage Example

```jsx
import { SmartTime, FullDate, TimeAgo } from '../components/TimeDisplay'

// In a list - adaptive display
<SmartTime date={incident.discovered_date} />

// In detail panel - full date
<FullDate date={incident.discovered_date} />

// Always relative
<TimeAgo date={actor.last_seen} />
```

### Files

| File | Purpose |
|------|---------|
| `src/components/TimeDisplay.jsx` | All time formatting components |
| `smartFormatDate()` | Utility function for smart formatting |

---

## Implementation Details

### Supabase Modules

All features use modular functions in `src/lib/supabase.js`:

| Module | Functions |
|--------|-----------|
| `orgProfile` | get(), update(), hasProfile() |
| `relevance` | getRelevantActors(), getRelevantVulnerabilities(), calculateActorScore(), calculateVulnScore() |
| `correlations` | getActorCorrelations(), getAttackPath(), getVulnActors(), getTechniqueActors() |
| `trendAnalysis` | getWeeklyComparison(), getWeekOverWeekChange(), getSectorTrends(), getChangeSummary() |
| `iocs` | quickLookup(), getEnrichmentLinks() |

### Routes

| Route | Component | Feature |
|-------|-----------|---------|
| `/settings` | Settings.jsx | Organization Profile |
| `/trends` | TrendAnalysis.jsx | Trend Analysis |
| `/actors` | ThreatActors.jsx | Correlation Panel (detail view) |

---

## Version History

### v0.3.0 (January 2026)
- Added Actor Trajectory Charts for historical trend comparison
- Added Attack Path Visualization diagrams
- Added Incident Flow (Sankey) visualization on Incidents page
- Added Keyboard Shortcuts modal (press `?` for help)
- Added Smart Time Display components (SmartTime, TimeAgo, etc.)
- Added AttackMatrixHeatmap toggle to Techniques page
- Added daily actor snapshots automation
- Added weekly summary generation automation
- Integrated NewBadge indicators across pages
- Added `getAll` functions for incidents, vulnerabilities, iocs, alerts

### v0.2.0 (January 2026)
- Added Organization Profile & Relevance Scoring
- Added IOC Quick Lookup with enrichment links
- Added Actor-Vuln-TTP Correlation panel
- Added Trend Analysis dashboard

### v0.1.0 (Initial Release)
- Core CTI dashboard functionality
- Threat actors, incidents, vulnerabilities, IOCs
- Search and export features

---

*Last updated: January 2026*
