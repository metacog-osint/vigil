# Vigil Threat Coverage Gap Analysis

> **Not archived, but dated.** Written January 2026; still the best structured
> list of what Vigil does not cover, and most of it stands. Four things have
> changed since, and the assessments below do not know about them:
>
> - **CISA ICS advisories are now ingested** (`cisa-ics` → `ics_advisories`),
>   which §3 lists as an easy win.
> - **CISA AA-series advisories are now ingested** (`cisa-advisories` →
>   `attributed_activity`), carrying government attribution of state activity.
> - **SEC 8-K Item 1.05 disclosures are now ingested** — the victim's own
>   account, which no section here anticipated.
> - The **single largest gap is one this document does not name**: until
>   21 September every incident Vigil held came from a ransomware leak site, so
>   it could only record an attack the attacker chose to publish. See
>   `docs/SESSION_HANDOFF.md` §3.

This document identifies cybersecurity domains and threat categories not yet captured in Vigil, along with potential data sources and prioritization recommendations.

_Created: January 15, 2026_
_Updated: January 19, 2026_

---

## Current Coverage Summary

Vigil currently provides intelligence across these domains:

| Domain                     | Coverage Level | Primary Sources                                           |
| -------------------------- | -------------- | --------------------------------------------------------- |
| Ransomware Intelligence    | **Strong**     | RansomLook, Ransomware.live, Ransomwatch                  |
| Indicators of Compromise   | **Strong**     | ThreatFox, URLhaus, Feodo, Spamhaus, OTX, PhishTank       |
| Vulnerability Intelligence | **Strong**     | NVD, CISA KEV, CISA Alerts                                |
| Threat Actor Profiles      | **Good**       | MITRE ATT&CK, Malpedia, MISP Galaxy                       |
| Malware Intelligence       | **Moderate**   | MalwareBazaar                                             |
| Breach Data                | **Basic**      | Have I Been Pwned                                         |
| Enrichment Services        | **Good**       | GreyNoise, Shodan InternetDB, VirusTotal, Hybrid Analysis |

---

## The gap this document does not name

_Added 21 September 2026. Rewritten the same night, after the feeds below were
actually read rather than only fetched._

Everything below this heading, and the "Proposed New Data Sources" list in
`DATA_SOURCES.md`, is about **indicators and telemetry** — blocklists,
sandboxes, passive DNS, scanning. Adding all of it would make Vigil a richer
IOC aggregator. None of it changes what Vigil can say happened.

Until 21 September every one of the 39,534 incidents came from a ransomware
leak-site tracker. That means Vigil could only record an attack **the attacker
chose to publish for extortion**. Sixty actors are attributed to Iran and
fifty-nine have no incidents at all; the only one with any posts to leak sites.

The useful question is not "what other indicators exist" but **who else records
an attack**. There are four answers.

> **A feed returning HTTP 200 and ten items is not a feed that says who did
> it.** The first version of this section listed NCSC-UK and CERT-EU as the two
> cheapest wins, "the same RSS shape as CISA, so `cisa-advisories` generalises
> rather than being rewritten". The fetch had been verified. The content had
> not. One of the two carries attribution; the other carries vulnerability
> notices, and `cisa-advisories` did not generalise to it either. The table
> below now records what each feed actually contains.

### 1. Governments attributing campaigns

| Source           | Status                       | What it actually contains                                                                                                                                                                                                                                                                                   |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CISA AA-series   | **Done** (`cisa-advisories`) | 10 advisories, 5 attributed                                                                                                                                                                                                                                                                                 |
| NCSC-UK          | **Done** (`ncsc-advisories`) | 6 news items, 3 attributed, 1 queued. Needed its own parser: no advisory id, a feed that is mostly blogs, and "Iranian state actors" where CISA writes "Iranian-Affiliated"                                                                                                                                 |
| CERT-EU          | **Rejected**                 | `security-advisories` is vulnerability notices — "2026-012: Critical Vulnerabilities in Check Point Products" — with no attribution in any of them. `threat-intelligence` is monthly Cyber Brief round-ups covering dozens of unrelated events; filing a digest as one attributed event is a category error |
| CCCS (Canada)    | **Rejected**                 | Feed found at `cyber.gc.ca/api/cccs/atom/v1/get?feed=alerts_advisories&lang=en`. Entirely vendor patch notices: "SolarWinds security advisory (AV26-941)"                                                                                                                                                   |
| JPCERT           | **Rejected**                 | `jpcert.or.jp/rss/jpcert.rdf`, 29 items, Japanese-language vulnerability alerts                                                                                                                                                                                                                             |
| ACSC (Australia) | Not found                    | cyber.gov.au refused every request                                                                                                                                                                                                                                                                          |

