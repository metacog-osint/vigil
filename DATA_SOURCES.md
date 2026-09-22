# Vigil Data Sources & Streams

This document provides a comprehensive overview of all threat intelligence data sources integrated into Vigil, along with planned additions and rollout strategy.

---

## Licensing

What a source permits governs what Vigil may do with it, so it belongs here rather
than in someone's memory.

**Checked directly on 21 September 2026:** ThreatCluster, SEC EDGAR, OFAC, CISA,
NCSC-UK, ETDA.

**Licences now live in the database, not only here.** `source_licences`
(migration 136) holds the same facts with a `commercial_use` flag, and
`actor_origins_commercial` is the view a paid tier reads instead of
`threat_actors`. Cutting a NonCommercial source is one `UPDATE`, not an audit.
Verified on 21 September: 669 actor origins held, **483 sellable, 186
withheld** — the 186 being exactly what ETDA added.
**Carried from the project's own records and not re-checked:** Ransomware.live,
DB-IP. Confirm those against the source before relying on them.

| Source                                  | Terms                                                                                | What that means here                                                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ransomware.live**                     | **Free tier is personal use only**                                                   | Documented as permitting personal use only, **which constrains any use beyond that**. It supplies all group profiles plus 11,256 of the victim countries. Every row carries `source = 'ransomware.live'`, so what would have to be replaced is identifiable exactly. |
| ThreatCluster Ransomware-Intel          | **TLP:CLEAR** — "free to use, redistribute, and integrate. Attribution appreciated." | No restriction on use or redistribution. Attributed anyway.                                                                                                                                                                                                          |
| SEC EDGAR                               | **US public domain**                                                                 | A work of the US government. No restriction.                                                                                                                                                                                                                         |
| OFAC SDN                                | **US public domain**                                                                 | A work of the US government. No restriction.                                                                                                                                                                                                                         |
| **ETDA / ThaiCERT Threat Group Cards**  | **CC BY-NC-SA 4.0 — NonCommercial**                                                  | **Free to use now; must be removed from anything sold.** Supplies 186 actor origin countries, all carrying `origin_source = 'etda'`, and `actor_origins_commercial` already excludes them. The licence is re-read from the API response on every run.                |
| State AG breach registries (CA, WA, OR) | **US state government public record**                                                | Filed under Civil Code 1798.29/1798.82 and published as a public record. Sellable.                                                                                                                                                                                   |
| CISA advisories                         | **US public domain**                                                                 | A work of the US government. No restriction.                                                                                                                                                                                                                         |
| NCSC-UK                                 | **Open Government Licence v3.0**                                                     | Free to use and redistribute, **including commercially**, provided the source is acknowledged. Vigil stores the advisory URL and the publishing government on every row, which satisfies it.                                                                         |
| DB-IP (indicator location)              | **CC BY 4.0**                                                                        | **Attribution is required wherever located data is shown** — currently the IOC search page and the Help methodology. Any new view showing country needs it too.                                                                                                      |

Sources not listed above have not been checked. That is a gap, not a statement
that they are unrestricted.

---

## Current Data Sources

The worker registry holds **28 scheduled jobs**; the tables below also list sources
that run from `scripts/` rather than the worker.

### Ransomware Intelligence

| Source                         | Endpoint                                                                         | Data Type                                             | Schedule        | Script                                                                       | Auth |
| ------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- | ---- |
| RansomLook                     | `https://www.ransomlook.io/api`                                                  | Ransomware incidents, victim claims                   | Every 30min     | `ingest-ransomlook.mjs`                                                      | None |
| Ransomware.live                | `https://api.ransomware.live/v2`                                                 | Victim claims, historical data (2020+)                | Every 6h        | `ingest-ransomware-live.mjs`                                                 | None |
| Ransomware.live groups         | `https://api.ransomware.live/v2/groups`                                          | Group ATT&CK techniques, tooling, leak-site addresses | Daily 03:00 UTC | `workers/src/feeds/ransomware-live.js`                                       | None |
| Ransomwatch                    | `https://raw.githubusercontent.com/joshhighet/ransomwatch/main/`                 | Victim posts, group metadata                          | Every 6h        | `ingest-ransomwatch.mjs`                                                     | None |
| ThreatCluster Ransomware-Intel | `https://raw.githubusercontent.com/Jam0k/Ransomware-Intel/main/data/victims.csv` | **Victim country**, sector, listed/delisted status    | Daily           | `workers/src/feeds/threatcluster.js` → `threatcluster-victims` Edge Function | None |

**Why ThreatCluster was added.** Ransomware.live was the only source that ever
supplied `victim_country` — 11,256 of 11,317 — and it stopped on 29 May 2026.
RansomLook returns no country field on any public endpoint (`/api/recent` and
`/api/posts` both checked). So the field did not decay; its single supplier went
away, and that supplier is the one whose licence is restricted to personal use.

Measured before it was adopted: 91% country coverage over 90 days, 85% match
against Vigil's missing rows on a plain normalised-name join, and **99% agreement
with the country data already held** (916 of 922 overlapping victims). The
agreement mattered more than the coverage — it is independently crawled, and it
still concords.

It fills only what is empty. Where the two sources disagree the incident is left
exactly as it was, _including that victim's rows with no country at all_, and the
disagreement is queued for review. Filling the empty rows of a contested victim
would leave one organisation with two countries, which is the product
contradicting itself rather than reporting a disagreement.

### Indicators of Compromise (IOCs)

