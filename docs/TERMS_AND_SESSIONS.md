# Terms Acceptance & Session Management

> **Last Updated:** January 19, 2026 | **Migration:** 071_terms_and_sessions.sql

This document covers the terms acceptance tracking system and session timeout management implemented for Vigil.

---

## Overview

Vigil implements two critical user management features:

1. **Terms Acceptance Tracking** - Ensures users accept Terms of Service and Privacy Policy, with re-acceptance required when terms are updated
2. **Session Management** - Automatic logout after idle timeout (30 min) and absolute timeout (8 hours)

---

## Terms Acceptance System

### Database Schema

```sql
-- Track terms/privacy policy versions
CREATE TABLE terms_versions (
  id UUID PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,           -- e.g., '1.0.0', '1.1.0'
  terms_updated_at DATE NOT NULL,
  privacy_updated_at DATE NOT NULL,
  summary TEXT,                            -- Brief description for user
  requires_reaccept BOOLEAN DEFAULT true,  -- Force existing users to re-accept
  created_at TIMESTAMPTZ
);

-- Track user acceptances
CREATE TABLE terms_acceptances (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  UNIQUE(user_id, terms_version)
);
```

### RPC Functions

| Function | Purpose |
|----------|---------|
| `get_current_terms_version()` | Returns latest terms version info |
| `has_accepted_current_terms(user_id)` | Checks if user accepted current version |
| `accept_terms(version, ip, user_agent)` | Records user acceptance |

### Frontend Integration

**Library:** `src/lib/terms.js`

```javascript
import {
  CURRENT_TERMS_VERSION,      // '1.0.0'
  getCurrentTermsVersion,     // Get version from DB
  hasAcceptedCurrentTerms,    // Check user acceptance
  acceptTerms,                // Record acceptance
  getAcceptanceHistory,       // User's acceptance history
} from '../lib/terms'
```

**Hook:** `src/hooks/useTermsAcceptance.js`

```javascript
import { useTermsAcceptance } from '../hooks/useTermsAcceptance'

const {
  loading,           // Initial check in progress
  needsAcceptance,   // true if user must accept
  termsVersion,      // Current version info
  accepting,         // Acceptance in progress
  error,             // Error message if any
  acceptTerms,       // Function to accept
} = useTermsAcceptance()
```

**Component:** `src/components/TermsUpdateModal.jsx`

Shown as a blocking modal when `needsAcceptance` is true. User must:
1. Click links to review Terms and Privacy Policy
2. Check the acceptance checkbox
3. Click "Accept and Continue"

### Registration Flow

New users must check acceptance box during registration (`src/pages/Auth.jsx`):
- Checkbox: "I agree to the Terms of Service and Privacy Policy"
- Registration blocked until checked
- Links open terms/privacy in new tabs

### Updating Terms

When you update `Terms.jsx` or `Privacy.jsx`:

1. **Update the version constant:**
   ```javascript
   // src/lib/terms.js
   export const CURRENT_TERMS_VERSION = '1.1.0'  // Increment
   export const TERMS_UPDATED_DATE = '2026-02-15'
   export const PRIVACY_UPDATED_DATE = '2026-02-15'
   ```

2. **Insert new version in database:**
   ```sql
   INSERT INTO terms_versions (
     version,
     terms_updated_at,
     privacy_updated_at,
     summary,
     requires_reaccept
   ) VALUES (
     '1.1.0',
     '2026-02-15',
     '2026-02-15',
     'Updated data retention policy and added new liability clauses',
     true  -- Force all users to re-accept
   );
   ```

3. **Deploy the changes** - All users will see the Terms Update Modal at next login

### Minor Updates (No Re-acceptance)

For typo fixes or clarifications that don't require re-acceptance:

```sql
INSERT INTO terms_versions (version, terms_updated_at, privacy_updated_at, summary, requires_reaccept)
VALUES ('1.0.1', '2026-02-01', '2026-01-19', 'Minor typo corrections', false);
```

---

## Session Management

### Configuration

**File:** `src/lib/sessionManager.js`

```javascript
export const SESSION_CONFIG = {
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,      // 30 minutes
  ABSOLUTE_TIMEOUT_MS: 8 * 60 * 60 * 1000,  // 8 hours
  WARNING_BEFORE_MS: 5 * 60 * 1000,     // 5 min warning
  ACTIVITY_EVENTS: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'],
  ACTIVITY_THROTTLE_MS: 60 * 1000,      // Throttle updates to 1/min
}
```

