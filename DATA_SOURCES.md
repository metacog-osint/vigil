# Vigil Data Sources & Streams

This document provides a comprehensive overview of all threat intelligence data sources integrated into Vigil, along with planned additions and rollout strategy.

---

## Current Data Sources (22 Active)

### Ransomware Intelligence

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| RansomLook | `https://www.ransomlook.io/api` | Ransomware incidents, victim claims | Every 6h | `ingest-ransomlook.mjs` | None |
| Ransomware.live | `https://api.ransomware.live/v2` | Victim claims, historical data (2020+) | Every 6h | `ingest-ransomware-live.mjs` | None |
| Ransomwatch | `https://raw.githubusercontent.com/joshhighet/ransomwatch/main/` | Victim posts, group metadata | Every 6h | `ingest-ransomwatch.mjs` | None |

### Indicators of Compromise (IOCs)

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| ThreatFox | `https://threatfox-api.abuse.ch/api/v1/` | IPs, domains, URLs, hashes | Every 6h | `ingest-threatfox.mjs` | None |
| URLhaus | `https://urlhaus-api.abuse.ch/v1/urls/recent/` | Malicious URLs | Every 6h | `ingest-urlhaus.mjs` | None |
| Feodo Tracker | `https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json` | Botnet C2 IPs | Every 6h | `ingest-feodo.mjs` | None |
| Spamhaus DROP | `https://www.spamhaus.org/drop/*.txt` | IP blocklists (DROP, EDROP, DROPv6) | Daily | `ingest-spamhaus.mjs` | None |
| AlienVault OTX | `https://otx.alienvault.com/api/v1` | Community threat pulses, IOCs | Daily | `ingest-alienvault-otx.mjs` | API Key |
| PhishTank | `http://data.phishtank.com/data/` | Verified phishing URLs | Daily | `ingest-phishtank.mjs` | Optional |

### Vulnerability Intelligence

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| CISA KEV | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | Exploited-in-wild CVEs | Every 6h | `ingest-cisa-kev.mjs` | None |
| NVD | `https://services.nvd.nist.gov/rest/json/cves/2.0` | Full CVE database | Every 6h | `ingest-nvd.mjs` | None |
| CISA Alerts | `https://www.cisa.gov/uscert/ncas/alerts.xml` | Security advisories (RSS) | Every 6h | `ingest-cisa-alerts.mjs` | None |

### Threat Actor Intelligence

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| MITRE ATT&CK | `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json` | Techniques, APT groups, mitigations | Every 6h | `ingest-mitre.mjs` | None |
| Malpedia | `https://malpedia.caad.fkie.fraunhofer.de/api` | Actor profiles, malware families | Every 6h | `ingest-malpedia.mjs` | None |
| MISP Galaxy | `https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/` | Threat actor clusters | Every 6h | `ingest-misp-galaxy.mjs` | None |

### Malware Intelligence

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| MalwareBazaar | `https://mb-api.abuse.ch/api/v1/` | Malware samples, hashes | Daily | `ingest-malwarebazaar.mjs` | Optional |

### Breach Data

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| Have I Been Pwned | `https://haveibeenpwned.com/api/v3/breaches` | Data breach information | Weekly | `ingest-hibp.mjs` | None |

### Enrichment Services

| Source | Endpoint | Data Type | Schedule | Script | Auth |
|--------|----------|-----------|----------|--------|------|
| GreyNoise | `https://api.greynoise.io/v3/community` | IP reputation, scanner detection | Daily | `ingest-greynoise.mjs` | Optional |
| Shodan InternetDB | `https://internetdb.shodan.io/` | Open ports, services | Daily | `enrich-shodan-internetdb.mjs` | None |
| VirusTotal | `https://www.virustotal.com/api/v3/` | IOC reputation, detections | Daily | `enrich-virustotal.mjs` | API Key |
| Hybrid Analysis | `https://www.hybrid-analysis.com/api/v2/` | Sandbox analysis reports | Daily | `enrich-hybridanalysis.mjs` | API Key |
| IP Geolocation | Various | Geographic location data | Daily | `enrich-geolocation.mjs` | Optional |

---

## Proposed New Data Sources

### Priority 1: Quick Wins (Free, Simple Integration)

These sources use simple JSON/text formats similar to existing integrations.