| Source         | Endpoint                                                               | Data Type                           | Schedule    | Script                      | Auth                        |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------- | ----------- | --------------------------- | --------------------------- |
| ThreatFox      | `https://threatfox-api.abuse.ch/api/v1/`                               | IPs, domains, URLs, hashes          | Every 30min | `ingest-threatfox.mjs`      | API Key (`ABUSECH_API_KEY`) |
| URLhaus        | `https://urlhaus-api.abuse.ch/v1/urls/recent/`                         | Malicious URLs                      | Every 30min | `ingest-urlhaus.mjs`        | API Key (`ABUSECH_API_KEY`) |
| Feodo Tracker  | `https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json` | Botnet C2 IPs                       | Every 30min | `ingest-feodo.mjs`          | None                        |
| Spamhaus DROP  | `https://www.spamhaus.org/drop/*.txt`                                  | IP blocklists (DROP, EDROP, DROPv6) | Daily       | `ingest-spamhaus.mjs`       | None                        |
| AlienVault OTX | `https://otx.alienvault.com/api/v1`                                    | Community threat pulses, IOCs       | Daily       | `ingest-alienvault-otx.mjs` | API Key                     |
| PhishTank      | `http://data.phishtank.com/data/`                                      | Verified phishing URLs              | Daily       | `ingest-phishtank.mjs`      | Optional                    |

### Vulnerability Intelligence

| Source      | Endpoint                                                                              | Data Type                 | Schedule | Script                   | Auth |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------- | -------- | ------------------------ | ---- |
| CISA KEV    | `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` | Exploited-in-wild CVEs    | Every 6h | `ingest-cisa-kev.mjs`    | None |
| NVD         | `https://services.nvd.nist.gov/rest/json/cves/2.0`                                    | Full CVE database         | Every 6h | `ingest-nvd.mjs`         | None |
| CISA Alerts | `https://www.cisa.gov/uscert/ncas/alerts.xml`                                         | Security advisories (RSS) | Every 6h | `ingest-cisa-alerts.mjs` | None |

### Threat Actor Intelligence

| Source       | Endpoint                                                                                      | Data Type                           | Schedule | Script                   | Auth |
| ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------- | -------- | ------------------------ | ---- |
| MITRE ATT&CK | `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json` | Techniques, APT groups, mitigations | Every 6h | `ingest-mitre.mjs`       | None |
| MITRE ATLAS  | `https://raw.githubusercontent.com/mitre-atlas/atlas-data/main/dist/ATLAS.yaml`               | AI/ML adversarial techniques        | Weekly   | `ingest-mitre.mjs`       | None |
| Malpedia     | `https://malpedia.caad.fkie.fraunhofer.de/api`                                                | Actor profiles, malware families    | Every 6h | `ingest-malpedia.mjs`    | None |
| MISP Galaxy  | `https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/`                           | Threat actor clusters               | Every 6h | `ingest-misp-galaxy.mjs` | None |

### Malware Intelligence

| Source         | Endpoint                          | Data Type               | Schedule          | Script                     | Auth                        |
| -------------- | --------------------------------- | ----------------------- | ----------------- | -------------------------- | --------------------------- |
| MalwareBazaar  | `https://mb-api.abuse.ch/api/v1/` | Malware samples, hashes | Daily (06:00 UTC) | `ingest-malwarebazaar.mjs` | API Key (`ABUSECH_API_KEY`) |
| ANY.RUN Trends | `https://any.run/malware-trends/` | Malware family trends   | Daily             | `ingest-anyrun.mjs`        | None (scraper)              |

### Regulatory Disclosures

| Source                                  | Endpoint                                                           | Data Type                                                    | Schedule | Script                                                                             | Auth                       |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------- | -------------------------- |
| SEC EDGAR 8-K Item 1.05                 | `https://efts.sec.gov/LATEST/search-index?q="Item 1.05"&forms=8-K` | Material cybersecurity incidents **disclosed by the victim** | Daily    | `workers/src/feeds/sec-disclosures.js` → `sec-cyber-disclosures` Edge Function     | None (User-Agent required) |
| State AG breach registries (CA, WA, OR) | `oag.ca.gov`, `atg.wa.gov`, `justice.oregon.gov`                   | **8,812 breach notifications, every cause**                  | Daily    | `workers/src/feeds/state-breach-notices.js` → `state-breach-notices` Edge Function | None                       |

**The California source is the one that stops Vigil being a ransomware-only
platform.** All 39,575 incidents it holds are ransomware leak-site claims;
against that, the entire non-ransomware corpus was about 500 rows. That is not
because the other sources were missing but because one table outnumbered
everything else eighty to one, and a feed of a hundred rows could not change
it.

8,812 notifications back to 20 January 2012, covering intrusion, insider, lost
device, misdirected mail and vendor compromise:

| State      | Notices | From     | Also publishes                                                 |
| ---------- | ------: | -------- | -------------------------------------------------------------- |
| California |   5,302 | Jan 2012 | —                                                              |
| Washington |   1,871 | Aug 2015 | Residents affected, **categories of data exposed** (all 1,871) |
| Oregon     |   1,639 | Oct 2015 | Breach date range, **discovery date**, people affected         |

**`persons_affected` means different things in different states, and the schema
says which.** Washington's column is "Number of Washingtonians Affected";
Oregon's is "Number Affected" and its largest row is Marriott at 500,000,000 —
the global figure. `persons_affected_scope` is `state_residents` or `total`,
and `breach_notices_by_state` reports the two separately rather than summing
them. Adding them would produce a number about nobody, and the first version of
the view did exactly that.

**"All fifty states" is not available**, checked 22 September: Texas is a
Salesforce portal behind auth (401), New Hampshire blocks non-browser clients
(403), Maine, Montana, Indiana and Vermont 404 at their documented paths, and
Iowa's page carries no table. About a dozen states publish a list a machine can
read; these are the three largest. Adding the next is a `REGISTRIES` entry in
the Edge Function — a URL, its pagination and which column means what.

It shares `victim_disclosures` with the SEC filings deliberately. An 8-K and a
California notice are the _same_ kind of claim — the victim telling a regulator
under a legal duty — unlike vendor research and government advisories, which
migration 139 keeps apart. Splitting them would mean asking "what did the
victim say" twice.

