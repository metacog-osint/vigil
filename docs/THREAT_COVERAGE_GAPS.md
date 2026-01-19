# Vigil Threat Coverage Gap Analysis

This document identifies cybersecurity domains and threat categories not yet captured in Vigil, along with potential data sources and prioritization recommendations.

*Created: January 15, 2026*
*Updated: January 19, 2026*

---

## Current Coverage Summary

Vigil currently provides intelligence across these domains:

| Domain | Coverage Level | Primary Sources |
|--------|---------------|-----------------|
| Ransomware Intelligence | **Strong** | RansomLook, Ransomware.live, Ransomwatch |
| Indicators of Compromise | **Strong** | ThreatFox, URLhaus, Feodo, Spamhaus, OTX, PhishTank |
| Vulnerability Intelligence | **Strong** | NVD, CISA KEV, CISA Alerts |
| Threat Actor Profiles | **Good** | MITRE ATT&CK, Malpedia, MISP Galaxy |
| Malware Intelligence | **Moderate** | MalwareBazaar |
| Breach Data | **Basic** | Have I Been Pwned |
| Enrichment Services | **Good** | GreyNoise, Shodan InternetDB, VirusTotal, Hybrid Analysis |

---

## Identified Coverage Gaps

### 1. Supply Chain & Software Composition Security

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| SBOM Analysis | No software bill of materials tracking | None | Dependency-Track, OWASP Dependency-Check |
| Package Tampering | No tracking of compromised npm/PyPI/Maven packages | None | Socket.dev, Snyk Vulnerability DB |
| Build Pipeline Attacks | No CI/CD compromise intelligence | None | - |
| Open Source Advisories | Limited OSS vulnerability tracking | **Implemented** | **GitHub GHSA** ✅ |

**Assessment:** GitHub GHSA is now integrated (`ingest-ghsa.mjs`), addressing open source advisories. SBOM analysis and dependency graphs remain gaps for full software supply chain visibility.

**Priority:** HIGH - Supply chain attacks are increasing (SolarWinds, Log4j, XZ Utils)

---

### 2. Cloud-Specific Threats

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Cloud Misconfigurations | Exposed S3 buckets, Azure blobs, GCS | None | GrayhatWarfare, Bucket Finder |
| Cloud Provider Incidents | AWS/Azure/GCP service disruptions | None | Cloud provider status APIs |
| IAM & Identity Threats | Cloud identity attack patterns | None | - |
| Container Security | Kubernetes, Docker vulnerabilities | Partial (CVEs) | Trivy DB, Anchore |
| Serverless Risks | Lambda/Functions attack patterns | None | - |

**Assessment:** No coverage of cloud-native attack patterns. Users in cloud-heavy environments lack context for cloud-specific threats.

**Priority:** MEDIUM - Important but requires significant architecture decisions

---

### 3. Industrial Control Systems (ICS/OT)

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| ICS Advisories | SCADA/PLC vulnerability alerts | None | **CISA ICS-CERT Advisories** |
| OT Protocol Threats | Modbus, DNP3, BACnet, OPC threats | None | Dragos (paid), Claroty (paid) |
| Critical Infrastructure | Sector-specific OT context | Limited | CISA ICS advisories |
| ICS Malware | Industroyer, Triton, PIPEDREAM | Partial | Malpedia |

**Assessment:** Significant gap for users in energy, manufacturing, water, and utilities sectors. CISA ICS-CERT advisories are freely available and should be integrated.

**Priority:** HIGH for industrial sector users

**Easy Win:** CISA ICS-CERT RSS feed at `https://www.cisa.gov/news-events/cybersecurity-advisories?f%5B0%5D=advisory_type%3A95`

---

### 4. Mobile & IoT Threats

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Android Malware | Mobile malware families, APKs | None | Koodous, AndroZoo, MalwareBazaar (partial) |
| iOS Threats | iPhone/iPad security issues | None | Apple Security Updates |
| IoT Botnets | Mirai variants, IoT compromises | Partial (Feodo) | Shadowserver, BadPackets |
| Firmware Vulnerabilities | Embedded device CVEs | Partial (NVD) | - |

**Assessment:** Mobile threats are underrepresented. IoT botnets have limited coverage beyond Feodo tracker.

**Priority:** MEDIUM - Growing attack surface but limited free data sources

---

