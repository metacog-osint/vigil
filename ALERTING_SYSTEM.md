# Vigil Real-Time Alerting System

This document outlines the requirements, architecture, and cost analysis for implementing real-time alerting capabilities in Vigil to beat traditional security news outlets like Bleeping Computer.

*Created: January 15, 2026*

---

## Executive Summary

### The Challenge

A colleague (Jake) requested that Vigil notify him of security events **before** Bleeping Computer reports on them. This is achievable for programmatic data sources but not for investigative journalism.

### The Opportunity

Vigil ingests directly from primary sources (leak sites, CISA, NVD, abuse.ch) - the same sources journalists monitor. By adding real-time alerting, we can deliver notifications within minutes of data publication, while journalists need hours to research and write articles.

---

## Competitive Analysis: Vigil vs Bleeping Computer

### Events Where Vigil CAN Be Faster

| Event Type | Data Source | Vigil Advantage | Confidence |
|------------|-------------|-----------------|------------|
| **Ransomware leak posts** | RansomLook, Ransomware.live | Direct feed vs journalist writing | 95% |
| **CISA KEV additions** | CISA JSON feed | Programmatic vs article | 95% |
| **New CVE publications** | NVD API | Direct API access | 90% |
| **IOC publications** | ThreatFox, URLhaus, Feodo | Automated feeds | 90% |
| **CISA security alerts** | RSS feed | Direct ingestion | 90% |
| **C2 infrastructure** | C2-Tracker (planned) | Daily Shodan scans | 85% |
| **Phishing domains** | crt.sh (planned) | Certificate transparency | 80% |
| **Malware samples** | MalwareBazaar | API access | 80% |

### Events Where Bleeping Computer Will Be Faster

| Event Type | Why They Win | Potential Mitigation |
|------------|--------------|---------------------|
| **Exclusive scoops** | Journalist sources, tipsters | None - human relationships |
| **Dark web forum posts** | Human analysts monitoring | Telegram/dark web monitoring |
| **Researcher disclosures** | Twitter/social relationships | Social media monitoring |
| **Vendor breach announcements** | Direct company contact | GDELT news monitoring |
| **In-depth investigations** | Skilled journalists | AI summarization |
| **Context and analysis** | Editorial expertise | AI-generated BLUF summaries |

### Events That Are a Toss-Up

| Event Type | Factor | Notes |
|------------|--------|-------|
| **Major breaches** | Who gets the tip first | GDELT could help |
| **New threat actor emergence** | Discovery timing | Depends on source |
| **Zero-day announcements** | Vendor coordination | Usually embargoed |

---

## Current State vs Required State

### Current Ingestion Architecture

```
External Source → GitHub Actions (every 6h) → Supabase → User checks dashboard
                        ↑
                   Manual refresh required
```

**Problems:**
- 6-hour ingestion cycles mean up to 6-hour delay
- No push notifications - user must check dashboard
- No filtering by relevance/urgency

### Required Architecture

```
External Source → Ingestion (15-30 min) → Supabase → Real-time Detection
                                                            ↓
                                                    Alert Processing
                                                            ↓
                                              ┌─────────────┼─────────────┐
                                              ↓             ↓             ↓
                                           Email      Push Notif     Webhook
                                                                   (Slack/Discord)
```

---

## System Requirements

### 1. Faster Ingestion Cycles

| Feed Category | Current | Target | Rationale |
|---------------|---------|--------|-----------|
| Ransomware (RansomLook, etc.) | 6 hours | 30 min | Time-sensitive victim posts |
| CISA KEV | 6 hours | 1 hour | Critical exploit intel |
| ThreatFox/URLhaus | 6 hours | 1 hour | Active threat indicators |
| CISA Alerts | 6 hours | 1 hour | Government advisories |
| NVD CVEs | 6 hours | 2 hours | High volume, less urgent |
| MITRE ATT&CK | 6 hours | Daily | Rarely changes |
| HIBP Breaches | Weekly | Daily | Breach announcements |

