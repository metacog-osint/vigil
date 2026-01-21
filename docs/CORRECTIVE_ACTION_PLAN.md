# Vigil Corrective Action Plan

> **Created:** January 20, 2026
> **Status:** In Progress
> **Purpose:** Systematic remediation of schema-code mismatches and documentation gaps

---

## Executive Summary

A comprehensive audit revealed **3 critical issues**, **12 moderate issues**, and **9 undocumented features**. This plan addresses them in priority order to restore full functionality.

---

## Phase 1: Critical Schema-Code Fixes (Immediate)

These issues cause queries to fail and return zero results.

### 1.1 Fix `threat_actor_id` → `actor_id` in compare.js

**File:** `src/lib/supabase/compare.js`
**Line:** 238
**Issue:** Code queries `threat_actor_id` but schema column is `actor_id`
**Impact:** Comparison queries fail silently

```javascript
// WRONG
.select('threat_actor_id')

// CORRECT
.select('actor_id')
```

**Status:** [x] Complete (2026-01-20)

---

### 1.2 Resolve `malware` vs `malware_samples` Table Name

**Issue:** Two different table definitions exist:
- Migration 001: `malware` table
- Migration 005: `malware_samples` table

**Code expects:** `malware_samples`

**Files affected:**
- `src/lib/supabase/malwareSamples.js` - queries `malware_samples`
- `src/lib/supabase/iocs.js` - quickLookup queries `malware_samples`

**Resolution:** Verify which table exists in production database, then:
- Option A: If `malware_samples` exists → No code changes needed
- Option B: If only `malware` exists → Update code to use `malware`
- Option C: If both exist → Consolidate to one table

**Status:** [x] Complete - `malware_samples` table exists (migration 005), code is correct

---

### 1.3 Audit All Remaining `discovered_at` References

**Issue:** Some files may still use `discovered_at` instead of `discovered_date`

**Already fixed:**
- [x] `src/lib/supabase/compare.js`
- [x] `src/lib/chatBots.js`
- [x] `src/lib/patternDetection.js`
- [x] `src/lib/predictiveModeling.js`
- [x] `src/lib/missedAlertsEmail.js`
- [x] `src/lib/digestGenerator.js`
- [x] `src/lib/constants/filters.js`
- [x] `src/components/upgrade/MissedAlertsWidget.jsx`

**Verified correct:**
- [x] Demo/mock data files - use `discovered_date` or `discovered_at` for appropriate tables
- [x] `shadowIT.js` - uses `discovered_at` but queries `discovered_assets` table which has that column

**Status:** [x] Complete - verified all files use correct column names for their respective tables

---

### 1.4 Audit All `sector`/`country` → `victim_sector`/`victim_country`

**Issue:** Code inconsistently uses short names vs full column names

**Correct columns (per schema):**
- `victim_sector` (not `sector`)
- `victim_country` (not `country`)

**Already fixed:**
- [x] `src/lib/supabase/compare.js`
- [x] `src/lib/predictiveModeling.js`
- [x] `src/lib/missedAlertsEmail.js`
- [x] `src/lib/digestGenerator.js`
- [x] `src/lib/predictions.js` - fixed lines 101, 409, 415 (2026-01-20)

**Verified correct (query different tables with `sector` column):**
- [x] `src/lib/benchmarks.js` - queries `sector_benchmarks` table
- [x] `src/lib/benchmarking.js` - queries `benchmark_metrics`, `benchmark_reports` tables
- [x] `src/lib/supabase/correlations.js` - queries `sector_technique_correlation` table

**Status:** [x] Complete (2026-01-20)

---

## Phase 2: API Authentication Fixes

### 2.1 Fix `user.uid` → `user.id` in API Endpoints

**Issue:** API endpoints use Firebase terminology (`uid`) but Supabase returns `id`

**Already fixed:**
- [x] `api/generate-summary.js` - line 114
- [x] `api/send-email.js` - line 67

**Status:** [x] Complete

---

## Phase 3: Documentation-Reality Alignment

### 3.1 Update Predictions Library Documentation

**Original Issue:** Initial audit incorrectly reported only 1 of 5 functions existed

**Verified Implementation (2026-01-20):**
All 5 functions ARE fully implemented in `src/lib/predictions.js`:
1. `getActorEscalationRisk()` - lines 24-73 ✓
2. `getSectorTargetingPrediction()` - lines 81-133 ✓
3. `getVulnExploitationPrediction()` - lines 141-216 ✓
4. `getOrgRiskScore()` - lines 224-301 ✓
5. `getPredictiveAlerts()` - lines 308-373 ✓

**Documentation:** `docs/UX_IMPROVEMENTS.md` lines 238-272 accurately documents these functions

**Status:** [x] Complete - No changes needed, documentation matches implementation

---

### 3.2 Remove Cloudflare Workers Migration Claims

**Issue:** DATA_SOURCES.md claims migration to Cloudflare Workers is complete, but:
- No Cloudflare Workers code exists
- GitHub Actions still handles all ingestion

**Resolution:** Updated DATA_SOURCES.md (2026-01-20):
- Changed "Ingestion Flow (Cloudflare Workers)" to "Ingestion Flow (GitHub Actions)"
- Updated architecture diagram to reference GitHub Actions + Node.js scripts
- Changed all `workers/src/feeds/*.js` paths to actual `scripts/ingest-*.mjs` paths
- Updated Error Handling section to remove Cloudflare references
- Marked non-existent scripts (ransomwhere, bgpstream) as "planned"

**Status:** [x] Complete (2026-01-20)

---

