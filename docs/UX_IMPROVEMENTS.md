# UX Improvements System

> **Version:** 1.3.0 | **Last Updated:** January 19, 2026

## Overview

A comprehensive set of UX improvements implemented across 5 phases to transform Vigil into an analyst's daily command center.

## Phase 1: Quick Wins

### What's New Badge

Track new items since the user's last visit:

```javascript
import { useLastVisit } from '../hooks/useLastVisit'
import { getNewItemsSince } from '../lib/whatsNew'

const { lastVisit, updateLastVisit } = useLastVisit()
const newItems = await getNewItemsSince(lastVisit)
// Returns: { incidents: 5, actors: 3, kevs: 2, total: 10 }
```

**Component:**
```jsx
import WhatsNewBadge from '../components/common/WhatsNewBadge'

<WhatsNewBadge /> // Shows badge with dropdown in header
```

### Keyboard Shortcuts

Global keyboard navigation system:

```javascript
import { SHORTCUTS } from '../lib/shortcuts'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

// Register shortcuts
useKeyboardShortcuts({
  onToggleSidebar: () => setSidebarCollapsed(!collapsed),
  onOpenSearch: () => setSearchOpen(true),
  onShowHelp: () => setHelpOpen(true),
})
```

**Key shortcuts:**
| Shortcut | Action |
|----------|--------|
| `?` | Show shortcuts help |
| `Ctrl+K` | Open search |
| `G then D` | Go to Dashboard |
| `G then A` | Go to Actors |
| `F` | Toggle Focus Mode |

### One-Click Actions

Quick action components:

```jsx
import { ExportIOCsButton, CreateAlertButton, BulkActionBar } from '../components/actions'

<ExportIOCsButton entityType="incident" entityId={incidentId} />
<CreateAlertButton entityType="actor" entityId={actorId} />
<BulkActionBar selectedIds={selectedIds} entityType="iocs" />
```

## Phase 2: Focus Mode & Quick IOC

### Focus Mode

Filter entire application to user's organization context:

```jsx
import { useFocusMode, FocusModeProvider } from '../hooks/useFocusMode'

// Wrap app with provider
<FocusModeProvider>
  <App />
</FocusModeProvider>

// Use in components
const { enabled, toggle, filters, profile } = useFocusMode()

// Build focus filters from profile
import { buildFocusFilters } from '../lib/focusFilters'
const filters = buildFocusFilters(profile)
```

**Component:**
```jsx
import FocusModeToggle from '../components/common/FocusModeToggle'

<FocusModeToggle /> // Toggle button for header
```

### Quick IOC Check

Inline IOC lookup in header:

```jsx
import QuickIOCInput from '../components/common/QuickIOCInput'
import { detectIOCType } from '../lib/iocDetection'

// Auto-detect IOC type
const { type, confidence, meta } = detectIOCType('8.8.8.8')
// Returns: { type: 'ipv4', confidence: 100, meta: { color: 'text-blue-400' } }

<QuickIOCInput /> // Search input with inline results
```

**Supported IOC types:** IPv4, IPv6, MD5, SHA1, SHA256, Domain, URL, Email, CVE

## Phase 3: Digests & Comparisons

### Comparison Dashboard

Time-based comparison analysis:

```jsx
import Compare from '../pages/Compare'
import {
  TimeRangeSelector,
  ComparisonCard,
  TrendChart,
  SectorComparison,
  RegionComparison,
} from '../components/compare'

<TimeRangeSelector value={range} onChange={setRange} />
<ComparisonCard
  title="Incidents"
  currentValue={47}
  previousValue={42}
  inverted={true} // Lower is better
/>
```

**Route:** `/compare`

### Digest Emails

Automated digest generation and sending:

```javascript
import { generateDigest, getDigestRecipients } from '../lib/digestGenerator'
import { generateDigestEmail } from '../lib/digestTemplates'

// Generate digest content
const digest = await generateDigest(userId, 'weekly')

// Generate email
const { html, text, subject } = generateDigestEmail(digest)
```

