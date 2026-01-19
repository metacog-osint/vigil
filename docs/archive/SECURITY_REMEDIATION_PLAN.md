# Security Remediation Plan

> **Created:** January 2025
> **Updated:** January 2026
> **Purpose:** Fix API key exposure and other security issues identified in code review
> **Context:** This plan is designed to be executed independently on a clean machine
> **Priority Levels:** P0 (Critical), P1 (High), P2 (Medium), P3 (Low)

---

## Summary

Vigil currently exposes sensitive API keys in the frontend bundle via `VITE_*` environment variables. These need to be moved to backend/edge functions. Additional security gaps include missing authentication verification, overly permissive CORS, lack of security headers, and insufficient rate limiting.

### Completion Status

| Task | Priority | Status |
|------|----------|--------|
| Task 1: Move Resend Email API | P0 | COMPLETED |
| Task 2: Move Groq AI API | P0 | COMPLETED |
| Task 3: Firebase Token Verification | P0 | COMPLETED |
| Task 4: Webhook Signature Validation | P1 | COMPLETED |
| Task 5: CORS Configuration | P1 | COMPLETED |
| Task 6: Security Headers | P2 | COMPLETED |
| Task 7: Rate Limiting | P2 | COMPLETED |
| Task 8: Add Security Headers | P1 | COMPLETED |
| Task 9: Audit Logging | P2 | COMPLETED |
| Task 10: Environment Variable Cleanup | P0 | COMPLETED |
| Task 11: Key Rotation Procedure | P0 | COMPLETED |
| Task 12: Sanitize Error Messages | P2 | COMPLETED |
| Task 13: Verify Supabase RLS Policies | P2 | COMPLETED |
| Task 14: Input Validation Improvements | P2 | COMPLETED |
| Task 15: Session Management | P2 | COMPLETED |
| Task 16: Fix Insecure Random Generation | P0 | COMPLETED |
| Task 17: Fix XSS Vulnerabilities | P0 | COMPLETED |
| Task 18: Fix IDOR Vulnerabilities | P1 | COMPLETED |
| Task 19: Add Query Parameter Validation | P1 | COMPLETED |
| Task 20: Add SSRF Protection | P1 | COMPLETED |
| Task 21: Fix Open Redirect in OAuth | P2 | COMPLETED |
| Task 22: Fix Anonymous User Preferences | P3 | COMPLETED |

---

## Task 1: Move Resend Email API to Edge Function [P0] - COMPLETED

**Problem:** `src/lib/email.js` uses `VITE_RESEND_API_KEY` which gets bundled into client JavaScript.

**Solution:** Create a Vercel serverless function to handle email sending.

### Steps

1. Create `api/send-email.js`:
```javascript
import { Resend } from 'resend';
import { verifyFirebaseToken } from './lib/firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify request is from authenticated user (check Firebase token)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = await verifyFirebaseToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY); // NOT VITE_ prefixed

  try {
    const { to, subject, html, text } = req.body;

    const data = await resend.emails.send({
      from: 'Vigil Alerts <alerts@theintelligence.company>',
      to,
      subject,
      html,
      text,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('Email send failed:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
```

2. Update `src/lib/email.js` to call the API endpoint instead of Resend directly:
```javascript
export async function sendEmail({ to, subject, html, text }) {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getFirebaseToken()}`,
    },
    body: JSON.stringify({ to, subject, html, text }),
  });

  if (!response.ok) {
    throw new Error('Failed to send email');
  }

  return response.json();
}
```

3. Move environment variable:
   - Remove `VITE_RESEND_API_KEY` from `.env`
   - Add `RESEND_API_KEY` (no VITE_ prefix) to Vercel environment variables

4. Remove the direct Resend import from frontend code

---

## Task 2: Move Groq AI API to Edge Function [P0] - COMPLETED

**Problem:** `src/lib/ai.js` AND `src/components/EntityThreatSummary.jsx` use `VITE_GROQ_API_KEY` which gets bundled into client JavaScript.

**Affected Files:**
- `src/lib/ai.js` (lines 38, 182, 235)
- `src/components/EntityThreatSummary.jsx` (line 104)

**Solution:** Create a Vercel serverless function for AI summaries.

### Steps

1. Create `api/generate-summary.js`:
```javascript
import { verifyFirebaseToken } from './lib/firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Firebase auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];
  const decoded = await verifyFirebaseToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { type, data } = req.body; // type: 'bluf' | 'actor' | 'entity'

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: buildMessages(type, data),
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const result = await response.json();
    return res.status(200).json({
      summary: result.choices[0]?.message?.content
    });
  } catch (error) {
    console.error('AI summary failed:', error);
    return res.status(500).json({ error: 'Failed to generate summary' });
  }
}

