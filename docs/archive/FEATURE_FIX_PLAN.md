# Feature Fix Plan

> **Created:** January 18, 2026
> **Completed:** January 18, 2026
> **Status:** All 6 issues resolved

Six modules identified with data/logic issues that need remediation.

---

## Issue 1: Compare Page Shows Random Data
**Severity:** Critical | **File:** `src/pages/Compare.jsx`

### Problem
- `generateTrendData()` uses `Math.random()` instead of real database queries
- `generateRegionData()` returns hardcoded static values
- IOC stats fallback to random numbers

### Solution
1. Create `src/lib/supabase/compare.js` with real query functions:
   - `getIncidentTrend(startDate, endDate)` - daily incident counts
   - `getRegionBreakdown(days)` - incidents by country/region
   - `getIOCStats(startDate, endDate)` - IOC counts for period
2. Update Compare.jsx to use real queries
3. Handle loading states and empty data gracefully

### Files to Modify
- `src/lib/supabase/compare.js` (new)
- `src/lib/supabase/index.js` (export)
- `src/pages/Compare.jsx`

---

## Issue 2: Webhook Test Doesn't Send
**Severity:** Medium | **File:** `src/lib/webhooks.js`

### Problem
- `testWebhook()` returns payload structure but doesn't actually send HTTP request
- Users think they're testing but nothing happens

### Solution
1. Create `/api/webhooks/test.js` serverless endpoint
2. Endpoint sends actual HTTP POST to webhook URL with test payload
3. Returns success/failure status and response details
4. Update frontend to call API endpoint

### Files to Modify
- `api/webhooks/test.js` (new)
- `src/lib/webhooks.js`

---

## Issue 3: Stripe Checkout Not Implemented
**Severity:** Medium | **File:** `src/pages/Pricing.jsx`

### Problem
- Subscribe button shows alert instead of processing payment
- `isCurrentTier` always false

### Solution
1. Implement Stripe Checkout session creation via `/api/stripe/create-checkout.js`
2. Redirect user to Stripe hosted checkout
3. Handle success/cancel redirects
4. Query user's current subscription tier from Supabase

### Files to Modify
- `api/stripe/create-checkout.js` (new)
- `src/pages/Pricing.jsx`
- `src/lib/stripe.js`

---

## Issue 4: Score Trend Always "Stable"
**Severity:** Medium | **File:** `src/lib/predictions.js`

### Problem
- `calculateScoreTrend()` always returns 'stable'
- Never shows "increasing" or "decreasing" risk

### Solution
1. Query historical org risk scores from last 7/30 days
2. Compare current score to average of historical
3. Return 'increasing' if >10% higher, 'decreasing' if >10% lower

### Files to Modify
- `src/lib/predictions.js`
- `src/lib/supabase/orgProfile.js` (add history query)

---

## Issue 5: Misleading Variable Names
**Severity:** Low | **File:** `src/lib/supabase/dashboard.js`

### Problem
- `incidents24h` variable actually contains 30-day data
- Legacy aliases create confusion

### Solution
1. Deprecate legacy aliases with comments
2. Update all consumers to use correct names (`incidents30d`)
3. Keep aliases for backwards compatibility but mark deprecated

### Files to Modify
- `src/lib/supabase/dashboard.js`
- `src/pages/dashboard/AboveFoldSection.jsx`
- `src/pages/dashboard/useDashboardData.js`

---

## Issue 6: SSO Validation Minimal
**Severity:** Low | **File:** `src/lib/sso.js`

### Problem
- SSO config validation only checks if fields exist
- Doesn't validate URL formats, certificate format, etc.

### Solution
1. Add URL validation for entityId, ssoUrl, sloUrl
2. Validate certificate is base64 encoded
3. Check domain format for allowedDomains
4. Return specific error messages for each validation failure

### Files to Modify
- `src/lib/sso.js`

---

## Implementation Order

1. **Compare Page** (Critical - users see fake data)
2. **Variable Naming** (Low but quick - prevents confusion)
3. **Score Trend** (Medium - improves predictions)
4. **Webhook Test** (Medium - broken feature)
5. **SSO Validation** (Low - edge case)
6. **Stripe Checkout** (Medium - requires Stripe account setup)

---

## Progress Tracking

| Issue | Status | Files Modified |
|-------|--------|----------------|
| Compare Page | **DONE** | `src/lib/supabase/compare.js` (new), `src/lib/supabase/index.js`, `src/pages/Compare.jsx` |
| Webhook Test | **DONE** | `api/webhooks/test.js` (new), `src/lib/webhooks.js` |
| Stripe Checkout | **DONE** | `src/pages/Pricing.jsx` (uses existing API) |
| Score Trend | **DONE** | `src/lib/predictions.js` |
| Variable Names | **DONE** | `src/lib/supabase/dashboard.js`, `src/pages/dashboard/AboveFoldSection.jsx`, `src/pages/dashboard/useDashboardData.js` |
| SSO Validation | **DONE** | `src/lib/sso.js` |