**The cause of each breach is not imported.** The list page does not carry it,
and inferring "ransomware" from an organisation name would invent the very
thing this source was added to avoid. **No notice is matched to an incident**
either: `match_status` stays `unreviewed`, because whether a California filing
and a leak-site claim describe one event is a judgment.

**Why this one is unlike every other source here.** Everything else in this
document is the attacker's claim. Since December 2023 an SEC registrant has had to
report a material cybersecurity incident within four business days, filed by the
victim, under penalty. That is the other party speaking, and it is the only
corroboration a leak-site feed cannot supply at any price.

101 Item 1.05 filings exist in total — the whole population since the rule took
effect — from 72 companies. Only 83 were _actually filed_ under Item 1.05; the
other 18 merely mention it, so the structured `items` field decides rather than the
full-text search. Eleven of the 72 are organisations a ransomware group has also
claimed.

The dates are the interesting part. Krispy Kreme filed **eight days before** Play
listed it; Key Tronic **twenty-one days before** Black Basta; Nutex Health on the
same day The Gentlemen posted.

Filings are ingested as facts. Whether a filing corroborates a _particular_ claim
is a judgment call and is queued, never applied — Stryker filed in April 2026 and
was claimed by Qilin in July, which may well be two unrelated incidents.

SEC asks for a User-Agent identifying the requester and no more than ten requests
per second. This makes two, once a day.

### Actor Attribution

| Source                             | Endpoint                                                  | Data Type                | Schedule | Script                                                           | Auth |
| ---------------------------------- | --------------------------------------------------------- | ------------------------ | -------- | ---------------------------------------------------------------- | ---- |
| ETDA / ThaiCERT Threat Group Cards | `https://apt.etda.or.th/cgi-bin/getcard.cgi?g=all&o=json` | **Actor origin country** | Weekly   | `workers/src/feeds/etda-actors.js` → `etda-actors` Edge Function | None |

**The gap it fills.** 483 of 4,504 threat actors had an origin country —
10.7% — all of it from MISP Galaxy and MITRE ATT&CK, neither of which sets out
to be an attribution register. ETDA is 503 actors with 1,788 names between
them, each name recording who gave it: CrowdStrike, Microsoft, MITRE,
SecureWorks, Kaspersky. Coverage is now **14.9%**.

**Why it was trusted to write anything.** Measured before it was built and
confirmed after: **433 agreements against 1 disagreement** with what Vigil
already held. The corpora were assembled independently and they concur. The
one dispute is OnionDog — Vigil says North Korea, ETDA says South Korea — and
it is queued, not applied.

**`[Unknown]` is an answer and it is kept.** 137 of ETDA's 503 entries record
the country as `[Unknown]`, and 124 of those match an actor Vigil holds.
Writing anything for them would convert a source's honest refusal into Vigil's
silence. They stay null.

**Confidence stays null.** `origin_confidence` means "confidence as published
by the source". ETDA publishes none; inventing a 50 to match MISP's rows would
render a number in a tooltip that no source ever said.

**Alias collisions are refused, not resolved.** Five actors — among them
Sandworm, whose alias `IRIDIUM` collides with another group — match entries
naming two different countries. None was filled; all are queued.

### Vendor Threat Research

| Source                                                                           | Endpoint             | Data Type                               | Schedule | Script                                                                   | Auth |
| -------------------------------------------------------------------------------- | -------------------- | --------------------------------------- | -------- | ------------------------------------------------------------------------ | ---- |
| GreyNoise, Acronis TRU, ESET, Unit 42, Talos, Microsoft, Securelist, Check Point | eight RSS/Atom feeds | Research reports, actor link candidates | Every 6h | `workers/src/feeds/vendor-research.js` → `vendor-research` Edge Function | None |

**Nothing here is parsed for attribution, and that was measured.** Across
**279 titles from these eight feeds, zero** carried an attribution a parser
could read. Six named a nationality, and every one named a _victim_ or a
_language_: "NightEagle targets Russian companies", "targeted spyware campaign
in Pakistan", "how a Chinese-speaking actor turned Brazilian government sites
into an SEO weapon". A nationality regex would have been wrong six times out of
six.

**What the titles do carry is the actor's name.** "Mustang Panda targets
India's government and energy sectors" links to Mustang Panda, which Vigil
already knows is CN from MITRE. Event from the vendor, country from the actor
record — each half sourced to something that actually claimed it. Alias
matching works: Sednit → APT28, ScarCruft → APT37, OceanLotus → APT32, Silk
Typhoon → HAFNIUM.

**Links are proposed, never applied.** `vendor_report_actors.confirmed` stays
null until a person rules. Two rules keep the proposals honest, both learned
from real false positives:

- Matching every actor name linked "An AI-Orchestrated **Global** Campaign" to
  a ransomware brand named `global`, and "NightEagle targets **Russian**
  companies" to one named `Russian` — a report about Russian _victims_.
  Matching is restricted to named groups.
- A one-word match followed by whitespace and a capital is dropped: "**Mirage**
  Kitten targeting aviation" matched `Mirage`, a Ke3chang alias, and proposed
  an Iranian group's campaign as the work of two Chinese actors. A headline
  colon is not the same thing — "Webworm: New burrowing techniques" is kept.

**Licence: all eight are the vendors' copyright.** Vigil stores the title, URL
and a short RSS summary — never the article body — and all eight are registered
in `source_licences` as **not sellable**, because nobody has read their terms
against this use.

### Government Attribution

