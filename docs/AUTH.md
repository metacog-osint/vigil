# Authentication & Authorization

> **Version:** 1.5.0 | **Last Updated:** January 19, 2026

## Overview

Vigil uses **Supabase Auth** exclusively for all authentication. This includes:
- Email/password registration and login
- OAuth providers (Google, GitHub)
- Magic link (passwordless) authentication
- Password reset flows
- Email verification

## useAuth Hook

The `useAuth` hook (`src/hooks/useAuth.js`) provides authentication state throughout the app:

```javascript
import { useAuth } from '../hooks/useAuth'

function Component() {
  const { user, profile, loading } = useAuth()

  if (loading) return <Loading />
  if (!user) return <Unauthorized />

  // user.id - Supabase user ID
  // user.email - User's email
  // profile - Organization profile from org_profiles table
}
```

**How it works:**
1. On mount, calls `supabase.auth.getSession()` to retrieve existing session
2. Automatically processes URL tokens from email verification/magic links
3. Subscribes to `onAuthStateChange` for real-time auth updates
4. Loads user's organization profile if it exists

## Authentication Gate

Vigil requires user registration for all access. The app structure separates public and protected routes:

**App Structure (`src/App.jsx`):**

```jsx
function App() {
  const { user, loading } = useAuth()

  if (loading) return <AuthLoader />

  // Unauthenticated: show public pages
  if (!user) return <PublicLayout />

  // Authenticated: show protected dashboard
  return <ProtectedApp />
}
```

**Public Routes (no auth required):**
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing | Marketing landing page |
| `/auth` | Auth | Login/register page |
| `/login` | Redirect | Redirects to `/auth` |
| `/register` | Redirect | Redirects to `/auth?mode=register` |
| `/pricing` | Pricing | Public pricing page |

**Protected Routes (auth required):**
All other routes require authentication. Unauthenticated users are redirected to the Landing page.

## Auth Page Features

The Auth page (`src/pages/Auth.jsx`) supports multiple authentication methods:

- **OAuth**: Google, GitHub (requires Supabase OAuth configuration)
- **Email/Password**: Traditional registration and login
- **Magic Link**: Passwordless email authentication
- **Password Reset**: Forgot password flow

```jsx
// Auth modes
const [mode, setMode] = useState('login') // 'login', 'register', 'magic-link', 'forgot-password'
```

## Landing Page

The Landing page (`src/pages/Landing.jsx`) is shown to unauthenticated visitors and includes:

- Hero section with value proposition
- Feature highlights
- Live data preview (blurred for non-users)
- Data sources showcase
- Testimonials
- Pricing preview
- Call-to-action sections

## Admin Authentication

System-level admin access is managed via environment variables.

**Configuration:**
```bash
# .env (local) or Vercel Environment Variables (production)
VITE_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

**Admin Check Utility (`src/lib/adminAuth.js`):**

```javascript
import { isSystemAdmin, hasAdminCapability, ADMIN_FEATURES } from '../lib/adminAuth'

// Check if user is a system admin
if (isSystemAdmin(user)) {
  // User has admin access
}

// Check specific capability (for future granular permissions)
if (hasAdminCapability(user, ADMIN_FEATURES.viewOps)) {
  // User can view ops dashboard
}
```

**Admin-Protected Pages:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/ops` | OpsDashboard | Data ingestion monitoring, sync status |

**Sidebar Admin Section:**

The Sidebar conditionally shows an "Admin" navigation group for system admins:

```javascript
// src/components/Sidebar.jsx
const isAdmin = isSystemAdmin(user)

const allNavigationGroups = isAdmin
  ? [...navigationGroups, adminNavigationGroup]
  : navigationGroups
```

Non-admins:
- Do not see the Admin section in the sidebar
- See "Access Denied" if they navigate directly to `/ops`

## Personalization Wizard Delay

The PersonalizationWizard now delays appearing to let users explore the dashboard first:

**Trigger Conditions (whichever comes first):**
- 60 seconds after login
- 3 page views

**Implementation (`src/components/PersonalizationWizard.jsx`):**

```javascript
const PERSONALIZATION_DELAY_MS = 60000 // 60 seconds
const PERSONALIZATION_PAGE_VIEWS = 3   // or 3 page views

export function usePersonalizationWizard() {
  // Checks if personalization is needed
  // Delays showing based on time or page views
  // Uses sessionStorage for delay tracking (resets each session)
  // Uses localStorage for completion persistence
}
```

**Storage Keys:**
- `vigil_personalization_completed` (localStorage) - Persists completion across sessions
- `vigil_personalization_delay_triggered` (sessionStorage) - Tracks if delay threshold met
- `vigil_page_views` (sessionStorage) - Counts page views in current session

## File Structure

```
src/
├── lib/
│   └── adminAuth.js          # Admin authentication utility
├── pages/
│   ├── Landing.jsx           # Public landing page
│   └── Auth.jsx              # Login/register page
├── components/
│   ├── Sidebar.jsx           # Updated with admin-only section
│   └── PersonalizationWizard.jsx  # Updated with delay logic
└── App.jsx                   # Auth gate logic
```

## Environment Variables

```bash
# Required for admin features
VITE_ADMIN_EMAILS=email1@example.com,email2@example.com
```

**Important:** Remember to set `VITE_ADMIN_EMAILS` in both:
1. Local `.env` file (for development)
2. Vercel Environment Variables (for production)

## Sign Out

Sign out is handled via Supabase in the Header component:

```javascript
import { supabase } from '../lib/supabase/client'

const handleSignOut = async () => {
  await supabase.auth.signOut()
  navigate('/')
}
```

On sign out:
1. Supabase session is cleared
2. Local storage auth data is removed
3. User is redirected to the landing page
4. `useAuth` hook detects the `SIGNED_OUT` event and clears state

## Email Verification Flow

1. User registers with email/password via Auth page
2. Supabase sends verification email (via Resend SMTP - see `docs/EMAIL.md`)
3. User clicks verification link in email
4. Supabase redirects to app with tokens in URL
5. `useAuth` hook's `getSession()` call automatically processes the tokens
6. User is authenticated and sees the dashboard

**Redirect URL Configuration:**
- Set in Auth.jsx: `emailRedirectTo: ${window.location.origin}/dashboard`
- Must match Supabase Dashboard > Authentication > URL Configuration > Redirect URLs

## Troubleshooting

**Verification email redirects to landing page:**
- Ensure `useAuth` hook uses Supabase (not Firebase)
- Check Supabase Dashboard > Authentication > URL Configuration > Site URL
- Verify the redirect URL is whitelisted

**"Multiple GoTrueClient instances" warning:**
- Only import `supabase` from `src/lib/supabase/client.js`
- Never call `createClient()` in other files

**Session not persisting:**
- Check browser localStorage for `sb-*` keys
- Ensure `persistSession: true` in client config