Evidence for each rejection is in `supabase/migrations/132_attributed_activity_sources.sql`,
so the same five feeds do not have to be re-checked to reach the same answer.

Two governments is the point rather than the count: with CISA alone,
"attributed to Russia" means "the United States said so". Iran is now named
independently by both.

### 2. Victims disclosing to a regulator

**This is the richest untapped vein**, and the one to do next. A
regulator-held breach register is the victim's own account, which is the only
thing that turns a claim into a corroborated event.

| Source                  | Status                 | Notes                                                                                                                                                                                                        |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC 8-K Item 1.05       | **Done** (`sec-edgar`) | 83 filings, 16 matched to claims                                                                                                                                                                             |
| HHS OCR breach portal   | Not done               | ~7,876 US healthcare breaches since 2009, 500+ individuals each. **High value and awkward**: the official portal is a session-based JSF page that 302s, not an API. Needs a scraper or a third-party mirror. |
| State AG breach notices | Not done               | California, Maine, Washington, Texas. Free, but each is a separate scraper.                                                                                                                                  |
| EU GDPR notifications   | Not done               | Fragmented across supervisory authorities.                                                                                                                                                                   |

### 3. Law enforcement and sanctions

OFAC designations are ingested for addresses. Not done: DOJ press releases and
indictments, which name both actor and victim; Europol operations; Treasury
cyber designations as attribution rather than as wallet lists.

### 3a. Who a named actor is, as opposed to what they did

_Added 21 September 2026, after the question "should a suspected Chinese threat
actor connect to China in Vigil" turned out to have a more interesting answer
than yes._

The four categories above are all about **events**. This one is about the
**actor record** an event hangs off, and it was the larger gap: only 10.7% of
Vigil's 4,504 threat actors had an origin country at all, so the map's
Attackers layer drew a tenth of the corpus.

| Source                             | Status                          | Notes                                                                                                         |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| MISP Galaxy, MITRE ATT&CK          | **Done**, and was all there was | 483 actors. Neither sets out to be an attribution register.                                                   |
| ETDA / ThaiCERT Threat Group Cards | **Done** (`etda-actors`)        | 503 actors, 1,788 names each recording who gave it. +186, coverage to 14.9%. **CC BY-NC-SA — NonCommercial.** |
| Malpedia                           | Already ingested, stale         | Carries actor country. Last success 30 May 2026. Cheaper than a new source: already licensed and wired.       |

**The next move here is Malpedia, not a new source.** It is already in the
registry, already licensed, and has not run since May.

### 4. Vendor threat research

Microsoft MSTIC, Mandiant, Talos, Unit 42, Secureworks — all publish free RSS
and all attribute. The attribution is in prose rather than a field, so this
belongs in the review queue rather than a parser: ingest the report, queue the
attribution for a verdict.

**This was measured on 21 September, not assumed.** Across **279 titles from
eight vendor feeds** — Unit 42, Talos, Microsoft, Securelist, SentinelOne,
ESET, Check Point and GreyNoise — **zero carried attribution a parser could
read.** Six named a nationality at all, and every one of those named it as a
victim or a language:

- "NightEagle targets **Russian** companies" — Russia is the target
- "targeted spyware campaign in **Pakistan**" — Pakistan is the target
- "how a **Chinese-speaking** actor turned Brazilian government sites into an
  SEO weapon" — a language, and Brazil is the target

A nationality regex over vendor titles would have been wrong six times out of
six. Vendor prose is harder to read correctly than a CISA title, not easier,
and the failure mode is silent.

