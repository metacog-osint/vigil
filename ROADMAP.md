# Vigil - Product Roadmap

> Cyber Threat Intelligence Platform by The Intelligence Company
> https://vigil.theintelligence.company

---

## Current State (v1.0.0)

Vigil is a subscription-ready CTI platform with:
- **22 automated data sources** (see DATA_SOURCES.md)
- **1,000+ threat actors** across 6 categories
- **24,000+ ransomware incidents** (2020-present)
- **Full MITRE ATT&CK integration** (691 techniques)
- **Subscription tiers** with Stripe integration
- **REST API** with 9 endpoints
- **SIEM exports** (Splunk, Elastic, Sentinel, STIX 2.1)

For completed features, see CHANGELOG.md and FEATURES.md.

---

## Planned: Phase 7 - Enterprise Features

### 7.1 Team Collaboration
- [ ] Shared workspaces
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] Team activity feed
- [ ] Shared watchlists and saved searches

### 7.2 Custom Alerting Engine
- [ ] Complex alert rule builder (AND/OR conditions)
- [ ] Alert deduplication and grouping
- [ ] Escalation policies
- [ ] On-call scheduling integration
- [ ] Alert fatigue management

### 7.3 Reporting Suite
- [ ] Scheduled PDF reports
- [ ] Executive summary templates
- [ ] Custom report builder
- [ ] Branded report output
- [ ] Historical trend reports

### 7.4 SSO & Identity
- [ ] SAML 2.0 support
- [ ] OIDC integration
- [ ] SCIM provisioning
- [ ] Multi-factor authentication options
- [ ] Session management

---

## Planned: Phase 8 - Intelligence Enrichment

### 8.1 Automated Enrichment Pipeline
- [ ] IP reputation scoring
- [ ] Domain age and registration data
- [ ] SSL certificate analysis
- [ ] WHOIS data integration
- [ ] Passive DNS history

### 8.2 Threat Scoring
- [ ] Custom risk scoring models
- [ ] Industry-specific threat scores
- [ ] Confidence-weighted scoring
- [ ] Time-decay factors

### 8.3 AI-Powered Analysis
- [ ] Automated threat summaries
- [ ] Pattern detection across incidents
- [ ] Anomaly detection
- [ ] Natural language querying
- [ ] Predictive threat modeling

---

## Planned: Phase 9 - Advanced Integrations

### 9.1 SOAR Integration
- [ ] Playbook templates
- [ ] Automated response actions
- [ ] Case management integration
- [ ] Evidence collection

### 9.2 Threat Intelligence Sharing
- [ ] TAXII server implementation
- [ ] STIX 2.1 import/export
- [ ] ISAC/ISAO integration
- [ ] Private sharing circles

### 9.3 Asset Discovery
- [ ] Asset inventory integration
- [ ] Attack surface mapping
- [ ] Vulnerability correlation
- [ ] Exposure scoring

---

## Planned: Data Source Expansion

### Priority 1: Quick Wins
See DATA_SOURCES.md Phase 1 for:
- Tor Exit Nodes
- Firehol blocklists
- OpenPhish
- C2-Tracker
- crt.sh certificates

### Priority 2: High Value
See DATA_SOURCES.md Phase 2-3 for:
- Exploit-DB integration
- CIRCL Passive DNS
- Censys certificates
- Enhanced sandbox integration

### Premium Sources (Enterprise)
| Source | Value | Status |
|--------|-------|--------|
| Shodan Full | Complete scanning data | Planned |
| Recorded Future | Finished intelligence | Evaluating |
| Censys Enterprise | Attack surface | Evaluating |

---

## Technical Debt & Quality

### Code Quality (In Progress)
See CORRECTIVE_ACTION_PLAN.md for:
- Refactoring large files (supabase.js, page components)
- Extracting shared constants
- Improving test coverage
- CI/CD improvements

### Performance Targets
| Metric | Current | Target |
|--------|---------|--------|
| Page load (P95) | ~2.5s | <2s |
| Search latency | ~600ms | <500ms |
| Test coverage | ~15% | 50%+ |
| Bundle size | 1.2MB | <1MB |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data freshness | < 6 hours | Time since last ingest |
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

*Last updated: January 2026*
*For version history, see CHANGELOG.md*
*For current features, see FEATURES.md*
*For data sources, see DATA_SOURCES.md*
