# Testing Expansion Plan

> Comprehensive plan to improve test coverage and reliability.
>
> **Created:** January 17, 2026
> **Related:** BUILD_PLAN_V2.md (Section A.4), CODE_IMPROVEMENT_PLAN.md (Task 17)

---

## Current State

| Metric | Value | Target |
|--------|-------|--------|
| Unit Tests | 909 passing | - |
| Test Coverage (statements) | 50.7%+ | 60%+ |
| Test Coverage (branches) | 43%+ | 50%+ |
| E2E Tests | 19-20 passing | 30+ |
| Browsers in CI | Chromium, Firefox, WebKit | ✅ All browsers enabled |

### Existing Test Files

**Unit Tests (`src/lib/__tests__/`):**
- `features.test.js`
- `queryParser.test.js`
- `analytics.test.js`
- `supabase.test.js`
- `apiKeys.test.js`
- `integrations.test.js`
- `customIocs.test.js`
- `ai.test.js`
- `utils.test.js`

**Supabase Module Tests (`src/lib/supabase/__tests__/`):**
- `incidents.test.js` (31 tests)
- `threatActors.test.js` (18 tests)
- `iocs.test.js` (49 tests)
- `vulnerabilities.test.js`
- `watchlists.test.js`
- `alerts.test.js`
- `trendAnalysis.test.js`

**Component Tests (`src/components/`):**
- `badges/__tests__/TrendBadge.test.jsx` (17 tests) - ✅ Added Jan 2026
- `badges/__tests__/SeverityBadge.test.jsx` (33 tests) - ✅ Added Jan 2026
- `common/__tests__/ErrorBoundary.test.jsx` (16 tests) - ✅ Added Jan 2026
- `common/__tests__/LoadingState.test.jsx` (30 tests) - ✅ Added Jan 2026

**Test Utilities:**
- `src/test/utils.jsx` - Test utilities and render helpers

**E2E Tests (`e2e/`):**
- `dashboard.spec.js`
- `search.spec.js`
- `threat-actors.spec.js`
- `navigation.spec.js`
- `vulnerabilities.spec.js`
- `incidents.spec.js`
- `iocs.spec.js`
- `accessibility.spec.js`
- `watchlists.spec.js`
- `export.spec.js`

---

## Phase 1: E2E Browser Coverage (P1) ✅ COMPLETED

**Status:** Completed January 2026 - Multi-browser matrix enabled in `.github/workflows/ci.yml`

Playwright config already has Firefox, Safari, and mobile viewports defined. CI now runs all browsers via matrix strategy.

### Task 1.1: Enable Firefox in CI ✅ COMPLETED
**File:** `.github/workflows/test.yml`
**Change:** Add Firefox to the test matrix or run all browsers
```yaml
- name: Run E2E tests
  run: npx playwright test --project=chromium --project=firefox
```
**Estimated Impact:** +5 min CI time

### Task 1.2: Enable WebKit in CI ✅ COMPLETED
**File:** `.github/workflows/ci.yml`
**Implementation:** WebKit now runs via matrix strategy alongside Chromium and Firefox.
```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
steps:
  - run: npx playwright install --with-deps ${{ matrix.browser }}
  - run: npx playwright test --project=${{ matrix.browser }}
```

### Task 1.3: Mobile Viewport Testing ✅ COMPLETED
**Already configured:** `Mobile Chrome`, `Mobile Safari` in `playwright.config.js`
**Implementation:** Created `e2e/mobile.spec.js` with comprehensive mobile tests:
- Dashboard load and display
- Navigation menu on mobile
- Search functionality
- Detail panels
- Touch interactions
- Performance benchmarks

---

## Phase 2: Missing E2E Test Flows (P1) ✅ ALL COMPLETED

### Task 2.1: Watchlist Management Flow ✅ COMPLETED
**File:** `e2e/watchlists.spec.js` (enhanced January 2026)
**Scenarios:**
- [x] Create new watchlist
- [x] Add entity to watchlist
- [x] Remove entity from watchlist
- [x] Delete watchlist
- [x] Watchlist persistence after page reload
- [x] Mobile viewport tests

### Task 2.2: Export Functionality ✅ COMPLETED
**File:** `e2e/export.spec.js` (enhanced January 2026)
**Scenarios:**
- [x] Export threat actors to CSV
- [x] Export IOCs to STIX 2.1
- [x] Export incidents to JSON
- [x] Verify downloaded file format
- [x] Mobile export tests

### Task 2.3: Alert Configuration Flow ✅ COMPLETED
**File:** `e2e/alerts.spec.js`
**Status:** Completed January 2026
**Scenarios:**
- [x] Create alert rule
- [x] Edit alert rule conditions
- [x] Enable/disable alert rule
- [x] Test webhook configuration UI