**What vendor titles do carry reliably is the actor's name and the target.**
Acronis publishes "Mustang Panda targets India's government and energy
sectors"; Vigil already knows Mustang Panda is CN from MITRE. That join —
event from the vendor, country from the actor record — is how a vendor report
becomes country-attributed activity without the vendor ever having named a
country. It is also why §3a matters more than this section.

| Vendor                             | Feed                                                                 | Items   | Note                                                                        |
| ---------------------------------- | -------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| GreyNoise                          | `greynoise.io/blog/rss.xml`                                          | 100     | Where the 21 Sep "Kapibala" story came from                                 |
| ESET                               | `welivesecurity.com/en/rss/feed/`                                    | 100     | Largest archive of the eight                                                |
| Acronis TRU                        | `acronis.com/en-us/tru/feed.xml`                                     | 20      | Named "Red Heron", which GreyNoise then cited. Mixed with MSP product posts |
| Unit 42, Check Point               | `unit42.paloaltonetworks.com/feed/`, `research.checkpoint.com/feed/` | 15 each |                                                                             |
| Microsoft, Securelist, SentinelOne | vendor `/feed/` paths                                                | 10 each |                                                                             |
| Talos                              | `blog.talosintelligence.com/rss/`                                    | 6       |                                                                             |

**GreyNoise's API is not this.** `api.greynoise.io` returns an IP's
classification and geolocation — where the box is, not who rented it. Checking
the API and concluding "GreyNoise does not attribute" was wrong about the
company: the research blog does, in prose.

### Nearly free, and already half-built — now done

`campaigns` held 56 MITRE ATT&CK campaigns with no actor links: 25 named their
actor in a text array and all 56 had `actor_id` null, so nothing could navigate
from Volt Typhoon to the KV Botnet activity or from Sandworm to the 2022
Ukraine Electric Power Attack. Migration 134 links the 24 unambiguous ones and
queues the rest. `link_campaign_actors` runs daily.

**`target_countries` is still empty on every campaign, and that is correct.**
MITRE does not publish a target country for a campaign object, and reading one
out of a campaign name — "2022 Ukraine Electric Power Attack" — would be Vigil
asserting what its source did not. The column is empty because the data is
absent, which is a different answer from zero.

---

## Identified Coverage Gaps

### 1. Supply Chain & Software Composition Security

| Gap                    | Description                                        | Current State   | Potential Sources                        |
| ---------------------- | -------------------------------------------------- | --------------- | ---------------------------------------- |
| SBOM Analysis          | No software bill of materials tracking             | None            | Dependency-Track, OWASP Dependency-Check |
| Package Tampering      | No tracking of compromised npm/PyPI/Maven packages | None            | Socket.dev, Snyk Vulnerability DB        |
| Build Pipeline Attacks | No CI/CD compromise intelligence                   | None            | -                                        |
| Open Source Advisories | Limited OSS vulnerability tracking                 | **Implemented** | **GitHub GHSA** ✅                       |

**Assessment:** GitHub GHSA is now integrated (`ingest-ghsa.mjs`), addressing open source advisories. SBOM analysis and dependency graphs remain gaps for full software supply chain visibility.

**Priority:** HIGH - Supply chain attacks are increasing (SolarWinds, Log4j, XZ Utils)

---

### 2. Cloud-Specific Threats

| Gap                      | Description                          | Current State  | Potential Sources             |
| ------------------------ | ------------------------------------ | -------------- | ----------------------------- |
| Cloud Misconfigurations  | Exposed S3 buckets, Azure blobs, GCS | None           | GrayhatWarfare, Bucket Finder |
| Cloud Provider Incidents | AWS/Azure/GCP service disruptions    | None           | Cloud provider status APIs    |
| IAM & Identity Threats   | Cloud identity attack patterns       | None           | -                             |
| Container Security       | Kubernetes, Docker vulnerabilities   | Partial (CVEs) | Trivy DB, Anchore             |
| Serverless Risks         | Lambda/Functions attack patterns     | None           | -                             |

**Assessment:** No coverage of cloud-native attack patterns. Users in cloud-heavy environments lack context for cloud-specific threats.

**Priority:** MEDIUM - Important but requires significant architecture decisions

---

### 3. Industrial Control Systems (ICS/OT)

