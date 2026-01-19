# Authentication & Authorization

> **Version:** 1.4.0 | **Last Updated:** January 19, 2026

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
