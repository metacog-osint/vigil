# Vigil Infrastructure Cost Analysis

Comprehensive cost breakdown for Vigil's current infrastructure and proposed enhancements including real-time alerting, additional data sources, and scaling considerations.

*Created: January 15, 2026*
*Last Updated: January 15, 2026*

---

## Executive Summary

### Current Monthly Costs

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Free/Pro | $0 - $25 |
| Firebase | Free | $0 |
| Vercel | Free | $0 |
| GitHub Actions | Free (public repo) | $0 |
| **Total Current** | | **$0 - $25/month** |

### Projected Costs with Real-Time Alerting

| Scenario | Monthly Cost | Notes |
|----------|--------------|-------|
| **Minimal (Free tiers)** | $0 - $25 | < 100 users, basic alerts |
| **Growth (Pro tiers)** | $50 - $100 | 100-1,000 users |
| **Scale (High usage)** | $150 - $300 | 1,000+ users, full features |

---

## Current Infrastructure Costs

### 1. Supabase (Database & Backend)

**Current Plan:** Free or Pro

| Plan | Price | Includes |
|------|-------|----------|
| **Free** | $0/month | 500 MB database, 5 GB bandwidth, 500K edge function calls, 200 concurrent realtime connections |
| **Pro** | $25/month | 8 GB database, 250 GB bandwidth, 2M edge function calls, daily backups |

**Current Usage Estimate:**
- Database size: ~200 MB (well within free tier)
- Edge function calls: < 100K/month
- Realtime connections: < 50 concurrent

**Recommendation:** Free tier is sufficient for current usage. Upgrade to Pro ($25/month) when:
- Database exceeds 500 MB
- Need daily backups
- Realtime connections exceed 200