| Gap                     | Description                       | Current State | Potential Sources             |
| ----------------------- | --------------------------------- | ------------- | ----------------------------- |
| ICS Advisories          | SCADA/PLC vulnerability alerts    | None          | **CISA ICS-CERT Advisories**  |
| OT Protocol Threats     | Modbus, DNP3, BACnet, OPC threats | None          | Dragos (paid), Claroty (paid) |
| Critical Infrastructure | Sector-specific OT context        | Limited       | CISA ICS advisories           |
| ICS Malware             | Industroyer, Triton, PIPEDREAM    | Partial       | Malpedia                      |

**Assessment:** Significant gap for users in energy, manufacturing, water, and utilities sectors. CISA ICS-CERT advisories are freely available and should be integrated.

**Priority:** HIGH for industrial sector users

**Easy Win:** CISA ICS-CERT RSS feed at `https://www.cisa.gov/news-events/cybersecurity-advisories?f%5B0%5D=advisory_type%3A95`

---

### 4. Mobile & IoT Threats

| Gap                      | Description                     | Current State   | Potential Sources                          |
| ------------------------ | ------------------------------- | --------------- | ------------------------------------------ |
| Android Malware          | Mobile malware families, APKs   | None            | Koodous, AndroZoo, MalwareBazaar (partial) |
| iOS Threats              | iPhone/iPad security issues     | None            | Apple Security Updates                     |
| IoT Botnets              | Mirai variants, IoT compromises | Partial (Feodo) | Shadowserver, BadPackets                   |
| Firmware Vulnerabilities | Embedded device CVEs            | Partial (NVD)   | -                                          |

**Assessment:** Mobile threats are underrepresented. IoT botnets have limited coverage beyond Feodo tracker.

**Priority:** MEDIUM - Growing attack surface but limited free data sources

---

### 5. Business Email Compromise (BEC) & Fraud

| Gap                   | Description                      | Current State | Potential Sources                |
| --------------------- | -------------------------------- | ------------- | -------------------------------- |
| BEC Campaigns         | CEO fraud, impersonation attacks | None          | -                                |
| Wire Fraud Indicators | Financial fraud patterns         | None          | -                                |
| Typosquatting Domains | Look-alike domain registration   | Partial       | DNSTwist feeds, crt.sh (planned) |
| Invoice Fraud         | Vendor impersonation             | None          | -                                |

**Assessment:** BEC causes more financial loss than ransomware globally but has no dedicated threat intelligence feeds. This is largely a detection/behavioral problem rather than feed-based.

**Priority:** MEDIUM - High impact but limited public data sources

> **Superseded, 24 September 2026.** "Limited public data sources" is wrong,
> and it is wrong in the same way the CERT-EU entry in §1 was wrong: it counted
> indicator feeds and concluded there was nothing there. The public record on
> fraud is large, authoritative and free — it is just held by prosecutors,
> Treasury and regulators rather than published as a blocklist. See §5a.

---

### 5a. Fraud and threat finance — the route is law enforcement, not scam feeds

_Added 24 September 2026, after the owner asked whether Vigil should cover
online scams, call scams and pig butchering._

**The answer is yes, and the reason §5 missed it is a unit-of-record problem.**
Vigil records an attack on a named organisation, claimed or disclosed. Scam
data does not arrive in that shape. It arrives in four, and only two of them
belong here.

| Shape                | Example                                                | Verdict                                                                                                                              |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Aggregate statistics | IC3 annual report, FTC Sentinel                        | **Not an incident.** Filing one as an event is the category error that got the CERT-EU monthly Cyber Brief rejected in §1. Own table. |
| Individual victims   | One person's romance-scam report                       | **Rejected.** Named individuals as data subjects, a different privacy regime from a corporate breach notice, kept forever in `entity_changelog`. |
| Infrastructure       | Scam domains, drainer wallets, spoofed numbers         | Already `iocs`. More of it does not change what Vigil can say happened.                                                              |
| **Enforcement acts** | Indictments, designations, advisories, forfeitures     | **This is the one.** Names actor, mechanism and often victim class, under the strongest evidentiary standard available.               |