| Source                    | Endpoint                                                     | Data Type                                      | Schedule | Script                                                                   | Auth |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------- | -------- | ------------------------------------------------------------------------ | ---- |
| CISA AA-series advisories | `https://www.cisa.gov/cybersecurity-advisories/*.xml`        | State-attributed activity, in CISA's own words | Every 6h | `workers/src/feeds/cisa-advisories.js` → `cisa-advisories` Edge Function | None |
| NCSC-UK news              | `https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml` | UK attributions and joint statements           | Every 6h | `workers/src/feeds/ncsc-advisories.js` → `ncsc-advisories` Edge Function | None |

**What these add that nothing else here can.** Every other incident source is a
ransomware leak site, so Vigil could only record an attack the attacker chose to
publish for extortion. Sixty threat actors are attributed to Iran and fifty-nine
have no incidents at all. A government advisory is the opposite kind of evidence:
an investigation, published, naming who it blames.

**The words are kept, not summarised.** CISA writes "Iranian-Affiliated",
"Russian State-Sponsored", "China-Nexus" and "Pro-Russia Hacktivists" and means
four different things. `attribution_phrase` stores the source's exact wording and
`attribution_strength` records which of `state | affiliated | nexus | aligned |
criminal` it is. The first parser read summaries as well as titles and turned
"Pro-Russia Hacktivists" into a Russian state attribution, which is false — the
tables are tested against the real titles in
`workers/src/feeds/__tests__/attribution.test.js`.

**Two governments, not one.** With CISA alone, "attributed to Russia" means "the
United States said so". Iran is now named independently by both: CISA as
"Iranian-Affiliated", NCSC as "Iranian state actors". The map says which.

**NCSC only reads `/news/`.** Its feed carries everything NCSC publishes — 13 blog
posts, 6 news items and 1 guidance page in the sample checked. A title naming a
country without stating the relationship ("Iranian cyber targeting of dissidents")
is stored unattributed and queued for a person, never guessed.

**Four other national CERTs were checked on 21 September 2026 and rejected**, with
the evidence in migration 132: CERT-EU publishes vulnerability notices and monthly
digests, CCCS publishes vendor patch advisories, JPCERT publishes Japanese-language
vulnerability alerts, and ACSC refused every request. A feed returning HTTP 200 and
ten items is not a feed that says who did it.

### Breach Data

| Source            | Endpoint                                     | Data Type               | Schedule | Script            | Auth |
| ----------------- | -------------------------------------------- | ----------------------- | -------- | ----------------- | ---- |
| Have I Been Pwned | `https://haveibeenpwned.com/api/v3/breaches` | Data breach information | Weekly   | `ingest-hibp.mjs` | None |

### Sandbox & Malware Analysis

| Source            | Endpoint                       | Data Type                            | Schedule | Script               | Auth     |
| ----------------- | ------------------------------ | ------------------------------------ | -------- | -------------------- | -------- |
| ANY.RUN           | `https://api.any.run/v1`       | Interactive sandbox reports, IOCs    | Daily    | `ingest-anyrun.mjs`  | API Key  |
| Triage (Hatching) | `https://api.tria.ge/v0`       | Automated malware triage             | Daily    | `ingest-triage.mjs`  | API Key  |
| InQuest Labs      | `https://labs.inquest.net/api` | Document-based threats (Office, PDF) | Daily    | `ingest-inquest.mjs` | Optional |

### Enhanced Vulnerability Intelligence

| Source        | Endpoint                                                                  | Data Type                            | Schedule | Script                   | Auth    |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------ | -------- | ------------------------ | ------- |
| VulnCheck KEV | `https://api.vulncheck.com/v3`                                            | Extended KEV (173% larger than CISA) | Daily    | `ingest-vulncheck.mjs`   | API Key |
| CISA ICS-CERT | `https://www.cisa.gov/sites/default/files/feeds/ics-cert_advisories.json` | ICS/OT advisories                    | Daily    | `ingest-cisa-alerts.mjs` | None    |

### Ransomware Payment Tracking

| Source      | Endpoint                          | Data Type                                 | Schedule | Script    | Auth |
| ----------- | --------------------------------- | ----------------------------------------- | -------- | --------- | ---- |
| Ransomwhere | `https://api.ransomwhe.re/export` | Ransomware BTC payments, wallet addresses | Daily    | `planned` | None |

### Sanctions

| Source   | Endpoint                                                                             | Data Type                                                 | Schedule        | Script                          | Auth |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------- | ------------------------------- | ---- |
| OFAC SDN | `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML` | Designated digital-currency addresses, entities, programs | Daily 03:00 UTC | `workers/src/feeds/ofac-sdn.js` | None |

Parsed from SDN.XML rather than SDN.CSV: the CSV truncates its remarks field at 1,000
characters and loses over half the addresses. The 127 MB advanced export has the same
coverage as the 29 MB SDN.XML, which is streamed and filtered to the 99 entities that
carry addresses. Delistings are dated, never deleted.

### MITRE ATT&CK Campaigns

| Source       | Endpoint                                                                                      | Data Type                                   | Schedule | Script             | Auth |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------- | -------- | ------------------ | ---- |
| MITRE ATT&CK | `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json` | Named campaigns (SolarWinds, Hafnium, etc.) | Weekly   | `ingest-mitre.mjs` | None |

### Community Threat Intelligence

| Source    | Endpoint                    | Data Type                         | Schedule | Script                 | Auth    |
| --------- | --------------------------- | --------------------------------- | -------- | ---------------------- | ------- |
| Pulsedive | `https://pulsedive.com/api` | Community intel with risk scoring | Daily    | `ingest-pulsedive.mjs` | API Key |

### Infrastructure Intelligence

| Source | Endpoint                          | Data Type                              | Schedule | Script              | Auth    |
| ------ | --------------------------------- | -------------------------------------- | -------- | ------------------- | ------- |
| Censys | `https://search.censys.io/api/v2` | Certificate/service data, C2 detection | Daily    | `ingest-censys.mjs` | API Key |

### Network/Routing Intelligence

