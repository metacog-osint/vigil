# Code Improvement Plan

> **Created:** January 2026
> **Purpose:** Address code quality, architecture, and maintainability issues
> **Context:** This plan is designed to be executed independently on a clean machine
> **Priority Levels:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
> **Effort Levels:** Easy (< 1 hour), Medium (1-4 hours), Hard (> 4 hours)

---

## Summary

This plan addresses 53+ code quality and architecture issues identified during a comprehensive code review. Issues range from critical broken imports to low-priority documentation gaps.

**Key Statistics:**
- 11 code duplication issues
- 3 broken/incorrect imports (Critical)
- 15+ error handling gaps
- 8+ architecture issues
- 5+ accessibility gaps
- Test coverage is minimal (16 test files for 100+ components)

---

## Task 1: Fix Broken Imports [P0, Easy] ✅ COMPLETED

**Status:** Completed January 2026

**Problem:** Three files import from non-existent `supabaseClient` path.

**Affected Files:**
- `src/lib/exposureScoring.js:8` - `import { supabase } from './supabaseClient'`
- `src/lib/patternDetection.js:8` - `import { supabase } from './supabaseClient'`
- `src/lib/supabase/escalationPolicies.js:7` - `import { supabase } from '../supabaseClient'`

**Solution:** Update imports to use correct path.

```javascript
// BEFORE
import { supabase } from './supabaseClient'

// AFTER
import { supabase } from './supabase/client'
// or
import { supabase } from './supabase'
```

**Verification:**
- [ ] `npm run build` completes without import errors
- [ ] Exposure scoring functionality works
- [ ] Pattern detection functionality works
- [ ] Escalation policies functionality works

---

## Task 2: Consolidate Duplicate Component Re-exports [P1, Easy] ✅ COMPLETED

**Status:** Completed January 2026 - Deleted duplicate stub files

**Problem:** 10+ components exist as 3-line re-export files at root level, with actual implementation in subdirectories.

**Affected Files:**
| Root Re-export (delete) | Actual Implementation |
|-------------------------|----------------------|
| `src/components/EnrichmentPanel.jsx` | `src/components/panels/EnrichmentPanel.jsx` |
| `src/components/CorrelationPanel.jsx` | `src/components/panels/CorrelationPanel.jsx` |
| `src/components/CountryAttackPanel.jsx` | `src/components/panels/CountryAttackPanel.jsx` |
| `src/components/DataSourcesPanel.jsx` | `src/components/panels/DataSourcesPanel.jsx` |
| `src/components/EventDetailPanel.jsx` | `src/components/panels/EventDetailPanel.jsx` |
| `src/components/ChangeSummaryCard.jsx` | `src/components/widgets/ChangeSummaryCard.jsx` |
| `src/components/IOCQuickLookupCard.jsx` | `src/components/widgets/IOCQuickLookupCard.jsx` |
| `src/components/ThreatHuntCard.jsx` | `src/components/widgets/ThreatHuntCard.jsx` |
| `src/components/WeekComparisonCard.jsx` | `src/components/widgets/WeekComparisonCard.jsx` |
| `src/components/StatCard.jsx` | `src/components/common/StatCard.jsx` |

**Solution:**
1. Update `src/components/index.js` to export from correct subdirectory paths
2. Update any direct imports in pages to use the barrel export
3. Delete root-level re-export files

**Steps:**
```javascript
// In src/components/index.js, change:
export { default as EnrichmentPanel } from './EnrichmentPanel'
// To:
export { default as EnrichmentPanel } from './panels/EnrichmentPanel'
```

---

## Task 3: Consolidate Supabase Imports [P1, Hard]

**Problem:** Monolithic `src/lib/supabase.js` (3,063 lines) coexists with modular `src/lib/supabase/` directory (30+ modules). Imports are inconsistent throughout codebase.

**Current State:**
```javascript
// Some files use:
import { threatActors } from '../lib/supabase'

// Others use:
import { threatActors } from '../lib/supabase/threatActors'
```

**Solution:**

### Phase 1: Audit Usage
```bash
# Find all imports from monolithic file
grep -r "from.*lib/supabase'" src/ --include="*.js" --include="*.jsx"

# Find all imports from modular directory
grep -r "from.*lib/supabase/" src/ --include="*.js" --include="*.jsx"
```