The fourth shape needs almost no new machinery. `attributed_activity`
(migration 131) already has `criminal` in its `attribution_strength` check
constraint, and §3 above already lists DOJ, Europol and Treasury-as-attribution
as undone work for unrelated reasons. Fraud coverage largely falls out of
sources that were wanted anyway.

#### Sources, all Tier 1 and all free

| Source                              | Why it is the right one                                                                                                                                                | Licence                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **FinCEN advisories and alerts**    | The best fit on this list. Structured as typology plus red-flag indicators — including the pig-butchering alert — and written to be acted on by regulated institutions. | US public domain                                    |
| **OFAC designations as attribution** | Already ingested for addresses. Treasury has designated scam-compound networks and the laundering rails behind them. Same feed, read for _who_.                        | US public domain                                    |
| **DOJ indictments and forfeitures** | Names individuals, compounds, wallets and mule structure. A charged indictment is the strongest provenance in the corpus.                                              | US public domain                                    |
| **FBI IC3 / FTC Sentinel**          | Official statistics, in a statistics table, rendered as statistics. Same species as `breach_notices_by_state`.                                                         | US public domain                                    |
| **UNODC threat assessments**        | The regional structural picture the US sources do not carry.                                                                                                           | **Unchecked — frequently CC BY-NC. Gate it first.** |

#### Ruled out

Scam-report aggregators — Chainabuse, ScamAdviser, national reporting portals.
Restrictive terms, unverified user submissions, and submitting-party data that
is personal in a way a breach notice is not.

**On-chain tracing is also out of scope, permanently.** Clustering and
attribution are the commercial moat of the blockchain-intelligence firms, they
require data Vigil does not have, and their reliability is contested in court —
the _Sterlingov_ Daubert opinion conceded the vendor does not track its own
false-positive rate. Vigil's lane is the documentary layer around the chain:
designations, indictments, advisories, typologies, and the contested record of
what anyone actually claimed.

#### What has been built

Migrations **145** and **146** do the part that is not a feed: `evidence_publishers`
(the three-tier source hierarchy), `contested_claims` and `claim_values` (two
bodies, two numbers, one recorded ruling), and the non-upgrade rule enforced in
`claim_values_resolved` — a figure's tier is the tier of whoever produced it and
cannot be improved by being repeated. `contested_claims_summary.distinct_origins`
therefore counts originators rather than citations, which is the difference
between corroboration and echo.

Eight worked examples are seeded from the 2025-26 public record on
crypto-enabled fraud. **None has been verified against its primary source**, and
`review_contested_claims()` queues every one of them as exactly that work.

#### What remains

1. A page. Nothing above is visible; see `docs/SESSION_HANDOFF.md` §2b for why
   that matters more than the next feed.
2. FinCEN and DOJ ingestion, in that order.
3. A typology layer — stages, roles, rails — for indicators and designations to
   hang off. This is the part no other source supplies ready-made.

---

### 6. Underground Economy / Dark Web

| Gap                           | Description                            | Current State  | Potential Sources                   |
| ----------------------------- | -------------------------------------- | -------------- | ----------------------------------- |
| Initial Access Brokers (IABs) | Access-for-sale marketplace tracking   | None           | Manual monitoring, commercial feeds |
| Credential Markets            | Stolen credential pricing/availability | None           | Hudson Rock (partial free)          |
| Exploit Sales                 | Zero-day market activity               | None           | -                                   |
| Ransomware Affiliates         | Affiliate program recruitment          | None           | -                                   |
| Carding Forums                | Payment card fraud                     | None           | -                                   |
| Leaked Databases              | Database dumps, combolists             | Partial (HIBP) | DeHashed (paid), LeakCheck          |

**Assessment:** We track ransomware victims but not the upstream economy. Initial Access Brokers often sell access weeks before ransomware deployment - this is valuable early warning intelligence.

**Priority:** HIGH - But requires careful implementation (legal, ethical considerations)

**Potential Approach:** Monitor curated Telegram channels, integrate with DeepDarkCTI project

---

### 7. Geopolitical & Campaign Context

