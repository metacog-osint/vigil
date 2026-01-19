# Infrastructure Modules

> **Version:** 1.2.1 | **Last Updated:** January 19, 2026

## Error Tracking (Sentry)

Sentry is initialized in production for error tracking:

```javascript
// src/lib/sentry.js
import { initSentry, captureException } from '../lib/sentry'

// Initialize on app startup (done in main.jsx)
if (import.meta.env.PROD) {
  initSentry()
}

// Capture errors manually
try {
  await riskyOperation()
} catch (error) {
  captureException(error, { extra: { context: 'additional info' } })
}
```

Environment variable: `VITE_SENTRY_DSN` (set in Vercel)

## Retry Utility

Exponential backoff retry for API calls:

```javascript
import { withRetry } from '../lib/retry'

// Wrap any async operation
const result = await withRetry(
  () => supabase.from('actors').select('*'),
  { maxRetries: 3, baseDelay: 1000 }
)

// With custom retry conditions
const result = await withRetry(fn, {
  shouldRetry: (error) => error.status >= 500,
  onRetry: (attempt, error) => console.log(`Retry ${attempt}`)
})
```

## Environment Validation

Startup validation for required environment variables:

```javascript
// src/lib/env.js
import { validateEnv } from '../lib/env'

// Called in main.jsx before app renders
try {
  validateEnv()
} catch (error) {
  // Shows clear error message with missing variables
}
```

## Loading State Component

Standardized loading/error/empty state wrapper:

```jsx
import { LoadingState } from '../components/common/LoadingState'

<LoadingState
  loading={isLoading}
  error={error}
  data={items}
  onRetry={refetch}
  emptyMessage="No items found"
  skeleton={<TableSkeleton rows={5} />}
>
  {/* Render data here */}
  <DataTable data={items} />
</LoadingState>
```

## Distributed Rate Limiting

Redis-based rate limiting for API endpoints (works across Vercel instances):

```javascript
// api/lib/rateLimit.js
import { checkRateLimit } from './rateLimit.js'

export default async function handler(request) {
  const rateLimitResult = await checkRateLimit(apiKeyId, rateLimit)
  if (!rateLimitResult.allowed) {
    return new Response('Rate limit exceeded', { status: 429 })
  }
  // Continue with request...
}
```

Environment variables (for Upstash Redis):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## API Key Rotation

Rotate API keys with grace period:

```javascript
import { apiKeys } from '../lib/apiKeys'

// Rotate a key (old key works for 7 days by default)
const { newKey, oldKey } = await apiKeys.rotate(keyId, {
  gracePeriodDays: 7
})

// Check rotation status
const status = await apiKeys.getRotationStatus(keyId)
// { isRotated: true, gracePeriodEnds: '2026-01-25T...' }
```

## State Management

See `docs/STATE_MANAGEMENT.md` for patterns:
- React Context usage
- Data fetching patterns
- Real-time subscription cleanup
- URL state management
- Anti-patterns to avoid