### 2. Alert Triggers

| Trigger Type | Condition | Priority |
|--------------|-----------|----------|
| **New ransomware victim** | Any new incident | High |
| **Watchlist actor activity** | Actor in user's watchlist posts | Critical |
| **Sector-relevant incident** | Victim sector matches org profile | High |
| **New KEV entry** | CVE added to CISA KEV | Critical |
| **Vendor CVE** | CVE affects vendor in org profile | Critical |
| **High-severity CVE** | CVSS >= 9.0 or EPSS >= 0.5 | High |
| **Watchlist CVE update** | CVE in watchlist gets KEV/exploit | Critical |
| **New CISA alert** | Any new advisory | Medium |
| **C2 infrastructure** | New C2 for tracked frameworks | Medium |

### 3. Notification Channels

| Channel | Use Case | Implementation |
|---------|----------|----------------|
| **Email** | Digest summaries, critical alerts | Resend API |
| **Browser Push** | Real-time desktop notifications | Web Push API |
| **Mobile Push** | On-the-go alerts | Firebase Cloud Messaging |
| **Slack** | Team collaboration | Incoming Webhooks |
| **Discord** | Community/personal | Webhooks |
| **Microsoft Teams** | Enterprise teams | Incoming Webhooks |
| **Generic Webhook** | Custom integrations | HTTP POST |

### 4. User Preferences

Users should be able to configure:

```javascript
{
  "alertPreferences": {
    "channels": {
      "email": true,
      "push": true,
      "slack": "https://hooks.slack.com/...",
      "discord": null,
      "teams": null
    },
    "triggers": {
      "ransomware_any": false,
      "ransomware_sector_match": true,
      "ransomware_watchlist": true,
      "kev_any": true,
      "kev_vendor_match": true,
      "cve_critical": true,
      "cve_watchlist": true,
      "cisa_alerts": true,
      "c2_infrastructure": false
    },
    "digest": {
      "enabled": true,
      "frequency": "daily", // daily, weekly
      "time": "08:00",
      "timezone": "America/New_York"
    },
    "quietHours": {
      "enabled": false,
      "start": "22:00",
      "end": "07:00"
    }
  }
}
```

---

## Technical Architecture

### Database Schema Additions

```sql
-- User alert preferences
CREATE TABLE alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Channels
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  slack_webhook TEXT,
  discord_webhook TEXT,
  teams_webhook TEXT,
  custom_webhook TEXT,

  -- Triggers
  ransomware_any BOOLEAN DEFAULT false,
  ransomware_sector_match BOOLEAN DEFAULT true,
  ransomware_watchlist BOOLEAN DEFAULT true,
  kev_any BOOLEAN DEFAULT true,
  kev_vendor_match BOOLEAN DEFAULT true,
  cve_critical BOOLEAN DEFAULT true,
  cve_watchlist BOOLEAN DEFAULT true,
  cisa_alerts BOOLEAN DEFAULT true,

  -- Digest settings
  digest_enabled BOOLEAN DEFAULT true,
  digest_frequency TEXT DEFAULT 'daily',
  digest_time TIME DEFAULT '08:00',
  digest_timezone TEXT DEFAULT 'UTC',

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  event_type TEXT NOT NULL, -- ransomware, kev, cve, cisa_alert
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  channels_sent TEXT[], -- ['email', 'push', 'slack']
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Push notification subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_prefs_user ON alert_preferences(user_id);
CREATE INDEX idx_alert_history_user ON alert_history(user_id);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
```