| Gap                      | Description                                | Current State | Potential Sources                   |
| ------------------------ | ------------------------------------------ | ------------- | ----------------------------------- |
| Named Campaigns          | SolarWinds, Hafnium, Salt Typhoon tracking | None          | **MITRE ATT&CK Campaigns**          |
| Geopolitical Correlation | Map threats to world events                | None          | **GDELT Project** (research needed) |
| Government Attribution   | Official nation-state attributions         | None          | DOJ indictments, OFAC sanctions     |
| Conflict-Driven Threats  | Ukraine, Taiwan, Middle East cyber ops     | None          | CyberPeace Institute                |

**Assessment:** Users cannot easily understand "why now" for threat activity spikes. No correlation between geopolitical events and cyber campaigns.

**Priority:** MEDIUM-HIGH - Provides crucial context for threat analysis

**Easy Win:** MITRE ATT&CK Campaigns data is available in the same feed we already ingest

---

### 8. AI/ML Security Threats

| Gap                  | Description                      | Current State | Potential Sources |
| -------------------- | -------------------------------- | ------------- | ----------------- |
| Adversarial ML       | Model poisoning, evasion attacks | None          | **MITRE ATLAS**   |
| AI-Generated Threats | Deepfakes, synthetic media       | None          | -                 |
| LLM Vulnerabilities  | Prompt injection, jailbreaks     | None          | OWASP LLM Top 10  |
| AI Supply Chain      | Malicious models on HuggingFace  | None          | -                 |

**Assessment:** Emerging threat category with limited structured data sources. MITRE ATLAS provides a framework similar to ATT&CK for AI threats.

**Priority:** LOW (current) → HIGH (future) - Limited feeds now but rapidly evolving

---

### 9. DDoS & Availability Threats

| Gap                      | Description                  | Current State | Potential Sources                 |
| ------------------------ | ---------------------------- | ------------- | --------------------------------- |
| DDoS Campaigns           | Volumetric attack tracking   | None          | NETSCOUT (paid), Cloudflare Radar |
| Booter/Stresser Services | DDoS-for-hire intelligence   | None          | -                                 |
| BGP Hijacks              | Routing security incidents   | None          | BGPStream, RIPE RIS               |
| DNS Attacks              | DNS amplification, hijacking | None          | -                                 |

**Assessment:** No visibility into availability threats. BGPStream provides free BGP hijack data.

**Priority:** LOW-MEDIUM - Niche use case but BGPStream is easy to integrate

---

### 10. Cryptocurrency & Financial Threats

| Gap                   | Description                      | Current State  | Potential Sources       |
| --------------------- | -------------------------------- | -------------- | ----------------------- |
| Crypto Exchange Hacks | Exchange breaches, wallet drains | None           | Rekt.news, CryptoScamDB |
| Ransomware Payments   | Payment flow tracking            | None           | **Ransomwhere**         |
| DeFi Exploits         | Smart contract vulnerabilities   | None           | -                       |
| Crypto Drainers       | Wallet draining malware          | Partial (IOCs) | -                       |

**Assessment:** Ransomwhere.com provides free ransomware payment tracking - directly complements our ransomware incident data.

**Priority:** MEDIUM

**Easy Win:** Ransomwhere API at `https://api.ransomwhe.re/`

---

### 11. Insider Threats

| Gap                        | Description                       | Current State | Potential Sources             |
| -------------------------- | --------------------------------- | ------------- | ----------------------------- |
| Behavioral Indicators      | Insider threat warning signs      | None          | CISA Insider Threat resources |
| Data Exfiltration Patterns | DLP-type intelligence             | None          | -                             |
| Privileged Access Abuse    | Admin account compromise patterns | None          | -                             |

**Assessment:** Insider threats are largely behavioral analytics problems, not feed-based intelligence. Limited applicability for a threat intel platform.

**Priority:** LOW - Not well-suited for feed-based approach

---

### 12. Physical-Cyber Convergence

| Gap                         | Description                      | Current State | Potential Sources |
| --------------------------- | -------------------------------- | ------------- | ----------------- |
| Physical Security Incidents | Facility breaches, badge cloning | None          | -                 |
| Drone/Counter-UAS           | Drone threat intelligence        | None          | -                 |
| GPS Spoofing                | Navigation system attacks        | None          | -                 |