### Phase 2: Create Clean Barrel Export
```javascript
// src/lib/supabase/index.js - Single source of truth
export { supabase } from './client'
export { threatActors } from './threatActors'
export { incidents } from './incidents'
export { iocs } from './iocs'
export { vulnerabilities } from './vulnerabilities'
// ... all other modules
```

### Phase 3: Update All Imports
- Replace direct module imports with barrel imports
- Update all pages and components

### Phase 4: Delete Monolithic File
- Archive `src/lib/supabase.js`
- Verify no remaining imports

**Verification:**
- [ ] All imports use `from '../lib/supabase'` barrel
- [ ] No direct imports to `src/lib/supabase.js`
- [ ] Build succeeds
- [ ] All features work

---

## Task 4: Add Error Boundaries [P1, Medium] ✅ COMPLETED

**Status:** Completed - Error boundaries already implemented in `src/components/common/ErrorBoundary.jsx` and applied in `src/App.jsx`

**Problem:** No error boundaries protect pages. Unhandled errors crash entire app.

**Statistics:**
- 0 Error Boundary components wrapping pages
- 28 try/catch blocks in lib (insufficient)
- Many async operations without error handling

**Solution:**

### 4a. Create Page Error Boundary
```jsx
// src/components/common/PageErrorBoundary.jsx
import { Component } from 'react'
import { ErrorFallback } from './ErrorBoundary'

export class PageErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Page error:', error, errorInfo)
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={() => this.setState({ hasError: false })}
        />
      )
    }
    return this.props.children
  }
}
```

### 4b. Wrap Routes in App.jsx
```jsx
// src/App.jsx
import { PageErrorBoundary } from './components/common/PageErrorBoundary'

<Route
  path="/dashboard"
  element={
    <PageErrorBoundary>
      <Dashboard />
    </PageErrorBoundary>
  }
/>
```

### 4c. Priority Pages to Wrap
1. Dashboard (most complex)
2. ThreatActors
3. IOCs
4. Vulnerabilities
5. Settings

---

## Task 5: Standardize API Response Format [P1, Medium]

**Problem:** Inconsistent return formats across data layer.

**Current Inconsistencies:**
```javascript
// Pattern 1: Supabase tuple
return { data, error }

// Pattern 2: Raw data
return Object.entries(counts).map(...)

// Pattern 3: Success/error object
return { success: true, id: data.id }

// Pattern 4: Null on error
return null
```

**Solution:** Standardize on Result pattern.

### Create Result Helper
```javascript
// src/lib/utils/result.js
export class Result {
  constructor(data, error = null) {
    this.data = data
    this.error = error
    this.ok = !error
  }

  static success(data) {
    return new Result(data, null)
  }

  static failure(error) {
    return new Result(null, error)
  }

  // Unwrap with default
  unwrapOr(defaultValue) {
    return this.ok ? this.data : defaultValue
  }
}
```

### Apply to Modules
```javascript
// src/lib/supabase/threatActors.js
import { Result } from '../utils/result'

async getAll(options = {}) {
  try {
    const { data, error } = await supabase
      .from('threat_actors')
      .select('*')

    if (error) return Result.failure(error)
    return Result.success(data)
  } catch (err) {
    return Result.failure(err)
  }
}
```

---

## Task 6: Add Missing Error Handling [P1, Medium]

**Problem:** Many async operations lack try/catch.

**Priority Files:**
1. `src/lib/ai.js` - AI API calls
2. `src/lib/email.js` - Email sending
3. `src/lib/integrations.js` - External service calls
4. `src/lib/alerts.js` - Webhook operations

**Pattern to Apply:**
```javascript
// BEFORE
async function fetchData() {
  const response = await fetch(url)
  return response.json()
}

// AFTER
async function fetchData() {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return { data: await response.json(), error: null }
  } catch (error) {
    console.error('Fetch failed:', error)
    return { data: null, error }
  }
}
```

---

## Task 7: Add Prop Validation [P2, Medium]

**Problem:** Zero PropTypes validation in components.

**Priority Components:**
1. Badge components (`TrendBadge`, `SeverityBadge`, `RelevanceBadge`)
2. Chart components
3. Panel components
4. Form components

**Solution Options:**

### Option A: PropTypes (Recommended for JS projects)
```jsx
import PropTypes from 'prop-types'

function TrendBadge({ status, showLabel, size }) {
  // ...
}

TrendBadge.propTypes = {
  status: PropTypes.oneOf(['ESCALATING', 'STABLE', 'DECLINING']).isRequired,
  showLabel: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
}

TrendBadge.defaultProps = {
  showLabel: true,
  size: 'md',
}
```