### 5. Business Email Compromise (BEC) & Fraud

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| BEC Campaigns | CEO fraud, impersonation attacks | None | - |
| Wire Fraud Indicators | Financial fraud patterns | None | - |
| Typosquatting Domains | Look-alike domain registration | Partial | DNSTwist feeds, crt.sh (planned) |
| Invoice Fraud | Vendor impersonation | None | - |

**Assessment:** BEC causes more financial loss than ransomware globally but has no dedicated threat intelligence feeds. This is largely a detection/behavioral problem rather than feed-based.

**Priority:** MEDIUM - High impact but limited public data sources

---

### 6. Underground Economy / Dark Web

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Initial Access Brokers (IABs) | Access-for-sale marketplace tracking | None | Manual monitoring, commercial feeds |
| Credential Markets | Stolen credential pricing/availability | None | Hudson Rock (partial free) |
| Exploit Sales | Zero-day market activity | None | - |
| Ransomware Affiliates | Affiliate program recruitment | None | - |
| Carding Forums | Payment card fraud | None | - |
| Leaked Databases | Database dumps, combolists | Partial (HIBP) | DeHashed (paid), LeakCheck |

**Assessment:** We track ransomware victims but not the upstream economy. Initial Access Brokers often sell access weeks before ransomware deployment - this is valuable early warning intelligence.

**Priority:** HIGH - But requires careful implementation (legal, ethical considerations)

**Potential Approach:** Monitor curated Telegram channels, integrate with DeepDarkCTI project

---

### 7. Geopolitical & Campaign Context

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Named Campaigns | SolarWinds, Hafnium, Salt Typhoon tracking | None | **MITRE ATT&CK Campaigns** |
| Geopolitical Correlation | Map threats to world events | None | **GDELT Project** (research needed) |
| Government Attribution | Official nation-state attributions | None | DOJ indictments, OFAC sanctions |
| Conflict-Driven Threats | Ukraine, Taiwan, Middle East cyber ops | None | CyberPeace Institute |

**Assessment:** Users cannot easily understand "why now" for threat activity spikes. No correlation between geopolitical events and cyber campaigns.

**Priority:** MEDIUM-HIGH - Provides crucial context for threat analysis

**Easy Win:** MITRE ATT&CK Campaigns data is available in the same feed we already ingest

---

### 8. AI/ML Security Threats

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Adversarial ML | Model poisoning, evasion attacks | None | **MITRE ATLAS** |
| AI-Generated Threats | Deepfakes, synthetic media | None | - |
| LLM Vulnerabilities | Prompt injection, jailbreaks | None | OWASP LLM Top 10 |
| AI Supply Chain | Malicious models on HuggingFace | None | - |

**Assessment:** Emerging threat category with limited structured data sources. MITRE ATLAS provides a framework similar to ATT&CK for AI threats.

**Priority:** LOW (current) → HIGH (future) - Limited feeds now but rapidly evolving

---

### 9. DDoS & Availability Threats

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| DDoS Campaigns | Volumetric attack tracking | None | NETSCOUT (paid), Cloudflare Radar |
| Booter/Stresser Services | DDoS-for-hire intelligence | None | - |
| BGP Hijacks | Routing security incidents | None | BGPStream, RIPE RIS |
| DNS Attacks | DNS amplification, hijacking | None | - |

**Assessment:** No visibility into availability threats. BGPStream provides free BGP hijack data.

**Priority:** LOW-MEDIUM - Niche use case but BGPStream is easy to integrate

---

### 10. Cryptocurrency & Financial Threats

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Crypto Exchange Hacks | Exchange breaches, wallet drains | None | Rekt.news, CryptoScamDB |
| Ransomware Payments | Payment flow tracking | None | **Ransomwhere** |
| DeFi Exploits | Smart contract vulnerabilities | None | - |
| Crypto Drainers | Wallet draining malware | Partial (IOCs) | - |

**Assessment:** Ransomwhere.com provides free ransomware payment tracking - directly complements our ransomware incident data.

**Priority:** MEDIUM

**Easy Win:** Ransomwhere API at `https://api.ransomwhe.re/`

---

### 11. Insider Threats

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Behavioral Indicators | Insider threat warning signs | None | CISA Insider Threat resources |
| Data Exfiltration Patterns | DLP-type intelligence | None | - |
| Privileged Access Abuse | Admin account compromise patterns | None | - |

**Assessment:** Insider threats are largely behavioral analytics problems, not feed-based intelligence. Limited applicability for a threat intel platform.

**Priority:** LOW - Not well-suited for feed-based approach

---

