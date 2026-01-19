# Vigil Codebase Audit Report

**Date:** January 2026
**Scope:** Full codebase review covering code quality, documentation, security, and infrastructure

---

## Executive Summary

| Category | Issues Found | Critical | High | Medium | Low |
|----------|--------------|----------|------|--------|-----|
| Security | 3 | 1 | 2 | 0 | 0 |
| Code Refactoring | 36 files | 0 | 9 | 18 | 9 |
| Documentation | 14 files | 0 | 2 | 4 | 8 |
| Testing | 6 gaps | 0 | 3 | 2 | 1 |
| CI/CD | 5 issues | 0 | 2 | 2 | 1 |
| **Total** | **64** | **1** | **18** | **26** | **19** |

**Estimated Remediation Effort:** 120-160 hours

---

## PART 1: SECURITY ISSUES

### CRITICAL: Exposed API Keys

**Status:** Requires immediate action

**Finding:** `.env` file may be in git history with exposed credentials:
- Supabase service role key (highest privilege)
- VirusTotal, GreyNoise, Hybrid Analysis API keys
- Groq API key
- OTX API key

**Remediation:**
1. Immediately revoke ALL exposed API keys
2. Remove `.env` from git history: `git filter-repo --path .env --invert-paths`
3. Regenerate all keys from respective dashboards
4. Add pre-commit hook to block `.env` commits

### HIGH: Missing Input Validation

**Finding:** `queryParser.js` lacks:
- Input length limits
- Sanitization for injection attacks
- Rate limiting

**Remediation:** Add validation layer in `src/lib/validation.js`

### HIGH: Dangerous HTML Rendering

**Finding:** `dangerouslySetInnerHTML` used in `src/pages/Help.jsx`

**Remediation:** Replace with markdown parser (`remark`/`rehype`) or sanitize input

---

## PART 2: CODE REFACTORING

### Files Exceeding 300 Lines (36 total)

#### Critical: Library Files

| File | Lines | Recommendation |
|------|-------|----------------|
| `src/lib/supabase.js` | 3,063 | Split into domain modules |
| `src/lib/integrations.js` | 836 | Extract per-platform modules |
| `src/lib/chat.js` | 734 | Separate platforms, commands, API |

**Recommended Structure for supabase.js:**
```
src/lib/supabase/
├── index.js           (barrel export)
├── client.js          (Supabase client init)
├── threatActors.js    (actor queries)
├── incidents.js       (incident queries)
├── iocs.js            (IOC queries)
├── vulnerabilities.js (vuln queries)
├── teams.js           (team management)
├── watchlists.js      (watchlist queries)
├── trendAnalysis.js   (trend calculations)
└── correlations.js    (correlation queries)
```

#### High: Page Components

| File | Lines | Recommendation |
|------|-------|----------------|
| `src/pages/ThreatActors.jsx` | 1,604 | Extract TableView, OverviewView, DetailPanel |
| `src/pages/Incidents.jsx` | 1,395 | Same pattern as ThreatActors |
| `src/pages/Assets.jsx` | 911 | Extract sub-components |
| `src/pages/Investigations.jsx` | 901 | Extract sub-components |
| `src/pages/CustomIOCs.jsx` | 849 | Extract sub-components |
| `src/pages/Settings.jsx` | 743 | Extract section components |
| `src/pages/Vendors.jsx` | 649 | Extract sub-components |
| `src/pages/Dashboard.jsx` | 635 | Extract widget components |
| `src/pages/Webhooks.jsx` | 616 | Extract sub-components |

#### Medium: Components (27 files over 300 lines)

Top 10 requiring attention:

| File | Lines | Recommendation |
|------|-------|----------------|
| `SSOConfigSection.jsx` | 757 | Extract provider forms |
| `IntegrationsSection.jsx` | 595 | Extract per-integration components |
| `PersonalizationWizard.jsx` | 523 | Extract step components + hook |
| `AlertRulesSection.jsx` | 512 | Extract modal + useAlertRules hook |
| `ActorRelationshipGraph.jsx` | 496 | Extract graph logic to hook |
| `ThreatAttributionMap.jsx` | 487 | Extract map controls |
| `SearchModal.jsx` | 475 | Extract search result components |
| `TeamManagement.jsx` | 467 | Extract member list, invite form |