| Source | Endpoint | Data Type | Value Add |
|--------|----------|-----------|-----------|
| crt.sh | `https://crt.sh/?output=json&q=%` | Certificate transparency logs | Early phishing domain detection |
| Tor Exit Nodes | `https://check.torproject.org/torbulkexitlist` | Tor exit node IPs | Anonymization network tracking |
| Firehol Level 1 | `https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset` | Aggregated IP blocklist | Consolidated reputation data |
| OpenPhish | `https://openphish.com/feed.txt` | Phishing URLs | Supplement PhishTank coverage |
| C2-Tracker | `https://github.com/montysecurity/C2-Tracker` | Cobalt Strike, Metasploit C2s | Framework infrastructure tracking |
| Maltrail | `https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware/` | Malware indicators | Additional IOC coverage |

### Priority 2: High-Value Additions (Free/Freemium)

| Source | Endpoint | Data Type | Value Add | Auth |
|--------|----------|-----------|-----------|------|
| Exploit-DB | `https://www.exploit-db.com/` | PoC exploits | Exploit availability for CVEs | None |
| Blocklist.de | `https://www.blocklist.de/lists/` | Brute-force attacker IPs | Attack source identification | None |
| Emerging Threats | `https://rules.emergingthreats.net/` | IP lists, Suricata rules | Network-level threat indicators | None |
| TweetFeed.live | `https://tweetfeed.live/` | Security Twitter IOCs | Real-time community intel | None |
| CIRCL Passive DNS | `https://www.circl.lu/services/passive-dns/` | Historical DNS data | Domain resolution history | API Key |
| Censys | `https://search.censys.io/api` | Certificate/service data | Infrastructure reconnaissance | API Key |

### Priority 3: Enhanced Coverage (API Key Required)

| Source | Endpoint | Data Type | Value Add | Auth |
|--------|----------|-----------|-----------|------|
| ANY.RUN | `https://any.run/api/` | Sandbox reports | Public malware analysis | API Key |
| Triage (Hatching) | `https://tria.ge/api/` | Fast malware triage | Quick sample analysis | API Key |
| VulnCheck KEV | `https://vulncheck.com/api/` | Extended KEV data | Exploit metadata enrichment | API Key |
| SecurityTrails | `https://securitytrails.com/api/` | Historical DNS/WHOIS | Domain intelligence | API Key |
| InQuest Labs | `https://labs.inquest.net/api` | Malicious documents | Document-based threats | API Key |

### Priority 4: Nice to Have (Future Consideration)

| Source | Endpoint | Data Type | Value Add | Auth |
|--------|----------|-----------|-----------|------|
| Shodan Full API | `https://api.shodan.io/` | Historical scans, monitors | Deep infrastructure intel | Paid |
| BinaryEdge | `https://api.binaryedge.io/` | Internet-wide scanning | Shodan alternative | Paid |
| Joe Sandbox | `https://jbxcloud.joesecurity.org/api/` | Detailed behavioral analysis | Premium sandbox | Paid |
| OpenCTI | GraphQL API | STIX threat intel | Structured threat data | Self-host |
| MISP Instances | Various | Community-shared threats | Sector-specific intel | Varies |

---

## Rollout Plan

### Phase 1: Quick Wins (Week 1-2)

**Objective:** Add 6 simple text/JSON feeds with minimal development effort.

| Task | Source | Effort | Script Name |
|------|--------|--------|-------------|
| 1.1 | Tor Exit Nodes | 2 hours | `ingest-tor-exits.mjs` |
| 1.2 | Firehol Level 1 | 2 hours | `ingest-firehol.mjs` |
| 1.3 | OpenPhish | 2 hours | `ingest-openphish.mjs` |
| 1.4 | Maltrail | 3 hours | `ingest-maltrail.mjs` |
| 1.5 | C2-Tracker | 4 hours | `ingest-c2-tracker.mjs` |
| 1.6 | crt.sh | 4 hours | `ingest-crtsh.mjs` |

**Deliverables:**
- 6 new ingestion scripts
- Updated GitHub Actions workflow
- Database schema updates (if needed)
- Documentation updates

**Schedule:**
- Daily ingestion for all Phase 1 sources
- Add to `data-ingestion-new-sources.yml` workflow

---

### Phase 2: High-Value Additions (Week 3-4)

**Objective:** Integrate exploit and attack intelligence sources.

| Task | Source | Effort | Script Name | Dependencies |
|------|--------|--------|-------------|--------------|
| 2.1 | Exploit-DB | 6 hours | `ingest-exploitdb.mjs` | CVE correlation logic |
| 2.2 | Blocklist.de | 3 hours | `ingest-blocklist-de.mjs` | None |
| 2.3 | Emerging Threats | 4 hours | `ingest-emerging-threats.mjs` | None |
| 2.4 | TweetFeed.live | 4 hours | `ingest-tweetfeed.mjs` | IOC parsing logic |