function buildMessages(type, data) {
  // Move prompt construction logic from src/lib/ai.js here
  if (type === 'bluf') {
    return [{ role: 'user', content: `Generate a BLUF summary: ${JSON.stringify(data)}` }];
  }
  // ... other prompt types
}
```

2. Update `src/lib/ai.js` to call the API endpoint

3. Update `src/components/EntityThreatSummary.jsx` to call the API endpoint (remove direct Groq usage)

4. Move environment variable:
   - Remove `VITE_GROQ_API_KEY` from `.env`
   - Add `GROQ_API_KEY` to Vercel environment variables

---

## Task 3: Implement Firebase Token Verification [P0] - COMPLETED

**Problem:** API endpoints have placeholder TODOs for Firebase token verification but no actual implementation.

**Solution:** Create a shared Firebase Admin utility for token verification.

### Steps

1. Create `api/lib/firebase-admin.js`:
```javascript
import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * Verify Firebase ID token
 * @param {string} token - Firebase ID token from client
 * @returns {Promise<object|null>} - Decoded token or null if invalid
 */
export async function verifyFirebaseToken(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.error('Firebase token verification failed:', error.message);
    return null;
  }
}

export default admin;
```

2. Add required environment variables to Vercel:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

3. Update all API endpoints to use `verifyFirebaseToken()`:
   - `api/send-email.js`
   - `api/generate-summary.js`
   - Any other authenticated endpoints

---

## Task 4: Add Webhook Signature Validation [P1] ✅ COMPLETED

**Status:** Completed January 2026 - Added HMAC-SHA256 signing to `scripts/process-alerts.mjs`

**Problem:** Alert webhooks (Slack/Discord/Teams) in `src/lib/alerts.js` don't validate request sources.

**Solution:** Implement HMAC signature validation for outbound webhook delivery confirmation.

### Steps

1. Add a `webhook_secret` column to the `alert_webhooks` table (generate on webhook creation)

2. When processing alerts, include signature in webhook payload:
```javascript
import crypto from 'crypto';

