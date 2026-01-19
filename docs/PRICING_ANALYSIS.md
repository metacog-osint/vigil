# Vigil Pricing Analysis & Competitive Review

> **Last Updated:** January 18, 2026
> **Purpose:** Strategic pricing analysis and competitive positioning

---

## Executive Summary

Vigil is positioned in the **SMB/Prosumer threat intelligence segment**, competing below enterprise platforms like Recorded Future ($60K+/yr) but offering more comprehensive features than basic tools. Current pricing may be **leaving money on the table** while the free tier is **too generous**.

**Key Recommendations:**
1. Restrict free tier (30-day data limit, search caps)
2. Raise Professional from $29 → $39/mo
3. Add "Professional Plus" tier at $59/mo
4. Raise Team from $99 → $129/mo
5. Set Enterprise floor at $499/mo
6. Implement upgrade prompts showing gated features

---

## Market Context

### Threat Intelligence Platform Segments

| Segment | Annual Cost | Examples | Target Customer |
|---------|-------------|----------|-----------------|
| **Enterprise TI** | $60,000 - $105,000+ | Recorded Future, Mandiant, Intel471 | Fortune 500, Government |
| **Mid-Market TI** | $7,000 - $25,000 | SOCRadar, Anomali ThreatStream | Mid-size enterprises |
| **SMB/Prosumer** | $0 - $5,000 | GreyNoise, Feedly TI, **Vigil** | SMBs, Individual analysts, MSSPs |

**Vigil's Position:** SMB/Prosumer segment - appropriate positioning in a less crowded space.

---

## Current Vigil Pricing Structure

### Tier Overview

| Tier | Monthly | Annual (20% off) | Users | API Requests |
|------|---------|------------------|-------|--------------|
| **Free** | $0 | - | 1 | 0 |
| **Professional** | $29 | $278/yr | 1 | 0 |
| **Team** | $99 | $950/yr | 5 | 10,000/mo |
| **Enterprise** | Custom | Custom | Unlimited | Unlimited |

### Feature Distribution

#### Free Tier (9 features)
- `view_dashboard` - Access to main dashboard
- `view_actors` - Browse threat actors
- `view_incidents` - View ransomware incidents
- `view_vulnerabilities` - Access CVE database
- `view_iocs` - Search IOC database
- `view_alerts` - View CISA alerts
- `basic_search` - Basic search functionality
- `view_trends` - Access trend analysis
- `view_techniques` - Browse MITRE ATT&CK techniques

#### Professional Tier (+15 features)
- `org_profile` - Organization profile setup
- `relevance_scoring` - Personalized relevance scores
- `email_digests` - Daily/weekly email digests
- `vendor_alerts` - Vendor-specific CVE alerts
- `saved_filters` - Save and reuse filters (25 max)
- `saved_searches` - Save searches and set default views
- `csv_export` - Export data to CSV
- `watchlist` - Track actors and CVEs (100 items)
- `threat_hunts` - Actionable threat hunt guides
- `custom_alert_rules` - Create custom alert rules
- `correlation_panel` - Actor correlation insights
- `scheduled_reports` - Automated scheduled reports
- `investigations` - Investigation notebooks
- `attack_surface` - Attack surface monitoring
- `custom_ioc_lists` - Import private IOC collections

#### Team Tier (+8 features)
- `api_access` - REST API access
- `api_keys` - Generate API keys
- `multiple_profiles` - Multiple org profiles (3)
- `bulk_search` - Bulk IOC lookup
- `stix_export` - Export in STIX 2.1 format
- `team_sharing` - Share with team members
- `advanced_search` - Advanced query language
- `priority_support` - Priority email support

#### Enterprise Tier (+9 features)
- `siem_integration` - SIEM connectors (Splunk, Elastic, Sentinel)
- `custom_integrations` - Custom integration development
- `sso_saml` - SSO/SAML authentication
- `audit_logs` - Full audit logging
- `sla_guarantee` - SLA guarantee
- `dedicated_support` - Dedicated support contact
- `custom_data_retention` - Custom data retention policies
- `white_label` - White-label branding customization
- `on_premise_option` - On-premise deployment option

### Usage Limits

| Limit | Free | Professional | Team | Enterprise |
|-------|------|--------------|------|------------|
| Users | 1 | 1 | 5 | Unlimited |
| Org Profiles | 0 | 1 | 3 | Unlimited |
| API Requests/mo | 0 | 0 | 10,000 | Unlimited |
| Saved Filters | 3 | 25 | Unlimited | Unlimited |
| Watchlist Items | 10 | 100 | Unlimited | Unlimited |

