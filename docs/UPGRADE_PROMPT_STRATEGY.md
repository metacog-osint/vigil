# Upgrade Prompt Strategy: Showing Users What They're Missing

> **Last Updated:** January 18, 2026
> **Purpose:** Convert free/lower-tier users by demonstrating premium value

---

## Philosophy

The goal is **not** to frustrate users, but to **demonstrate value** they're missing. Every prompt should:
1. Show what they could have (not just block them)
2. Provide context for why it matters
3. Make upgrading frictionless (one click to pricing)
4. Never interrupt critical workflows

---

## Strategy 1: Blurred/Teaser Content

### Concept
Show premium content but blurred or partially hidden, with a clear upgrade CTA.

### Implementation Ideas

#### 1.1 Historical Data Teaser (Free Tier)
```
┌─────────────────────────────────────────────────────┐
│  📊 Incident Timeline                               │
│                                                     │
│  Jan 2026  ████████████  47 incidents              │
│  Dec 2025  ████████      38 incidents              │
│  ─────────────────────────────────────────────────  │
│  Nov 2025  ░░░░░░░░░░░░  [Blurred]                 │
│  Oct 2025  ░░░░░░░░░░░░  [Blurred]                 │
│  Sep 2025  ░░░░░░░░░░░░  [Blurred]                 │
│                                                     │
│  🔒 Upgrade to Professional to see full history    │
│     [View Plans →]                                  │
└─────────────────────────────────────────────────────┘
```

**Where:** Dashboard timeline, incident charts, trend analysis

#### 1.2 Correlation Preview (Free/Professional)
```
┌─────────────────────────────────────────────────────┐
│  🔗 Actor Correlations for "LockBit"               │
│                                                     │
│  Related CVEs:     12 vulnerabilities              │
│  Associated IOCs:  ░░░░ [Unlock with Pro]          │
│  Attack Chains:    ░░░░ [Unlock with Pro]          │
│  Similar Actors:   ░░░░ [Unlock with Team]         │
│                                                     │
│  See what LockBit is really capable of →           │
│  [Upgrade to Professional - $39/mo]                │
└─────────────────────────────────────────────────────┘
```

**Where:** Actor detail panels, correlation sections

