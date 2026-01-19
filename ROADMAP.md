# Vigil - Product Roadmap

> Cyber Threat Intelligence Platform by The Intelligence Company
> https://vigil.theintelligence.company

---

## Current State (v1.2.0)

Vigil is a production-ready CTI platform with:
- **29 automated data sources** (see DATA_SOURCES.md)
- **1,000+ threat actors** across 6 categories
- **24,000+ ransomware incidents** (2020-present)
- **Full MITRE ATT&CK integration** (691 techniques)
- **Subscription tiers** with Stripe integration
- **REST API** with 9 endpoints
- **SIEM exports** (Splunk, Elastic, Sentinel, STIX 2.1)
- **Real-time alerting** (email, push, Slack, Discord, Teams, webhooks)
- **Cloudflare Workers** for edge-based data ingestion

For detailed feature documentation, see:
- `CHANGELOG.md` - Version history
- `FEATURES.md` - Current feature documentation
- `BUILD_PLAN_V2.md` - **Authoritative development plan**

---

## Completed Phases

### Phase 7: Enterprise Features ✅
- [x] Team collaboration (RBAC, shared watchlists, audit logging)
- [x] Custom alerting engine (complex rules, escalation, on-call)
- [x] Reporting suite (scheduled reports, templates, branding)
- [x] SSO/SAML (Okta, Azure AD, Google Workspace, OIDC)
- [x] Multi-tenancy / white-label support

### Phase 8: Intelligence Enrichment ✅
- [x] Automated enrichment pipeline (IP reputation, WHOIS, SSL, passive DNS)
- [x] Threat scoring (custom models, industry-specific, time-decay)
- [x] AI-powered analysis (summaries, pattern detection, anomaly detection)
- [x] Natural language querying
- [x] Predictive threat modeling

### Phase 9: Advanced Integrations ✅ (Partial)
- [x] TAXII 2.1 server implementation
- [x] STIX 2.1 import/export
- [x] Asset discovery and attack surface mapping
- [x] Vulnerability-to-asset correlation
- [x] Exposure scoring
- [x] Shadow IT detection

---

## Remaining Work

> **Note:** See `BUILD_PLAN_V2.md` for detailed tracking of all items.

### Data Sources - API Key Status
| Source | Status | Notes |
|--------|--------|-------|
| Pulsedive | ✅ Ready | API key configured |
| Censys | ✅ Ready | API key configured |
| VulnCheck KEV | ✅ Ready | API key configured |
| ANY.RUN | Pending | Needs API key |
| Triage | Pending | Needs API key |

### Quick Wins (No API Required)
| Source | Effort | Value |
|--------|--------|-------|
| CISA ICS-CERT | 3 hours | ICS/OT advisories |
| Ransomwhere | 2 hours | Crypto payment tracking |
| MITRE ATT&CK Campaigns | 2 hours | Named campaign tracking |
| BGPStream | 4 hours | BGP hijack detection |

### Production Hardening
- [ ] Stripe payment failure handling
- [ ] Grace period and dunning logic
- [ ] E2E tests in CI (Firefox, Safari, mobile)

### Future Considerations (Backlog)
| Feature | Complexity | Blocker |
|---------|------------|---------|
| SOAR Integration | High | Architecture decisions |
| SCIM Provisioning | Medium | Enterprise demand |
| Mobile App Push | Medium | Requires mobile app |
| UMD Cyber Events | Medium | Registration required |
| GDELT Integration | High | Complex implementation |
| ISAC/ISAO Integration | Medium | External partnerships |

---

## Performance Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Page load (P95) | ~2.5s | <2s | In Progress |
| Search latency | ~600ms | <500ms | In Progress |
| Test coverage | 50.7% | 50%+ | ✅ Achieved |
| Bundle size | 1.2MB | <1MB | In Progress |
| Data freshness | 30 min | <30 min | ✅ Achieved |
| Uptime | 99.9% | 99.9% | ✅ Maintained |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data freshness | < 30 min (critical feeds) | Time since last ingest |
| Uptime | 99.9% | Monitoring alerts |
| API response | < 500ms | P95 latency |
| User engagement | > 5 min/session | Analytics |
| Paid conversion | 5% | Stripe metrics |

---

## Feedback & Requests

Feature requests and feedback welcome:
- GitHub Issues for bug reports
- GitHub Discussions for feature ideas
- Email: feedback@theintelligence.company

---

*Last updated: January 17, 2026*
*For detailed development tracking, see BUILD_PLAN_V2.md*