### 12. Physical-Cyber Convergence

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| Physical Security Incidents | Facility breaches, badge cloning | None | - |
| Drone/Counter-UAS | Drone threat intelligence | None | - |
| GPS Spoofing | Navigation system attacks | None | - |

**Assessment:** Physical security convergence is outside the scope of traditional CTI. No clear data sources.

**Priority:** LOW - Out of scope for current platform focus

---

### 13. Disinformation & Influence Operations

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| State-Sponsored Disinfo | Nation-state influence campaigns | None | **GDELT Project**, EUvsDisinfo |
| Coordinated Inauthentic Behavior | Bot networks, fake accounts | None | Stanford Internet Observatory |
| Election Security | Election-related cyber threats | None | CISA Election Security |

**Assessment:** Disinformation is increasingly intertwined with cyber operations. GDELT Project may provide relevant data (research needed).

**Priority:** MEDIUM - Growing relevance but different skill set required

---

### 14. Regulatory & Compliance Context

| Gap | Description | Current State | Potential Sources |
|-----|-------------|---------------|-------------------|
| GDPR Breach Notifications | EU data protection violations | None | GDPR Enforcement Tracker |
| SEC Cyber Disclosures | Public company breach filings | None | SEC EDGAR |
| Regulatory Actions | FTC, state AG enforcement | None | - |

**Assessment:** Compliance teams need regulatory context alongside threat intelligence. Some structured data sources exist.

**Priority:** LOW-MEDIUM - Niche but valuable for enterprise users

---

## Prioritized Remediation Roadmap

### Tier 1: Easy Wins (Free, Simple Integration)

| Source | Fills Gap | Effort | Script |
|--------|-----------|--------|--------|
| **CISA ICS-CERT** | ICS/OT Advisories | 3 hours | `ingest-ics-cert.mjs` |
| **Ransomwhere** | Crypto/Ransomware Payments | 2 hours | `ingest-ransomwhere.mjs` |
| **MITRE ATT&CK Campaigns** | Named Campaign Tracking | 2 hours | Update `ingest-mitre.mjs` |
| **BGPStream** | Routing/BGP Hijacks | 4 hours | `ingest-bgpstream.mjs` |

### Tier 2: Medium Effort (May Require API Keys)

| Source | Fills Gap | Effort | Notes |
|--------|-----------|--------|-------|
| **MITRE ATLAS** | AI/ML Threats | 4 hours | Similar to ATT&CK integration |
| **Shadowserver** | IoT Botnets | 4 hours | Requires registration |
| **GDELT Project** | Geopolitical Context | 8 hours | Research needed |

### Tier 3: Complex (Requires Architecture Decisions)

| Source | Fills Gap | Effort | Notes |
|--------|-----------|--------|-------|
| Dark Web Monitoring | Underground Economy | 20+ hours | Legal/ethical considerations |
| Cloud Threat Feeds | Cloud Security | 16+ hours | Multi-provider complexity |
| Supply Chain (beyond GHSA) | Software Composition | 20+ hours | Requires SBOM infrastructure |

---

## Sources Without Known Data Streams

The following gaps have no identified free/public data sources:

1. **BEC Campaign Tracking** - No structured feeds exist
2. **Insider Threat Indicators** - Behavioral, not feed-based
3. **Cloud IAM Threats** - No public threat intel feeds
4. **AI-Generated Threat Content** - Emerging, no feeds yet
5. **Physical-Cyber Convergence** - Out of scope for CTI
6. **Booter/Stresser Intelligence** - Mostly law enforcement data
7. **Zero-Day Market Activity** - Underground, no public feeds

**Potential Solution:** GDELT Project and UMD Cyber Events Database - see detailed analysis below.

---

## GDELT Project Analysis

### Overview