function signWebhookPayload(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Include in webhook headers
headers['X-Vigil-Signature'] = `sha256=${signWebhookPayload(payload, secret)}`;
headers['X-Vigil-Timestamp'] = Date.now().toString();
```

3. For inbound webhooks (if any), validate signatures before processing

4. Document webhook signature verification for customers using generic webhooks

---

## Task 5: Fix CORS Configuration [P1] ✅ COMPLETED

**Status:** Completed January 2026

**Problem:** API endpoints use `Access-Control-Allow-Origin: '*'` which is overly permissive.

**Affected Files:**
- `api/lib/auth.js` (lines 126-131, 139-144)
- `api/scim/users.js` (line 95)

**Solution:** Restrict CORS to allowed domains.

### Steps

1. Create `api/lib/cors.js`:
```javascript
const ALLOWED_ORIGINS = [
  'https://vigil.theintelligence.company',
  'https://vigil-beta.vercel.app',
  process.env.NODE_ENV === 'development' && 'http://localhost:5173',
].filter(Boolean);

export function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

2. Update `api/lib/auth.js` to use restricted CORS:
```javascript
import { getCorsHeaders } from './cors';

export function jsonResponse(data, status = 200, req) {
  const origin = req?.headers?.origin || '';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    }
  });
}
```

3. Update `api/scim/users.js` similarly (SCIM may need specific IdP origins)

---

## Task 6: Fix SCIM Token Timing Attack Vulnerability [P1] ✅ COMPLETED

**Status:** Completed January 2026

**Problem:** `api/scim/users.js` uses `token === process.env.SCIM_SECRET_TOKEN` which is vulnerable to timing attacks.

**Solution:** Use constant-time comparison.

### Steps

1. Update `api/scim/users.js`:
```javascript
import crypto from 'crypto';

function validateScimToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  const expectedToken = process.env.SCIM_SECRET_TOKEN;

  if (!expectedToken || token.length !== expectedToken.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expectedToken)
  );
}
```

---

## Task 7: Add Rate Limiting [P1] ✅ COMPLETED (Upgraded)

**Status:** Completed January 2026 - Added to `api/lib/auth.js` and all v1 API endpoints
**Upgraded:** January 2026 - Migrated from in-memory to Redis-based distributed rate limiting

**Problem:** No rate limiting on API endpoints, allowing potential abuse. Initial in-memory implementation didn't work across Vercel Edge instances (each instance had its own rate limit map).

**Solution:** Implement distributed rate limiting using Upstash Redis.

**Implementation:**
- Created `api/lib/rateLimit.js` with Redis-backed limiter via `@upstash/redis` and `@upstash/ratelimit`
- Added fallback to in-memory rate limiting if Redis unavailable (graceful degradation)
- Updated all v1 API endpoints to use async `checkRateLimit()` function
- Rate limits configured per API key from `api_keys.rate_limit_per_minute` column
- Returns proper 429 status with `Retry-After` header
- Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers

**Environment Variables (for Redis):**
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token

### Steps

1. Create `api/lib/rate-limit.js`:
```javascript
import { LRUCache } from 'lru-cache';

const rateLimitCache = new LRUCache({
  max: 10000, // Max number of IPs to track
  ttl: 60 * 1000, // 1 minute window
});

export function rateLimit(options = {}) {
  const { limit = 60, windowMs = 60000 } = options;

  return (req) => {
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const key = `${ip}:${req.url}`;

    const current = rateLimitCache.get(key) || 0;

    if (current >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + windowMs,
      };
    }

    rateLimitCache.set(key, current + 1);

    return {
      allowed: true,
      remaining: limit - current - 1,
    };
  };
}
```

2. Apply stricter limits to sensitive endpoints:
   - `/api/send-email`: 10 requests/minute
   - `/api/generate-summary`: 20 requests/minute
   - `/api/scim/*`: 100 requests/minute
   - `/api/stripe/*`: 50 requests/minute

3. Return rate limit headers:
```javascript
res.setHeader('X-RateLimit-Limit', limit);
res.setHeader('X-RateLimit-Remaining', remaining);
res.setHeader('X-RateLimit-Reset', resetAt);
```

---

## Task 8: Add Security Headers [P1] ✅ COMPLETED

**Status:** Completed January 2026 - Added to `vercel.json`

**Problem:** Application lacks security headers (CSP, X-Frame-Options, etc.).

**Solution:** Add security headers via Vercel configuration or middleware.

### Steps

1. Update `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.firebaseio.com https://api.groq.com https://api.resend.com wss://*.supabase.co; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

2. Test CSP doesn't break functionality (especially Firebase and Supabase connections)

---

## Task 9: Add Audit Logging for Sensitive Operations [P2] ✅ COMPLETED

**Status:** Completed January 2026 - Created `api/_lib/audit.js` and migration `064_audit_logging.sql`

**Problem:** No audit trail for sensitive operations like API key management, webhook changes, and SCIM operations.

**Solution:** Implement comprehensive audit logging.

### Steps

1. Create `supabase/migrations/xxx_audit_log.sql`:
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

2. Create `api/lib/audit.js`:
```javascript
import { supabase } from './auth';

export async function logAuditEvent({
  userId,
  action,
  resourceType,
  resourceId,
  details,
  req,
}) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'],
      user_agent: req?.headers?.['user-agent'],
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}
```

3. Log these operations:
   - API key created/deleted/rotated
   - Webhook created/updated/deleted
   - SCIM user provisioned/deprovisioned
   - Subscription changes
   - Failed login attempts
   - Permission changes

---

## Task 10: Environment Variable Cleanup [P0]

### Current State (Insecure)
```
VITE_RESEND_API_KEY=re_xxx      # Exposed in bundle
VITE_GROQ_API_KEY=gsk_xxx       # Exposed in bundle
```

### Target State (Secure)
```
# Frontend (.env) - only public keys
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # This is designed to be public
VITE_FIREBASE_API_KEY=AIza...   # This is designed to be public
VITE_VAPID_PUBLIC_KEY=BKxx...   # Public key, safe to expose