### Duplicated Code Patterns

#### Constants Duplication

| Constant | Duplicated In | Action |
|----------|---------------|--------|
| `SECTORS` | ThreatActors.jsx, Incidents.jsx, PersonalizationWizard.jsx, OrganizationProfileSetup.jsx | Create `src/lib/constants/sectors.js` |
| `TIME_RANGES` | 4+ files | Create `src/lib/constants/time.js` |
| `PRIORITY_COLORS` | Investigations.jsx, multiple components | Create `src/lib/constants/colors.js` |
| `STATUS_OPTIONS` | Multiple pages | Create `src/lib/constants/filters.js` |

#### HTTP Fetch Duplication (Scripts)

| Pattern | Files | Action |
|---------|-------|--------|
| Custom fetch functions | 7+ ingestion scripts | Create `scripts/lib/http.mjs` |
| Sector classification | ingest-ransomwatch.mjs (inline) + lib/sector-classifier.mjs | Remove inline, use library |

**Recommended shared HTTP module:**
```javascript
// scripts/lib/http.mjs
export async function fetchJSON(url, options = {}) { ... }
export async function fetchWithRetry(url, maxRetries = 3) { ... }
export async function fetchWithAuth(url, token, method = 'GET') { ... }
```

### Inconsistent Patterns

| Pattern | Issue | Recommendation |
|---------|-------|----------------|
| State management | Some pages use 15+ useState, others group into objects | Create `useFiltersState()`, `useDataLoading()` hooks |
| Supabase queries | Multiple patterns for conditional filters | Create query builder abstraction |
| Export patterns | Mixed named + default exports | Standardize on named exports |

### Directory Structure Issues

**Current:**
```
src/components/    (70+ files, no organization)
src/hooks/         (1 file)
src/contexts/      (exists but underutilized)
```

**Recommended:**
```
src/components/
├── common/        (Header, Sidebar, ErrorBoundary, LoadingSpinner)
├── charts/        (TrendChart, ActivityChart, AttackPathDiagram)
├── panels/        (CorrelationPanel, EnrichmentPanel, DetailPanel)
├── forms/         (AlertRuleForm, IntegrationForm)
├── badges/        (TrendBadge, SeverityBadge, RelevanceBadge)
├── tables/        (DataTable, ActorTable, IncidentTable)
└── index.js

src/hooks/
├── useFilters.js
├── useDataLoading.js
├── useTableState.js
├── useAnalytics.js
└── index.js

src/constants/
├── sectors.js
├── colors.js
├── filters.js
├── time.js
└── index.js
```

---

## PART 3: DOCUMENTATION CONSOLIDATION

### Files to Archive

| File | Reason | Action |
|------|--------|--------|
| `BUILD_PLAN.md` | All 6 sprints marked complete | Move to `docs/archive/BUILD_PLAN_COMPLETED.md` |
| `IMPLEMENTATION_PLAN.md` | Historical sprint breakdown | Archive or merge with ROADMAP |
| `docs/DEVELOPMENT.md` | "Recent Work" is now historical | Convert to changelog entries |
| `docs/SPRINT2_SETUP.md` | Completed feature setup | Archive |

### Files to Consolidate

#### Data Source Documentation (3 files → 1)

| Current Files | Issue | Action |
|---------------|-------|--------|
| `DATA_SOURCES.md` | Comprehensive (22 sources) | Keep as authoritative |
| `docs/DATA_INGESTION.md` | Overlaps with DATA_SOURCES | Convert to quick-reference, link to DATA_SOURCES |
| `README.md` (data section) | Abbreviated list | Link to DATA_SOURCES |

#### Feature/Roadmap Documentation

| Current Files | Issue | Action |
|---------------|-------|--------|
| `FEATURES.md` | Documents implemented features | Keep for current state |
| `ROADMAP.md` | Mix of completed + planned | Remove completed sections |
| `BUILD_PLAN.md` | Completed sprints | Archive |

