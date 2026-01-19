# Security & Code Quality

> **Version:** 0.4.2 | **Last Updated:** January 19, 2026

## Pre-commit Hooks (Husky + lint-staged)

Automated code quality checks run before every commit:

```bash
# Husky runs lint-staged on pre-commit
# Configuration in package.json:
"lint-staged": {
  "src/**/*.{js,jsx}": ["eslint --fix --max-warnings 0"],
  "src/**/*.{js,jsx,json,css}": ["prettier --write"]
}
```

**What happens on commit:**
1. ESLint runs on staged JS/JSX files with auto-fix
2. Prettier formats staged files
3. Commit is blocked if any lint errors remain (warnings allowed)

**Bypass hooks (emergency only):**
```bash
git commit --no-verify -m "message"
```

**Files:**
- `.husky/pre-commit` - Hook script
- `package.json` - lint-staged configuration

## Logger Utility

Environment-aware logging that suppresses debug/info logs in production:

```javascript
import { logger } from '../lib/logger'

logger.debug('Debug info')  // Only in development
logger.info('Info message') // Only in development
logger.warn('Warning')      // Always logged
logger.error('Error', err)  // Always logged
```

## API Query Validation

All API endpoints use validated query parameters via `api/lib/validators.js`:

```javascript
import {
  validateSortField,
  validateSortOrder,
  validatePagination,
  sanitizeSearch,
  isValidUUID,
  isValidCVE,
  validateDateRange,
  validateIOCType
} from '../lib/validators.js'

// Whitelist-based sort field validation
const sortBy = validateSortField('actors', params.get('sort_by'))

// Sanitize search strings (removes special chars, limits length)
const search = sanitizeSearch(params.get('search'))

// Validate pagination bounds (max 100 per page, max 1000 pages)
const { page, limit, offset } = validatePagination(params.get('page'), params.get('limit'))
```

## CORS Configuration

Restricted CORS via `api/lib/cors.js`:

```javascript
import { getCorsHeaders, handleCorsPreflightRequest } from '../lib/cors.js'

// Handle preflight
const preflightResponse = handleCorsPreflightRequest(request)
if (preflightResponse) return preflightResponse

// Get origin-specific headers
const headers = getCorsHeaders(request.headers.get('origin'))
```

Allowed origins:
- `https://vigil.theintelligence.company`
- `https://www.vigil.theintelligence.company`
- `*.vercel.app` (preview deployments)
- `http://localhost:5173` (development only)

## Security Headers

Production security headers are configured in `vercel.json`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricts camera, microphone, geolocation)

## CI/CD Updates

E2E tests now run on multiple browsers via matrix strategy:

```yaml
# .github/workflows/ci.yml
e2e-tests:
  strategy:
    fail-fast: false
    matrix:
      browser: [chromium, firefox, webkit]
```

## Secure API Endpoints

API keys are now protected via Vercel serverless functions. The frontend no longer has access to sensitive keys like `RESEND_API_KEY` or `GROQ_API_KEY`.

### API Files

```
api/lib/supabase-auth.js    # Supabase JWT token verification
api/lib/cors.js             # CORS configuration
api/lib/validators.js       # Query parameter validation
api/send-email.js           # Secure email sending via Resend
api/generate-summary.js     # Secure AI summaries via Groq
```

### Supabase Token Verification

All authenticated endpoints verify Supabase JWT tokens:

```javascript
import { verifyRequest } from './lib/supabase-auth.js'

export default async function handler(request) {
  const { user, error } = await verifyRequest(request)
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 401 })
  }
  // user.id is now available
}
```

### Email API (`/api/send-email`)

```javascript
// Frontend usage (src/lib/email.js)
import { supabase } from './supabase/client'

const { data: { session } } = await supabase.auth.getSession()
const response = await fetch('/api/send-email', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to, subject, html, text }),
})
```

Rate limit: 10 emails per minute per user.

### AI Summary API (`/api/generate-summary`)

```javascript
// Frontend usage (src/lib/ai.js)
import { supabase } from './supabase/client'

const { data: { session } } = await supabase.auth.getSession()
const response = await fetch('/api/generate-summary', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'bluf',  // or 'actor'
    data: { incidents30d, topActors, topSectors, recentIncidents }
  }),
})
```

Rate limit: 5 requests per minute per user.

### Getting API Keys

1. **Supabase Service Role Key**: Supabase Dashboard > Settings > API > service_role key
2. **Resend API Key**: https://resend.com/api-keys
3. **Groq API Key**: https://console.groq.com/keys (free tier available)