**Database Changes:**
- Add `exploit_availability` field to `vulnerabilities` table
- Add `source_feed` tracking for IOC deduplication

**Deliverables:**
- 4 new ingestion scripts
- Exploit-to-CVE correlation
- Enhanced IOC source tracking

---

### Phase 3: DNS & Certificate Intelligence (Week 5-6)

**Objective:** Add domain and certificate monitoring capabilities.

| Task | Source | Effort | Script Name | Dependencies |
|------|--------|--------|-------------|--------------|
| 3.1 | CIRCL Passive DNS | 6 hours | `enrich-circl-pdns.mjs` | API key acquisition |
| 3.2 | Censys Certificates | 8 hours | `ingest-censys.mjs` | API key acquisition |
| 3.3 | Certificate Alerting | 6 hours | `monitor-certificates.mjs` | Org profile domains |

**Database Changes:**
- New `dns_records` table for passive DNS history
- New `certificates` table for cert transparency data
- Add `monitored_domains` to org profile

**Deliverables:**
- Domain monitoring capability
- Certificate transparency alerts
- Phishing domain early warning

---

### Phase 4: Enhanced Sandbox Integration (Week 7-8)

**Objective:** Expand malware analysis capabilities.

| Task | Source | Effort | Script Name | Dependencies |
|------|--------|--------|-------------|--------------|
| 4.1 | ANY.RUN Public | 6 hours | `ingest-anyrun.mjs` | API key |
| 4.2 | Triage | 6 hours | `ingest-triage.mjs` | API key |
| 4.3 | Sandbox Correlation | 8 hours | `correlate-sandbox.mjs` | Tasks 4.1, 4.2 |

**Database Changes:**
- New `sandbox_reports` table
- Link sandbox reports to IOCs and malware families

**Deliverables:**
- Multiple sandbox source integration
- Behavioral indicator extraction
- Malware family correlation

---

### Phase 5: Vulnerability Enrichment (Week 9-10)

**Objective:** Enhance vulnerability intelligence with exploit context.

| Task | Source | Effort | Script Name | Dependencies |
|------|--------|--------|-------------|--------------|
| 5.1 | VulnCheck KEV | 6 hours | `enrich-vulncheck.mjs` | API key |
| 5.2 | Exploit Maturity Scoring | 8 hours | `calculate-exploit-maturity.mjs` | Phase 2 complete |
| 5.3 | Vulnerability Prioritization | 6 hours | `prioritize-vulnerabilities.mjs` | Tasks 5.1, 5.2 |

**Database Changes:**
- Add `exploit_maturity` enum to vulnerabilities
- Add `prioritization_score` calculation

**Deliverables:**
- Exploit maturity tracking
- Risk-based vulnerability prioritization
- Enhanced KEV context

---

### Phase 6: Future Considerations (Backlog)

These items are tracked for future implementation based on user feedback and resource availability.

| Source | Value | Complexity | Blocker |
|--------|-------|------------|---------|
| Shodan Full API | Deep infrastructure intel | Medium | Cost (paid tier) |
| BinaryEdge | Alternative scanning data | Medium | Cost (paid tier) |
| Joe Sandbox | Premium analysis | Low | Cost (paid tier) |
| OpenCTI | STIX platform | High | Self-hosting requirement |
| SecurityTrails | Domain intelligence | Medium | Cost (paid tier) |
| MISP Feeds | Sector-specific intel | High | Instance management |

---

## Integration Architecture

### Ingestion Flow

```
External API/Feed
       │
       ▼
┌─────────────────┐
│ Ingestion Script │  (scripts/ingest-*.mjs)
│  - Fetch data    │
│  - Transform     │
│  - Deduplicate   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│  - Upsert data  │
│  - Log sync     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post-Processing │
│  - Correlations  │
│  - Trend calc    │
│  - Enrichment    │
└─────────────────┘
```

### Scheduling Tiers

| Tier | Frequency | Sources | Rationale |
|------|-----------|---------|-----------|
| Tier 1 | Every 6 hours | Ransomware, KEV, MITRE, Core IOCs | Frequently updated, critical data |
| Tier 2 | Daily (2 AM UTC) | OTX, MalwareBazaar, Enrichment | Community intel, rate-limited APIs |
| Tier 3 | Weekly | HIBP, Low-change sources | Infrequently updated data |