| Source    | Endpoint                                    | Data Type                         | Schedule | Script    | Auth |
| --------- | ------------------------------------------- | --------------------------------- | -------- | --------- | ---- |
| BGPStream | `https://bgpstream.crosswork.cisco.com/api` | BGP hijacks, route leaks, outages | Daily    | `planned` | None |

### Cyber Events Intelligence

| Source           | Endpoint                                      | Data Type                                     | Schedule         | Script                        | Auth         |
| ---------------- | --------------------------------------------- | --------------------------------------------- | ---------------- | ----------------------------- | ------------ |
| UMD Cyber Events | `https://cissm.umd.edu/cyber-events-database` | Nation-state attribution, motives, industries | Monthly (manual) | `ingest-umd-cyber-events.mjs` | Registration |

### Enrichment Services

| Source            | Endpoint                                  | Data Type                        | Schedule | Script                         | Auth     |
| ----------------- | ----------------------------------------- | -------------------------------- | -------- | ------------------------------ | -------- |
| GreyNoise         | `https://api.greynoise.io/v3/community`   | IP reputation, scanner detection | Daily    | `ingest-greynoise.mjs`         | Optional |
| Shodan InternetDB | `https://internetdb.shodan.io/`           | Open ports, services             | Daily    | `enrich-shodan-internetdb.mjs` | None     |
| VirusTotal        | `https://www.virustotal.com/api/v3/`      | IOC reputation, detections       | Daily    | `enrich-virustotal.mjs`        | API Key  |
| Hybrid Analysis   | `https://www.hybrid-analysis.com/api/v2/` | Sandbox analysis reports         | Daily    | `enrich-hybridanalysis.mjs`    | API Key  |
| IP Geolocation    | Various                                   | Geographic location data         | Daily    | `enrich-geolocation.mjs`       | Optional |

---

## Proposed New Data Sources

### Priority 1: Quick Wins (Free, Simple Integration)

These sources use simple JSON/text formats similar to existing integrations.

| Source          | Endpoint                                                                                  | Data Type                     | Value Add                         |
| --------------- | ----------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------- |
| crt.sh          | `https://crt.sh/?output=json&q=%`                                                         | Certificate transparency logs | Early phishing domain detection   |
| Tor Exit Nodes  | `https://check.torproject.org/torbulkexitlist`                                            | Tor exit node IPs             | Anonymization network tracking    |
| Firehol Level 1 | `https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/firehol_level1.netset` | Aggregated IP blocklist       | Consolidated reputation data      |
| OpenPhish       | `https://openphish.com/feed.txt`                                                          | Phishing URLs                 | Supplement PhishTank coverage     |
| C2-Tracker      | `https://github.com/montysecurity/C2-Tracker`                                             | Cobalt Strike, Metasploit C2s | Framework infrastructure tracking |
| Maltrail        | `https://raw.githubusercontent.com/stamparm/maltrail/master/trails/static/malware/`       | Malware indicators            | Additional IOC coverage           |

### Priority 2: High-Value Additions (Free/Freemium)

| Source            | Endpoint                                     | Data Type                | Value Add                       | Auth    | Status                          |
| ----------------- | -------------------------------------------- | ------------------------ | ------------------------------- | ------- | ------------------------------- |
| Exploit-DB        | `https://www.exploit-db.com/`                | PoC exploits             | Exploit availability for CVEs   | None    | ✅ Implemented                  |
| Blocklist.de      | `https://www.blocklist.de/lists/`            | Brute-force attacker IPs | Attack source identification    | None    | ✅ Implemented                  |
| Emerging Threats  | `https://rules.emergingthreats.net/`         | IP lists, Suricata rules | Network-level threat indicators | None    | ✅ Implemented                  |
| TweetFeed.live    | `https://tweetfeed.live/`                    | Security Twitter IOCs    | Real-time community intel       | None    | ⚠️ Deprioritized (API concerns) |
| CIRCL Passive DNS | `https://www.circl.lu/services/passive-dns/` | Historical DNS data      | Domain resolution history       | API Key | ✅ Implemented                  |
| Censys            | `https://search.censys.io/api`               | Certificate/service data | Infrastructure reconnaissance   | API Key | ✅ Implemented                  |
| Pulsedive         | `https://pulsedive.com/api`                  | Community threat intel   | Risk scoring, aggregated feeds  | API Key | ✅ Implemented                  |

### Priority 3: Enhanced Coverage (API Key Required)

| Source            | Endpoint                          | Data Type            | Value Add                   | Auth    | Status         |
| ----------------- | --------------------------------- | -------------------- | --------------------------- | ------- | -------------- |
| ANY.RUN           | `https://any.run/api/`            | Sandbox reports      | Public malware analysis     | API Key | ✅ Implemented |
| Triage (Hatching) | `https://tria.ge/api/`            | Fast malware triage  | Quick sample analysis       | API Key | ✅ Implemented |
| VulnCheck KEV     | `https://vulncheck.com/api/`      | Extended KEV data    | Exploit metadata enrichment | API Key | ✅ Implemented |
| SecurityTrails    | `https://securitytrails.com/api/` | Historical DNS/WHOIS | Domain intelligence         | API Key | Planned        |
| InQuest Labs      | `https://labs.inquest.net/api`    | Malicious documents  | Document-based threats      | API Key | ✅ Implemented |

### Priority 4: Nice to Have (Future Consideration)

| Source          | Endpoint                                | Data Type                    | Value Add                 | Auth      |
| --------------- | --------------------------------------- | ---------------------------- | ------------------------- | --------- |
| Shodan Full API | `https://api.shodan.io/`                | Historical scans, monitors   | Deep infrastructure intel | Paid      |
| BinaryEdge      | `https://api.binaryedge.io/`            | Internet-wide scanning       | Shodan alternative        | Paid      |
| Joe Sandbox     | `https://jbxcloud.joesecurity.org/api/` | Detailed behavioral analysis | Premium sandbox           | Paid      |
| OpenCTI         | GraphQL API                             | STIX threat intel            | Structured threat data    | Self-host |
| MISP Instances  | Various                                 | Community-shared threats     | Sector-specific intel     | Varies    |