### Alerting Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (Ingestion)                    │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Ransomware│ │   KEV    │ │   IOCs   │ │  Alerts  │           │
│  │  30 min  │ │  1 hour  │ │  1 hour  │ │  1 hour  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                   │
│       └────────────┴─────┬──────┴────────────┘                   │
│                          │                                       │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │  Supabase (Database)  │                          │
│              │  - New record trigger │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │  Supabase Edge Func   │
              │  alert-processor      │
              │                       │
              │  1. Detect new events │
              │  2. Match user prefs  │
              │  3. Filter relevance  │
              │  4. Queue alerts      │
              └───────────┬───────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
     │  Resend  │  │ Web Push │  │ Webhooks │
     │  (Email) │  │  (FCM)   │  │(Slack,etc│
     └──────────┘  └──────────┘  └──────────┘
```

### Alert Processing Logic

```javascript
// Pseudocode for alert-processor edge function

async function processNewEvent(event) {
  const { type, data } = event;

  // Get all users who might want this alert
  const users = await getUsersWithAlertPrefs();

  for (const user of users) {
    const prefs = user.alert_preferences;
    const profile = user.org_profile;

    // Check if user wants this type of alert
    if (!shouldAlert(type, data, prefs, profile)) continue;

    // Check quiet hours
    if (isQuietHours(prefs)) {
      await queueForDigest(user, event);
      continue;
    }

    // Send to enabled channels
    const channels = [];

    if (prefs.email_enabled) {
      await sendEmail(user.email, formatAlert(event));
      channels.push('email');
    }

    if (prefs.push_enabled) {
      await sendPushNotification(user.id, formatPush(event));
      channels.push('push');
    }

    if (prefs.slack_webhook) {
      await sendSlackMessage(prefs.slack_webhook, formatSlack(event));
      channels.push('slack');
    }

    // Log alert
    await logAlert(user.id, event, channels);
  }
}

function shouldAlert(type, data, prefs, profile) {
  switch (type) {
    case 'ransomware':
      if (prefs.ransomware_watchlist && isWatchlistActor(data, profile)) return true;
      if (prefs.ransomware_sector_match && isSectorMatch(data, profile)) return true;
      if (prefs.ransomware_any) return true;
      return false;

    case 'kev':
      if (prefs.kev_vendor_match && isVendorMatch(data, profile)) return true;
      if (prefs.kev_any) return true;
      return false;

    case 'cve':
      if (prefs.cve_watchlist && isWatchlistCVE(data, profile)) return true;
      if (prefs.cve_critical && data.cvss >= 9.0) return true;
      return false;

    default:
      return false;
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Create alert_preferences table | 2 hours | None |
| Create alert_history table | 1 hour | None |
| Build Alert Settings UI | 8 hours | Tables |
| Implement Resend email integration | 4 hours | None |
| Create alert-processor edge function | 8 hours | Tables |

**Deliverables:**
- Users can configure alert preferences
- Email alerts work for all trigger types
- Alert history is logged

### Phase 2: Real-Time Channels (Week 3-4)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Implement Web Push API | 6 hours | Service Worker |
| Add push subscription management | 4 hours | Web Push |
| Implement Slack webhook integration | 3 hours | None |
| Implement Discord webhook integration | 2 hours | Slack done |
| Implement Teams webhook integration | 2 hours | Slack done |
| Generic webhook support | 2 hours | None |

**Deliverables:**
- Browser push notifications
- Slack/Discord/Teams integration
- Custom webhook support

### Phase 3: Faster Ingestion (Week 5-6)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Update ransomware ingestion to 30 min | 2 hours | None |
| Update KEV ingestion to 1 hour | 1 hour | None |
| Update IOC ingestion to 1 hour | 1 hour | None |
| Optimize GitHub Actions workflows | 4 hours | All above |
| Add ingestion status monitoring | 4 hours | None |

**Deliverables:**
- Sub-hour alerting for critical events
- Workflow efficiency improvements

### Phase 4: Intelligence & Polish (Week 7-8)

| Task | Effort | Dependencies |
|------|--------|--------------|
| Daily/weekly digest emails | 6 hours | Phase 1 |
| Quiet hours implementation | 3 hours | Phase 1 |
| Alert deduplication logic | 4 hours | Phase 1 |
| Mobile app push (optional) | 20 hours | FCM setup |
| Analytics dashboard | 8 hours | All phases |

**Deliverables:**
- Digest summaries
- Quiet hours respect
- Alert analytics

---

## Success Metrics

### Speed Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Ransomware alert latency | < 45 min from leak post | Compare to RansomLook timestamp |
| KEV alert latency | < 90 min from CISA update | Compare to CISA timestamp |
| CVE alert latency | < 3 hours from NVD publish | Compare to NVD timestamp |

### Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Alert open rate | > 40% | clicked_at / sent_at |
| User retention | > 80% keep alerts on | Weekly active check |
| False positive rate | < 10% | User feedback |

### Competitive Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Beat Bleeping Computer | > 70% of ransomware posts | Manual comparison |
| Beat Bleeping Computer | > 90% of KEV additions | Manual comparison |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Alert fatigue | Users disable alerts | Medium | Smart filtering, quiet hours |
| Email deliverability | Alerts go to spam | Medium | Use Resend, proper SPF/DKIM |
| API rate limits | Missed events | Low | Backoff logic, caching |
| Cost overruns | Budget exceeded | Low | Usage monitoring, caps |
| False positives | User trust eroded | Medium | Tuned relevance scoring |

---

---

## Implementation Status

### ✅ Completed (January 15, 2026)

| Component | File(s) | Status |
|-----------|---------|--------|
| **Database Migration** | `supabase/migrations/028_realtime_alerts.sql` | ✅ Applied |
| **Alert Queue Tables** | `push_subscriptions`, `alert_webhooks`, `alert_queue`, `alert_deliveries` | ✅ Created |
| **Client-side Alerts Library** | `src/lib/alerts.js` | ✅ Implemented |
| **Alert Settings UI** | `src/components/AlertSettingsSection.jsx` | ✅ Built |
| **Email Integration** | `src/lib/email.js` (Resend API) | ✅ Configured |
| **Push Notification Handlers** | `public/sw.js` | ✅ Added |
| **Alert Processing Script** | `scripts/process-alerts.mjs` | ✅ Created |
| **Fast Ingestion Workflow** | `.github/workflows/critical-alerts-ingestion.yml` | ✅ 30-min cron |
| **Webhook Integrations** | Slack, Discord, Teams | ✅ Implemented |

### Environment Configuration

| Secret | Location | Status |
|--------|----------|--------|
| `VAPID_PUBLIC_KEY` | GitHub Secrets + `.env` | ✅ Configured |
| `VAPID_PRIVATE_KEY` | GitHub Secrets + `.env` | ✅ Configured |
| `RESEND_API_KEY` | GitHub Secrets + `.env` | ✅ Configured |

### Key Files Created/Modified

```
src/
├── lib/
│   ├── alerts.js          # Push subscriptions, webhooks, preferences
│   └── email.js           # Resend API integration
├── components/
│   └── AlertSettingsSection.jsx  # Settings UI
└── pages/
    └── Settings.jsx       # Updated to include AlertSettingsSection

scripts/
└── process-alerts.mjs     # Alert queue processor

public/
└── sw.js                  # Push notification handlers

.github/workflows/
└── critical-alerts-ingestion.yml  # 30-min fast ingestion
```

### Database Triggers Active

- `auto_queue_incident_alert` - Queues alerts for new ransomware incidents
- `auto_queue_kev_alert` - Queues alerts when CVEs are added to KEV

### Testing the System

```bash
# Manually trigger the fast ingestion workflow
gh workflow run "Critical Alerts Ingestion (Fast)"

# Process pending alerts locally
npm run process:alerts

# Check alert queue status
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('alert_queue').select('*').eq('status', 'pending').then(r => console.log(r.data));
"
```

---

*Document Version: 2.0*
*Last Updated: January 15, 2026*
*Implementation Completed: January 15, 2026*