**NPM Scripts:**
```bash
npm run send:digests              # Send digests (auto-detects type)
npm run send:digests:daily        # Send daily digests
npm run send:digests:weekly       # Send weekly digests
```

**GitHub Actions:** `.github/workflows/send-digests.yml` runs daily at 8 AM UTC.

## Phase 4: Customization & Collaboration

### Widget Registry

Dashboard customization system:

```javascript
import { WIDGETS, WIDGET_TYPES, DEFAULT_LAYOUT, getWidgetById } from '../lib/widgetRegistry'

// Available widget types
WIDGET_TYPES.BLUF           // AI Summary
WIDGET_TYPES.PRIORITIES     // Priorities for You
WIDGET_TYPES.ESCALATING     // Escalating Actors
WIDGET_TYPES.STATS          // Stats Row
WIDGET_TYPES.ACTIVITY_CHART // Activity Chart
WIDGET_TYPES.TOP_ACTORS     // Top Actors
// ... and more
```

**Layout Hook:**
```javascript
import { useDashboardLayout } from '../hooks/useDashboardLayout'

const {
  layout,
  loading,
  addWidget,
  removeWidget,
  updateWidgetConfig,
  resetLayout,
} = useDashboardLayout()
```

**Widget Picker:**
```jsx
import WidgetPicker from '../components/dashboard/WidgetPicker'

<WidgetPicker
  isOpen={showPicker}
  onClose={() => setShowPicker(false)}
  onSelectWidget={handleAddWidget}
  existingWidgets={layout.widgets}
/>
```

### Collaboration Features

**Share Links:**
```javascript
import { createShareLink, getShareLinks, copyToClipboard } from '../lib/sharing'

const link = await createShareLink('actor', actorId, { expiresInDays: 7 })
// Returns: { url: 'https://vigil.../s/abc123', token: 'abc123' }

await copyToClipboard(link.url)
```

**Entity Notes:**
```javascript
import { createNote, getNotes, updateNote, deleteNote } from '../lib/notes'

await createNote('actor', actorId, 'Investigation notes...', { isTeamVisible: true })
const notes = await getNotes('actor', actorId)
```

**Components:**
```jsx
import { ShareButton, NoteEditor } from '../components/collaboration'

<ShareButton entityType="actor" entityId={actorId} entityName="LockBit" />
<NoteEditor entityType="actor" entityId={actorId} />
```

## Phase 5: Predictive Intelligence

### Predictions Library

Predictive analytics for threat intelligence:

```javascript
import {
  getActorEscalationRisk,
  getSectorTargetingPrediction,
  getVulnExploitationPrediction,
  getOrgRiskScore,
  getPredictiveAlerts,
  RISK_LEVELS,
} from '../lib/predictions'

// Actor escalation risk
const risk = await getActorEscalationRisk(actorId)
// Returns: { risk: 'high', increase: 75, signal: 'Pre-campaign pattern detected', confidence: 85 }

// Sector targeting prediction
const prediction = await getSectorTargetingPrediction('healthcare')
// Returns: { risk: 'medium', isSeasonalPeak: true, prediction: 'Flu season targeting expected' }

// Vulnerability exploitation prediction
const vulnRisk = await getVulnExploitationPrediction('CVE-2026-1234')
// Returns: { risk: 'critical', daysToExploit: '0-3', score: 75, reasons: [...] }

// Organization risk score
const orgRisk = await getOrgRiskScore(profile)
// Returns: { score: 65, risk: 'high', factors: [...], trend: 'increasing' }

// Get all predictive alerts
const alerts = await getPredictiveAlerts(profile)
```

### Similarity Engine

Find related items:

```javascript
import {
  getSimilarIncidents,
  getSimilarActors,
  getSimilarVulnerabilities,
} from '../lib/similarity'

const similar = await getSimilarIncidents(incidentId, 5)
// Returns: [{ ...incident, similarity: { score: 75, factors: [...] } }, ...]
```