### Timeout Types

| Type | Duration | Behavior |
|------|----------|----------|
| **Idle Timeout** | 30 minutes | Resets on any user activity |
| **Absolute Timeout** | 8 hours | Forces re-auth regardless of activity |
| **Warning** | 5 min before idle | Modal with "Stay Signed In" button |

### Frontend Integration

**Hook:** `src/hooks/useSessionManager.js`

```javascript
import { useSessionManager } from '../hooks/useSessionManager'

const {
  showWarning,       // true when warning modal should show
  warningInfo,       // { minutes, type }
  timeoutReason,     // 'idle' | 'absolute' | 'cross_tab' | 'manual'
  extendSession,     // Reset idle timer
  dismissWarning,    // Close warning without extending
  getTimeRemaining,  // Get remaining time
  config,            // SESSION_CONFIG
} = useSessionManager()
```

**Component:** `src/components/SessionWarningModal.jsx`

Shows 5 minutes before idle timeout with:
- Warning message with countdown
- "Stay Signed In" button (extends session)
- "Dismiss" button (closes modal, timeout still applies)

### Cross-Tab Synchronization

Sessions sync across browser tabs:
- Logout in one tab logs out all tabs
- Activity in one tab updates others
- Uses `localStorage` events for communication

### Session Events

```javascript
// Listen for session timeout
useSessionManager({
  onTimeout: ({ reason }) => {
    // reason: 'idle', 'absolute', 'cross_tab', 'manual'
    navigate('/auth', { state: { message: 'Session expired' } })
  },
  onWarning: ({ minutes, type }) => {
    // Show warning modal
  }
})
```

---

## Database Tables

### terms_versions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| version | TEXT | Semantic version (unique) |
| terms_updated_at | DATE | When ToS was updated |
| privacy_updated_at | DATE | When Privacy was updated |
| summary | TEXT | User-facing change description |
| requires_reaccept | BOOLEAN | Force users to re-accept |
| created_at | TIMESTAMPTZ | Record creation time |

### terms_acceptances

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users |
| terms_version | TEXT | Version accepted |
| accepted_at | TIMESTAMPTZ | When accepted |
| ip_address | INET | User's IP (optional) |
| user_agent | TEXT | Browser info (optional) |

### user_sessions (Optional)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users |
| session_token | TEXT | Hashed Supabase session ID |
| created_at | TIMESTAMPTZ | Session start |
| last_activity_at | TIMESTAMPTZ | Last activity |
| expires_at | TIMESTAMPTZ | Expiration time |
| ip_address | INET | User's IP |
| user_agent | TEXT | Browser info |
| device_info | JSONB | Device metadata |
| is_valid | BOOLEAN | Session validity flag |

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/terms.js` | Terms version constants and API functions |
| `src/lib/sessionManager.js` | Session timeout logic |
| `src/hooks/useTermsAcceptance.js` | React hook for terms state |
| `src/hooks/useSessionManager.js` | React hook for session state |
| `src/components/TermsUpdateModal.jsx` | Terms re-acceptance modal |
| `src/components/SessionWarningModal.jsx` | Timeout warning modal |
| `src/pages/Auth.jsx` | Registration with terms checkbox |
| `src/pages/Terms.jsx` | Terms of Service page |
| `src/pages/Privacy.jsx` | Privacy Policy page |
| `supabase/migrations/071_terms_and_sessions.sql` | Database schema |

---

## Security Considerations

1. **Acceptance Audit Trail** - All acceptances recorded with timestamp, IP, and user agent
2. **Tamper-Proof Versions** - Version string is immutable once created
3. **Session Invalidation** - `invalidate_user_sessions(user_id)` function for forced logout
4. **Cross-Tab Security** - Logout propagates to all tabs immediately
5. **RLS Policies** - Users can only see/create their own acceptances

---

## Troubleshooting

### User not seeing Terms modal
- Check `requires_reaccept` is `true` for current version
- Verify version in `terms.js` matches database
- Check browser console for RPC errors

### Session not timing out
- Verify `useSessionManager` hook is mounted in `ProtectedApp`
- Check activity events are being captured
- Verify localStorage is not disabled

### Terms version mismatch
- Always update both `src/lib/terms.js` and database
- Run migration before deploying frontend changes