The [GDELT Project](https://www.gdeltproject.org/) (Global Database of Events, Language, and Tone) is a massive open data platform supported by Google Jigsaw that monitors broadcast, print, and web news from nearly every country in 100+ languages. It identifies people, locations, organizations, themes, emotions, and events driving global society, updating every 15 minutes.

**Key Stats:**
- Historical archives from January 1, 1979 to present
- 100+ languages monitored
- Updates every 15 minutes
- 100% free and open
- Available via raw files, Google BigQuery, or APIs

### How GDELT Could Fill Vigil's Gaps

| Gap | GDELT Capability | Integration Approach |
|-----|------------------|---------------------|
| **Geopolitical Context** | CAMEO event taxonomy tracks nation-state actions, conflicts, cooperation | Correlate cyber events with geopolitical tensions |
| **Named Campaigns** | News coverage of major cyber incidents (SolarWinds, Salt Typhoon) | Track media mentions of known campaigns |
| **Nation-State Attribution** | Actor codes identify government/military entities by country | Map threat actors to nation-state coverage |
| **Disinformation Tracking** | Tone analysis, theme identification | Monitor information operations discourse |
| **Emerging Threats** | Real-time global news monitoring | Early warning for new threat types |

### GDELT Event Classification (CAMEO)

GDELT uses the CAMEO (Conflict and Mediation Event Observations) taxonomy:
- **300+ event types** in hierarchical structure
- **QuadClass**: Verbal Cooperation, Material Cooperation, Verbal Conflict, Material Conflict
- **Goldstein Scale**: -10 to +10 rating of event impact on stability
- **Actor Codes**: Nation-state + agent codes (e.g., "RUSMIL" = Russia Military)

### GDELT APIs Available

| API | Purpose | Use Case for Vigil |
|-----|---------|-------------------|
| **DOC 2.0** | Full-text search across 65 languages | Search for cyber threat mentions |
| **GEO 2.0** | Geographic visualization | Map threat activity by region |
| **Context 2.0** | Sentence-level search with context | Extract specific threat intelligence |
| **TV 2.0** | Television news monitoring | Track broadcast coverage of incidents |

### Cyber-Specific GDELT Usage

GDELT has been used for "mapping cyber" - plotting worldwide news coverage discussing:
- Cyber warfare
- Cyber attacks
- Data breaches
- Computer/online security

**Filtering approach:** Requires "cyber" mentioned at least twice per article to reduce false positives.

**Limitation:** Higher false positive rate than structured threat feeds; requires NLP post-processing.

---

## UMD Cyber Events Database (GDELT-Powered)

### Overview

The University of Maryland's [Cyber Events Database](https://cissm.umd.edu/cyber-events-database) provides structured, open-source information on cyber-attacks from 2014 to present. As of January 2025, it leverages GDELT for automated candidate event identification.

**This is essentially what Vigil needs for geopolitical cyber context.**

### Data Fields Available (25+ fields)

| Field Category | Fields |
|---------------|--------|
| **Event** | ID, dates, event type, subtype |
| **Threat Actor** | Name, type (nation-state/criminal/hacktivist/terrorist/hobbyist), country |
| **Target** | Organization, industry (NAICS codes), country |
| **Attack Details** | Motive, severity metrics, disruptive vs exploitative |
| **Context** | Geographic indicators, organizational membership |

### Threat Actor Categories Tracked

- **Nation-States**: Russia GRU Sandworm, North Korea 3rd Technical Surveillance Bureau, etc.
- **Criminal Organizations**: cl0p, LockBit, etc.
- **Hacktivists**: Anonymous, etc.
- **Terrorists**
- **Hobbyists**

### Access & Integration

| Aspect | Details |
|--------|---------|
| **Time Period** | 2014 - present (monthly updates) |
| **Current Data** | Through December 31, 2025 |
| **Access** | Registration required via Google Form |
| **Format** | Structured data download (CSV/Excel) |
| **API** | No public API - download only |
| **Contact** | Dr. Charles Harry (charry@umd.edu) |

### Recommended Integration Approach

1. **Register for access** to UMD Cyber Events Database
2. **Periodic bulk import** (monthly) of structured cyber events
3. **Correlate with existing data**:
   - Link nation-state actors to existing threat actor profiles
   - Map events to ransomware incidents by date/actor
   - Enrich IOCs with geopolitical context
4. **Optional**: Direct GDELT integration for real-time news monitoring

### Potential New Tables

```sql
-- Geopolitical cyber events from UMD/GDELT
CREATE TABLE cyber_events (
  id UUID PRIMARY KEY,
  event_date DATE,
  event_type TEXT, -- disruptive, exploitative, mixed
  event_subtype TEXT,
  threat_actor_name TEXT,
  threat_actor_type TEXT, -- nation_state, criminal, hacktivist, terrorist, hobbyist
  threat_actor_country TEXT,
  target_organization TEXT,
  target_industry TEXT,
  target_industry_naics TEXT,
  target_country TEXT,
  motive TEXT,
  severity_score INTEGER,
  source_url TEXT,
  gdelt_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link to existing threat actors
ALTER TABLE threat_actors ADD COLUMN umd_actor_id TEXT;
ALTER TABLE threat_actors ADD COLUMN nation_state_attribution TEXT;
```

---

## GDELT Integration Recommendation

### Phase 1: UMD Cyber Events Database (Easy)
- **Effort**: 6-8 hours
- **Script**: `ingest-umd-cyber-events.mjs`
- **Approach**: Monthly bulk import of structured data
- **Value**: Immediate geopolitical context for cyber events

### Phase 2: Direct GDELT DOC API (Medium)
- **Effort**: 12-16 hours
- **Script**: `monitor-gdelt-cyber.mjs`
- **Approach**: Daily queries for cyber-related news
- **Keywords**: "ransomware", "data breach", "APT", "nation-state hack", etc.
- **Value**: Real-time news monitoring, early warning

### Phase 3: GDELT Event Database (Advanced)
- **Effort**: 20+ hours
- **Approach**: BigQuery integration for full event analysis
- **Value**: Deep geopolitical correlation, trend analysis

---

## Next Steps

### Immediate (Phase 1 Integration)
1. [x] Research GDELT Project applicability - **COMPLETE** (highly relevant)
2. [ ] Register for UMD Cyber Events Database access
3. [ ] Integrate CISA ICS-CERT advisories (easy win, 3 hours)
4. [ ] Add Ransomwhere payment tracking (easy win, 2 hours)
5. [x] Add EPSS scoring to vulnerabilities - **COMPLETE** (`ingest-epss.mjs`)
6. [x] Add GitHub GHSA advisories - **COMPLETE** (`ingest-ghsa.mjs`)

### Short-Term (Phase 2)
7. [ ] Implement UMD Cyber Events Database ingestion (6-8 hours)
8. [ ] Extract ATT&CK Campaigns from existing MITRE feed (2 hours)
9. [ ] Implement GDELT DOC API monitoring for cyber news (12-16 hours)

### Medium-Term (Phase 3+)
10. [ ] Consider MITRE ATLAS for AI threat framework
11. [ ] Evaluate dark web monitoring approach (Telegram channels)
12. [ ] Explore GDELT BigQuery for deep geopolitical analysis

---

## Summary: GDELT Value Proposition

GDELT and the UMD Cyber Events Database together address several critical gaps:

| Gap Category | Solution | Priority |
|--------------|----------|----------|
| Geopolitical Context | UMD Cyber Events + GDELT | **HIGH** |
| Nation-State Attribution | UMD actor tracking | **HIGH** |
| Named Campaign Tracking | GDELT news monitoring | **MEDIUM** |
| Disinformation/Influence Ops | GDELT tone analysis | **MEDIUM** |
| Early Warning | GDELT real-time news | **MEDIUM** |

**Recommendation:** Prioritize UMD Cyber Events Database integration as the structured data provides immediate value with lower implementation effort than raw GDELT integration.

---

---

## Related Documentation

- **[ALERTING.md](./ALERTING.md)** - Real-time alerting system
- **[PRICING_ANALYSIS.md](./PRICING_ANALYSIS.md)** - Infrastructure cost breakdown and projections
- **[../DATA_SOURCES.md](../DATA_SOURCES.md)** - Current and proposed data source inventory

---

## Appendix: Beating Security News Outlets

### The Challenge

Stakeholder feedback requested Vigil notify users of events **before** security news outlets like Bleeping Computer report on them.

### Assessment

| Event Category | Can Vigil Win? | Why |
|----------------|----------------|-----|
| Ransomware leak posts | **YES (95%)** | Direct feed access vs journalist writing |
| CISA KEV additions | **YES (95%)** | Programmatic API vs article |
| New CVE publications | **YES (90%)** | Direct NVD API access |
| IOC publications | **YES (90%)** | Automated threat feeds |
| Exclusive scoops | **NO (0%)** | Journalism, human sources |
| Vendor breach announcements | **UNLIKELY (30%)** | Need GDELT news monitoring |

### Requirements to Achieve This

1. **Faster ingestion** - Move from 6-hour to 30-minute cycles for critical feeds
2. **Real-time alerting** - Push notifications, email, webhooks
3. **Smart filtering** - Alert only on relevant events (org profile match)
4. **GDELT integration** - Catch news before articles are written

See [ALERTING.md](./ALERTING.md) for alerting implementation details.

---

*Document Version: 1.3*
*Last Updated: January 19, 2026*
*GDELT Research: Complete*
*EPSS Integration: Complete*
*GHSA Integration: Complete*