---

## Competitive Analysis

### Direct Competitor Pricing

| Platform | Free Tier | Entry Paid | Team/API | Enterprise |
|----------|-----------|------------|----------|------------|
| **Vigil** | Full read access | $29/mo | $99/mo (5 users) | Custom |
| **SOCRadar** | Limited (1 yr trial) | ~$650/mo | ~$7,900/yr | Custom |
| **GreyNoise** | Community API only | Talk to sales | Talk to sales | Custom |
| **Feedly TI** | None | Talk to sales | Talk to sales | Talk to sales |
| **CrowdStrike** | None | $92/device/yr | Per device | Custom |

### Enterprise Platform Pricing (Reference)

| Platform | Annual Cost | Notes |
|----------|-------------|-------|
| **Recorded Future** | $60,000 - $105,000 | 5 pricing tiers |
| **Mandiant (Google)** | Custom | Typically $50K+ |
| **Intel471** | Custom | Typically $75K+ |
| **Anomali ThreatStream** | $15,000 - $50,000 | Volume-based |

### Key Observations

1. **Vigil is significantly cheaper** than mid-market competitors like SOCRadar
2. **Free tier is more generous** than any competitor
3. **Professional tier underpriced** compared to market
4. **No pricing transparency** from most competitors (opportunity for Vigil)

---

## Issues & Opportunities

### Issue 1: Free Tier Too Generous ⚠️

**Current State:** Free users get full read access to all data, all time periods.

**Problem:** Users can extract substantial value without paying:
- Full threat actor database
- Complete incident history
- All CVE/KEV vulnerabilities
- IOC searching
- Trend analysis
- MITRE techniques

**Impact:** Reduces conversion pressure; competitors gate this data.

**Recommendation:**
- Limit free tier to **last 30 days** of data
- Cap searches at **25/day**
- Remove trend analysis from free tier
- Add watermarks/banners showing date restrictions

### Issue 2: Professional Tier Underpriced 💰

**Current:** $29/mo ($348/yr)

**Market Comparison:**
- SOCRadar entry: ~$650/mo
- Feedly TI: "Talk to sales" (typically $200+/mo)
- Similar SaaS tools: $49-99/mo for comparable features

**Recommendation:** Increase to **$39/mo** ($468/yr)
- Still significantly cheaper than alternatives
- Better reflects value delivered
- 34% revenue increase per customer

### Issue 3: Large Gap Between Professional and Team 📊

**Current Jump:** $29 → $99 (3.4x increase)

**Problem:** Customers who need:
- API access for automation
- STIX export for SIEM
- Bulk search capabilities

...but don't need 5 users, have no option between $29 and $99.

**Recommendation:** Add intermediate tier:

| Tier | Price | Users | API Requests | Key Features |
|------|-------|-------|--------------|--------------|
| **Professional Plus** | $59/mo | 1 | 2,500/mo | API access, STIX export, bulk search |

### Issue 4: Team API Limits May Be Restrictive

**Current:** 10,000 requests/month

**Consideration:** Power users automating IOC lookups could exceed this.

**Recommendation:**
- Increase to **25,000/mo** for Team
- Or offer usage-based overage ($0.01/request beyond limit)

### Issue 5: Enterprise Has No Floor Price 💼

**Current:** "Custom" with no guidance

**Problem:**
- Sales conversations start from zero
- No anchor for negotiations
- Harder to qualify leads

**Recommendation:** Set minimum at **$499/mo** ($5,988/yr)
- Published as "Starting at $499/mo"
- Provides negotiation anchor
- Qualifies serious enterprise buyers

---

## Recommended Pricing Structure

### New Tier Configuration

| Tier | Current | Recommended | Change |
|------|---------|-------------|--------|
| **Free** | $0 (full access) | $0 (30-day limit) | Restrict |
| **Professional** | $29/mo | $39/mo | +$10 |
| **Professional Plus** | N/A | $59/mo | NEW |
| **Team** | $99/mo | $129/mo | +$30 |
| **Enterprise** | Custom | Starting $499/mo | Set floor |

### Annual Discount
- **Current:** 20%
- **Recommended:** 15% (preserves more revenue)

### New Usage Limits