### Task 2.4: Settings Pages ✅ COMPLETED
**File:** `e2e/settings.spec.js`
**Status:** Completed January 2026
**Scenarios:**
- [x] Profile settings save
- [x] Organization profile setup
- [x] API key generation
- [x] Notification preferences

---

## Phase 3: Unit Test Coverage Gaps (P2)

### Task 3.1: Hook Tests ✅ COMPLETED
**Status:** Completed January 2026
**Files:** `src/hooks/__tests__/useFilters.test.jsx`, `src/hooks/__tests__/useDataLoading.test.js`
**Priority files:**
- [x] `src/hooks/useFilters.js` - Filter state management
- [x] `src/hooks/useDataLoading.js` - Data fetching
- [ ] `src/hooks/useTableState.js` - Table interactions (deferred)
- [ ] `src/hooks/useKeyboardNavigation.js` - Keyboard handling (deferred)

### Task 3.2: Utility Function Tests ✅ COMPLETED
**Status:** Completed January 2026 - 49 tests
**File:** `src/lib/__tests__/utils.test.js`
**Coverage:**
- [x] classifySeverity - CVSS severity classification
- [x] detectIOCType - IOC type detection (IP, hash, URL, domain, email, CVE)
- [x] formatNumber - Number formatting with K/M/B suffixes
- [x] truncate - Text truncation
- [x] parseDate - Date parsing
- [x] relativeTime - Relative time formatting
- [x] sanitize - HTML sanitization
- [x] stringToColor - Consistent color generation

### Task 3.3: Component Tests (React Testing Library) ✅ PARTIALLY COMPLETED
**Status:** 4 component test suites added (96 tests total) - January 2026

**Completed:**
- [x] `ErrorBoundary` - Error handling (16 tests)
- [x] `LoadingState` - Loading/error/empty states (30 tests)
- [x] `SeverityBadge` - Rendering variants (33 tests)
- [x] `TrendBadge` - Status display (17 tests)

**Remaining:**
- [x] `Skeleton` components - Loading states (39 tests) - January 2026
- [x] `SearchModal` - Search interactions (21 tests) - January 2026
- [ ] `DataTable` - No standalone component exists; table logic is in pages

---

## Phase 4: Integration Tests (P2)

### Task 4.1: API Route Tests
**Files to test (`api/` directory):**
- [ ] `api/v1/actors.js`
- [ ] `api/v1/incidents.js`
- [ ] `api/v1/iocs.js`
- [ ] `api/v1/search.js`
- [ ] `api/stripe/webhook.js`

### Task 4.2: Supabase RLS Policy Tests
**Test that RLS policies work correctly:**
- [ ] Watchlist privacy (users can only see their own)
- [ ] Org-scoped data isolation
- [ ] Public vs authenticated access

---

## Phase 5: Test Infrastructure (P3)

### Task 5.1: Visual Regression Testing
**Tool:** Playwright screenshots or Percy
**Scope:**
- Dashboard layout
- Chart rendering
- Badge variants
- Mobile layouts

### Task 5.2: Performance Testing
**Tool:** Lighthouse CI or custom performance tests
**Metrics:**
- Page load time
- Time to Interactive
- Bundle size tracking

### Task 5.3: Accessibility Automation
**Already have:** `accessibility.spec.js` with axe-core
**Expand to:**
- [ ] All page routes
- [ ] Modal/dialog accessibility
- [ ] Keyboard navigation completeness

---

## Implementation Priority

| Task | Priority | Effort | Value | Status |
|------|----------|--------|-------|--------|
| Enable Firefox in CI | P1 | Low | High | ✅ COMPLETED |
| Enable WebKit in CI | P2 | Low | Medium | ✅ COMPLETED |
| Watchlist E2E flow | P1 | Medium | High | ✅ COMPLETED |
| Export E2E flow | P1 | Medium | High | ✅ COMPLETED |
| Alert config E2E | P1 | Medium | High | ✅ COMPLETED |
| Settings E2E | P1 | Medium | High | ✅ COMPLETED |
| Hook unit tests | P2 | Medium | Medium | ✅ COMPLETED |
| Component tests | P2 | High | Medium | ✅ PARTIALLY (4/7 suites) |
| API route tests | P2 | Medium | High | Backlog |
| Visual regression | P3 | High | Low | Backlog |

---

## CI Configuration Template

```yaml
# .github/workflows/test.yml additions
jobs:
  e2e:
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}
      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.browser }}
```

---

*Last Updated: January 18, 2026 - 909 unit tests passing*