### Option B: TypeScript Migration (Long-term)
- Convert to `.tsx` files
- Add interfaces for all props
- Enable strict mode

---

## Task 8: Implement Memoization [P2, Medium]

**Problem:** Large components re-render unnecessarily.

**Priority Components:**
- `Dashboard.jsx` (635 lines, 25+ state variables)
- `AuditLogs.jsx` (844 lines)
- `Reports.jsx` (737 lines)

**Patterns to Apply:**

### 8a. Memoize Child Components
```jsx
import { memo } from 'react'

const ExpensiveList = memo(function ExpensiveList({ items }) {
  return items.map(item => <ListItem key={item.id} {...item} />)
})
```

### 8b. Memoize Computed Values
```jsx
const sortedData = useMemo(() => {
  return [...data].sort((a, b) => b.date - a.date)
}, [data])
```

### 8c. Memoize Callbacks
```jsx
const handleClick = useCallback((id) => {
  setSelected(id)
}, [])
```

---

## Task 9: Add Lazy Loading for Routes [P2, Hard] ✅ COMPLETED

**Status:** Completed January 2026 - Already implemented in `src/App.jsx`

**Problem:** All routes eagerly loaded, increasing initial bundle size.

**Solution:**

```jsx
// src/App.jsx
import { lazy, Suspense } from 'react'
import { SkeletonPage } from './components/common/Skeleton'

// Lazy load heavy pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const Reports = lazy(() => import('./pages/Reports'))
const ThreatActors = lazy(() => import('./pages/ThreatActors'))

function App() {
  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<SkeletonPage />}>
            <Dashboard />
          </Suspense>
        }
      />
      {/* ... other routes */}
    </Routes>
  )
}
```

**Priority Pages for Lazy Loading:**
1. Dashboard (635 lines)
2. AuditLogs (844 lines)
3. Reports (737 lines)
4. Vendors (649 lines)
5. Webhooks (616 lines)

---

## Task 10: Improve Accessibility [P2, Medium]

**Problem:** 247 buttons, only 40 ARIA/role attributes.

### 10a. Add ARIA Labels to Icon Buttons
```jsx
// BEFORE
<button onClick={handleClose}>
  <XIcon className="w-5 h-5" />
</button>

// AFTER
<button
  onClick={handleClose}
  aria-label="Close"
  title="Close"
>
  <XIcon className="w-5 h-5" aria-hidden="true" />
</button>
```

### 10b. Add Keyboard Navigation
```jsx
// Add to interactive cards
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }}
>
```

### 10c. Focus Management in Modals
```jsx
// Use focus trap in modals
import { FocusTrap } from 'focus-trap-react'

<FocusTrap>
  <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <h2 id="modal-title">Modal Title</h2>
    {/* content */}
  </div>
</FocusTrap>
```

---

## Task 11: Add Query Parameter Limits [P2, Easy]

**Problem:** Some queries fetch all data then slice in JavaScript.

**Affected:**
- `src/lib/supabase.js:321` - `getBySector()` no limit
- `src/lib/supabase.js:258` - `.slice(0, 10)` in JS instead of SQL

**Solution:**
```javascript
// BEFORE
async getBySector(days = 365) {
  const { data } = await supabase
    .from('incidents')
    .select('sector')

  // Counting in JavaScript
  const counts = {}
  data.forEach(d => counts[d.sector] = (counts[d.sector] || 0) + 1)
  return Object.entries(counts).slice(0, 10) // JS slicing
}

// AFTER - Use SQL aggregation
async getBySector(days = 365, limit = 10) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .rpc('get_incidents_by_sector', {
      since_date: since.toISOString(),
      max_results: limit
    })

  return { data, error }
}
```

---

## Task 12: Reduce Dashboard Query Count [P2, Hard]

**Problem:** Dashboard makes 9 parallel queries on load.

```javascript
// Current: 9 separate database calls
Promise.all([
  dashboard.getOverview(),
  incidents.getRecent({ limit: 10, days: 365 }),
  threatActors.getTopActive(365, 5),
  vulnerabilities.getRecentKEV(365),
  incidents.getBySector(),
  vulnerabilities.getBySeverity(),
  threatActors.getEscalating(5),
  syncLog.getRecent(1),
  incidents.getDailyCounts(90),
])
```

**Solution Options:**