# Backend (Vercel env vars) - secrets
RESEND_API_KEY=re_xxx
GROQ_API_KEY=gsk_xxx
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VAPID_PRIVATE_KEY=xxx
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY=xxx
SCIM_SECRET_TOKEN=xxx
```

---

## Task 11: Key Rotation Procedure [P0]

**Problem:** Exposed API keys should be considered compromised and need rotation.

### Keys to Rotate

| Key | Service | Rotation Steps |
|-----|---------|----------------|
| `VITE_GROQ_API_KEY` | Groq | 1. Generate new key at console.groq.com 2. Update Vercel env 3. Delete old key |
| `VITE_RESEND_API_KEY` | Resend | 1. Generate new key at resend.com/api-keys 2. Update Vercel env 3. Revoke old key |

### Zero-Downtime Rotation Process

1. **Before rotation:**
   - Ensure new API endpoints are deployed and working
   - Verify frontend is calling new endpoints (not using keys directly)

2. **Rotation:**
   - Generate new key in service dashboard
   - Add new key to Vercel as `GROQ_API_KEY` / `RESEND_API_KEY`
   - Redeploy to pick up new env vars
   - Verify functionality

3. **Cleanup:**
   - Delete/revoke old keys in service dashboards
   - Remove `VITE_*` versions from local `.env` files
   - Update `.env.example` to not include sensitive keys

---

## Task 12: Sanitize Error Messages [P2] ✅ COMPLETED

**Status:** Completed January 2026 - Created `api/_lib/errors.js` with ApiError class and handleError utility

**Problem:** Some endpoints return raw error messages which could leak internal details.

**Affected Files:**
- `api/scim/users.js` (line 296: returns `error.message`)
- Various other API endpoints

**Solution:** Standardize error responses.

### Steps

1. Create `api/lib/errors.js`:
```javascript
export class ApiError extends Error {
  constructor(message, statusCode = 500, publicMessage = null) {
    super(message);
    this.statusCode = statusCode;
    this.publicMessage = publicMessage || 'An error occurred';
  }
}

export function handleError(error, res) {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.publicMessage,
    });
  }

  // Never expose internal error details
  return res.status(500).json({
    error: 'Internal server error',
  });
}
```

2. Update all API endpoints to use `handleError()` instead of returning `error.message`

---

## Task 13: Verify Supabase RLS Policies [P2] ✅ COMPLETED

**Status:** Completed January 2026 - Created migration `065_secure_rls_policies.sql` with proper user-scoped policies for api_keys, watchlists, watchlist_items, user_preferences, alert_webhooks, push_subscriptions, notifications, and user_subscriptions tables.

**Problem:** Need to verify Row Level Security policies are properly configured.

### Steps

1. Audit all tables for RLS:
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

2. Verify these critical tables have RLS enabled:
   - `user_preferences` - users can only access their own
   - `user_subscriptions` - users can only access their own
   - `api_keys` - users can only access their own
   - `alert_webhooks` - users can only access their own
   - `push_subscriptions` - users can only access their own
   - `watchlists` - users can only access their own (or shared)
   - `notifications` - users can only access their own

3. Test RLS policies with different user contexts

---

## Task 14: Input Validation Improvements [P2] ✅ COMPLETED

**Status:** Completed January 2026 - Enhanced `api/_lib/validators.js` with IOC, email, IP, domain, hash validators. Created `src/lib/validators.js` for frontend validation.

**Problem:** Input validation is inconsistent across the application.

### Areas to Address

1. **Search queries** (already in plan):
   - `src/lib/supabase/threatActors.js`
   - `src/lib/supabase/incidents.js`
   - `src/lib/supabase/iocs.js`

2. **IOC inputs**:
   - Validate IP addresses, domains, hashes before database queries
   - Prevent potential injection through malformed IOCs

3. **Webhook URLs**:
   - `src/lib/alerts.js` has basic validation but needs:
   - SSRF prevention (block internal IPs)
   - URL length limits

4. **Email addresses**:
   - Validate format before sending emails
   - Prevent header injection

### Implementation

```javascript
// api/lib/validators.js
import validator from 'validator';

export function validateEmail(email) {
  if (!email || !validator.isEmail(email)) {
    throw new ApiError('Invalid email address', 400, 'Invalid email address');
  }
  return validator.normalizeEmail(email);
}