**Create:** `CHANGELOG.md` to track completed work (extract from ROADMAP, BUILD_PLAN, FEATURES version history)

### Files to Create

| File | Purpose | Source Content |
|------|---------|----------------|
| `CHANGELOG.md` | Version history | Extract from ROADMAP.md, BUILD_PLAN.md |
| `docs/ARCHITECTURE.md` | System design | Extract from CLAUDE.md, DATABASE.md |
| `docs/SECURITY.md` | Security practices | New content needed |
| `docs/TESTING.md` | Test strategy | New content needed |
| `CONTRIBUTING.md` | Contributor guide | New content needed |

### Recommended Documentation Structure

```
Root (public-facing):
├── README.md              (overview + quick links)
├── CHANGELOG.md           (NEW - version history)
├── FEATURES.md            (current capabilities)
├── ROADMAP.md             (future plans only)
├── SAAS_ROADMAP.md        (monetization strategy)
├── DATA_SOURCES.md        (authoritative source list)
├── CONTRIBUTING.md        (NEW - contributor guide)

docs/ (developer-focused):
├── ARCHITECTURE.md        (NEW - system design)
├── DATABASE.md            (schema reference)
├── TESTING.md             (NEW - test strategy)
├── SECURITY.md            (NEW - security guide)
├── DATA_INGESTION.md      (quick ref → DATA_SOURCES)
├── CLAUDE.md              (AI context, trimmed)
└── archive/
    ├── BUILD_PLAN_COMPLETED.md
    └── IMPLEMENTATION_PLAN_HISTORICAL.md
```

---

## PART 4: TESTING GAPS

### Current Coverage

| Area | Files | Coverage |
|------|-------|----------|
| Unit Tests | 4 | `queryParser`, `apiKeys`, `features`, `integrations` |
| Component Tests | 0 | None |
| E2E Tests | 3 | Basic flows only (Chromium only) |

### Missing Test Coverage

#### Priority 1: Critical Paths

| Module | Risk | Recommendation |
|--------|------|----------------|
| `src/lib/supabase.js` | High - 3000+ lines, 0 tests | Add query builder tests |
| `src/lib/ai.js` | Medium - AI integration | Test throttling, error handling |
| `src/lib/analytics.js` | Medium - Usage tracking | Test event capture |

#### Priority 2: User Flows

| Flow | Current | Needed |
|------|---------|--------|
| IOC Search | None | E2E test for search → results → enrichment |
| Watchlist | None | E2E test for add → alert → remove |
| Export | None | E2E test for filter → export → download |

#### Priority 3: Edge Cases

| Area | Tests Needed |
|------|--------------|
| Date/time handling | Timezone edge cases |
| Large datasets | Pagination limits |
| Error states | API failures, timeouts |

### E2E Configuration Issues

| Issue | Current | Recommended |
|-------|---------|-------------|
| Browsers | Chromium only | Add Firefox, Safari |
| Viewports | Desktop only | Add mobile testing |
| Port | Hardcoded 5173 | Use dynamic port |

---

## PART 5: CI/CD IMPROVEMENTS

### GitHub Workflow Issues

#### data-ingestion.yml

| Issue | Impact | Fix |
|-------|--------|-----|
| No caching | Slow builds | Add `actions/cache` for node_modules |
| No timeouts | Could run forever | Add `timeout-minutes: 15` |
| Wrong triggers | Malpedia/MISP skip incorrectly | Fix conditional logic |
| No failure alerts | Silent failures | Add Slack/email notification |

#### ci.yml

| Issue | Impact | Fix |
|-------|--------|-----|
| `continue-on-error: true` | Failures don't block PRs | Remove for blocking checks |
| No E2E tests | Regressions slip through | Add playwright to CI |
| Tests on PR only | Push can break main | Enable on push to main |

### Missing Workflows

| Workflow | Purpose | Priority |
|----------|---------|----------|
| `dependabot.yml` | Dependency updates | High |
| `codeql.yml` | Security scanning | High |
| `bundle-size.yml` | Track bundle growth | Medium |