#### 1.3 Search Results Teaser
```
┌─────────────────────────────────────────────────────┐
│  🔍 Search: "healthcare ransomware"                │
│                                                     │
│  Showing 25 of 347 results (last 30 days)          │
│                                                     │
│  ┌─ Result 1 ─────────────────────────────────┐    │
│  │ LockBit hits MedCare Hospital - Jan 15     │    │
│  └────────────────────────────────────────────┘    │
│  ... 24 more results ...                           │
│                                                     │
│  ┌─ 322 older results hidden ─────────────────┐    │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │ Upgrade to see incidents from 2024-2025    │    │
│  │ [Unlock Full History →]                    │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Where:** Search results, incident lists, IOC lookups

---

## Strategy 2: Feature Previews with Samples

### Concept
Let users try premium features with limited functionality or sample data.

### Implementation Ideas

#### 2.1 API Playground (Free/Professional)
```
┌─────────────────────────────────────────────────────┐
│  🔌 API Playground                        [Pro+]   │
│                                                     │
│  Try the Vigil API with sample data:               │
│                                                     │
│  GET /api/v1/actors/lockbit                        │
│  ┌────────────────────────────────────────────┐    │
│  │ {                                          │    │
│  │   "name": "LockBit",                       │    │
│  │   "type": "ransomware",                    │    │
│  │   "incidents_30d": 47,                     │    │
│  │   "iocs": "██████ [Upgrade for full data]" │    │
│  │ }                                          │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ✨ Like what you see?                             │
│  Get full API access with Professional Plus        │
│  [Start Free Trial →]                              │
└─────────────────────────────────────────────────────┘
```

**Where:** New "API Explorer" page accessible to all tiers

#### 2.2 Report Preview
```
┌─────────────────────────────────────────────────────┐
│  📄 Sample Weekly Threat Report                    │
│                                                     │
│  ┌─ Page 1 of 5 ─────────────────────────────┐     │
│  │ EXECUTIVE SUMMARY                         │     │
│  │ This week saw 47 ransomware incidents...  │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  ┌─ Pages 2-5 ───────────────────────────────┐     │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │     │
│  │           [Locked Preview]                │     │
│  └───────────────────────────────────────────┘     │
│                                                     │
│  Generate custom reports for your org →            │
│  [Upgrade to Professional]                         │
└─────────────────────────────────────────────────────┘
```

**Where:** Reports page, email digest preview

#### 2.3 Relevance Score Preview
```
┌─────────────────────────────────────────────────────┐
│  🎯 Personalized Threat Relevance                  │
│                                                     │
│  Based on a sample Healthcare org profile:         │
│                                                     │
│  HIGH RELEVANCE                                    │
│  ├─ LockBit ████████████████ 95%                  │
│  ├─ BlackCat ██████████████ 87%                   │
│  └─ Cl0p ████████████ 76%                         │
│                                                     │
│  ⚡ Want scores for YOUR organization?             │
│  Set up your org profile to see what matters most  │
│  [Upgrade to Professional →]                       │
└─────────────────────────────────────────────────────┘
```

**Where:** Dashboard sidebar, actor list page

---

## Strategy 3: Contextual Upgrade Prompts

### Concept
Show upgrade prompts at the moment users naturally want the feature.

### Implementation Ideas

#### 3.1 Export Blocked
```
┌─────────────────────────────────────────────────────┐
│  📥 Export Data                                    │
│                                                     │
│  You've selected 47 incidents to export.           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  CSV Export          [🔒 Professional]     │   │
│  │  STIX 2.1 Export     [🔒 Pro Plus]         │   │
│  │  JSON Export         [🔒 Professional]     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Export is available on Professional plans.        │
│  [View Plans] [Copy to Clipboard - Free]           │
└─────────────────────────────────────────────────────┘
```

**Where:** Any export button/menu

#### 3.2 Watchlist Limit Reached
```
┌─────────────────────────────────────────────────────┐
│  👁️ Watchlist Full                                 │
│                                                     │
│  You're watching 10/10 items (Free tier limit)     │
│                                                     │
│  Currently watching:                               │
│  • LockBit, BlackCat, Cl0p... +7 more              │
│                                                     │
│  Upgrade to watch up to 100 actors & CVEs:         │
│  ┌─────────────────────────────────────────────┐   │
│  │ Professional - $39/mo                       │   │
│  │ ✓ 100 watchlist items                       │   │
│  │ ✓ Email alerts when they're active          │   │
│  │ ✓ Relevance scoring for your org            │   │
│  │                        [Upgrade Now →]      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Where:** Watchlist add button when limit reached

#### 3.3 Search Limit Reached (Free)
```
┌─────────────────────────────────────────────────────┐
│  🔍 Daily Search Limit                             │
│                                                     │
│  You've used 25/25 searches today.                 │
│  Searches reset in 14 hours.                       │
│                                                     │
│  Need unlimited searches?                          │
│  Professional plan includes:                       │
│  ✓ Unlimited searches                              │
│  ✓ Full historical data access                     │
│  ✓ Save your favorite searches                     │
│                                                     │
│  [Upgrade to Professional - $39/mo]                │
│  [Remind Me Tomorrow]                              │
└─────────────────────────────────────────────────────┘
```

**Where:** Search bar after limit exceeded

#### 3.4 Advanced Query Syntax Hint
```
┌─────────────────────────────────────────────────────┐
│  💡 Pro Tip: Advanced Search                       │
│                                                     │
│  Your search: "lockbit healthcare"                 │
│                                                     │
│  With Team plan, you could search:                 │
│  actor:lockbit AND sector:healthcare AND           │
│  date:>2025-06-01 AND country:US                   │
│                                                     │
│  [Learn about Advanced Search →]                   │
│  [Dismiss]                                         │
└─────────────────────────────────────────────────────┘
```

**Where:** Below search bar for complex queries

---

## Strategy 4: Social Proof & FOMO

### Concept
Show what other users are doing with premium features.

### Implementation Ideas

#### 4.1 Activity Feed Teaser
```
┌─────────────────────────────────────────────────────┐
│  🌐 Vigil Community Activity                       │
│                                                     │
│  In the last hour:                                 │
│  • 12 analysts exported IOC lists                  │
│  • 8 teams shared threat reports                   │
│  • 47 API queries from integrations                │
│  • 3 SIEM alerts triggered                         │
│                                                     │
│  Join 500+ security teams using Vigil              │
│  [See What's Possible →]                           │
└─────────────────────────────────────────────────────┘
```