### Error Handling

All ingestion scripts implement:
- Retry logic with exponential backoff
- Rate limit detection and throttling
- Sync logging to `sync_log` table
- Failure alerting via GitHub Actions

---

## Metrics & Monitoring

### Current Coverage Statistics

| Category | Sources | Records (Approx) |
|----------|---------|------------------|
| Ransomware Incidents | 3 | 1,600+ |
| IOCs | 6 | 50,000+ |
| Vulnerabilities (CVE) | 2 | 10,000+ |
| Known Exploited (KEV) | 1 | 1,100+ |
| Threat Actors | 3 | 500+ |
| ATT&CK Techniques | 1 | 700+ |
| Malware Samples | 1 | 5,000+ |
| Data Breaches | 1 | 700+ |

### Success Criteria for New Sources

Each new source integration should:
- [ ] Ingest successfully for 7 consecutive days
- [ ] Produce no duplicate records
- [ ] Complete within timeout limits
- [ ] Log all sync attempts
- [ ] Handle API errors gracefully

---

## Appendix: Environment Variables

### Current Required Keys

```bash
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=

# Optional Enrichment
VITE_GROQ_API_KEY=
VIRUSTOTAL_API_KEY=
HYBRIDANALYSIS_API_KEY=
OTX_API_KEY=
GREYNOISE_API_KEY=
PHISHTANK_API_KEY=
```

### New Keys Required (By Phase)

| Phase | Source | Variable |
|-------|--------|----------|
| Phase 3 | CIRCL | `CIRCL_API_KEY` |
| Phase 3 | Censys | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| Phase 4 | ANY.RUN | `ANYRUN_API_KEY` |
| Phase 4 | Triage | `TRIAGE_API_KEY` |
| Phase 5 | VulnCheck | `VULNCHECK_API_KEY` |

---

## Source Quality Assessment (January 2026 Research)

Independent research was conducted to evaluate proposed sources and identify gaps.

### Priority 1 Sources - Evaluation

| Source | Verdict | Assessment |
|--------|---------|------------|
| **crt.sh** | ✅ Excellent | Industry-standard CT log search. Zero errors in reliability studies vs other monitors. Critical for phishing domain detection. |
| **Tor Exit Nodes** | ✅ Good | Simple IP list from official Tor Project, useful for anonymization tracking. |
| **Firehol Level 1** | ✅ Good | Well-maintained aggregated blocklist, curated from multiple sources. |
| **OpenPhish** | ⚠️ Acceptable | Supplements PhishTank but updates less frequently than premium feeds. |
| **C2-Tracker** | ✅ Excellent | Tracks 2.7k+ confirmed Cobalt Strike servers, actively maintained daily via Shodan. |
| **Maltrail** | ✅ Good | Solid supplemental IOC coverage from stamparm's research. |

### Priority 2 Sources - Evaluation

| Source | Verdict | Assessment |
|--------|---------|------------|
| **Exploit-DB** | ✅ Critical | Must-have for CVE-to-exploit correlation. Industry standard. |
| **Blocklist.de** | ✅ Good | Complements existing IP feeds with brute-force attacker data. |
| **Emerging Threats** | ✅ Good | Suricata rules add detection context beyond IOCs. |
| **TweetFeed.live** | ⚠️ Fragile | Relies on X/Twitter API - may break with policy changes. Consider lower priority. |
| **CIRCL Passive DNS** | ✅ Excellent | High-quality historical DNS data from Luxembourg CERT. |
| **Censys** | ✅ Excellent | Better certificate/service data than crt.sh for some use cases. |

### Priority 3-4 Sources - Evaluation

| Source | Verdict | Assessment |
|--------|---------|------------|
| **VulnCheck KEV** | ✅ Critical | Catalog is 173% larger than CISA KEV and 27 days faster at detecting exploited CVEs. Free community tier available. |
| **ANY.RUN** | ✅ Good | Public sandbox reports provide behavioral analysis context. |
| **Triage (Hatching)** | ✅ Good | Fast automated triage complements ANY.RUN. |
| **SecurityTrails** | ⚠️ Costly | Value vs cost questionable when CIRCL provides similar DNS history. |
| **InQuest Labs** | ✅ Good | Unique focus on document-based threats (Office, PDF). |

### Sources NOT Recommended