---

## Rollout Plan

### Phase 1: Quick Wins (Week 1-2)

**Objective:** Add 6 simple text/JSON feeds with minimal development effort.

| Task | Source          | Effort  | Script Name             |
| ---- | --------------- | ------- | ----------------------- |
| 1.1  | Tor Exit Nodes  | 2 hours | `ingest-tor-exits.mjs`  |
| 1.2  | Firehol Level 1 | 2 hours | `ingest-firehol.mjs`    |
| 1.3  | OpenPhish       | 2 hours | `ingest-openphish.mjs`  |
| 1.4  | Maltrail        | 3 hours | `ingest-maltrail.mjs`   |
| 1.5  | C2-Tracker      | 4 hours | `ingest-c2-tracker.mjs` |
| 1.6  | crt.sh          | 4 hours | `ingest-crtsh.mjs`      |

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

| Task | Source           | Effort  | Script Name                   | Dependencies          |
| ---- | ---------------- | ------- | ----------------------------- | --------------------- |
| 2.1  | Exploit-DB       | 6 hours | `ingest-exploitdb.mjs`        | CVE correlation logic |
| 2.2  | Blocklist.de     | 3 hours | `ingest-blocklist-de.mjs`     | None                  |
| 2.3  | Emerging Threats | 4 hours | `ingest-emerging-threats.mjs` | None                  |
| 2.4  | TweetFeed.live   | 4 hours | `ingest-tweetfeed.mjs`        | IOC parsing logic     |

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

| Task | Source               | Effort  | Script Name                | Dependencies        |
| ---- | -------------------- | ------- | -------------------------- | ------------------- |
| 3.1  | CIRCL Passive DNS    | 6 hours | `enrich-circl-pdns.mjs`    | API key acquisition |
| 3.2  | Censys Certificates  | 8 hours | `ingest-censys.mjs`        | API key acquisition |
| 3.3  | Certificate Alerting | 6 hours | `monitor-certificates.mjs` | Org profile domains |

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

| Task | Source              | Effort  | Script Name             | Dependencies   |
| ---- | ------------------- | ------- | ----------------------- | -------------- |
| 4.1  | ANY.RUN Public      | 6 hours | `ingest-anyrun.mjs`     | API key        |
| 4.2  | Triage              | 6 hours | `ingest-triage.mjs`     | API key        |
| 4.3  | Sandbox Correlation | 8 hours | `correlate-sandbox.mjs` | Tasks 4.1, 4.2 |

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

| Task | Source                       | Effort  | Script Name                      | Dependencies     |
| ---- | ---------------------------- | ------- | -------------------------------- | ---------------- |
| 5.1  | VulnCheck KEV                | 6 hours | `enrich-vulncheck.mjs`           | API key          |
| 5.2  | Exploit Maturity Scoring     | 8 hours | `calculate-exploit-maturity.mjs` | Phase 2 complete |
| 5.3  | Vulnerability Prioritization | 6 hours | `prioritize-vulnerabilities.mjs` | Tasks 5.1, 5.2   |

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

| Source          | Value                     | Complexity | Blocker                  |
| --------------- | ------------------------- | ---------- | ------------------------ |
| Shodan Full API | Deep infrastructure intel | Medium     | Cost (paid tier)         |
| BinaryEdge      | Alternative scanning data | Medium     | Cost (paid tier)         |
| Joe Sandbox     | Premium analysis          | Low        | Cost (paid tier)         |
| OpenCTI         | STIX platform             | High       | Self-hosting requirement |
| SecurityTrails  | Domain intelligence       | Medium     | Cost (paid tier)         |
| MISP Feeds      | Sector-specific intel     | High       | Instance management      |

---

## Integration Architecture

### Ingestion Flow (GitHub Actions)

Data ingestion is handled by GitHub Actions workflows that run on schedule, executing Node.js scripts from the `scripts/` directory.