**Where:** Dashboard sidebar, pricing page

#### 4.2 "Others Also Viewed" Premium
```
┌─────────────────────────────────────────────────────┐
│  You're viewing: CVE-2026-1234                     │
│                                                     │
│  🔒 Pro users also checked:                        │
│  ├─ Which actors exploit this CVE                  │
│  ├─ IOCs associated with exploitation              │
│  └─ Attack chains using this vulnerability         │
│                                                     │
│  [Unlock Actor Intelligence →]                     │
└─────────────────────────────────────────────────────┘
```

**Where:** CVE detail pages, actor profiles

#### 4.3 Upgrade Success Stories
```
┌─────────────────────────────────────────────────────┐
│  💬 "Vigil's API saved us 10 hours/week"          │
│                                                     │
│  "We automated our IOC ingestion pipeline and      │
│  now our SIEM gets fresh indicators every hour."   │
│                                                     │
│  — Security Engineer, Mid-size MSSP                │
│                                                     │
│  [See API Documentation →]                         │
└─────────────────────────────────────────────────────┘
```

**Where:** Rotating testimonials on gated features

---

## Strategy 5: Value Metrics & ROI

### Concept
Show users quantified value they're missing.

### Implementation Ideas

#### 5.1 Missed Alerts Counter
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ Alerts You Would Have Received                 │
│                                                     │
│  This month, Professional users were alerted to:   │
│                                                     │
│  🔴 3 critical CVEs affecting Microsoft            │
│  🟠 7 ransomware campaigns targeting healthcare    │
│  🟡 12 new IOCs for actors you're watching         │
│                                                     │
│  You're not subscribed to alerts.                  │
│  [Set Up Alerts with Professional →]               │
└─────────────────────────────────────────────────────┘
```

**Where:** Dashboard, weekly email to free users

#### 5.2 Time Saved Calculator
```
┌─────────────────────────────────────────────────────┐
│  ⏱️ Time Saved with Vigil Pro                      │
│                                                     │
│  Average Professional user saves:                  │
│                                                     │
│  📊 4 hrs/week - Automated relevance scoring       │
│  📧 2 hrs/week - Digest emails vs manual checking  │
│  📥 3 hrs/week - One-click exports                 │
│  ─────────────────────────────────────────────────  │
│  Total: 9 hours/week × $50/hr = $450/week          │
│                                                     │
│  Professional costs just $39/month                 │
│  ROI: 46x return                                   │
│                                                     │
│  [Calculate Your ROI →]                            │
└─────────────────────────────────────────────────────┘
```

**Where:** Pricing page, upgrade prompts

#### 5.3 Coverage Gap Analysis
```
┌─────────────────────────────────────────────────────┐
│  📉 Your Threat Coverage                           │
│                                                     │
│  Based on your activity, you're seeing:            │
│                                                     │
│  Threat Actors    ████████░░░░░░  60%              │
│  Incidents        ████░░░░░░░░░░  30% (30-day cap) │
│  CVE Intel        ██████████████  100%             │
│  IOC Context      ████░░░░░░░░░░  30%              │
│  Correlations     ░░░░░░░░░░░░░░  0%               │
│                                                     │
│  Get full coverage →                               │
│  [Compare Plans]                                   │
└─────────────────────────────────────────────────────┘
```

**Where:** Settings page, periodic email

---

## Strategy 6: Inline Feature Badges

### Concept
Small, non-intrusive indicators showing which tier unlocks a feature.

### Implementation Ideas

#### 6.1 Feature Labels
```jsx
// Throughout the UI, add subtle tier badges

<Button>
  Export to STIX <ProPlusBadge />
</Button>

<MenuItem>
  Advanced Search <TeamBadge />
</MenuItem>

<NavItem>
  API Keys <TeamBadge />