**Assessment:** Physical security convergence is outside the scope of traditional CTI. No clear data sources.

**Priority:** LOW - Out of scope for current platform focus

---

### 13. Disinformation & Influence Operations

| Gap                              | Description                      | Current State | Potential Sources              |
| -------------------------------- | -------------------------------- | ------------- | ------------------------------ |
| State-Sponsored Disinfo          | Nation-state influence campaigns | None          | **GDELT Project**, EUvsDisinfo |
| Coordinated Inauthentic Behavior | Bot networks, fake accounts      | None          | Stanford Internet Observatory  |
| Election Security                | Election-related cyber threats   | None          | CISA Election Security         |

**Assessment:** Disinformation is increasingly intertwined with cyber operations. GDELT Project may provide relevant data (research needed).

**Priority:** MEDIUM - Growing relevance but different skill set required

---

### 14. Regulatory & Compliance Context

| Gap                       | Description                   | Current State | Potential Sources        |
| ------------------------- | ----------------------------- | ------------- | ------------------------ |
| GDPR Breach Notifications | EU data protection violations | None          | GDPR Enforcement Tracker |
| SEC Cyber Disclosures     | Public company breach filings | None          | SEC EDGAR                |
| Regulatory Actions        | FTC, state AG enforcement     | None          | -                        |

**Assessment:** Compliance teams need regulatory context alongside threat intelligence. Some structured data sources exist.

**Priority:** LOW-MEDIUM - Niche but valuable for enterprise users

---

## Prioritized Remediation Roadmap

### Tier 1: Easy Wins (Free, Simple Integration)

| Source                     | Fills Gap                  | Effort  | Script                    |
| -------------------------- | -------------------------- | ------- | ------------------------- |
| **CISA ICS-CERT**          | ICS/OT Advisories          | 3 hours | `ingest-ics-cert.mjs`     |
| **Ransomwhere**            | Crypto/Ransomware Payments | 2 hours | `ingest-ransomwhere.mjs`  |
| **MITRE ATT&CK Campaigns** | Named Campaign Tracking    | 2 hours | Update `ingest-mitre.mjs` |
| **BGPStream**              | Routing/BGP Hijacks        | 4 hours | `ingest-bgpstream.mjs`    |

### Tier 2: Medium Effort (May Require API Keys)

| Source            | Fills Gap            | Effort  | Notes                         |
| ----------------- | -------------------- | ------- | ----------------------------- |
| **MITRE ATLAS**   | AI/ML Threats        | 4 hours | Similar to ATT&CK integration |
| **Shadowserver**  | IoT Botnets          | 4 hours | Requires registration         |
| **GDELT Project** | Geopolitical Context | 8 hours | Research needed               |

### Tier 3: Complex (Requires Architecture Decisions)

| Source                     | Fills Gap            | Effort    | Notes                        |
| -------------------------- | -------------------- | --------- | ---------------------------- |
| Dark Web Monitoring        | Underground Economy  | 20+ hours | Legal/ethical considerations |
| Cloud Threat Feeds         | Cloud Security       | 16+ hours | Multi-provider complexity    |
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

| Gap                          | GDELT Capability                                                         | Integration Approach                              |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| **Geopolitical Context**     | CAMEO event taxonomy tracks nation-state actions, conflicts, cooperation | Correlate cyber events with geopolitical tensions |
| **Named Campaigns**          | News coverage of major cyber incidents (SolarWinds, Salt Typhoon)        | Track media mentions of known campaigns           |
| **Nation-State Attribution** | Actor codes identify government/military entities by country             | Map threat actors to nation-state coverage        |
| **Disinformation Tracking**  | Tone analysis, theme identification                                      | Monitor information operations discourse          |
| **Emerging Threats**         | Real-time global news monitoring                                         | Early warning for new threat types                |

### GDELT Event Classification (CAMEO)

GDELT uses the CAMEO (Conflict and Mediation Event Observations) taxonomy:

- **300+ event types** in hierarchical structure
- **QuadClass**: Verbal Cooperation, Material Cooperation, Verbal Conflict, Material Conflict
- **Goldstein Scale**: -10 to +10 rating of event impact on stability
- **Actor Codes**: Nation-state + agent codes (e.g., "RUSMIL" = Russia Military)

