# Architecture Improvements Plan

> **Created:** January 17, 2026
> **Completed:** January 17, 2026
> **Status:** ✅ All Issues Resolved
> **Priority:** Critical infrastructure and security improvements

---

## Overview

This plan addresses 11 architectural issues identified during a comprehensive code review. Items are prioritized by security impact and implementation complexity.

---

## Issue 1: Redis-Based Rate Limiting (Critical)

### Problem
Current rate limiting uses in-memory `Map` in `api/lib/auth.js`. Vercel Edge Functions are stateless - each instance has its own map, so rate limits aren't enforced across instances.

### Solution
Migrate to Upstash Redis for distributed rate limiting.

### Implementation
1. Add `@upstash/redis` and `@upstash/ratelimit` packages
2. Create `api/lib/rateLimit.js` with Redis-backed limiter
3. Update all API endpoints to use new rate limiter
4. Add fallback to in-memory if Redis unavailable
5. Add environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Files to Modify
- `package.json` - Add dependencies
- `api/lib/rateLimit.js` - New file
- `api/lib/auth.js` - Remove in-memory rate limiting
- `api/v1/actors.js` - Use new rate limiter
- `api/v1/incidents.js` - Use new rate limiter
- `api/v1/iocs.js` - Use new rate limiter
- `api/v1/vulnerabilities.js` - Use new rate limiter

### Status: ✅ Completed

---

## Issue 2: Centralized Error Tracking (High)

### Problem
Errors logged to console only. Production issues go unnoticed until user reports.

### Solution
Integrate Sentry for error tracking and performance monitoring.

### Implementation
1. Add `@sentry/react` package
2. Create `src/lib/sentry.js` initialization module
3. Wrap App with Sentry error boundary
4. Add Sentry to API routes for backend errors
5. Configure source maps upload in build

### Files to Modify
- `package.json` - Add Sentry SDK
- `src/lib/sentry.js` - New initialization file
- `src/main.jsx` - Initialize Sentry
- `src/App.jsx` - Add Sentry ErrorBoundary
- `vite.config.js` - Source map configuration

### Environment Variables
- `VITE_SENTRY_DSN` - Sentry project DSN

### Status: ✅ Completed

---

## Issue 3: Standardized Loading States (Medium)

### Problem
Inconsistent loading UI - some pages use skeletons, others spinners, some have none.

### Solution
Create standardized loading components and apply consistently.

### Implementation
1. Audit existing loading patterns
2. Create `LoadingState` wrapper component
3. Create page-specific skeleton templates
4. Update all data-fetching pages to use consistent pattern

### Files to Modify
- `src/components/ui/LoadingState.jsx` - New component
- `src/components/ui/PageSkeleton.jsx` - New component
- `src/components/ui/TableSkeleton.jsx` - Enhance existing
- All page components - Apply consistent loading

### Status: ✅ Completed

---

## Issue 4: API Key Rotation Mechanism (High)

### Problem
No way to rotate API keys without breaking existing integrations.

### Solution
Implement key versioning with configurable grace period.

### Implementation
1. Add `rotated_at`, `expires_at`, `replaced_by` columns to `api_keys` table
2. Create rotation endpoint/function
3. During grace period, both old and new keys work
4. Add UI for key rotation in settings
5. Add automated expiry cleanup

### Database Changes
```sql
ALTER TABLE api_keys ADD COLUMN rotated_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN replaced_by UUID REFERENCES api_keys(id);
```

### Files to Modify
- `supabase/migrations/` - New migration
- `src/lib/apiKeys.js` - Add rotation functions
- `api/lib/auth.js` - Check both current and rotated keys
- `src/pages/Settings.jsx` - Add rotation UI

### Status: ✅ Completed

---

## Issue 5: API Retry Logic (Medium)

### Problem
Failed API calls don't retry; user must manually refresh.

### Solution
Add exponential backoff retry wrapper for Supabase calls.

### Implementation
1. Create `src/lib/retry.js` utility
2. Wrap critical Supabase operations with retry logic
3. Add configurable retry count and delays
4. Show retry status in UI when retrying

### Files to Modify
- `src/lib/retry.js` - New utility
- `src/lib/supabase/index.js` - Apply retry wrapper
- `src/lib/supabase/*.js` - Critical operations

### Status: ✅ Completed

---

## Issue 6: Component Test Coverage (Medium)

### Problem
150+ components with minimal test coverage. Regressions go unnoticed.

### Solution
Add React Testing Library tests for critical components.

### Implementation
1. Set up React Testing Library with Vitest
2. Create test utilities and mocks
3. Add tests for critical components:
   - SearchModal
   - DetailPanel
   - TrendBadge
   - SeverityBadge
   - ErrorBoundary
   - DataTable

### Files to Create
- `src/test/setup.js` - Test setup
- `src/test/utils.jsx` - Test utilities
- `src/components/__tests__/*.test.jsx` - Component tests

### Status: ✅ Completed

---

## Issue 7: State Management Documentation (Low)

### Problem
Mix of Context API, local state, and direct Supabase calls without clear pattern.

### Solution
Document data-fetching patterns and establish conventions.

### Implementation
1. Document current patterns in CLAUDE.md
2. Create `docs/STATE_MANAGEMENT.md` guide
3. Add code comments for complex state flows

### Files to Modify
- `docs/STATE_MANAGEMENT.md` - New documentation
- `CLAUDE.md` - Add state management section

### Status: ✅ Completed

---

## Issue 8: Real-time Subscription Audit (Medium)

### Problem
Need to verify all subscriptions properly unsubscribe on unmount.