```
External API/Feed
       │
       ▼
┌─────────────────────────┐
│   GitHub Actions        │  (scripts/ingest-*.mjs)
│  - Cron-triggered       │
│  - Node.js execution    │
│  - Fetch & transform    │
│  - Batch processing     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│    Supabase     │
│  - Upsert data  │
│  - Trigger alerts│
│  - Log changes  │
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

**Workflows:** `.github/workflows/data-ingestion.yml`, `.github/workflows/critical-alerts-ingestion.yml`

### Scheduling Tiers (GitHub Actions Cron)

| Tier     | Cron           | Feeds                                           | Rationale                                |
| -------- | -------------- | ----------------------------------------------- | ---------------------------------------- |
| Critical | `*/30 * * * *` | Ransomlook, CISA KEV, ThreatFox, Feodo, URLhaus | Near real-time ransomware & IOC alerts   |
| High     | `0 */6 * * *`  | NVD, VulnCheck, EPSS                            | Vulnerability intelligence refresh       |
| Daily A  | `0 0 * * *`    | Malpedia, MISP Galaxy, MITRE ATT&CK             | Threat actor intel (low churn)           |
| Daily B  | `0 6 * * *`    | MalwareBazaar, Tor Exits                        | Malware samples, anonymization tracking  |
| Daily C  | `0 12 * * *`   | Pulsedive, Censys                               | Community intel, infrastructure scanning |

### API Authentication Requirements

| Source        | Header                  | Environment Variable                 | Notes                 |
| ------------- | ----------------------- | ------------------------------------ | --------------------- |
| ThreatFox     | `Auth-Key`              | `ABUSECH_API_KEY`                    | Required since 2025   |
| URLhaus       | `Auth-Key`              | `ABUSECH_API_KEY`                    | Same key as ThreatFox |
| MalwareBazaar | `Auth-Key`              | `ABUSECH_API_KEY`                    | Same key as ThreatFox |
| VulnCheck     | `Authorization: Bearer` | `VULNCHECK_API_KEY`                  | Free tier available   |
| Pulsedive     | `key` param             | `PULSEDIVE_API_KEY`                  | Free tier available   |
| Censys        | Basic Auth              | `CENSYS_API_ID`, `CENSYS_API_SECRET` | Free tier available   |

### Error Handling

All ingestion scripts implement:

- Graceful degradation (skip feed if API key missing)
- Batch processing with partial failure handling
- Response logging for debugging via `sync_log` table
- Automatic retry on next scheduled run

---

## Metrics & Monitoring

### Current Coverage Statistics

| Category              | Sources | Records (Approx) |
| --------------------- | ------- | ---------------- |
| Ransomware Incidents  | 3       | 1,600+           |
| IOCs                  | 6       | 50,000+          |
| Vulnerabilities (CVE) | 2       | 10,000+          |
| Known Exploited (KEV) | 1       | 1,100+           |
| Threat Actors         | 3       | 500+             |
| ATT&CK Techniques     | 1       | 700+             |
| Malware Samples       | 1       | 5,000+           |
| Data Breaches         | 1       | 700+             |

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

# Abuse.ch APIs (ThreatFox, URLhaus, MalwareBazaar)
ABUSECH_API_KEY=              # Required since 2025 - get from https://abuse.ch/api/#auth

# Optional Enrichment
GROQ_API_KEY=                 # Server-side only (Vercel) - never prefix with VITE_
VIRUSTOTAL_API_KEY=
HYBRIDANALYSIS_API_KEY=
OTX_API_KEY=
GREYNOISE_API_KEY=
PHISHTANK_API_KEY=
```

### New Threat Intel API Keys (Implemented)

```bash
# VulnCheck - Extended KEV catalog
VULNCHECK_API_KEY=           # Free tier at https://vulncheck.com/

# Pulsedive - Community threat intel
PULSEDIVE_API_KEY=           # Free tier at https://pulsedive.com/api/

# Censys - Certificate/service intelligence
CENSYS_API_ID=               # Free tier at https://search.censys.io/account/api
CENSYS_API_SECRET=

# ANY.RUN - Interactive malware sandbox
ANYRUN_API_KEY=              # Free tier at https://any.run/api-documentation/

# Triage (Hatching) - Malware triage
TRIAGE_API_KEY=              # Free tier at https://tria.ge/account

# InQuest Labs - Document threats
INQUEST_API_KEY=             # Optional, free tier works without key
```

### Legacy Keys Reference (By Phase)

| Phase   | Source    | Variable                             | Status         |
| ------- | --------- | ------------------------------------ | -------------- |
| Phase 3 | CIRCL     | `CIRCL_API_KEY`                      | ✅ Implemented |
| Phase 3 | Censys    | `CENSYS_API_ID`, `CENSYS_API_SECRET` | ✅ Implemented |
| Phase 4 | ANY.RUN   | `ANYRUN_API_KEY`                     | ✅ Implemented |
| Phase 4 | Triage    | `TRIAGE_API_KEY`                     | ✅ Implemented |
| Phase 5 | VulnCheck | `VULNCHECK_API_KEY`                  | ✅ Implemented |
| Phase 5 | Pulsedive | `PULSEDIVE_API_KEY`                  | ✅ Implemented |
| Phase 5 | InQuest   | `INQUEST_API_KEY`                    | ✅ Implemented |

---

## Source Quality Assessment (January 2026 Research)

Independent research was conducted to evaluate proposed sources and identify gaps.

### Priority 1 Sources - Evaluation

| Source              | Verdict       | Assessment                                                                                                                     |
| ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **crt.sh**          | ✅ Excellent  | Industry-standard CT log search. Zero errors in reliability studies vs other monitors. Critical for phishing domain detection. |
| **Tor Exit Nodes**  | ✅ Good       | Simple IP list from official Tor Project, useful for anonymization tracking.                                                   |
| **Firehol Level 1** | ✅ Good       | Well-maintained aggregated blocklist, curated from multiple sources.                                                           |
| **OpenPhish**       | ⚠️ Acceptable | Supplements PhishTank but updates less frequently than premium feeds.                                                          |
| **C2-Tracker**      | ✅ Excellent  | Tracks 2.7k+ confirmed Cobalt Strike servers, actively maintained daily via Shodan.                                            |
| **Maltrail**        | ✅ Good       | Solid supplemental IOC coverage from stamparm's research.                                                                      |

### Priority 2 Sources - Evaluation

| Source                | Verdict      | Assessment                                                                        |
| --------------------- | ------------ | --------------------------------------------------------------------------------- |
| **Exploit-DB**        | ✅ Critical  | Must-have for CVE-to-exploit correlation. Industry standard.                      |
| **Blocklist.de**      | ✅ Good      | Complements existing IP feeds with brute-force attacker data.                     |
| **Emerging Threats**  | ✅ Good      | Suricata rules add detection context beyond IOCs.                                 |
| **TweetFeed.live**    | ⚠️ Fragile   | Relies on X/Twitter API - may break with policy changes. Consider lower priority. |
| **CIRCL Passive DNS** | ✅ Excellent | High-quality historical DNS data from Luxembourg CERT.                            |
| **Censys**            | ✅ Excellent | Better certificate/service data than crt.sh for some use cases.                   |

### Priority 3-4 Sources - Evaluation

