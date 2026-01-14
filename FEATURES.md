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
10. [Data Sources & Actor Taxonomy](#10-data-sources--actor-taxonomy)
11. [Threat Actors Page Enhancements](#11-threat-actors-page-enhancements-v041)

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

## 10. Data Sources & Actor Taxonomy

### Purpose
Comprehensive threat intelligence from 11 automated data sources covering ransomware, APT groups, malware, vulnerabilities, and IOCs.

### Automated Data Sources

| Source | Type | Data | Update Frequency |
|--------|------|------|------------------|
| [RansomLook](https://ransomlook.io/) | Ransomware | ~600 groups, victims | Every 6 hours |
| [Ransomware.live](https://ransomware.live/) | Incidents | 16,000+ attacks | Every 6 hours |
| [MITRE ATT&CK](https://attack.mitre.org/) | TTPs | 172 APT groups, 691 techniques | Every 6 hours |
| [Malpedia](https://malpedia.caad.fkie.fraunhofer.de/) | Malware | 864 actors, 3,638 families | Every 6 hours |
| [MISP Galaxy](https://github.com/MISP/misp-galaxy) | Actors | 2,940 community actors | Every 6 hours |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Vulnerabilities | 1,100+ exploited CVEs | Every 6 hours |
| [CISA Alerts](https://www.cisa.gov/news-events/cybersecurity-advisories) | Advisories | Security alerts | Every 6 hours |
| [NVD](https://nvd.nist.gov/) | Vulnerabilities | Recent CVEs | Every 6 hours |
| [Abuse.ch ThreatFox](https://threatfox.abuse.ch/) | IOCs | Malware indicators | Every 6 hours |
| [Abuse.ch URLhaus](https://urlhaus.abuse.ch/) | IOCs | Malicious URLs | Every 6 hours |
| [Abuse.ch Feodo](https://feodotracker.abuse.ch/) | IOCs | Botnet C2 IPs | Every 6 hours |

### Actor Type Taxonomy

Vigil classifies threat actors into 6 categories:

| Category | Count | Description | Examples |
|----------|-------|-------------|----------|
| **Ransomware** | 578 | Encrypt & extort groups | LockBit, ALPHV, Akira |
| **APT** | 362 | State-sponsored espionage | APT28, Lazarus, Cozy Bear |
| **Cybercrime** | 25 | Financial fraud | FIN7, Magecart, Scattered Spider |
| **Hacktivism** | 23 | Political motivation | Anonymous, Killnet, Lapsus$ |
| **Initial Access Broker** | 9 | Sell network access | Emotet, Qakbot operators |
| **Data Extortion** | 3 | Steal without encrypting | Karakurt, RansomHouse |

### Data Sources Panel

The Settings page includes a **Data Sources** panel showing:

1. **Actor Type Distribution** - Breakdown of actors by category
2. **Sync Status** - Status of each automated source (success/error/partial)
3. **Last Sync Time** - When each source was last updated
4. **Records Added** - Count of records from last sync

### How to Access

1. Navigate to **Settings** from the sidebar
2. Scroll to the **Data Sources** section
3. View sync status and actor counts

### Manual Updates

For sources without automated feeds (hacktivism groups, IABs), run:

```bash
npm run seed:actor-types
```

### Ingestion Scripts

| Script | Command | Source |
|--------|---------|--------|
| `ingest-ransomlook.mjs` | `npm run ingest:ransomlook` | RansomLook |
| `ingest-ransomware-live.mjs` | `npm run ingest:ransomware-live` | Ransomware.live |
| `ingest-mitre.mjs` | `npm run ingest:mitre` | MITRE ATT&CK |
| `ingest-malpedia.mjs` | `npm run ingest:malpedia` | Malpedia |
| `ingest-misp-galaxy.mjs` | `npm run ingest:misp-galaxy` | MISP Galaxy |
| `ingest-kev.mjs` | `npm run ingest:kev` | CISA KEV |
| `ingest-cisa-alerts.mjs` | `npm run ingest:cisa-alerts` | CISA Alerts |
| `ingest-nvd.mjs` | `npm run ingest:nvd` | NVD |
| `ingest-threatfox.mjs` | `npm run ingest:threatfox` | ThreatFox |
| `ingest-urlhaus.mjs` | `npm run ingest:urlhaus` | URLhaus |
| `ingest-feodo.mjs` | `npm run ingest:feodo` | Feodo Tracker |
| `seed-actor-types.mjs` | `npm run seed:actor-types` | Curated actors |

### Components

| File | Purpose |
|------|---------|
| `src/components/DataSourcesPanel.jsx` | Data sources status UI |
| `src/lib/supabase.js` (dataSources module) | Sync status queries |

---

## 11. Threat Actors Page Enhancements (v0.4.1)

### Purpose
Comprehensive improvements to the Threat Actors page for better usability, navigation, and data analysis.

### Features

#### 1. Pagination / Load More
- Displays 50 actors at a time for faster initial load
- "Load More" button shows progress (e.g., "50 of 3,294")
- Maintains filter state while loading more

#### 2. CSV Export
- Click "Export" button in header toolbar
- Exports all visible columns: Name, Type, Trend, Incidents, Last Seen, Status, Risk Score, Aliases, Sectors
- Filename includes date (e.g., `threat-actors-2026-01-14.csv`)

#### 3. Saved Filters
- Click "Saved Filters" dropdown in header
- Enter name and click "Save" to store current filter combination
- Click saved filter name to apply
- Click X to delete saved filter
- Stores: search, sector, type, trend, status filters + sort configuration

#### 4. Activity Sparklines
- Mini trend visualization in the "7d / Prev" column
- Shows 5-point interpolated line from previous week to current week
- Color indicates direction: red (increasing), green (decreasing), gray (stable)
- Only shows for actors with activity data

#### 5. Related Actors (Detail Panel)
- "Similar Actors" section in actor detail panel
- Shows top 5 actors with highest similarity score
- Similarity based on: same type (20pts), shared sectors (15pts each), shared TTPs (10pts each)
- Click to switch to that actor's details

#### 6. Quick Watchlist (Shift+Click)
- Hold Shift and click rows to select multiple actors
- Selected rows highlighted in cyan
- "Add X to Watchlist" button appears when rows selected
- Bulk adds all selected actors to watchlist

#### 7. Keyboard Navigation
- `↑` / `↓` - Navigate between rows
- `Enter` - Open selected actor's detail panel
- `Escape` - Close detail panel, clear selection
- `/` - Focus search input
- Keyboard hints bar shown below header

#### 8. Map View
- Toggle between "Table" and "Map" view in header
- Map view shows actors grouped by:
  - **Target Region** - Countries/regions targeted
  - **Target Sector** - Industries targeted (clickable to filter)
  - **Actor Type** - Color-coded type breakdown (clickable to filter)

#### 9. Risk Score
- Requires Organization Profile setup in Settings
- Shows relevance score (0-100) based on:
  - Sector match: 50 points
  - Country/region match: 30 points
  - Escalating status: 20 points
- Color-coded badge: Red (80+), Orange (60+), Yellow (40+), Blue (<40)
- Sortable column (hidden on smaller screens)

### Components

| Component | Purpose |
|-----------|---------|
| `ColumnMenu` | Dropdown menu for column headers with sort/filter options |
| `Sparkline` | Mini line chart for activity visualization |
| Table row selection | Shift+click multi-select functionality |
| View mode toggle | Table/Map view switcher |

### Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate rows |
| `Enter` | View actor details |
| `Escape` | Close panel / Clear selection |
| `/` | Focus search |
| `Shift+Click` | Select multiple rows |

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/ThreatActors.jsx` | All 9 features implemented |
| `src/components/Tooltip.jsx` | Added ColumnMenu component |
| `src/lib/supabase.js` | Added status filter support |

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
| `dataSources` | sources, getSyncStatus(), getActorTypeCounts() |

### Routes

| Route | Component | Feature |
|-------|-----------|---------|
| `/settings` | Settings.jsx | Organization Profile |
| `/trends` | TrendAnalysis.jsx | Trend Analysis |
| `/actors` | ThreatActors.jsx | Correlation Panel (detail view) |

---

## Version History

### v0.4.1 (January 2026)
- Added Threat Actors page enhancements:
  - Pagination/Load More (50 actors at a time)
  - CSV export with all columns
  - Saved filters functionality
  - Activity sparklines in 7d/Prev column
  - Related actors in detail panel
  - Quick watchlist (Shift+click multi-select)
  - Keyboard navigation (arrow keys, Enter, /, Escape)
  - Map view toggle (region, sector, type breakdown)
  - Risk score column based on org profile
- Added ColumnMenu component for table headers with sort/filter options
- Added color-coded actor type badges
- Improved column sorting with type grouping

### v0.4.0 (January 2026)
- Added Malpedia integration (864 actors, 3,638 malware families)
- Added MISP Galaxy integration (2,940 community actors)
- Added MITRE ATT&CK intrusion-sets parsing (172 APT groups with TTPs)
- Added Data Sources Panel UI showing sync status and actor counts
- Expanded actor taxonomy to 6 categories (1,000+ total actors)
- Added automated trend calculation in GitHub Actions workflow
- Added curated actor types script (cybercrime, hacktivism, IABs, data extortion)
- Fixed user_preferences 406 error
- Fixed vulnerabilities 400 error

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
