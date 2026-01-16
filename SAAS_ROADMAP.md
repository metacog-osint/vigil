# Vigil SaaS Product Roadmap

> Comprehensive plan for building Vigil into a successful subscription-based threat intelligence platform.

**Document Created:** January 2026
**Last Updated:** January 2026
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State](#current-state)
3. [Phase 1: Revenue Enablers](#phase-1-revenue-enablers)
4. [Phase 2: Retention & Stickiness](#phase-2-retention--stickiness)
5. [Phase 3: Enterprise Features](#phase-3-enterprise-features)
6. [Phase 4: Expansion & Scale](#phase-4-expansion--scale)
7. [Cost Analysis](#cost-analysis)
8. [Technical Architecture](#technical-architecture)
9. [Success Metrics](#success-metrics)
10. [Risk Assessment](#risk-assessment)

---

## Executive Summary

### Vision
Transform Vigil from a threat intelligence dashboard into a **push-based intelligence platform** that proactively delivers relevant, actionable threat intelligence to security teams.

### Key Differentiators
1. **Relevance-First**: Intelligence tailored to each customer's sector, tech stack, and assets
2. **Push, Not Pull**: Scheduled reports, alerts, and digests delivered automatically
3. **Collaboration Built-In**: Team features, shared watchlists, investigation notebooks
4. **Affordable**: Aggressive pricing compared to enterprise TI platforms ($1000s/mo)

### Target Customers
| Segment | Size | Pain Point | Willingness to Pay |
|---------|------|------------|-------------------|
| SMB Security Teams | 1-10 analysts | No budget for Recorded Future/Mandiant | $50-200/mo |
| MSSPs | 5-50 customers | Need white-label TI for clients | $200-500/mo |
| Enterprise SOCs | 10-50 analysts | Overwhelmed by generic intel | $500-2000/mo |

---

## Current State

### Completed Features (Phases 1-7)

| Category | Features |
|----------|----------|
| **Data Ingestion** | 15+ threat feeds (ransomware, IOCs, vulnerabilities, MITRE) |
| **Enrichment** | Shodan, VirusTotal, HybridAnalysis, GreyNoise, Geolocation |
| **UI/UX** | Dashboard, Actors, Incidents, IOC Search, Vulnerabilities, Alerts |
| **Personalization** | Org profile, relevance scoring, sector filtering |
| **Collaboration** | Teams, shared watchlists, role-based access |
| **Security** | 2FA, session management, Firebase Auth |
| **Performance** | Service worker, offline support, caching |
| **Documentation** | Help center with 8 comprehensive sections |
| **Testing** | 174 unit tests, 20 E2E tests, ESLint |

### Current Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Auth**: Firebase Authentication
- **AI**: Groq (Llama 3.3 70B)
- **Email**: Resend
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions

### Current Monthly Costs
```
Supabase Pro:     $25/mo
Vercel:           $0 (free tier)
Firebase:         $0 (free tier)
Resend:           $0 (free tier)
Domain:           ~$1/mo
─────────────────────────
Total:            ~$26/mo
```

---

## Phase 1: Revenue Enablers

> **Goal**: Features that directly justify subscription pricing
> **Timeline**: 2-3 weeks
> **Priority**: CRITICAL

### 1.1 Scheduled Intelligence Reports (COMPLETED)

**What**: Automated PDF/email reports delivered on schedule

**User Story**: *"As a security manager, I want a weekly threat digest emailed to my team so we stay informed without logging in daily."*

**Features**:
- [x] Daily, weekly, monthly report schedules
- [x] Customizable report sections (actors, incidents, vulns, IOCs)
- [x] HTML/PDF generation with branding
- [x] Email delivery via Resend
- [x] Report history and archives

**Technical Implementation**:
```
├── scripts/
│   └── generate-scheduled-report.mjs    # Report generation logic
├── src/
│   ├── lib/
│   │   └── reportGenerator.js           # PDF generation
│   ├── pages/
│   │   └── Reports.jsx                  # Report configuration UI
│   └── components/
│       └── ReportBuilder.jsx            # Report customization
└── .github/workflows/
    └── scheduled-reports.yml            # Cron trigger
```

**Dependencies**:
- `puppeteer` or `@react-pdf/renderer` for PDF generation
- Resend for email delivery (already configured)
- GitHub Actions for scheduling

**Cost**: Free (within Resend free tier for <100 reports/day)

---

### 1.2 Custom Alert Rules Engine (COMPLETED)

**What**: User-defined rules that trigger notifications when conditions are met

**User Story**: *"As an analyst, I want to be alerted immediately when a threat actor targeting my sector has new activity."*

**Features**:
- [x] Rule builder UI with conditions
- [x] Multiple trigger types (new incident, new IOC, trend change, KEV added)
- [x] Email and in-app notification channels
- [x] Rule evaluation scheduler (15-minute intervals)
- [x] Alert history and analytics

**Rule Examples**:
```javascript
// Example rule definitions
{
  name: "Healthcare Ransomware Alert",
  conditions: [
    { field: "entity_type", operator: "eq", value: "incident" },
    { field: "sector", operator: "eq", value: "healthcare" },
    { field: "actor.trend_status", operator: "eq", value: "ESCALATING" }
  ],
  actions: [
    { type: "email", to: "soc@company.com" },
    { type: "slack", channel: "#threat-intel" }
  ]
}
```

**Technical Implementation**:
```
├── supabase/migrations/
│   └── 011_alert_rules.sql              # Rules schema
├── src/
│   ├── lib/
│   │   └── alertEngine.js               # Rule evaluation logic
│   ├── pages/
│   │   └── AlertRules.jsx               # Rule management UI
│   └── components/
│       ├── RuleBuilder.jsx              # Visual rule builder
│       └── RuleCondition.jsx            # Condition input
└── scripts/
    └── evaluate-alert-rules.mjs         # Scheduled rule evaluation
```

**Schema**:
```sql
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  team_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_history (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES alert_rules(id),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  matched_entities JSONB,
  actions_taken JSONB,
  status TEXT
);
```

**Cost**: Free (email/webhook notifications)

---

### 1.3 Usage Analytics Dashboard (COMPLETED)

**What**: Analytics to understand how customers use Vigil

**User Story**: *"As the product owner, I want to see which features are used most and identify at-risk customers."*

**Features**:
- [x] Page view tracking
- [x] Feature usage events
- [x] Search query analytics
- [x] User engagement scores
- [x] Churn risk indicators
- [x] Analytics dashboard component

**Events to Track**:
```javascript
// Event types
const EVENTS = {
  PAGE_VIEW: 'page_view',
  SEARCH: 'search',
  EXPORT: 'export',
  WATCHLIST_ADD: 'watchlist_add',
  ALERT_CREATED: 'alert_created',
  REPORT_GENERATED: 'report_generated',
  API_CALL: 'api_call',
}
```

**Cost**: Free (Supabase storage)

---

### 1.4 Tiered Feature Gating (COMPLETED)

**What**: Enable/disable features based on subscription tier

**Tiers**:
| Feature | Free | Pro ($49/mo) | Team ($149/mo) | Enterprise |
|---------|------|--------------|----------------|------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| IOC Search | 10/day | Unlimited | Unlimited | Unlimited |
| Watchlists | 1 | 10 | Unlimited | Unlimited |
| Alert Rules | ❌ | 5 | 25 | Unlimited |
| Scheduled Reports | ❌ | Weekly | Daily | Custom |
| Team Members | 1 | 1 | 10 | Unlimited |
| API Access | ❌ | 1k/mo | 10k/mo | Unlimited |
| SSO/SAML | ❌ | ❌ | ❌ | ✅ |
| White-label | ❌ | ❌ | ❌ | ✅ |

**Technical Implementation**:
```javascript
// src/lib/features.js
export const TIER_LIMITS = {
  free: {
    ioc_searches_per_day: 10,
    watchlists: 1,
    alert_rules: 0,
    team_members: 1,
    api_calls_per_month: 0,
    scheduled_reports: false,
  },
  pro: {
    ioc_searches_per_day: Infinity,
    watchlists: 10,
    alert_rules: 5,
    team_members: 1,
    api_calls_per_month: 1000,
    scheduled_reports: 'weekly',
  },
  // ...
}
```

**Cost**: Stripe integration (2.9% + $0.30 per transaction)

---

## Phase 2: Retention & Stickiness

> **Goal**: Features that increase switching costs and long-term value
> **Timeline**: 3-4 weeks
> **Priority**: HIGH

### 2.1 Investigation Notebooks

**What**: Save and document threat investigations with context

**User Story**: *"As an analyst, I want to save my investigation into APT29 with all the IOCs, notes, and findings so I can share it with my team."*

**Features**:
- [ ] Create investigation from any entity
- [ ] Rich text notes with markdown
- [ ] Attach IOCs, actors, vulnerabilities
- [ ] Timeline of investigation activity
- [ ] Share with team members
- [ ] Export to PDF

**Schema**:
```sql
CREATE TABLE investigations (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  team_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open', -- open, closed, archived
  severity TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE investigation_entries (
  id UUID PRIMARY KEY,
  investigation_id UUID REFERENCES investigations(id),
  entry_type TEXT NOT NULL, -- note, entity, attachment, timeline
  content JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Cost**: Free

---

### 2.2 Attack Surface Monitoring

**What**: Monitor customer's own assets against threat intelligence

**User Story**: *"As a security manager, I want to know immediately if any of my company's domains or IPs appear in threat intelligence."*

**Features**:
- [ ] Asset inventory (domains, IPs, email domains)
- [ ] Continuous matching against IOC feeds
- [ ] Breach notification (HIBP integration)
- [ ] Certificate transparency monitoring
- [ ] Alerts when assets are mentioned

**Asset Types**:
```javascript
const ASSET_TYPES = {
  DOMAIN: 'domain',           // company.com
  IP_RANGE: 'ip_range',       // 192.168.1.0/24
  EMAIL_DOMAIN: 'email',      // @company.com in breaches
  BRAND_KEYWORD: 'keyword',   // "CompanyName" in posts
  EXECUTIVE: 'executive',     // CEO name monitoring
}
```

**Cost**:
- Basic (IOC matching): Free
- HIBP API: Free for domain search
- Certificate Transparency: Free (crt.sh API)

---

### 2.3 Custom IOC Lists

**What**: Import and manage private IOC collections

**User Story**: *"As a threat intel analyst, I want to import our internal IOC list and cross-reference it with public threat data."*

**Features**:
- [ ] CSV/STIX/JSON import
- [ ] Manual IOC entry
- [ ] Tagging and categorization
- [ ] Auto-enrichment on import
- [ ] Correlation with public IOCs
- [ ] Export in multiple formats

**Supported Formats**:
- CSV (value, type, tags, notes)
- STIX 2.1 bundles
- MISP JSON
- OpenIOC XML
- Plain text (one per line)

**Cost**: Free

---

### 2.4 Saved Searches & Views

**What**: Save frequent searches and custom dashboard views

**User Story**: *"As an analyst focused on ransomware, I want to save my filtered view so I don't have to set it up every time."*

**Features**:
- [ ] Save current search/filters as named view
- [ ] Quick access from sidebar
- [ ] Share views with team
- [ ] Set default view per page

**Cost**: Free

---

## Phase 3: Enterprise Features

> **Goal**: Features required for enterprise sales
> **Timeline**: 4-6 weeks
> **Priority**: MEDIUM (revenue dependent)

### 3.1 SSO/SAML Integration

**What**: Enterprise single sign-on support

**User Story**: *"As an IT admin, I need Vigil to integrate with our Okta SSO so users don't need separate passwords."*

**Supported Providers**:
- [ ] Okta
- [ ] Azure AD
- [ ] OneLogin
- [ ] Google Workspace
- [ ] Generic SAML 2.0

**Technical Options**:

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| Firebase Identity Platform | Native Firebase integration | Limited SAML support | $0.05/MAU |
| Auth0 | Full SAML, easy setup | Another vendor | $23/mo (1k users) |
| WorkOS | Built for B2B SaaS | Newer platform | $49/mo base |
| Build custom | Full control | Complex, security risk | Dev time |

**Recommendation**: Start with Firebase Identity Platform, upgrade to WorkOS if enterprise demand justifies.

**Cost**: $50-200/mo depending on MAU

---

### 3.2 Audit Logs Export

**What**: Detailed activity logs for compliance

**User Story**: *"As a compliance officer, I need to export all user activity for our SOC2 audit."*

**Features**:
- [ ] All user actions logged
- [ ] Export to CSV/JSON
- [ ] Retention configuration
- [ ] Search and filter logs
- [ ] Automated compliance reports

**Events Logged**:
```javascript
const AUDIT_EVENTS = [
  'user.login',
  'user.logout',
  'user.mfa_enrolled',
  'search.executed',
  'export.downloaded',
  'watchlist.created',
  'watchlist.item_added',
  'alert_rule.created',
  'alert_rule.triggered',
  'team.member_invited',
  'team.member_removed',
  'api.key_created',
  'api.key_used',
]
```

**Cost**: Free (Supabase storage)

---

### 3.3 White-Label / Multi-Tenancy

**What**: Allow MSSPs to rebrand Vigil for their customers

**User Story**: *"As an MSSP, I want to offer threat intelligence to my clients under my brand."*

**Features**:
- [ ] Custom logo and colors
- [ ] Custom domain (CNAME)
- [ ] Remove Vigil branding
- [ ] Per-tenant data isolation
- [ ] Tenant management portal

**Technical Implementation**:
```javascript
// Tenant configuration
const tenantConfig = {
  id: 'acme-security',
  name: 'ACME Security',
  domain: 'intel.acmesecurity.com',
  branding: {
    logo: 'https://...',
    primaryColor: '#FF5733',
    favicon: 'https://...',
  },
  features: {
    // Feature flags per tenant
  }
}
```

**Cost**:
- Vercel Pro for custom domains: $20/mo
- Additional Supabase for isolation: $25/mo per major tenant

---

### 3.4 SLA Dashboard

**What**: Uptime monitoring and SLA reporting

**User Story**: *"As an enterprise customer, I need proof of 99.9% uptime for my procurement team."*

**Features**:
- [ ] Public status page
- [ ] Historical uptime data
- [ ] Incident history
- [ ] Planned maintenance calendar
- [ ] SLA compliance reporting

**Options**:
- Better Uptime (free tier available)
- Instatus ($20/mo)
- Build custom with UptimeRobot API (free)

**Cost**: $0-20/mo

---

## Phase 4: Expansion & Scale

> **Goal**: Features for growth and market expansion
> **Timeline**: Ongoing
> **Priority**: LOW (after revenue established)

### 4.1 API Webhooks

**What**: Push events to customer systems in real-time

**Features**:
- [ ] Webhook URL registration
- [ ] Event type filtering
- [ ] Retry logic with exponential backoff
- [ ] Webhook logs and debugging
- [ ] Signature verification

**Events Available**:
```javascript
const WEBHOOK_EVENTS = [
  'incident.created',
  'actor.trend_changed',
  'vulnerability.kev_added',
  'ioc.matched_asset',
  'alert.triggered',
  'report.generated',
]
```

**Cost**: Free

---

### 4.2 Vendor Risk Monitoring

**What**: Monitor third-party vendors for security issues

**User Story**: *"As a security manager, I want to track if our vendors (Salesforce, AWS, etc.) have any breaches or vulnerabilities."*

**Features**:
- [ ] Vendor inventory
- [ ] Automatic breach monitoring
- [ ] Vulnerability correlation (by vendor's tech)
- [ ] Risk scoring
- [ ] Vendor security questionnaire tracking

**Data Sources**:
- HIBP for breaches
- CVE data correlated to vendor products
- News monitoring (future)

**Cost**: Free for basic, premium breach APIs cost more

---

### 4.3 Industry Benchmarking

**What**: Compare threat landscape against industry peers

**User Story**: *"As a CISO, I want to show my board how our sector compares to others in terms of ransomware attacks."*

**Features**:
- [ ] Anonymized aggregate statistics
- [ ] Sector comparison charts
- [ ] Trend analysis vs industry
- [ ] Monthly benchmark reports

**Requirements**:
- Sufficient customer base for meaningful data
- Privacy-preserving aggregation
- Opt-in data sharing

**Cost**: Free (uses existing data)

---

### 4.4 Slack/Teams Interactive Bots

**What**: Query Vigil directly from chat

**Features**:
- [ ] `/vigil search <query>` - IOC lookup
- [ ] `/vigil actor <name>` - Actor summary
- [ ] `/vigil alerts` - Recent alerts
- [ ] Interactive buttons for actions
- [ ] Threaded responses

**Cost**: Free

---

### 4.5 Mobile App (Future)

**What**: iOS/Android app for on-the-go access

**Features**:
- Push notifications for alerts
- Quick IOC lookup
- Dashboard overview
- Offline report viewing

**Options**:
- React Native (code sharing with web)
- PWA enhancement (already have service worker)

**Cost**: $99/yr Apple Developer + dev time

---

## Cost Analysis

### Infrastructure Costs by Scale

| Users | Supabase | Email | Auth | Hosting | Total/mo |
|-------|----------|-------|------|---------|----------|
| 0-100 | $25 | $0 | $0 | $0 | **$25** |
| 100-500 | $25 | $20 | $0 | $0 | **$45** |
| 500-1000 | $75 | $20 | $25 | $20 | **$140** |
| 1000-5000 | $150 | $50 | $100 | $50 | **$350** |
| 5000+ | $300+ | $100+ | $200+ | $100+ | **$700+** |

### Third-Party API Costs

| Service | Free Tier | Paid Tier | When Needed |
|---------|-----------|-----------|-------------|
| VirusTotal | 4 req/min | $700/mo | High-volume enrichment |
| Shodan | InternetDB free | $59/mo | Active scanning |
| HIBP | Domain search free | $3.50/domain/mo | Breach monitoring |
| Stripe | 0 | 2.9% + $0.30/tx | Payment processing |

### Revenue Model

| Tier | Price | Target Customers | Break-even Users |
|------|-------|------------------|------------------|
| Free | $0 | Lead generation | N/A |
| Pro | $49/mo | Individual analysts | 1 (at $25 infra) |
| Team | $149/mo | Small security teams | 1 (at $45 infra) |
| Enterprise | $499+/mo | Large orgs, MSSPs | 1 (at $140 infra) |

**Target**: 100 paying customers at avg $100/mo = $10k MRR

---

## Technical Architecture

### Current Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    React SPA                            ││
│  │  Dashboard │ Actors │ IOCs │ Vulns │ Reports │ Settings ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Realtime   │  │   Storage    │      │
│  │   (Data)     │  │   (Subs)     │  │   (Files)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │ Firebase │    │  Resend  │    │   Groq   │
       │  (Auth)  │    │ (Email)  │    │   (AI)   │
       └──────────┘    └──────────┘    └──────────┘
```

### Proposed Architecture (with new features)
```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Actions                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Ingest    │  │   Alerts    │  │   Reports   │         │
│  │   (6hr)     │  │   (15min)   │  │   (daily)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                     PostgreSQL                        │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐ │  │
│  │  │ Threat │ │ Alert  │ │ Teams  │ │ Investigations │ │  │
│  │  │  Data  │ │ Rules  │ │& Users │ │ & Notebooks    │ │  │
│  │  └────────┘ └────────┘ └────────┘ └────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Realtime   │  │   Storage    │  │  Edge Funcs  │      │
│  │ (Live subs)  │  │(PDFs, files) │  │  (Webhooks)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

### Product Metrics

| Metric | Target (6mo) | Target (12mo) |
|--------|--------------|---------------|
| Registered Users | 500 | 2,000 |
| Paying Customers | 50 | 200 |
| MRR | $5,000 | $20,000 |
| DAU/MAU Ratio | 30% | 40% |
| Churn Rate | <5%/mo | <3%/mo |

### Feature Adoption Metrics

| Feature | Success Indicator |
|---------|-------------------|
| Scheduled Reports | >50% of paid users configure |
| Alert Rules | Avg 3+ rules per paid user |
| Watchlists | Avg 5+ items per user |
| Team Collaboration | >30% of teams have 3+ members |
| API Usage | >20% of Team+ users active |

### Customer Health Score

```javascript
const healthScore = {
  loginFrequency: 0.25,      // 25% weight
  featureUsage: 0.25,        // 25% weight
  alertsConfigured: 0.20,    // 20% weight
  teamEngagement: 0.15,      // 15% weight
  recentActivity: 0.15,      // 15% weight
}
```

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Supabase outage | Low | High | Local caching, offline mode |
| Data source deprecation | Medium | Medium | Multiple sources per data type |
| API rate limiting | Medium | Low | Caching, queue management |
| Security breach | Low | Critical | 2FA, audit logs, pen testing |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low conversion rate | Medium | High | Focus on free-to-paid funnel |
| High churn | Medium | High | Stickiness features, engagement |
| Enterprise sales cycle | High | Medium | Self-serve focus, PLG model |
| Competitor response | Medium | Medium | Speed, niche focus |

### Mitigation Priorities
1. **Data reliability**: Multiple feeds per data type
2. **Customer engagement**: Onboarding, health monitoring
3. **Security**: Regular audits, compliance certifications
4. **Revenue diversity**: Multiple tiers, annual plans

---

## PRIORITY: Fix Tier Propagation (Before New Features)

### Current Issue
The feature gating infrastructure exists but the user's subscription tier is **not consistently passed through the app**. Many components hardcode `userTier = 'free'`.

### Files That Need Fixing
```
src/pages/ApiDocs.jsx:260        → const userTier = 'free' (HARDCODED)
src/components/ApiKeysSection.jsx:5    → userTier = 'free' default
src/components/IntegrationsSection.jsx:316 → userTier = 'free' default
```

### Solution: Create SubscriptionContext

**Step 1: Create Context** (`src/contexts/SubscriptionContext.jsx`)
```javascript
// Provides user subscription tier globally
// - Fetches from Supabase on auth change
// - Caches in React context
// - Exposes: tier, subscription, loading, canAccess(), isLimitReached()
```

**Step 2: Wrap App** in `App.jsx`
```javascript
<SubscriptionProvider>
  <Routes>...</Routes>
</SubscriptionProvider>
```

**Step 3: Replace All Hardcoded Tiers**
```javascript
// Before
const userTier = 'free'

// After
const { tier } = useSubscription()
```

**Step 4: Update useAuth Hook**
- Add `subscription` and `tier` to the auth hook return value
- Single source of truth for user state

### What Already Works
- `src/lib/features.js` - canAccess(), isLimitReached(), tier definitions
- `src/lib/stripe.js` - getUserSubscription(), checkout, portal
- `src/components/UpgradePrompt.jsx` - FeatureGate, LimitGate components
- `api/stripe/*` - Checkout, portal, webhook endpoints
- `supabase/migrations/011_subscriptions_and_api.sql` - Database schema
- 25 unit tests for feature gating

### Stripe Environment Variables Needed
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_STRIPE_PRICE_PRO_MONTHLY=price_xxx
VITE_STRIPE_PRICE_PRO_ANNUAL=price_xxx
VITE_STRIPE_PRICE_TEAM_MONTHLY=price_xxx
VITE_STRIPE_PRICE_TEAM_ANNUAL=price_xxx
STRIPE_SECRET_KEY=sk_live_xxx (server-side only)
STRIPE_WEBHOOK_SECRET=whsec_xxx (server-side only)
```

---

## Implementation Sequence

### Recommended Order

```
Phase 1A (Week 1-2): Scheduled Reports
    └── PDF generation
    └── Email delivery
    └── Report configuration UI

Phase 1B (Week 2-3): Alert Rules Engine
    └── Rule schema and storage
    └── Rule builder UI
    └── Evaluation scheduler
    └── Notification delivery

Phase 1C (Week 3-4): Usage Analytics + Feature Gating
    └── Event tracking
    └── Analytics dashboard
    └── Tier enforcement
    └── Stripe integration

Phase 2A (Week 5-6): Investigation Notebooks
    └── Investigation schema
    └── Note-taking UI
    └── Entity attachments
    └── Sharing and export

Phase 2B (Week 7-8): Attack Surface Monitoring
    └── Asset inventory UI
    └── IOC matching logic
    └── Breach monitoring
    └── Asset alerts

[Continue based on customer feedback and revenue]
```

---

## Appendix

### A. Competitive Landscape

| Competitor | Pricing | Strengths | Weaknesses |
|------------|---------|-----------|------------|
| Recorded Future | $10k+/mo | Comprehensive | Expensive |
| Mandiant TI | $5k+/mo | APT expertise | Enterprise only |
| AlienVault OTX | Free | Community | Basic features |
| GreyNoise | $500+/mo | IP intel | Narrow focus |
| **Vigil** | $49-499/mo | Affordable, relevant | Newer, smaller |

### B. Data Source Inventory

| Source | Data Type | Update Freq | Cost |
|--------|-----------|-------------|------|
| RansomLook | Incidents | 6hr | Free |
| Ransomware.live | Incidents | 6hr | Free |
| CISA KEV | Vulnerabilities | 6hr | Free |
| NVD | CVEs | Daily | Free |
| ThreatFox | IOCs | 6hr | Free |
| URLhaus | IOCs | 6hr | Free |
| Feodo Tracker | IOCs | 6hr | Free |
| AlienVault OTX | IOCs | Daily | Free |
| MalwareBazaar | Malware | Daily | Free |
| PhishTank | Phishing | Daily | Free |
| MITRE ATT&CK | Techniques | Weekly | Free |
| HIBP | Breaches | Weekly | Free |
| Shodan InternetDB | Enrichment | Daily | Free |
| VirusTotal | Enrichment | Daily | Free* |
| HybridAnalysis | Enrichment | Daily | Free* |
| GreyNoise | Enrichment | Daily | Free* |

*Rate limited on free tier

### C. File Structure (Proposed)

```
vigil/
├── src/
│   ├── pages/
│   │   ├── Reports.jsx           # NEW: Report configuration
│   │   ├── AlertRules.jsx        # NEW: Alert rule management
│   │   ├── Investigations.jsx    # NEW: Investigation notebooks
│   │   └── Assets.jsx            # NEW: Attack surface
│   ├── components/
│   │   ├── ReportBuilder.jsx     # NEW
│   │   ├── RuleBuilder.jsx       # NEW
│   │   ├── InvestigationPanel.jsx# NEW
│   │   └── AssetInventory.jsx    # NEW
│   └── lib/
│       ├── reportGenerator.js    # NEW: PDF generation
│       ├── alertEngine.js        # NEW: Rule evaluation
│       └── assetMatcher.js       # NEW: IOC matching
├── scripts/
│   ├── generate-scheduled-report.mjs  # NEW
│   ├── evaluate-alert-rules.mjs       # NEW
│   └── check-asset-matches.mjs        # NEW
└── supabase/migrations/
    ├── 011_alert_rules.sql       # NEW
    ├── 012_investigations.sql    # NEW
    └── 013_assets.sql            # NEW
```

---

**Document Status**: Ready for Review
**Next Action**: Discuss priorities and begin Phase 1 implementation