</NavItem>
```

**Visual:**
```
[Export CSV]  [Export STIX 🔷Pro+]  [Export JSON]
```

#### 6.2 Sidebar Navigation Hints
```
┌─────────────────────────────┐
│ 📊 Dashboard                │
│ 👤 Actors                   │
│ 📋 Incidents                │
│ 🔍 IOC Lookup               │
│ ─────────────────────────── │
│ 📈 Trends           [Free]  │
│ 🎯 Relevance        [Pro]   │
│ 🔌 API Keys         [Team]  │
│ 📊 Reports          [Pro]   │
│ 🔗 Integrations     [Ent]   │
└─────────────────────────────┘
```

#### 6.3 Dashboard Widget Locks
```
┌─────────────────────────────────────────────────────┐
│  Dashboard                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Threat   │ │ Top      │ │ 🔒 Relevance    │   │
│  │ Level    │ │ Actors   │ │    Scores       │   │
│  │   67     │ │ LockBit  │ │                 │   │
│  │          │ │ BlackCat │ │ [Unlock w/Pro]  │   │
│  └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Strategy 7: Email Campaigns

### Concept
Nurture free users toward conversion with value-focused emails.

### Implementation Ideas

#### 7.1 Weekly "What You Missed" Email
```
Subject: 🔍 3 critical threats you should know about

Hi [Name],

This week on Vigil, Professional users were alerted to:

🔴 CVE-2026-1234 - Critical Microsoft Exchange RCE
   → 3 actors actively exploiting (LockBit, BlackCat, Cl0p)

🟠 Healthcare sector attacks up 40% this month
   → Your sector? Set up your org profile to get relevant alerts

🟡 47 new IOCs attributed to LockBit
   → Exportable as CSV/STIX for your security tools

You're on the Free plan, seeing 30 days of data.
Upgrade to Professional for full history + alerts.

[See What You're Missing →]
```

#### 7.2 Feature Spotlight Series
```
Subject: Did you know? Vigil can feed your SIEM automatically

Hi [Name],

Security teams using Vigil's API integration save an average of
10 hours per week on manual IOC updates.

Here's how it works:
1. Generate an API key (Team plan)
2. Connect to Splunk/Elastic/Sentinel
3. Get fresh IOCs pushed every hour

[Watch 2-min Demo →]

Currently on Free? Upgrade to Team for API access.
```

---

## Implementation Components

### New React Components Needed

```
src/components/upgrade/
├── UpgradePrompt.jsx        # Already exists - enhance
├── BlurredContent.jsx       # Blurred teaser with upgrade CTA
├── FeaturePreview.jsx       # Sample data preview
├── LimitReachedModal.jsx    # When user hits a limit
├── TierBadge.jsx            # Small [Pro] [Team] badges
├── ValueMetricCard.jsx      # ROI/time saved displays
├── UpgradeSuccessStory.jsx  # Testimonial cards
└── MissedAlertsWidget.jsx   # Shows what they would have seen
```

### Database Changes

```sql
-- Track upgrade prompt impressions/clicks
CREATE TABLE upgrade_prompt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  prompt_type TEXT NOT NULL,
  prompt_location TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'impression', 'click', 'dismiss'
  current_tier TEXT,
  target_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track "missed" events for free users
CREATE TABLE missed_premium_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,  -- 'alert', 'correlation', 'export'
  event_data JSONB,
  would_require_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### A/B Testing Plan

| Test | Variant A | Variant B | Metric |
|------|-----------|-----------|--------|
| Blur vs Block | Blurred content | "Upgrade to view" message | Conversion rate |
| Prompt timing | Immediate | After 3 uses | Conversion rate |
| CTA copy | "Upgrade Now" | "See What You're Missing" | Click rate |
| Value display | Features list | ROI calculator | Conversion rate |

---

## Prompt Placement Priority

### High Impact (Implement First)
1. **Historical data blur** - Dashboard/search results
2. **Export blocked modal** - Export buttons
3. **Watchlist limit modal** - Add to watchlist
4. **Search limit toast** - Search bar (free tier)

### Medium Impact
5. **API playground preview** - New page
6. **Correlation preview blur** - Actor panels
7. **Relevance score preview** - Dashboard widget
8. **Weekly "missed" email** - Email campaign

### Lower Impact (Nice to Have)
9. **Tier badges on nav** - Sidebar
10. **Success story carousel** - Pricing page
11. **ROI calculator** - Pricing page
12. **Activity feed teaser** - Dashboard

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Free → Paid conversion | 5% → 8% | Users upgrading within 30 days |
| Upgrade prompt CTR | > 3% | Clicks / impressions |
| Trial start rate | > 15% | Users starting free trial |
| Feature discovery | +50% | Premium feature page views |
| Churn reduction | -10% | Users downgrading |

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0 | Initial strategy document |