### 3.3 Document Undocumented Features

**Features implemented but not documented:**

| Feature | Files | Priority |
|---------|-------|----------|
| Asset Monitoring | `src/lib/assets.js`, `Assets.jsx` | High |
| Custom IOCs | `src/lib/customIocs.js`, `CustomIOCs.jsx` | High |
| Threat Hunts | `src/pages/ThreatHunts.jsx` | Medium |
| Investigations | `src/pages/Investigations.jsx` | Medium |
| Benchmarking | `src/pages/Benchmarks.jsx` | Medium |
| Multi-tenancy/SCIM | `src/lib/multitenancy.js`, `api/scim/` | Medium |
| Team Collaboration | `src/lib/supabase/teams.js` | Medium |
| API Key Rotation | `src/lib/apiKeys.js` | Low |
| Chat Integration | `src/lib/chat.js` | Low |

**Resolution:** Create `docs/ADVANCED_FEATURES.md` covering these

**Status:** [ ] Pending

---

## Phase 4: Data Quality Improvements

### 4.1 Verify Sector Classification Consistency

**Issue:** Not all ingestion scripts apply sector classification

**Scripts WITH classification:**
- [x] `ingest-ransomwatch.mjs`
- [x] `ingest-ransomlook.mjs`

**Verified (2026-01-20):**
- [x] `ingest-ransomware-live.mjs` - Already has `classifySector()` integrated
- [x] Edge function `ingest-ransomwatch/index.ts` - Added simplified inline classifier

**Resolution:** Verified all ransomware ingestion scripts have sector classification

**Status:** [x] Complete (2026-01-20)

---

### 4.2 Run Sector Reclassification

**Issue:** Existing incidents may have "Unknown" sector

**Command:** `npm run reclassify:sectors`

**Verification:** Check count of "Unknown" sectors before/after

**Status:** [ ] Pending

---

## Phase 5: Code Quality

### 5.1 Add Basic Test Coverage

**Issue:** 0% test coverage documented

**Priority tests needed:**
1. Schema validation tests (column names match)
2. API endpoint tests
3. Data ingestion integration tests

**Status:** [ ] Future work

---

## Execution Order

```
Phase 1.1 → Phase 1.2 → Phase 1.3 → Phase 1.4
    ↓
Phase 2.1 (already complete)
    ↓
Phase 3.1 → Phase 3.2 → Phase 3.3
    ↓
Phase 4.1 → Phase 4.2
    ↓
Phase 5.1 (future)
```

---

## Progress Tracking

| Phase | Task | Status | Date |
|-------|------|--------|------|
| 1.1 | Fix threat_actor_id | [x] Complete | 2026-01-20 |
| 1.2 | Resolve malware table | [x] Complete | 2026-01-20 |
| 1.3 | Audit discovered_at | [x] Complete | 2026-01-20 |
| 1.4 | Audit sector/country | [x] Complete | 2026-01-20 |
| 2.1 | Fix user.uid | [x] Complete | 2026-01-20 |
| 3.1 | Update predictions docs | [x] Complete | 2026-01-20 |
| 3.2 | Remove Workers claims | [x] Complete | 2026-01-20 |
| 3.3 | Document features | [ ] Pending | |
| 4.1 | Sector classification | [x] Complete | 2026-01-20 |
| 4.2 | Reclassify sectors | [ ] Pending | |
| 5.1 | Add tests | [ ] Future | |

---

## Verification Checklist

After all fixes:

- [ ] Dashboard shows non-zero Incidents (30d)
- [ ] Dashboard shows non-zero Total KEVs
- [ ] Dashboard shows non-zero Total IOCs
- [ ] Comparison page loads data correctly
- [ ] No 400/404/500 errors in console
- [ ] AI summary generates without error
- [ ] Sector breakdown shows real sectors (not 90% Unknown)

---

## Files Modified

This section will be updated as work progresses.

### Modified (Previous Session):
- `api/generate-summary.js` - user.uid → user.id
- `api/send-email.js` - user.uid → user.id
- `src/lib/supabase/compare.js` - discovered_at → discovered_date, sector fixes
- `src/lib/chatBots.js` - discovered_at → discovered_date
- `src/lib/patternDetection.js` - discovered_at → discovered_date
- `src/lib/predictiveModeling.js` - discovered_at → discovered_date, sector fixes
- `src/lib/missedAlertsEmail.js` - column name fixes
- `src/lib/digestGenerator.js` - column name fixes
- `src/lib/constants/filters.js` - discovered_at → discovered_date
- `src/components/upgrade/MissedAlertsWidget.jsx` - column name fixes
- `src/components/patterns/TemporalClusterChart.jsx` - added fallback

### Modified (This Session - 2026-01-20):
- `src/lib/supabase/compare.js` - threat_actor_id → actor_id
- `src/lib/predictions.js` - sector → victim_sector (lines 101, 409, 415)
- `src/lib/predictiveModeling.js` - threat_actor_id → actor_id (lines 232, 234, 244)
- `src/lib/patternDetection.js` - threat_actor_id → actor_id (4 occurrences)
- `src/lib/similarity.js` - threat_actor_id → actor_id, sector → victim_sector
- `src/lib/focusFilters.js` - sector → victim_sector, country → victim_country
- `src/components/SearchModal.jsx` - threat_actor_id → actor_id
- `src/components/panels/SimilarIncidentsPanel.jsx` - sector → victim_sector
- `DATA_SOURCES.md` - removed Cloudflare Workers claims, fixed script paths
- `supabase/functions/ingest-ransomwatch/index.ts` - added sector classifier