| Source | Reason |
|--------|--------|
| **TweetFeed.live** | X/Twitter API reliability concerns after policy changes. Deprioritize. |
| **Paid Shodan/BinaryEdge** | Cost vs. value questionable when free InternetDB exists for basic enrichment. |

---

## Identified Gaps - Missing Sources

Research identified several high-value sources not in the original proposal:

### Critical Priority (Add to Phase 1)

#### EPSS - Exploit Prediction Scoring System
- **URL**: `https://api.first.org/data/v1/epss`
- **Data Type**: Probability scores for CVE exploitation within 30 days
- **Why Critical**: CVSS alone is inadequate - only 2.3% of CVSS 7+ CVEs are actually exploited. EPSS uses ML to predict real-world exploitation likelihood.
- **Auth**: None (completely free from FIRST.org)
- **Effort**: 3 hours
- **Script**: `ingest-epss.mjs`
- **Integration**: Add `epss_score` and `epss_percentile` columns to vulnerabilities table

#### GitHub Advisory Database (GHSA)
- **URL**: `https://api.github.com/advisories`
- **Data Type**: 305,000+ security advisories for open-source packages
- **Why Critical**: Essential for supply chain security. Covers npm, PyPI, Maven, Go, Rust ecosystems.
- **Auth**: None (public API without authentication)
- **Effort**: 4 hours
- **Script**: `ingest-ghsa.mjs`
- **Integration**: New `advisories` table, cross-reference with NVD CVEs

### High Priority (Add to Phase 2)

#### Pulsedive
- **URL**: `https://pulsedive.com/api/`
- **Data Type**: Community threat intelligence with risk scoring
- **Why Valuable**: Aggregates OSINT feeds with automated risk assessment
- **Auth**: Free tier available
- **Effort**: 4 hours
- **Script**: `ingest-pulsedive.mjs`

#### Nuclei Templates (Detection Signatures)
- **URL**: `https://github.com/projectdiscovery/nuclei-templates`
- **Data Type**: Vulnerability detection templates mapped to CVEs
- **Why Valuable**: Shows which CVEs have automated detection/exploitation possible
- **Auth**: None
- **Effort**: 5 hours
- **Script**: `ingest-nuclei-templates.mjs`

### Medium Priority (Phase 3+)

#### Dark Web / Telegram Monitoring
- **Resources**: DeepDarkCTI (github.com/fastfire/deepdarkCTI), Telegram-OSINT
- **Data Type**: Leak announcements, threat actor chatter, credential dumps
- **Why Valuable**: 50,000+ cybercrime channels on Telegram. Early warning for breaches.
- **Challenge**: Not a simple feed - requires careful implementation
- **Approach**: Start with curated leak monitoring channels, expand carefully
- **Effort**: 12+ hours
- **Script**: `monitor-darkweb.mjs`

#### UMD Cyber Events Database (GDELT-Powered)
- **URL**: `https://cissm.umd.edu/cyber-events-database`
- **Data Type**: Structured cyber attack events with nation-state attribution
- **Why Critical**: 25+ fields including threat actor type (nation-state/criminal/hacktivist), target industry, motive, severity. Covers 2014-present with monthly updates.
- **Auth**: Registration required (free)
- **Effort**: 6-8 hours
- **Script**: `ingest-umd-cyber-events.mjs`
- **Integration**: New `cyber_events` table, link to existing threat actors

#### GDELT Project (Real-Time News)
- **URL**: `https://api.gdeltproject.org/api/v2/doc/doc`
- **Data Type**: Global news monitoring for cyber-related coverage
- **Why Valuable**: Real-time monitoring of 100+ languages, 15-minute updates. Early warning for emerging threats, geopolitical correlation.
- **Auth**: None (free)
- **Effort**: 12-16 hours
- **Script**: `monitor-gdelt-cyber.mjs`
- **Integration**: News alerts, trend correlation with existing incidents

#### IntelOwl Integration
- **URL**: `https://github.com/intelowlproject/IntelOwl`
- **Data Type**: Aggregated enrichment from 100+ analyzers
- **Why Valuable**: Single API to query VirusTotal, AbuseIPDB, Shodan, etc.
- **Auth**: Self-hosted or use public demo
- **Approach**: Use as enrichment backend rather than primary data source
- **Effort**: 8 hours (setup + integration)

#### ID Ransomware Indicators
- **Why Valuable**: Ransomware family identification enhances incident classification
- **Challenge**: No public API - would need partnership or careful scraping
- **Status**: Research needed

---

## Updated Rollout Plan