export function validateWebhookUrl(url) {
  if (!url || !validator.isURL(url, { protocols: ['https'] })) {
    throw new ApiError('Invalid webhook URL', 400, 'Webhook URL must be HTTPS');
  }

  // SSRF prevention - block internal IPs
  const parsed = new URL(url);
  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (blockedHosts.includes(parsed.hostname)) {
    throw new ApiError('Invalid webhook URL', 400, 'Internal URLs not allowed');
  }

  return url;
}

export function validateIOC(value, type) {
  switch (type) {
    case 'ip':
      if (!validator.isIP(value)) {
        throw new ApiError('Invalid IP address', 400);
      }
      break;
    case 'domain':
      if (!validator.isFQDN(value)) {
        throw new ApiError('Invalid domain', 400);
      }
      break;
    case 'hash':
      if (!/^[a-fA-F0-9]{32,64}$/.test(value)) {
        throw new ApiError('Invalid hash', 400);
      }
      break;
  }
  return value;
}
```

---

## Task 15: Session Management [P2] ✅ COMPLETED

**Status:** Completed January 2026 - Created `src/lib/sessionManager.js` with token refresh, logout cleanup, activity tracking, session timeout, and re-authentication for sensitive operations.

**Problem:** No explicit handling of session refresh, logout, or invalidation.

### Steps

1. Implement token refresh handling in frontend:
```javascript
// src/lib/auth.js
import { getAuth, onIdTokenChanged } from 'firebase/auth';

export function setupTokenRefresh() {
  const auth = getAuth();

  onIdTokenChanged(auth, async (user) => {
    if (user) {
      // Token refreshed, update any cached tokens
      const token = await user.getIdToken();
      // Store for API calls
    }
  });
}
```

2. Add logout cleanup:
   - Clear local storage
   - Unsubscribe from push notifications
   - Invalidate any cached tokens

3. Force re-authentication for sensitive operations:
   - Changing email
   - Deleting account
   - Regenerating API keys

---

## Verification Checklist

After completing the tasks:

### API Key Exposure
- [ ] `grep -r "VITE_RESEND" src/` returns no results
- [ ] `grep -r "VITE_GROQ" src/` returns no results
- [ ] No API keys visible in browser DevTools → Sources → webpack/vite bundle
- [ ] Email sending works via `/api/send-email`
- [ ] AI summaries work via `/api/generate-summary`

### Authentication
- [ ] All API endpoints verify Firebase tokens
- [ ] Token verification uses `firebase-admin` SDK
- [ ] Invalid tokens return 401

### CORS & Headers
- [ ] CORS only allows specific origins
- [ ] Security headers present (check with securityheaders.com)
- [ ] CSP doesn't break functionality

### Rate Limiting
- [ ] `/api/send-email` rate limited to 10/min
- [ ] `/api/generate-summary` rate limited to 20/min
- [ ] Rate limit headers returned

### SCIM
- [ ] Token comparison uses constant-time comparison
- [ ] Error messages don't leak internal details

### Audit & Logging
- [ ] Audit log table exists
- [ ] Sensitive operations logged

### Key Rotation
- [ ] Old Groq key revoked
- [ ] Old Resend key revoked
- [ ] New keys working in production

---

## Task 16: Fix Insecure Random Number Generation [P0] ✅ COMPLETED

**Status:** Completed January 2026

**Problem:** API keys and session IDs are generated using `Math.random()` which is cryptographically insecure.

**Affected Files:**
- `src/lib/apiKeys.js` (line 16) - API key generation
- `src/lib/analytics.js` (line 24) - Session ID generation

**Solution:** Use `crypto.getRandomValues()` for all security-sensitive random values.

### Steps

1. Fix `src/lib/apiKeys.js`:
```javascript
// BEFORE (insecure)
for (let i = 0; i < 32; i++) {
  key += chars.charAt(Math.floor(Math.random() * chars.length))
}

// AFTER (secure)
function generateSecureKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = new Uint32Array(length)
  crypto.getRandomValues(randomValues)
  let key = 'vgl_'
  for (let i = 0; i < length; i++) {
    key += chars.charAt(randomValues[i] % chars.length)
  }
  return key
}
```

2. Fix `src/lib/analytics.js`:
```javascript
// BEFORE (insecure)
sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`

// AFTER (secure)
function generateSessionId() {
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)
  const hex = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('')
  return `sess_${Date.now()}_${hex}`
}
```

---

## Task 17: Fix XSS Vulnerabilities in Markdown Rendering [P0] ✅ COMPLETED