| Source                | Verdict     | Assessment                                                                                                          |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **VulnCheck KEV**     | ✅ Critical | Catalog is 173% larger than CISA KEV and 27 days faster at detecting exploited CVEs. Free community tier available. |
| **ANY.RUN**           | ✅ Good     | Public sandbox reports provide behavioral analysis context.                                                         |
| **Triage (Hatching)** | ✅ Good     | Fast automated triage complements ANY.RUN.                                                                          |
| **SecurityTrails**    | ⚠️ Costly   | Value vs cost questionable when CIRCL provides similar DNS history.                                                 |
| **InQuest Labs**      | ✅ Good     | Unique focus on document-based threats (Office, PDF).                                                               |

### Sources NOT Recommended

| Source                     | Reason                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| **TweetFeed.live**         | X/Twitter API reliability concerns after policy changes. Deprioritize.        |
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

#### UMD Cyber Events Database (GDELT-Powered) ✅ COMPLETE

- **URL**: `https://cissm.umd.edu/cyber-events-database`
- **Data Type**: Structured cyber attack events with nation-state attribution
- **Why Critical**: 25+ fields including threat actor type (nation-state/criminal/hacktivist), target industry, motive, severity. Covers 2014-present with monthly updates.
- **Auth**: Registration required (free)
- **Script**: `scripts/ingest-umd-cyber-events.mjs`
- **Migration**: `061_cyber_events.sql`
- **Records**: 16,104 cyber events (2014-2025)
- **Update Frequency**: Monthly (manual download required)
- **Note**: Uses GDELT as upstream data source since January 2025

#### GDELT Project (Real-Time News) - PLANNED

- **URL**: `https://api.gdeltproject.org/api/v2/doc/doc`
- **Data Type**: Global news monitoring for cyber-related coverage
- **Why Valuable**: Real-time monitoring of 100+ languages, 15-minute updates. Early warning for emerging threats, geopolitical correlation.
- **Complementary to UMD**: UMD provides curated monthly data; GDELT provides real-time news alerts
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

| Task | Source          | Effort  | Script Name             | Priority     |
| ---- | --------------- | ------- | ----------------------- | ------------ |
| 1.1  | **EPSS**        | 3 hours | `ingest-epss.mjs`       | **CRITICAL** |
| 1.2  | **GitHub GHSA** | 4 hours | `ingest-ghsa.mjs`       | **CRITICAL** |
| 1.3  | Tor Exit Nodes  | 2 hours | `ingest-tor-exits.mjs`  | High         |
| 1.4  | Firehol Level 1 | 2 hours | `ingest-firehol.mjs`    | High         |
| 1.5  | C2-Tracker      | 4 hours | `ingest-c2-tracker.mjs` | High         |
| 1.6  | crt.sh          | 4 hours | `ingest-crtsh.mjs`      | High         |
| 1.7  | OpenPhish       | 2 hours | `ingest-openphish.mjs`  | Medium       |
| 1.8  | Maltrail        | 3 hours | `ingest-maltrail.mjs`   | Medium       |

**New Database Changes for Phase 1:**

- Add `epss_score` FLOAT and `epss_percentile` FLOAT to `vulnerabilities` table
- Create `advisories` table for GitHub GHSA data
- Add `advisory_ids` array to link CVEs to GHSA advisories

### Revised Phase 2: High-Value Additions

| Task | Source               | Effort  | Script Name                   | Priority |
| ---- | -------------------- | ------- | ----------------------------- | -------- |
| 2.1  | Exploit-DB           | 6 hours | `ingest-exploitdb.mjs`        | Critical |
| 2.2  | **Pulsedive**        | 4 hours | `ingest-pulsedive.mjs`        | **NEW**  |
| 2.3  | Blocklist.de         | 3 hours | `ingest-blocklist-de.mjs`     | High     |
| 2.4  | Emerging Threats     | 4 hours | `ingest-emerging-threats.mjs` | High     |
| 2.5  | **Nuclei Templates** | 5 hours | `ingest-nuclei-templates.mjs` | **NEW**  |

**Removed from Phase 2:** TweetFeed.live (API reliability concerns)

### Revised Phase 5: Vulnerability Prioritization

| Task | Source                       | Effort  | Script Name                      | Notes                                     |
| ---- | ---------------------------- | ------- | -------------------------------- | ----------------------------------------- |
| 5.1  | VulnCheck KEV                | 6 hours | `enrich-vulncheck.mjs`           | Supplements CISA KEV                      |
| 5.2  | **EPSS-based Scoring**       | 4 hours | `calculate-epss-priority.mjs`    | **Replace** manual maturity scoring       |
| 5.3  | Vulnerability Prioritization | 6 hours | `prioritize-vulnerabilities.mjs` | Combine EPSS + KEV + exploit availability |

**Key Change:** Use EPSS as primary prioritization signal instead of manual exploit maturity scoring.

---

## New Environment Variables Required

| Phase   | Source      | Variable                                                 | Status        |
| ------- | ----------- | -------------------------------------------------------- | ------------- |
| Phase 1 | EPSS        | None required                                            | ✅ Active     |
| Phase 1 | GitHub GHSA | None required (or `GITHUB_TOKEN` for higher rate limits) | ✅ Active     |
| Phase 2 | Pulsedive   | `PULSEDIVE_API_KEY`                                      | ✅ Configured |
| Phase 3 | CIRCL       | `CIRCL_API_KEY`                                          | Pending       |
| Phase 3 | Censys      | `CENSYS_API_KEY`                                         | ✅ Configured |
| Phase 4 | ANY.RUN     | `ANYRUN_API_KEY`                                         | Pending       |
| Phase 4 | Triage      | `TRIAGE_API_KEY`                                         | Pending       |
| Phase 5 | VulnCheck   | `VULNCHECK_API_KEY`                                      | ✅ Configured |

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

_Last Updated: January 17, 2026_
_Document Version: 1.3_
_Major Update: Added MITRE ATLAS, ANY.RUN scraper, BGPStream feeds_