### Option A: Database View/Function
```sql
-- Create dashboard summary view
CREATE OR REPLACE FUNCTION get_dashboard_summary(p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
  SELECT json_build_object(
    'overview', (SELECT row_to_json(t) FROM get_overview() t),
    'recent_incidents', (SELECT json_agg(t) FROM get_recent_incidents(10, p_days) t),
    'top_actors', (SELECT json_agg(t) FROM get_top_actors(5) t),
    -- ... combine all queries
  )
$$ LANGUAGE SQL;
```

### Option B: API Aggregation Endpoint
```javascript
// api/dashboard-data.js
export default async function handler(req, res) {
  const [overview, incidents, actors, ...] = await Promise.all([...])
  return res.json({ overview, incidents, actors, ... })
}
```

### Option C: Caching Layer
```javascript
// Cache dashboard data for 5 minutes
const CACHE_TTL = 5 * 60 * 1000
let cache = { data: null, timestamp: 0 }

async function getDashboardData() {
  if (Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data
  }
  const data = await fetchAllDashboardData()
  cache = { data, timestamp: Date.now() }
  return data
}
```

---

## Task 13: Split Large Components [P2, Hard]

**Problem:** Monolithic page components violate single responsibility.

**Priority Targets:**
| File | Lines | Issues |
|------|-------|--------|
| `AuditLogs.jsx` | 844 | 7+ internal functions |
| `Reports.jsx` | 737 | Report builder + viewer in one |
| `Dashboard.jsx` | 635 | 25+ state vars, 9 effects |
| `Vendors.jsx` | 649 | CRUD + display |
| `Webhooks.jsx` | 616 | Form + list + detail |

**Refactoring Pattern:**

```
src/pages/Dashboard/
├── index.jsx           # Main component (100-200 lines)
├── DashboardHeader.jsx
├── DashboardStats.jsx
├── ThreatOverview.jsx
├── RecentActivity.jsx
├── useDashboardData.js # Custom hook for data fetching
└── dashboardUtils.js   # Helper functions
```

**Example Split:**
```jsx
// src/pages/Dashboard/useDashboardData.js
export function useDashboardData() {
  const [data, setData] = useState(initialState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDashboardData().then(setData).catch(setError).finally(() => setLoading(false))
  }, [])

  return { data, loading, error, refresh: loadDashboardData }
}

// src/pages/Dashboard/index.jsx
import { useDashboardData } from './useDashboardData'
import { DashboardStats } from './DashboardStats'
import { ThreatOverview } from './ThreatOverview'

export default function Dashboard() {
  const { data, loading, error } = useDashboardData()

  if (loading) return <SkeletonDashboard />
  if (error) return <ErrorFallback error={error} />

  return (
    <div className="space-y-6">
      <DashboardStats stats={data.overview} />
      <ThreatOverview actors={data.actors} incidents={data.incidents} />
    </div>
  )
}
```

---

## Task 14: Remove Console Logs [P3, Easy] ✅ COMPLETED

**Status:** Completed January 2026 - Created `src/lib/logger.js` and replaced console.* calls

**Problem:** 64 console.* calls in production code.

**Solution:**

### 14a. Create Logger Utility
```javascript
// src/lib/logger.js
const isDev = import.meta.env.DEV

export const logger = {
  debug: (...args) => isDev && console.debug('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
}
```

### 14b. Replace All Console Calls
```bash
# Find all console usages
grep -rn "console\." src/lib/ --include="*.js"
```

```javascript
// BEFORE
console.log('Generating AI summary...')

// AFTER
import { logger } from './logger'
logger.debug('Generating AI summary...')
```

---

## Task 15: Add JSDoc Documentation [P3, Easy]

**Problem:** Most lib files lack documentation.

**Priority Files:**
1. `src/lib/supabase.js` (3000+ lines)
2. `src/lib/ai.js`
3. `src/lib/alerts.js`

**Template:**
```javascript
/**
 * Fetch threat actors with optional filtering
 *
 * @param {Object} options - Query options
 * @param {string} [options.search] - Search term for name/alias
 * @param {string} [options.trendStatus] - Filter by trend (ESCALATING|STABLE|DECLINING)
 * @param {number} [options.limit=50] - Max results to return
 * @param {number} [options.offset=0] - Pagination offset
 * @returns {Promise<{data: ThreatActor[], error: Error|null}>}
 *
 * @example
 * const { data, error } = await threatActors.getAll({
 *   trendStatus: 'ESCALATING',
 *   limit: 10
 * })
 */
async function getAll(options = {}) {
  // ...
}
```