**Components:**
```jsx
import { PredictiveAlert, RiskIndicator, SimilarItems } from '../components/insights'

<PredictiveAlert
  type="actor_escalation"
  entity="LockBit"
  risk="high"
  message="Pre-campaign pattern detected"
  confidence={85}
/>

<RiskIndicator
  score={65}
  risk="high"
  factors={factors}
  showDetails={true}
/>

<SimilarItems
  type="incident"
  entityId={incidentId}
  limit={5}
/>
```

## Database Tables (Migration 068)

```sql
-- Digest preferences
CREATE TABLE digest_preferences (
  user_id UUID REFERENCES auth.users(id),
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'none')),
  send_time TIME DEFAULT '08:00',
  timezone TEXT DEFAULT 'UTC',
  include_sections JSONB
);

-- Digest history
CREATE TABLE digest_history (
  user_id UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  digest_type TEXT,
  content_hash TEXT
);

-- Entity notes
CREATE TABLE entity_notes (
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id TEXT,
  content TEXT,
  is_team_visible BOOLEAN
);

-- Share links
CREATE TABLE share_links (
  created_by UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id TEXT,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  view_count INTEGER
);

-- Dashboard layouts
CREATE TABLE dashboard_layouts (
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  layout JSONB,
  is_default BOOLEAN
);

-- Team watchlists
CREATE TABLE team_watchlists (
  team_id UUID REFERENCES teams(id),
  name TEXT,
  description TEXT
);
```

## Dashboard Data Fixes (v1.3.1)

Three data quality issues were identified and fixed:

### 1. Global Threat Map "No Data" on Hover

**Problem:** Hovering over countries showed "No data" despite incidents existing.

**Root Cause:** Data stored with ISO-2 codes (US, GB), but map uses ISO-3 codes (USA, GBR). The reverse lookup was incomplete.

**Fix:** Added comprehensive `ISO3_TO_ISO2` mapping with 100+ countries in `src/components/ThreatAttributionMap.jsx`

### 2. Threat Level Always 100/100

**Problem:** Threat level gauge always showed 100/100 "Critical".

**Root Cause:** Using `log2` scale which maxed out too quickly.

**Fix:** Updated calculation in `src/pages/dashboard/useDashboardData.js` to use `log10` scale:

**New scale:**
- 100 incidents → 33 base score
- 500 incidents → 45 base score
- 1000 incidents → 50 base score
- 5000 incidents → 60 base score

### 3. Targeted Sectors 905 "Unknown"

**Problem:** Most incidents showed "Unknown" sector in the dashboard chart.

**Fix:** Run reclassification for existing data:
```bash
npm run reclassify:sectors
```

## File Structure

```
src/
├── components/
│   ├── actions/
│   │   ├── ExportIOCsButton.jsx
│   │   ├── CreateAlertButton.jsx
│   │   └── BulkActionBar.jsx
│   ├── collaboration/
│   │   ├── ShareButton.jsx
│   │   └── NoteEditor.jsx
│   ├── common/
│   │   ├── WhatsNewBadge.jsx
│   │   ├── FocusModeToggle.jsx
│   │   └── QuickIOCInput.jsx
│   ├── compare/
│   │   ├── TimeRangeSelector.jsx
│   │   ├── ComparisonCard.jsx
│   │   ├── TrendChart.jsx
│   │   ├── SectorComparison.jsx
│   │   └── RegionComparison.jsx
│   ├── dashboard/
│   │   └── WidgetPicker.jsx
│   └── insights/
│       ├── PredictiveAlert.jsx
│       ├── RiskIndicator.jsx
│       └── SimilarItems.jsx
├── hooks/
│   ├── useLastVisit.js
│   ├── useFocusMode.jsx
│   └── useDashboardLayout.js
├── lib/
│   ├── shortcuts.js
│   ├── whatsNew.js
│   ├── focusFilters.js
│   ├── iocDetection.js
│   ├── digestGenerator.js
│   ├── digestTemplates.js
│   ├── widgetRegistry.js
│   ├── sharing.js
│   ├── notes.js
│   ├── predictions.js
│   └── similarity.js
├── pages/
│   └── Compare.jsx
scripts/
└── send-digests.mjs
```