**Status:** Completed January 2026 - Added DOMPurify sanitization

**Problem:** `dangerouslySetInnerHTML` is used with markdown content that may contain user input.

**Affected Files:**
- `src/pages/Help.jsx` (lines 485-487)
- `src/components/InvestigationNotebook.jsx` (line 424)

**Solution:** Use a sanitization library like DOMPurify before rendering HTML.

### Steps

1. Install DOMPurify:
```bash
npm install dompurify
```

2. Create sanitization wrapper:
```javascript
// src/lib/sanitize.js
import DOMPurify from 'dompurify'

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  })
}

export function renderMarkdownSafe(markdown) {
  const html = renderMarkdown(markdown)
  return sanitizeHtml(html)
}
```

3. Update components:
```jsx
// Help.jsx
import { sanitizeHtml } from '../lib/sanitize'

<div dangerouslySetInnerHTML={{
  __html: sanitizeHtml(formatMarkdown(section.content)),
}}/>

// InvestigationNotebook.jsx
import { renderMarkdownSafe } from '../lib/sanitize'

<div dangerouslySetInnerHTML={{
  __html: renderMarkdownSafe(notes) || '<p class="text-gray-500">...</p>'
}}/>
```

---

## Task 18: Fix IDOR Vulnerabilities in Watchlists [P1] ✅ COMPLETED

**Status:** Completed January 2026 - Added userId verification to all mutation operations

**Problem:** Watchlist update/delete operations don't verify user ownership.

**Affected Files:**
- `src/lib/supabase/watchlists.js` - `update()`, `delete()`, `removeItem()`
- `src/lib/supabase/sharedWatchlists.js` - `updateWatchlist()`, `removeItem()`

**Solution:** Add user/team ownership verification to all mutation operations.

### Steps

1. Fix `src/lib/supabase/watchlists.js`:
```javascript
// BEFORE
async update(id, updates) {
  return supabase
    .from('watchlists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

// AFTER
async update(id, updates, userId) {
  if (!userId) throw new Error('User ID required')
  return supabase
    .from('watchlists')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)  // Verify ownership
    .select()
    .single()
}

async delete(id, userId) {
  if (!userId) throw new Error('User ID required')
  return supabase
    .from('watchlists')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)  // Verify ownership
}
```

2. Similar fixes for `sharedWatchlists.js` - verify team membership before mutations

3. **Alternative:** Rely on Supabase RLS policies (Task 13) but explicit checks are defense-in-depth

---

## Task 19: Add Query Parameter Validation [P1] ✅ COMPLETED

**Status:** Completed January 2026 - Created `api/lib/validators.js`

**Problem:** `sort_by` and other query parameters are passed directly to database queries without validation.

**Affected Files:**
- `api/v1/actors.js` (line 106)
- `api/v1/incidents.js` (line 123)
- `api/v1/iocs.js`
- `api/v1/vulnerabilities.js`

**Solution:** Validate query parameters against whitelists.

### Steps

1. Create `api/lib/query-validators.js`:
```javascript
const ALLOWED_SORT_FIELDS = {
  actors: ['name', 'last_seen', 'first_seen', 'incident_count', 'trend_status', 'created_at'],
  incidents: ['discovered_date', 'victim_name', 'created_at', 'severity'],
  iocs: ['created_at', 'last_seen', 'type', 'threat_level'],
  vulnerabilities: ['published_date', 'cvss_score', 'cve_id', 'created_at'],
}

export function validateSortField(entity, field) {
  const allowed = ALLOWED_SORT_FIELDS[entity] || []
  if (!allowed.includes(field)) {
    return allowed[0] // Return default
  }
  return field
}

export function validateSortOrder(order) {
  return order === 'asc' ? 'asc' : 'desc'
}

export function validatePagination(page, limit) {
  const validPage = Math.max(1, Math.min(parseInt(page) || 1, 1000)) // Max 1000 pages
  const validLimit = Math.max(1, Math.min(parseInt(limit) || 50, 100)) // Max 100 per page
  return { page: validPage, limit: validLimit }
}
```

2. Update API endpoints:
```javascript
import { validateSortField, validateSortOrder, validatePagination } from './lib/query-validators'

const sortBy = validateSortField('actors', params.get('sort_by'))
const sortOrder = validateSortOrder(params.get('sort_order'))
const { page, limit } = validatePagination(params.get('page'), params.get('limit'))
```