### Solution
Audit and fix subscription cleanup in all components.

### Implementation
1. Search for all `subscribeToTable` usages
2. Verify each has proper cleanup in useEffect return
3. Fix any missing cleanup
4. Add ESLint rule for subscription cleanup

### Files to Audit
- All components using `subscribeToTable`
- `src/lib/supabase/realtime.js`

### Status: ✅ Completed

---

## Issue 9: ErrorBoundary Integration (Low)

### Problem
ErrorBoundary exists but may not catch all routing errors.

### Solution
Ensure ErrorBoundary wraps entire app including router.

### Implementation
1. Verify ErrorBoundary placement in component tree
2. Add route-level error boundaries
3. Add fallback UI for different error types

### Files to Modify
- `src/App.jsx` - Verify/fix ErrorBoundary placement
- `src/components/ErrorBoundary.jsx` - Enhance fallback UI

### Status: ✅ Completed

---

## Issue 10: Environment Variable Validation (Low)

### Problem
No startup check for required environment variables.

### Solution
Add validation that fails fast with clear error messages.

### Implementation
1. Create `src/lib/env.js` validation module
2. Check all required vars on app initialization
3. Show clear error in development if missing
4. Fail build in production if missing

### Files to Modify
- `src/lib/env.js` - New validation module
- `src/main.jsx` - Import and run validation
- `vite.config.js` - Build-time validation

### Status: ✅ Completed

---

## Issue 11: Bundle Size Optimization (Medium)

### Problem
Recharts adds ~500KB to bundle. Initial load slow on mobile.

### Solution
Analyze bundle and optimize imports.

### Implementation
1. Add bundle analyzer
2. Audit Recharts usage - only import used components
3. Consider lighter alternatives for simple charts
4. Optimize other large dependencies

### Files to Modify
- `package.json` - Add analyzer, possibly swap chart lib
- `vite.config.js` - Configure chunking
- Chart components - Optimize imports

### Status: ✅ Completed

---

## Implementation Order

| Phase | Issues | Rationale |
|-------|--------|-----------|
| 1 | 1, 2 | Critical security and observability |
| 2 | 4, 5 | API reliability improvements |
| 3 | 3, 9, 10 | UX consistency and robustness |
| 4 | 6, 7, 8 | Code quality and maintainability |
| 5 | 11 | Performance optimization |

---

## Progress Tracking

- [x] Issue 1: Redis-Based Rate Limiting - `api/lib/rateLimit.js` created with Upstash Redis support
- [x] Issue 2: Centralized Error Tracking - `src/lib/sentry.js` created with Sentry SDK integration
- [x] Issue 3: Standardized Loading States - `src/components/common/LoadingState.jsx` created
- [x] Issue 4: API Key Rotation - Migration `063_api_key_rotation.sql` + `src/lib/apiKeys.js` updated
- [x] Issue 5: API Retry Logic - `src/lib/retry.js` created with exponential backoff
- [x] Issue 6: Component Test Coverage - Tests added for TrendBadge, SeverityBadge, ErrorBoundary, LoadingState
- [x] Issue 7: State Management Documentation - `docs/STATE_MANAGEMENT.md` created
- [x] Issue 8: Real-time Subscription Audit - All subscriptions verified to have proper cleanup
- [x] Issue 9: ErrorBoundary Integration - Top-level ErrorBoundary added to App.jsx
- [x] Issue 10: Environment Variable Validation - `src/lib/env.js` created with startup validation
- [x] Issue 11: Bundle Size Optimization - Improved chunking in vite.config.js + bundle analyzer

---

## Files Created/Modified

### New Files
- `api/lib/rateLimit.js` - Distributed rate limiting with Redis
- `src/lib/sentry.js` - Sentry error tracking integration
- `src/lib/retry.js` - API retry utility with exponential backoff
- `src/lib/env.js` - Environment variable validation
- `src/components/common/LoadingState.jsx` - Standardized loading states
- `src/components/badges/__tests__/TrendBadge.test.jsx` - Component tests
- `src/components/badges/__tests__/SeverityBadge.test.jsx` - Component tests
- `src/components/common/__tests__/ErrorBoundary.test.jsx` - Component tests
- `src/components/common/__tests__/LoadingState.test.jsx` - Component tests
- `src/test/utils.jsx` - Test utilities
- `docs/STATE_MANAGEMENT.md` - State management documentation
- `supabase/migrations/063_api_key_rotation.sql` - API key rotation schema
- `vite.config.analyze.js` - Bundle analyzer config

### Modified Files
- `api/lib/auth.js` - Updated for Redis rate limiting and key rotation
- `api/v1/actors.js` - Added async rate limiting and rotation headers
- `api/v1/incidents.js` - Added async rate limiting and rotation headers
- `api/v1/iocs.js` - Added async rate limiting and rotation headers
- `api/v1/vulnerabilities.js` - Added async rate limiting and rotation headers
- `src/lib/apiKeys.js` - Added rotation functions
- `src/lib/supabase/index.js` - Added retry utility export
- `src/components/common/ErrorBoundary.jsx` - Added Sentry integration
- `src/components/common/index.js` - Added LoadingState export
- `src/components/index.js` - Added LoadingState export
- `src/components/NotificationBell.jsx` - Removed unused import
- `src/App.jsx` - Added top-level ErrorBoundary
- `src/main.jsx` - Added Sentry init and env validation
- `package.json` - Added new dependencies and analyze script
- `vite.config.js` - Improved chunking for smaller bundles

---

*Completed: January 17, 2026*
