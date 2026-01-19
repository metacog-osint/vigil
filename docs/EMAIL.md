# Custom Email Configuration

> **Version:** 1.4.1 | **Last Updated:** January 19, 2026

## Overview

Vigil uses Resend for transactional emails with a custom domain (`noreply@theintelligence.company`). This replaces the default Supabase email sender.

## Components

| Service | Purpose |
|---------|---------|
| **Resend** | Email delivery API (transactional emails, alerts) |
| **Supabase SMTP** | Auth emails (verification, password reset) via custom SMTP |
| **Squarespace DNS** | Domain DNS records for email authentication |

## Email Flow

1. **Auth Emails** (verification, password reset): Supabase → Custom SMTP → Resend → User
2. **App Emails** (alerts, digests): App → `/api/send-email` → Resend → User

## DNS Configuration

The following DNS records are required for `theintelligence.company`:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| TXT | `resend._domainkey` | `p=MIGfMA0GCS...` | DKIM signature |
| MX | `send` | `feedback-smtp.{region}.amazonses.com` | SPF bounce handling |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF authorization |
| TXT | `_dmarc` | `v=DMARC1; p=none; ...` | DMARC policy |

**Verify in Resend:** Dashboard → Domains → Check all records show "Verified"

## Supabase SMTP Configuration

Configure in Supabase Dashboard: **Project Settings** → **Authentication** (under NOTIFICATIONS section) → **SMTP Settings**

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API key (`re_...`) |
| Sender Email | `noreply@theintelligence.company` |
| Sender Name | `Vigil Security` |

## Supabase URL Configuration

Configure in Supabase Dashboard: **Authentication** → **URL Configuration**

| Field | Value |
|-------|-------|
| Site URL | `https://vigil.theintelligence.company` |
| Redirect URLs | `https://vigil.theintelligence.company/**` |

**Important:** Without this, email verification links will redirect to `localhost:3000`.

## Environment Variables

```bash
# .env (local) - Not used for auth emails, only app emails
RESEND_API_KEY=re_xxxxxxxxxx

# Vercel (production) - For /api/send-email endpoint
RESEND_API_KEY=re_xxxxxxxxxx
```

## Testing Email Flow

1. **Auth Verification Email:**
   - Register a new account
   - Check email arrives from `noreply@theintelligence.company`
   - Verify link redirects to `https://vigil.theintelligence.company`

2. **Password Reset Email:**
   - Click "Forgot Password" on auth page
   - Verify email arrives from custom domain
   - Verify reset link works correctly

3. **App Emails (Alerts):**
   ```javascript
   import { sendEmail } from '../lib/email'

   await sendEmail({
     to: 'test@example.com',
     subject: 'Test Alert',
     html: '<p>Test email from Vigil</p>',
     text: 'Test email from Vigil'
   })
   ```

## Troubleshooting

**Emails going to spam:**
- Ensure all DNS records are verified in Resend
- Wait 24-48 hours for DNS propagation
- Check DMARC reports for authentication failures

**Verification emails redirecting to localhost:**
- Update Site URL in Supabase Authentication settings
- Add production URL to Redirect URLs whitelist

**"Invalid sender" error:**
- Verify domain is fully verified in Resend
- Ensure sender email matches verified domain

**Emails still showing "Supabase" as sender:**
- Verify Custom SMTP is enabled (toggle ON) in Supabase Dashboard
- Double-check SMTP credentials (especially the Resend API key)
- Try disabling and re-enabling Custom SMTP