| Limit | Free | Professional | Pro Plus | Team | Enterprise |
|-------|------|--------------|----------|------|------------|
| Data History | 30 days | Full | Full | Full | Full |
| Searches/day | 25 | Unlimited | Unlimited | Unlimited | Unlimited |
| Users | 1 | 1 | 1 | 5 | Unlimited |
| Org Profiles | 0 | 1 | 1 | 3 | Unlimited |
| API Requests/mo | 0 | 0 | 2,500 | 25,000 | Unlimited |
| Saved Filters | 3 | 25 | 50 | Unlimited | Unlimited |
| Watchlist Items | 10 | 100 | 250 | Unlimited | Unlimited |

### New Feature Distribution

| Feature | Free | Pro | Pro+ | Team | Ent |
|---------|------|-----|------|------|-----|
| View data (30 days) | ✓ | ✓ | ✓ | ✓ | ✓ |
| View data (full history) | - | ✓ | ✓ | ✓ | ✓ |
| Basic search | ✓ | ✓ | ✓ | ✓ | ✓ |
| Advanced search | - | - | - | ✓ | ✓ |
| Org profile | - | ✓ | ✓ | ✓ | ✓ |
| Relevance scoring | - | ✓ | ✓ | ✓ | ✓ |
| Email digests | - | ✓ | ✓ | ✓ | ✓ |
| CSV export | - | ✓ | ✓ | ✓ | ✓ |
| Watchlist | - | ✓ | ✓ | ✓ | ✓ |
| Alert rules | - | ✓ | ✓ | ✓ | ✓ |
| Investigations | - | ✓ | ✓ | ✓ | ✓ |
| API access | - | - | ✓ | ✓ | ✓ |
| STIX export | - | - | ✓ | ✓ | ✓ |
| Bulk search | - | - | ✓ | ✓ | ✓ |
| Team sharing | - | - | - | ✓ | ✓ |
| SIEM integration | - | - | - | - | ✓ |
| SSO/SAML | - | - | - | - | ✓ |
| White-label | - | - | - | - | ✓ |

---

## Revenue Impact Analysis

### Assumptions
- 100 paying customers
- Distribution: 60 Professional, 30 Team, 10 Enterprise
- Enterprise average: $300/mo current, $499/mo proposed

### Monthly Recurring Revenue (MRR)

| Tier | Current | Proposed | Δ MRR |
|------|---------|----------|-------|
| Professional (60) | $1,740 | $2,340 | +$600 |
| Pro Plus (new - est. 15) | $0 | $885 | +$885 |
| Team (30→25) | $2,970 | $3,225 | +$255 |
| Enterprise (10) | $3,000 | $4,990 | +$1,990 |
| **Total** | **$7,710** | **$11,440** | **+$3,730 (+48%)** |

### Annual Revenue Impact
- **Current ARR:** $92,520
- **Proposed ARR:** $137,280
- **Increase:** +$44,760 (+48%)

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)
1. Update pricing page with new prices
2. Add "Starting at $499/mo" to Enterprise
3. Reduce annual discount from 20% → 15%
4. Update Stripe price IDs

### Phase 2: Free Tier Restrictions (Week 2)
1. Implement 30-day data limit for free users
2. Add search rate limiting (25/day)
3. Add upgrade banners on restricted content
4. Update feature flags

### Phase 3: New Tier Launch (Week 3)
1. Create Professional Plus tier
2. Configure Stripe products/prices
3. Update feature matrix
4. Migrate appropriate customers

### Phase 4: Upgrade Prompts (Week 4)
1. Implement "preview" features for lower tiers
2. Add contextual upgrade prompts
3. Create email campaigns for free→paid conversion
4. A/B test prompt placements

---

## Upgrade Prompt Strategy

See `UPGRADE_PROMPT_STRATEGY.md` for detailed implementation of showing users what they're missing.

---

## Appendix: Competitor Research Sources

- [SOCRadar Pricing - G2](https://www.g2.com/products/socradar-extended-threat-intelligence/pricing)
- [GreyNoise Pricing - TrustRadius](https://www.trustradius.com/products/greynoise-intelligence/pricing)
- [Feedly Threat Intelligence Pricing](https://feedly.com/threat-intelligence/pricing)
- [Top TI Platforms 2026 - Flare](https://flare.io/glossary/top-14-threat-intelligence-platforms-for-2026/)
- [Recorded Future Reviews - PeerSpot](https://www.peerspot.com/products/recorded-future-reviews)
- [CrowdStrike Pricing - CyCognito](https://www.cycognito.com/learn/attack-surface/crowdstrike-falcon-pricing/)
- [Mandiant Pricing - TrustRadius](https://www.trustradius.com/products/mandiant-advantage-threat-intelligence/pricing)

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0 | Initial competitive analysis |
