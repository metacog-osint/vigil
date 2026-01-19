# Real-Time Alerting System

> **Version:** 0.3.0 | **Last Updated:** January 19, 2026

## Overview

The alerting system delivers security events to users faster than news outlets by:
- Ingesting critical feeds every 30 minutes (ransomware, KEV, IOCs)
- Automatic alert queuing via database triggers
- Multi-channel delivery (push, email, webhooks)

## Key Files

```
src/lib/alerts.js           # Push subscriptions, webhook CRUD, preferences
src/lib/email.js            # Resend API integration with HTML templates
src/components/AlertSettingsSection.jsx  # Settings UI component
scripts/process-alerts.mjs  # Alert queue processor
public/sw.js                # Push notification handlers
.github/workflows/critical-alerts-ingestion.yml  # 30-min fast ingestion
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `push_subscriptions` | Browser push notification endpoints |
| `alert_webhooks` | Slack/Discord/Teams webhook configs |
| `alert_queue` | Pending alerts for processing |
| `alert_deliveries` | Delivery tracking and history |

## Using the Alerts Library

```javascript
import { subscribeToPush, createWebhook, getAlertPreferences } from '../lib/alerts'

// Subscribe to push notifications
const subscription = await subscribeToPush(userId)

// Create a Slack webhook
await createWebhook(userId, {
  name: 'SOC Slack',
  type: 'slack',
  url: 'https://hooks.slack.com/...',
  eventTypes: ['ransomware', 'kev']
})

// Get user preferences
const prefs = await getAlertPreferences(userId)
```

## Sending Email Alerts

```javascript
import { sendEmail, generateRansomwareAlertEmail } from '../lib/email'

const { html, text, subject } = generateRansomwareAlertEmail({
  victim_name: 'Acme Corp',
  threat_actor: 'LockBit',
  sector: 'healthcare',
  country: 'United States'
})

await sendEmail({ to: 'analyst@company.com', subject, html, text })
```

## Processing Alerts

```bash
# Process pending alerts (runs in GitHub Actions every 30 min)
npm run process:alerts

# Manually trigger the fast ingestion workflow
gh workflow run "Critical Alerts Ingestion (Fast)"
```

## Environment Variables

```
VAPID_PUBLIC_KEY=...        # For web push (server + client)
VAPID_PRIVATE_KEY=...       # For web push (server only)
VITE_VAPID_PUBLIC_KEY=...   # Exposed to client
RESEND_API_KEY=re_...       # Email delivery
```