---

## Task 20: Add SSRF Protection to Webhook URLs [P1] ✅ COMPLETED

**Status:** Completed January 2026 - Updated `src/lib/alerts.js`

**Problem:** Webhook URL validation doesn't block private IP ranges, enabling SSRF attacks.

**Affected Files:**
- `src/lib/alerts.js` - `validateWebhookUrl()`
- `src/lib/webhooks.js` (if exists)

**Solution:** Block all private and reserved IP ranges.

### Steps

1. Update webhook URL validation:
```javascript
import { isIP } from 'validator'

const BLOCKED_IP_RANGES = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-2][0-7])\./, // Carrier-grade NAT
  /^::1$/,                     // IPv6 loopback
  /^fc00:/,                    // IPv6 private
  /^fe80:/,                    // IPv6 link-local
]

export function validateWebhookUrl(type, url) {
  try {
    const parsed = new URL(url)

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS' }
    }

    // Check for IP address
    const hostname = parsed.hostname
    if (isIP(hostname)) {
      for (const pattern of BLOCKED_IP_RANGES) {
        if (pattern.test(hostname)) {
          return { valid: false, error: 'Internal IP addresses not allowed' }
        }
      }
    }

    // Block localhost variations
    if (['localhost', 'localhost.localdomain', '0.0.0.0'].includes(hostname.toLowerCase())) {
      return { valid: false, error: 'Localhost not allowed' }
    }

    // URL length limit
    if (url.length > 2048) {
      return { valid: false, error: 'URL too long' }
    }

    // Type-specific validation...
    switch (type) {
      case 'slack':
        if (!url.includes('hooks.slack.com')) {
          return { valid: false, error: 'Must be a Slack webhook URL' }
        }
        break
      // ... other types
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}
```

---

## Task 21: Fix Open Redirect in OAuth Callbacks [P2] ✅ COMPLETED

**Status:** Completed January 2026 - Created `src/lib/oauthSecurity.js` with cryptographically secure state parameter generation and redirect URL validation.

**Problem:** OAuth redirect handling may not properly validate redirect URLs.

**Affected Files:**
- `src/pages/ChatIntegrations.jsx` (line 105)
- `src/lib/chat.js`

**Solution:** Validate OAuth state parameter and restrict redirect URLs.

### Steps

1. Use cryptographically secure state parameter:
```javascript
function generateOAuthState() {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const state = btoa(String.fromCharCode(...randomBytes))
  sessionStorage.setItem('oauth_state', state)
  return state
}
```

2. Validate state on callback:
```javascript
function validateOAuthCallback(returnedState) {
  const expectedState = sessionStorage.getItem('oauth_state')
  sessionStorage.removeItem('oauth_state')

  if (!expectedState || returnedState !== expectedState) {
    throw new Error('Invalid OAuth state - possible CSRF attack')
  }
}
```

3. Whitelist redirect URLs:
```javascript
const ALLOWED_REDIRECT_PATHS = ['/settings', '/integrations', '/chat']

function validateRedirectUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin)
    // Must be same origin
    if (parsed.origin !== window.location.origin) {
      return false
    }
    // Must be allowed path
    return ALLOWED_REDIRECT_PATHS.some(path => parsed.pathname.startsWith(path))
  } catch {
    return false
  }
}
```

---

## Task 22: Fix Anonymous User Preferences [P3] ✅ COMPLETED

**Status:** Completed January 2026 - Updated `src/lib/supabase/userPreferences.js` to require authenticated user ID, return defaults for unauthenticated users without database access, and add `isDefault` flag.

**Problem:** Default `userId = 'anonymous'` in userPreferences allows preference conflicts.

**Affected Files:**
- `src/lib/supabase/userPreferences.js` (line 9)

**Solution:** Require authenticated user ID.

### Steps

1. Remove default anonymous user:
```javascript
// BEFORE
async get(userId = 'anonymous') {

// AFTER
async get(userId) {
  if (!userId) {
    throw new Error('Authenticated user ID required')
  }
  // ...
}
```

2. Update all callers to pass authenticated user ID

---

## Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `api/send-email.js` | Create (new) | P0 |
| `api/generate-summary.js` | Create (new) | P0 |
| `api/lib/firebase-admin.js` | Create (new) | P0 |
| `src/lib/apiKeys.js` | Fix insecure random | P0 |
| `src/lib/analytics.js` | Fix insecure random | P0 |
| `src/lib/sanitize.js` | Create (new) | P0 |
| `src/pages/Help.jsx` | Add HTML sanitization | P0 |
| `src/components/InvestigationNotebook.jsx` | Add HTML sanitization | P0 |
| `api/lib/cors.js` | Create (new) | P1 |
| `api/lib/rate-limit.js` | Create (new) | P1 |
| `api/lib/query-validators.js` | Create (new) | P1 |
| `src/lib/supabase/watchlists.js` | Add ownership checks | P1 |
| `src/lib/supabase/sharedWatchlists.js` | Add team checks | P1 |
| `src/lib/alerts.js` | Add SSRF protection | P1 |
| `api/v1/actors.js` | Add query validation | P1 |
| `api/v1/incidents.js` | Add query validation | P1 |
| `api/lib/errors.js` | Create (new) | P2 |
| `api/lib/audit.js` | Create (new) | P2 |
| `api/lib/validators.js` | Create (new) | P2 |
| `src/lib/email.js` | Update to use API endpoint | P0 |
| `src/lib/ai.js` | Update to use API endpoint | P0 |
| `src/components/EntityThreatSummary.jsx` | Update to use API endpoint | P0 |
| `api/lib/auth.js` | Fix CORS | P1 |
| `api/scim/users.js` | Fix timing attack, CORS, error messages | P1 |
| `vercel.json` | Add security headers | P1 |
| `.env` | Remove VITE_RESEND_API_KEY, VITE_GROQ_API_KEY | P0 |
| `src/pages/ChatIntegrations.jsx` | Fix open redirect | P2 |
| `src/lib/supabase/userPreferences.js` | Remove anonymous default | P3 |

---

## Notes for Implementation

- The existing `api/stripe/webhook.js` is a good reference for how to structure Vercel serverless functions
- Firebase token verification requires `firebase-admin` SDK and service account credentials
- Test locally with `vercel dev` before deploying
- After deployment, rotate the exposed API keys (they should be considered compromised)
- Run security header check at https://securityheaders.com after deployment
- Consider running OWASP ZAP or similar tool for additional vulnerability scanning

---

## Extended Verification Checklist

### Cryptographic Security
- [ ] API key generation uses `crypto.getRandomValues()`
- [ ] Session ID generation uses `crypto.getRandomValues()`
- [ ] No `Math.random()` used for security-sensitive values

### XSS Prevention
- [ ] All `dangerouslySetInnerHTML` usage sanitized with DOMPurify
- [ ] No raw user input rendered in HTML
- [ ] CSP headers block inline scripts where possible

### Authorization (IDOR Prevention)
- [ ] Watchlist update/delete verifies user ownership
- [ ] Shared watchlist operations verify team membership
- [ ] All resource mutations include ownership checks
- [ ] RLS policies active on user-specific tables

### Input Validation
- [ ] `sort_by` parameter validated against whitelist
- [ ] `sort_order` validated to 'asc' or 'desc'
- [ ] Pagination parameters have upper bounds
- [ ] Webhook URLs block private IP ranges

### OAuth Security
- [ ] OAuth state parameter cryptographically secure
- [ ] State validated on callback
- [ ] Redirect URLs whitelisted

---

## Dependencies to Add

```bash
npm install firebase-admin lru-cache validator dompurify
```

For TypeScript projects, also add:
```bash
npm install -D @types/dompurify
```

---

## Priority Summary

| Priority | Tasks | Description |
|----------|-------|-------------|
| P0 (Critical) | 1, 2, 3, 10, 11, 16, 17 | API key exposure, auth, insecure random, XSS |
| P1 (High) | 4, 5, 6, 7, 8, 18, 19, 20 | CORS, timing attacks, rate limiting, IDOR, SSRF |
| P2 (Medium) | 9, 12, 13, 14, 15, 21 | Audit logging, error sanitization, RLS, session mgmt |
| P3 (Low) | 22 | Anonymous user preferences |

**Recommended Order:**
1. Fix P0 issues first (exposed secrets, XSS, insecure random)
2. Deploy and rotate compromised keys
3. Fix P1 issues (auth, CORS, IDOR)
4. Fix P2/P3 issues in subsequent releases