### Revised Phase 1: Quick Wins + Critical Gaps

| Task | Source | Effort | Script Name | Priority |
|------|--------|--------|-------------|----------|
| 1.1 | **EPSS** | 3 hours | `ingest-epss.mjs` | **CRITICAL** |
| 1.2 | **GitHub GHSA** | 4 hours | `ingest-ghsa.mjs` | **CRITICAL** |
| 1.3 | Tor Exit Nodes | 2 hours | `ingest-tor-exits.mjs` | High |
| 1.4 | Firehol Level 1 | 2 hours | `ingest-firehol.mjs` | High |
| 1.5 | C2-Tracker | 4 hours | `ingest-c2-tracker.mjs` | High |
| 1.6 | crt.sh | 4 hours | `ingest-crtsh.mjs` | High |
| 1.7 | OpenPhish | 2 hours | `ingest-openphish.mjs` | Medium |
| 1.8 | Maltrail | 3 hours | `ingest-maltrail.mjs` | Medium |

**New Database Changes for Phase 1:**
- Add `epss_score` FLOAT and `epss_percentile` FLOAT to `vulnerabilities` table
- Create `advisories` table for GitHub GHSA data
- Add `advisory_ids` array to link CVEs to GHSA advisories

### Revised Phase 2: High-Value Additions

| Task | Source | Effort | Script Name | Priority |
|------|--------|--------|-------------|----------|
| 2.1 | Exploit-DB | 6 hours | `ingest-exploitdb.mjs` | Critical |
| 2.2 | **Pulsedive** | 4 hours | `ingest-pulsedive.mjs` | **NEW** |
| 2.3 | Blocklist.de | 3 hours | `ingest-blocklist-de.mjs` | High |
| 2.4 | Emerging Threats | 4 hours | `ingest-emerging-threats.mjs` | High |
| 2.5 | **Nuclei Templates** | 5 hours | `ingest-nuclei-templates.mjs` | **NEW** |

**Removed from Phase 2:** TweetFeed.live (API reliability concerns)

### Revised Phase 5: Vulnerability Prioritization

| Task | Source | Effort | Script Name | Notes |
|------|--------|--------|-------------|-------|
| 5.1 | VulnCheck KEV | 6 hours | `enrich-vulncheck.mjs` | Supplements CISA KEV |
| 5.2 | **EPSS-based Scoring** | 4 hours | `calculate-epss-priority.mjs` | **Replace** manual maturity scoring |
| 5.3 | Vulnerability Prioritization | 6 hours | `prioritize-vulnerabilities.mjs` | Combine EPSS + KEV + exploit availability |

**Key Change:** Use EPSS as primary prioritization signal instead of manual exploit maturity scoring.

---

## New Environment Variables Required

| Phase | Source | Variable |
|-------|--------|----------|
| Phase 1 | EPSS | None required |
| Phase 1 | GitHub GHSA | None required (or `GITHUB_TOKEN` for higher rate limits) |
| Phase 2 | Pulsedive | `PULSEDIVE_API_KEY` (free tier) |
| Phase 3 | CIRCL | `CIRCL_API_KEY` |
| Phase 3 | Censys | `CENSYS_API_ID`, `CENSYS_API_SECRET` |
| Phase 4 | ANY.RUN | `ANYRUN_API_KEY` |
| Phase 4 | Triage | `TRIAGE_API_KEY` |
| Phase 5 | VulnCheck | `VULNCHECK_API_KEY` |

---

## Research Sources

This assessment was based on research from:
- [FIRST.org EPSS](https://www.first.org/epss/) - Exploit Prediction Scoring System
- [VulnCheck KEV Analysis](https://www.vulncheck.com/blog/comparing-kevs-jupyter) - KEV comparison research
- [GitHub Advisory Database](https://github.com/advisories) - GHSA documentation
- [C2-Tracker Repository](https://github.com/montysecurity/C2-Tracker) - C2 infrastructure tracking
- [IntelOwl Project](https://github.com/intelowlproject/IntelOwl) - OSINT aggregation
- [DeepDarkCTI](https://github.com/fastfire/deepdarkCTI) - Dark web intelligence
- [Awesome Threat Intelligence](https://github.com/hslatman/awesome-threat-intelligence) - Curated TI resources
- [Anomali Open Source Feeds](https://www.anomali.com/blog/open-source-threat-intelligence-feeds) - Feed recommendations

---

*Last Updated: January 2026*
*Document Version: 1.1*
*Research Update: January 15, 2026*