---

## PART 6: PERFORMANCE & ACCESSIBILITY

### Performance Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| No code splitting | Large initial bundle | Add `React.lazy()` for routes |
| No React.memo | Unnecessary re-renders | Memoize expensive components |
| 600KB chunk limit | Above default (500KB) | Lower limit, split vendors |
| Sourcemaps in prod | +50% bundle size | Disable for production |

### Accessibility Issues

| Issue | Impact | Fix |
|-------|--------|-----|
| onClick without keyboard | Keyboard users blocked | Add `onKeyPress`, `tabIndex` |
| Missing ARIA labels | Screen readers fail | Add `aria-label`, `role` |
| No skip links | Navigation difficult | Add skip-to-content link |

---

## PART 7: PRIORITIZED ACTION PLAN

### Immediate (This Week)

| # | Task | Effort | Owner |
|---|------|--------|-------|
| 1 | Revoke and rotate all API keys | 2h | Security |
| 2 | Remove `.env` from git history | 1h | DevOps |
| 3 | Fix CI `continue-on-error` | 30m | DevOps |
| 4 | Archive BUILD_PLAN.md | 15m | Docs |

### Short-Term (2-4 Weeks)

| # | Task | Effort | Owner |
|---|------|--------|-------|
| 5 | Split `supabase.js` into modules | 8h | Backend |
| 6 | Create constants directory | 4h | Frontend |
| 7 | Extract ThreatActors sub-components | 6h | Frontend |
| 8 | Add E2E tests to CI | 4h | QA |
| 9 | Create CHANGELOG.md | 2h | Docs |
| 10 | Consolidate data source docs | 2h | Docs |

### Medium-Term (1-2 Months)

| # | Task | Effort | Owner |
|---|------|--------|-------|
| 11 | Refactor remaining large pages | 24h | Frontend |
| 12 | Organize components directory | 8h | Frontend |
| 13 | Create shared HTTP module for scripts | 4h | Backend |
| 14 | Add unit tests for supabase modules | 16h | QA |
| 15 | Create ARCHITECTURE.md | 4h | Docs |
| 16 | Add Dependabot + CodeQL | 2h | DevOps |

### Long-Term (Quarter)

| # | Task | Effort | Owner |
|---|------|--------|-------|
| 17 | Implement code splitting | 8h | Frontend |
| 18 | Add accessibility audit + fixes | 16h | Frontend |
| 19 | Migrate to TypeScript (optional) | 40h | All |
| 20 | Achieve 60% test coverage | 32h | QA |

---

## Appendix A: File Size Reference

### Pages by Size

| File | Lines | Priority |
|------|-------|----------|
| ThreatActors.jsx | 1,604 | High |
| Incidents.jsx | 1,395 | High |
| Assets.jsx | 911 | Medium |
| Investigations.jsx | 901 | Medium |
| CustomIOCs.jsx | 849 | Medium |
| Settings.jsx | 743 | Medium |
| Vendors.jsx | 649 | Low |
| Dashboard.jsx | 635 | Low |
| Webhooks.jsx | 616 | Low |

### Libraries by Size

| File | Lines | Priority |
|------|-------|----------|
| supabase.js | 3,063 | Critical |
| integrations.js | 836 | High |
| chat.js | 734 | Medium |
| queryParser.js | 377 | Low |

---

## Appendix B: Documentation Overlap Matrix

| Topic | README | CLAUDE | FEATURES | ROADMAP | BUILD_PLAN | DATABASE |
|-------|--------|--------|----------|---------|------------|----------|
| Data Sources | Brief | Yes | Yes | Yes | - | - |
| Schema | - | Yes | - | Yes | - | Full |
| Features | Brief | - | Full | Yes | Yes | - |
| Architecture | - | Yes | - | - | - | Partial |
| Sprints | - | - | - | Yes | Full | - |

**Recommendation:** Single source of truth per topic, others link to it.

---

*Report generated: January 2026*
*Next audit recommended: April 2026*