---

## Task 16: Fix TODO Comments [P2, Medium]

**Problem:** TODO comments indicate incomplete features.

**Affected Files:**
- `src/pages/Pricing.jsx:94` - "TODO: Implement Stripe checkout"
- `src/pages/Pricing.jsx:143` - "TODO: Get from user subscription"

**Actions:**
1. Complete Stripe checkout integration
2. Wire up subscription status from SubscriptionContext
3. Remove or convert TODOs to GitHub issues

---

## Task 17: Add Critical Path Tests [P1, Hard]

**Problem:** Only 16 test files for 100+ components and 40+ pages.

**Critical Paths to Test:**

### 17a. Authentication Flow
```javascript
// src/lib/__tests__/auth.test.js
describe('Authentication', () => {
  test('login with valid credentials succeeds', async () => {})
  test('login with invalid credentials fails', async () => {})
  test('logout clears session', async () => {})
  test('token refresh works', async () => {})
})
```

### 17b. Data Fetching
```javascript
// src/lib/supabase/__tests__/threatActors.test.js
describe('Threat Actors', () => {
  test('getAll returns paginated results', async () => {})
  test('getById returns single actor', async () => {})
  test('search filters by name', async () => {})
  test('handles network errors gracefully', async () => {})
})
```

### 17c. Component Rendering
```javascript
// src/components/__tests__/TrendBadge.test.jsx
describe('TrendBadge', () => {
  test('renders ESCALATING status correctly', () => {})
  test('renders DECLINING status correctly', () => {})
  test('hides label when showLabel=false', () => {})
})
```

---

## Verification Checklist

### Critical Fixes
- [ ] All imports resolve correctly
- [ ] Build completes without errors
- [ ] No runtime import errors in console

### Code Organization
- [ ] Duplicate re-export files deleted
- [ ] All imports use barrel exports
- [ ] Monolithic supabase.js archived

### Error Handling
- [ ] All pages wrapped in error boundaries
- [ ] All async operations have try/catch
- [ ] Errors display user-friendly messages

### Performance
- [ ] Heavy pages lazy loaded
- [ ] Dashboard query count reduced
- [ ] No unnecessary re-renders in profiler

### Quality
- [ ] No console.log in production build
- [ ] Critical paths have tests
- [ ] PropTypes on shared components

---

## Files to Modify

| File | Action | Priority | Effort |
|------|--------|----------|--------|
| `src/lib/exposureScoring.js` | Fix import | P0 | Easy |
| `src/lib/patternDetection.js` | Fix import | P0 | Easy |
| `src/lib/supabase/escalationPolicies.js` | Fix import | P0 | Easy |
| `src/components/*.jsx` (10 files) | Delete re-exports | P1 | Easy |
| `src/components/index.js` | Update exports | P1 | Easy |
| `src/components/common/PageErrorBoundary.jsx` | Create | P1 | Medium |
| `src/App.jsx` | Add error boundaries, lazy loading | P1 | Medium |
| `src/lib/utils/result.js` | Create | P1 | Easy |
| `src/lib/supabase/*.js` | Standardize returns | P1 | Medium |
| `src/lib/logger.js` | Create | P3 | Easy |
| Multiple lib files | Replace console.* | P3 | Easy |

---

## Priority Summary

| Priority | Tasks | Description |
|----------|-------|-------------|
| P0 (Critical) | 1 | Fix broken imports |
| P1 (High) | 2, 3, 4, 5, 6, 17 | Component cleanup, error handling, API consistency, tests |
| P2 (Medium) | 7, 8, 9, 10, 11, 12, 13, 16 | Prop validation, performance, accessibility |
| P3 (Low) | 14, 15 | Console logs, documentation |

**Recommended Order:**
1. Fix P0 broken imports first (blocks other work)
2. Add error boundaries (prevents crashes)
3. Consolidate components (reduces confusion)
4. Add tests for critical paths
5. Performance optimizations
6. Polish (docs, console logs)

---

## Dependencies to Add

```bash
npm install prop-types focus-trap-react
```

---

## Notes for Implementation

- Run `npm run build` after each major change to catch errors early
- Use `git stash` liberally when switching between tasks
- The existing `src/components/common/ErrorBoundary.jsx` can be extended
- Consider TypeScript migration for long-term type safety
- Run `npm run lint` to catch style issues