### GDELT APIs Available

| API             | Purpose                              | Use Case for Vigil                    |
| --------------- | ------------------------------------ | ------------------------------------- |
| **DOC 2.0**     | Full-text search across 65 languages | Search for cyber threat mentions      |
| **GEO 2.0**     | Geographic visualization             | Map threat activity by region         |
| **Context 2.0** | Sentence-level search with context   | Extract specific threat intelligence  |
| **TV 2.0**      | Television news monitoring           | Track broadcast coverage of incidents |

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

| Field Category     | Fields                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| **Event**          | ID, dates, event type, subtype                                            |
| **Threat Actor**   | Name, type (nation-state/criminal/hacktivist/terrorist/hobbyist), country |
| **Target**         | Organization, industry (NAICS codes), country                             |
| **Attack Details** | Motive, severity metrics, disruptive vs exploitative                      |
| **Context**        | Geographic indicators, organizational membership                          |

### Threat Actor Categories Tracked

- **Nation-States**: Russia GRU Sandworm, North Korea 3rd Technical Surveillance Bureau, etc.
- **Criminal Organizations**: cl0p, LockBit, etc.
- **Hacktivists**: Anonymous, etc.
- **Terrorists**
- **Hobbyists**

### Access & Integration

| Aspect           | Details                               |
| ---------------- | ------------------------------------- |
| **Time Period**  | 2014 - present (monthly updates)      |
| **Current Data** | Through December 31, 2025             |
| **Access**       | Registration required via Google Form |
| **Format**       | Structured data download (CSV/Excel)  |
| **API**          | No public API - download only         |
| **Contact**      | Dr. Charles Harry (charry@umd.edu)    |

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

| Gap Category                 | Solution                 | Priority   |
| ---------------------------- | ------------------------ | ---------- |
| Geopolitical Context         | UMD Cyber Events + GDELT | **HIGH**   |
| Nation-State Attribution     | UMD actor tracking       | **HIGH**   |
| Named Campaign Tracking      | GDELT news monitoring    | **MEDIUM** |
| Disinformation/Influence Ops | GDELT tone analysis      | **MEDIUM** |
| Early Warning                | GDELT real-time news     | **MEDIUM** |

**Recommendation:** Prioritize UMD Cyber Events Database integration as the structured data provides immediate value with lower implementation effort than raw GDELT integration.

---

---

## Related Documentation

- **[ALERTING.md](./ALERTING.md)** - Real-time alerting system
- Infrastructure cost breakdown and projections — moved out of this public
  repository on 21 September 2026 along with the other commercial material.
  See the removal commit for where it went.
- **[../DATA_SOURCES.md](../DATA_SOURCES.md)** - Current and proposed data source inventory

---

## Appendix: Beating Security News Outlets

### The Challenge

Stakeholder feedback requested Vigil notify users of events **before** security news outlets like Bleeping Computer report on them.

### Assessment

| Event Category              | Can Vigil Win?     | Why                                      |
| --------------------------- | ------------------ | ---------------------------------------- |
| Ransomware leak posts       | **YES (95%)**      | Direct feed access vs journalist writing |
| CISA KEV additions          | **YES (95%)**      | Programmatic API vs article              |
| New CVE publications        | **YES (90%)**      | Direct NVD API access                    |
| IOC publications            | **YES (90%)**      | Automated threat feeds                   |
| Exclusive scoops            | **NO (0%)**        | Journalism, human sources                |
| Vendor breach announcements | **UNLIKELY (30%)** | Need GDELT news monitoring               |

### Requirements to Achieve This

1. **Faster ingestion** - Move from 6-hour to 30-minute cycles for critical feeds
2. **Real-time alerting** - Push notifications, email, webhooks
3. **Smart filtering** - Alert only on relevant events (org profile match)
4. **GDELT integration** - Catch news before articles are written

See [ALERTING.md](./ALERTING.md) for alerting implementation details.

---

_Document Version: 1.3_
_Last Updated: January 19, 2026_
_GDELT Research: Complete_
_EPSS Integration: Complete_
_GHSA Integration: Complete_
