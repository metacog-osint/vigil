# Sprint 2 Setup Guide

This guide covers the setup steps required to enable Sprint 2 features (Email & Notifications).

## 1. Database Migration

Apply the migration to create notification tables:

### Option A: Supabase Dashboard (Recommended)

1. Open the Supabase SQL Editor:
   **https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql**

2. Copy the entire contents of:
   `supabase/migrations/010_notifications_and_alerts.sql`

3. Paste into the SQL Editor and click **"Run"**

### Option B: Supabase CLI

```bash
# Install CLI if needed
npm install -g supabase

# Link your project (requires access token from dashboard)
supabase link --project-ref faqazkwdkajhxmwxchop

# Push migrations
supabase db push
```

### Verify Migration

Run this command to check if tables were created:
```bash
npm run check:migration
```

## 2. GitHub Secrets

Add these secrets in your GitHub repository settings:
**Settings → Secrets and variables → Actions → New repository secret**

### Required Secrets:

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `RESEND_API_KEY` | API key for sending emails | [Resend Dashboard](https://resend.com/api-keys) |
| `SUPABASE_SERVICE_KEY` | Service role key for admin operations | Supabase Dashboard → Settings → API → service_role key |

### Existing Secrets (should already be set):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

## 3. Resend Setup

### Create Resend Account
1. Sign up at https://resend.com
2. Verify your email domain (or use the sandbox domain for testing)
3. Create an API key
4. Add the API key to:
   - `.env` file: `RESEND_API_KEY=re_xxxxx`
   - GitHub Secrets: `RESEND_API_KEY`

### Test Email Sending
```bash
# Dry run (no emails sent)
npm run send:digest:dry-run

# Send to single user for testing
npm run send:digest -- --user=your@email.com --dry-run
```

## 4. Verify Setup

### Check Migration Status
```bash
node scripts/check-migration-status.mjs
```

Expected output:
```
✓ notifications
✓ user_alert_rules
✓ alert_triggers
✓ threat_hunts
✓ user_hunt_progress
```

### Test Daily Digest
```bash
# Dry run to verify data fetching works
npm run send:digest:dry-run
```

## 5. Enable Daily Digest Workflow

The daily digest runs automatically at 6 AM UTC via GitHub Actions.

To trigger manually:
1. Go to **Actions** → **Daily Digest Email**
2. Click **"Run workflow"**
3. Optionally enable "Dry run" for testing

## New Features Enabled

After setup, these features will be available:

### Notifications Bell (Header)
- Real-time in-app notifications
- Mark as read functionality
- Links to related items

### Threat Hunts Page (/threat-hunts)
- Actionable detection guides
- SIEM queries (Splunk, Elastic, Sentinel)
- Progress tracking for hunt checks

### Alert Rules (Settings)
- Custom alert rules for:
  - Vendor CVEs (e.g., "Alert me about Cisco CVEs")
  - Actor activity (e.g., "Alert when LockBit is escalating")
  - Sector incidents (e.g., "Healthcare sector incidents")
  - New KEVs
  - Severity thresholds

### Daily Digest Emails
- Personalized based on org profile
- Critical items highlighted
- Watchlist updates included

## Troubleshooting

### Migration Fails
- Ensure you're using the service role key, not anon key
- Check if `user_preferences` table exists (dependency)
- Run migration statements individually to find errors

### Emails Not Sending
- Verify RESEND_API_KEY is set correctly
- Check Resend dashboard for API usage/errors
- Verify email domain is verified in Resend

### Notifications Not Loading
- Check browser console for errors
- Verify `notifications` table exists
- Check Supabase RLS policies if applicable