**Source:** [Supabase Pricing](https://supabase.com/pricing)

---

### 2. Firebase (Authentication)

**Current Plan:** Spark (Free)

| Feature | Free Limit |
|---------|------------|
| Authentication | 50,000 MAU |
| Firestore | 1 GB storage, 50K reads/day |
| Cloud Messaging | Unlimited |

**Current Usage:**
- Monthly Active Users: < 1,000
- Firestore usage: Minimal (user preferences)

**Cost:** $0/month (well within free limits)

**Recommendation:** No changes needed. Firebase free tier is extremely generous for auth.

**Source:** [Firebase Pricing](https://firebase.google.com/pricing)

---

### 3. Vercel (Hosting)

**Current Plan:** Hobby (Free)

| Feature | Free Limit |
|---------|------------|
| Bandwidth | 100 GB/month |
| Serverless Functions | 100 GB-hours |
| Edge Functions | 500K invocations |
| Builds | 6,000 minutes/month |

**Current Usage:**
- Bandwidth: < 10 GB/month
- Function invocations: < 50K/month

**Cost:** $0/month

**Recommendation:** Free tier is sufficient. Upgrade to Pro ($20/month) if:
- Traffic exceeds 100 GB bandwidth
- Need team collaboration features
- Require higher function limits

**Source:** [Vercel Pricing](https://vercel.com/pricing)

---

### 4. GitHub Actions (Data Ingestion)

**Current Plan:** Free (Public Repository)

| Feature | Public Repos | Private Repos |
|---------|--------------|---------------|
| Minutes | Unlimited | 2,000/month |
| Storage | Unlimited | 500 MB |

**Current Usage:**
- ~6 workflow runs per day (every 6 hours for multiple feeds)
- ~5 minutes per run average
- Total: ~900 minutes/month

**Cost:** $0/month (public repository)

**Important Update (March 2026):** GitHub will introduce a $0.002/minute platform charge for self-hosted runners. This does NOT affect GitHub-hosted runners on public repos.

**Source:** [GitHub Actions Billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)

---

## Real-Time Alerting System Costs

### 1. Email Notifications (Resend)

**Recommended Provider:** [Resend](https://resend.com/pricing)

| Plan | Price | Emails/Month | Daily Limit |
|------|-------|--------------|-------------|
| **Free** | $0 | 3,000 | 100/day |
| **Pro** | $20 | 50,000 | Unlimited |
| **Scale** | $90 | 100,000 | Unlimited |

**Usage Estimates:**

| User Count | Alerts/User/Day | Monthly Emails | Required Plan | Cost |
|------------|-----------------|----------------|---------------|------|
| 50 | 2 | 3,000 | Free | $0 |
| 100 | 2 | 6,000 | Pro | $20 |
| 500 | 2 | 30,000 | Pro | $20 |
| 1,000 | 2 | 60,000 | Scale | $90 |

**Recommendation:** Start with Free tier, upgrade to Pro ($20/month) when user base exceeds 50 active users.

---

### 2. Push Notifications

**Option A: Web Push API (Native Browser)**

| Item | Cost |
|------|------|
| Implementation | Free (browser native) |
| Delivery | Free |
| Infrastructure | None required |

**Option B: Firebase Cloud Messaging (Mobile)**

| Item | Cost |
|------|------|
| Push messages | Free (unlimited) |
| Setup | Free |

**Recommendation:** Use native Web Push API for browser notifications ($0) and Firebase Cloud Messaging for mobile ($0).

---

### 3. Webhook Notifications (Slack, Discord, Teams)

| Item | Cost |
|------|------|
| Outgoing HTTP requests | Free |
| Slack incoming webhooks | Free |
| Discord webhooks | Free |
| Teams webhooks | Free |

**Cost:** $0/month - Webhooks are just HTTP POST requests.

---

### 4. Increased Ingestion Frequency

Moving from 6-hour to 30-minute ingestion cycles:

**Current:** 4 runs/day × 30 days = 120 runs/month
**Proposed:** 48 runs/day × 30 days = 1,440 runs/month

| Scenario | Runs/Month | Minutes (@ 5min avg) | Cost |
|----------|------------|----------------------|------|
| Current (6h) | 120 | 600 | $0 |
| Proposed (30min) | 1,440 | 7,200 | $0 |

**Cost:** Still $0/month for public repositories with GitHub-hosted runners.

**Note:** If repository is private, 7,200 minutes exceeds the 2,000 free minutes. Would need:
- Team plan ($4/user/month) with 3,000 minutes, or
- Additional minutes at $0.008/minute = ~$42/month

**Recommendation:** Keep repository public for free unlimited Actions minutes.

---

### 5. Supabase Edge Functions (Alert Processing)

**Purpose:** Process new events and dispatch alerts

**Estimated Usage:**
- New events: ~1,000/day across all feeds
- Alert checks per event: ~100 users
- Function invocations: ~100,000/month

| Plan | Included | Overage |
|------|----------|---------|
| Free | 500,000 | $2/million |
| Pro | 2,000,000 | $2/million |

**Cost:** $0/month (within free tier limits)

---

## New Data Source Costs

### Free Sources (No Additional Cost)

| Source | API Cost | Notes |
|--------|----------|-------|
| EPSS | $0 | Free from FIRST.org |
| GitHub GHSA | $0 | Free public API |
| GDELT | $0 | Free, supported by Google |
| UMD Cyber Events | $0 | Free with registration |
| crt.sh | $0 | Free |
| Tor Exit Nodes | $0 | Free |
| Firehol | $0 | Free |
| C2-Tracker | $0 | Free |
| Ransomwhere | $0 | Free |
| CISA ICS-CERT | $0 | Free |
| OpenPhish | $0 | Free |
| Maltrail | $0 | Free |
| Exploit-DB | $0 | Free |

### Freemium Sources (Free Tier Available)

| Source | Free Tier | Paid Tier |
|--------|-----------|-----------|
| Pulsedive | 100 queries/day | $30/month for unlimited |
| GreyNoise | 100 queries/day | $300/month community |
| Censys | 250 queries/month | $500+/month |
| ANY.RUN | 100 tasks/month | $109/month |

**Recommendation:** Use free tiers initially, upgrade only if query limits become restrictive.

### Paid Sources (Optional, Future)

| Source | Monthly Cost | Value Add |
|--------|--------------|-----------|
| VulnCheck | Contact sales | Extended KEV, faster |
| Shodan API | $59/month | Full historical scans |
| SecurityTrails | $50+/month | DNS/WHOIS history |
| BinaryEdge | $50+/month | Internet scanning |

**Recommendation:** Defer paid sources until clear user demand exists.

---

## Cost Scenarios

### Scenario 1: Minimal (Current + Basic Alerting)

For < 100 users, basic email alerts, free tiers everywhere.

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Free | $0 |
| Firebase | Free | $0 |
| Vercel | Free | $0 |
| GitHub Actions | Free | $0 |
| Resend | Free | $0 |
| Push Notifications | Free | $0 |
| New Data Sources | Free | $0 |
| **Total** | | **$0/month** |

---

### Scenario 2: Growth (100-1,000 Users)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Pro | $25 |
| Firebase | Free | $0 |
| Vercel | Free | $0 |
| GitHub Actions | Free | $0 |
| Resend | Pro | $20 |
| Push Notifications | Free | $0 |
| New Data Sources | Free | $0 |
| **Total** | | **$45/month** |

---

### Scenario 3: Scale (1,000+ Users, Full Features)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Pro + overages | $50 |
| Firebase | Free | $0 |
| Vercel | Pro | $20 |
| GitHub Actions | Free | $0 |
| Resend | Scale | $90 |
| Push Notifications | Free | $0 |
| Pulsedive | Pro | $30 |
| **Total** | | **$190/month** |

---

### Scenario 4: Enterprise (5,000+ Users, Premium Data)

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Supabase | Team | $599 |
| Firebase | Free | $0 |
| Vercel | Pro | $20 |
| GitHub Actions | Free | $0 |
| Resend | Scale | $90 |
| Push Notifications | Free | $0 |
| VulnCheck | Est. | $200 |
| Shodan | Full | $59 |
| **Total** | | **~$970/month** |

---

## Cost Optimization Strategies

### 1. Keep Repository Public

- **Savings:** $40-100/month on GitHub Actions
- **Trade-off:** Code is visible (acceptable for this project)

### 2. Use Native Web Push

- **Savings:** $50-200/month vs third-party push services
- **Trade-off:** Slightly more complex implementation

### 3. Smart Alert Batching

- **Savings:** Reduce email costs by 50-70%
- **Implementation:** Batch non-critical alerts into digests

### 4. Relevance Filtering

- **Savings:** Reduce unnecessary alerts/emails
- **Implementation:** Only alert on org-profile-relevant events

### 5. Caching & Deduplication

- **Savings:** Reduce API calls and processing
- **Implementation:** Cache enrichment data, dedupe alerts

---

## Annual Cost Projections

| Scenario | Monthly | Annual |
|----------|---------|--------|
| Minimal (bootstrap) | $0 | $0 |
| Growth (100-1K users) | $45 | $540 |
| Scale (1K+ users) | $190 | $2,280 |
| Enterprise (5K+ users) | $970 | $11,640 |

---

## Revenue vs Cost Analysis

If Vigil implements subscription tiers:

| Tier | Price/Month | Users Needed to Cover Costs |
|------|-------------|----------------------------|
| Minimal scenario | $0 | N/A |
| Growth scenario ($45) | $29 Pro | 2 users |
| Scale scenario ($190) | $29 Pro | 7 users |
| Scale scenario ($190) | $99 Team | 2 teams |

**Break-even is extremely achievable** with even minimal paid adoption.

---

## Summary Recommendations

1. **Start with all free tiers** - $0/month is achievable
2. **First paid upgrade:** Supabase Pro ($25) when database grows
3. **Second paid upgrade:** Resend Pro ($20) when users exceed 50
4. **Keep GitHub repo public** for free unlimited Actions
5. **Use native Web Push** instead of third-party services
6. **Implement smart batching** to reduce email costs
7. **Defer paid data sources** until user demand is clear

**Bottom Line:** Real-time alerting can be implemented for **$0-45/month** at moderate scale, scaling to **$150-200/month** at 1,000+ users.

---

## References

- [Supabase Pricing](https://supabase.com/pricing)
- [Vercel Pricing](https://vercel.com/pricing)
- [GitHub Actions Billing](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
- [Resend Pricing](https://resend.com/pricing)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [GitHub Actions 2026 Changes](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/)

---

*Document Version: 1.0*
