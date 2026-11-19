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
**Checked directly on 26 October 2026:** Ransomware.live, RansomLook,
Ransomwatch, MITRE ATT&CK, MISP Galaxy, Malpedia. Migration 160 extends the
switch from origins to claims, countries and group profiles:
`incidents_commercial`, `threat_actors_commercial` and the three
`actor_*_commercial` views show only what a sellable source supplied, and
delete nothing.

**Carried from the project's own records and not re-checked:** DB-IP. Confirm
it against the source before relying on it.

| Source                                  | Terms                                                                                | What that means here                                                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ransomware.live**                     | **Non-commercial use only** (T&C §4–§6, updated 19 Aug 2026)                         | Commercial use needs the owner's prior written approval, and raw data may not be re-served by API or file. Measured 26 Oct: sole source of 15,204 incidents, 11,317 victim countries and every group profile row. All of it is excluded from the `*_commercial` views. |
| RansomLook                              | **CC BY 4.0** (data and API responses, per its README)                               | Sellable with credit. Supplies every leak-site claim since 29 May 2026.                                                                                                                                                                                              |
| Ransomwatch                             | **Unlicense**                                                                        | Sellable. Archived 3 March 2026; its rows stay.                                                                                                                                                                                                                      |
| MITRE ATT&CK                            | **ATT&CK Terms of Use**, royalty-free including commercial use                       | MITRE's copyright notice and the licence must travel with any copy of ATT&CK content.                                                                                                                                                                                |
| MISP Galaxy                             | **CC0 1.0 or 2-clause BSD** (dual)                                                   | Sellable. Supplies most actor origins. Data spells it both `misp-galaxy` and `misp_galaxy`; since 160 both match.                                                                                                                                                    |
| **Malpedia**                            | **CC BY-NC-SA 3.0 — NonCommercial**                                                  | **Treated as ETDA is** (owner's decision, 26 Oct 2026): free product only. Supplies 1,101 actor names and nothing else.                                                                                                                                               |
| ThreatCluster Ransomware-Intel          | **TLP:CLEAR** — "free to use, redistribute, and integrate. Attribution appreciated." | No restriction on use or redistribution. Attributed anyway.                                                                                                                                                                                                          |
| SEC EDGAR                               | **US public domain**                                                                 | A work of the US government. No restriction.                                                                                                                                                                                                                         |
| OFAC SDN                                | **US public domain**                                                                 | A work of the US government. No restriction.                                                                                                                                                                                                                         |
| **ETDA / ThaiCERT Threat Group Cards**  | **CC BY-NC-SA 4.0 — NonCommercial**                                                  | **Free to use now; must be removed from anything sold.** Supplies 186 actor origin countries, all carrying `origin_source = 'etda'`, and `actor_origins_commercial` already excludes them. The licence is re-read from the API response on every run.                |
| State AG breach registries (CA, WA, OR) | **US state government public record**                                                | Filed under Civil Code 1798.29/1798.82 and published as a public record. Sellable.                                                                                                                                                                                   |
| CISA advisories                         | **US public domain**                                                                 | A work of the US government. No restriction.                                                                                                                                                                                                                         |
| NCSC-UK                                 | **Open Government Licence v3.0**                                                     | Free to use and redistribute, **including commercially**, provided the source is acknowledged. Vigil stores the advisory URL and the publishing government on every row, which satisfies it.                                                                         |
| CISA Vulnrichment                       | **CC0 1.0 Universal** (repo LICENSE, checked 18 Nov 2026)                            | Public domain dedication: free public redistribution and commercial use allowed. Credited to CISA anyway. Registered in `source_licences` as `cisa-vulnrichment` (176).                                                                                               |
| Android security bulletins              | **CC BY 4.0** (source.android.com/license, checked 19 Nov 2026)                    | Free redistribution, including commercial, **with attribution to Google**. Only the exploitation notes, their CVEs and the bulletin date are taken. `source_licences`: `android-bulletins` (187). |
| Mozilla security advisories             | **MPL-2.0** (repo LICENSE, checked 19 Nov 2026)                                     | Free redistribution, including commercial, with the licence notice. Only sentences about the wild, their CVEs and the announced date are taken. `source_licences`: `mozilla-mfsa` (187). |
| CERT-FR alerts                          | **Licence Ouverte 2.0** (cert.cyber.gouv.fr/mentions-legales, checked 19 Nov 2026) | Free reuse, including commercial, **crediting CERT-FR and the date of last update**. Kept in French. `source_licences`: `certfr-alerts` (188). |
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
| ThreatCluster Ransomware-Intel | `https://raw.githubusercontent.com/Jam0k/Ransomware-Intel/main/data/victims.csv` | **Victim country**, sector, listed/delisted status    | Daily           | `workers/src/feeds/threatcluster.js` → `threatcluster-victims` Edge Function | None |

**Why Ransomwatch was removed.** Its upstream repo was archived on 3 Mar 2026
and stopped updating, so the ingest script was deleted on 4 Oct 2026. Incidents
it loaded before then keep `source = 'ransomwatch'`.

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
| CISA Vulnrichment | `github.com/cisagov/vulnrichment` (develop), commits since a cursor | CISA's SSVC judgments: Exploitation none/poc/active, Automatable, Technical Impact | Hourly (worker `cisa-vulnrichment`, Edge Function of the same name) | `scripts/backfill-cisa-vulnrichment.mjs` (one-time) | GitHub token, public read only |
| Android and Mozilla exploitation statements | `source.android.com/docs/security/bulletin/*` (7 families); `codeload.github.com/mozilla/foundation-security-advisories` tarball | The vendor's own sentence that a CVE was or may be exploited, verbatim, with its kind | Daily (worker `vendor-exploited`, Edge Function of the same name) | `scripts/backfill-vendor-exploited.mjs` (Android, one-time) | None |
| CERT-FR alerts | `cert.cyber.gouv.fr/alerte/json/` (list) and `/alerte/<reference>/json/` | CERT-FR's "act now" notices: title, CVEs, vendors, risks, summary, dates, the alert's JSON | Daily (worker `certfr-alerts`, Edge Function of the same name) | `scripts/backfill-vendor-exploited.mjs --certfr` (one-time) | None |

**CISA Vulnrichment (176, 18 Nov 2026)** is kept apart from KEV, in `cisa_ssvc`, not in `vulnerabilities`. `active` is CISA's judgment that a CVE is exploited, which it makes for CVEs that are not in KEV too; `poc` is its judgment that a proof of concept is public, not a report of exploitation. Tom chose to store it first and decide where it shows; on 18 Nov 2026 he chose to show it (177): anon reads `cisa_ssvc`, `/api/feed` carries "CISA's ADP assessment of <CVE>: exploitation active (assessed <date>)" for CVEs assessed active in the last 7 days, marked "not in CISA's KEV catalog" where Vigil's copy of KEV does not list them, and the vulnerability panel shows the same line with Automatable and Technical Impact. Credited as "CISA Vulnrichment (CC0)". Never a KEV label. The independent known-exploited signal that replaces VulnCheck (retired 15 Nov, 164) starts here; PoC aggregators, MSRC and Project Zero stay separate and come only after their terms are read.

**KEV is CISA's catalogue as it stands (180, 19 Nov 2026).** The cisa-kev job hands its full list to `reconcile_kev_catalog` after each complete run, which clears the KEV columns on any row CISA does not list (archived in `kev_unlisted_rows`). Before 180, 8 rows were KEV in Vigil and in no CISA list: 5 VulnCheck leftovers, 2 of unrecorded origin and CVE-2026-69836, which CISA removed.

**Android and Mozilla, the vendors' own words (187, 19 Nov 2026)** are kept apart from KEV, in `vendor_exploit_statements`, one row per vendor, document, CVE and sentence, the sentence verbatim. Android, every bulletin family (Android, Pixel, Pixel Watch, Wear OS, Automotive, Chromecast, XR), has used one wording since 2020: "There are indications that <CVEs> may be under limited, targeted exploitation." 406 bulletins on 19 Nov 2026 held 51 such notes naming 44 CVEs; 41 are in KEV, and CVE-2020-0500, CVE-2022-20415 and CVE-2023-21096 are not. Mozilla's 1,636 advisories hold 29 sentences about the wild in nine wordings, and only twelve of them (9 CVEs, all in KEV) say this flaw was attacked. The rest say a related flaw or another product was exploited, that exploit code is public with no attacks known, or that it was not abused. Each is stored with its `kind` (`exploited`, `exploited_elsewhere`, `public_exploit_only`, `not_exploited`), from a table of wordings a person has read (`_shared/vendorExploited.ts`); a new wording is stored as `unclassified`, never shown, and opens a `vendor_statement_unclassified` finding. source.android.com picks a page's language by where the request comes from, so the function asks for `?hl=en` and refuses a page not served in English; the first backfill from Supabase's edge got German, Polish and Farsi pages and found 17 notes of 51. **Shown on the vulnerability panel only** (191; Tom, 19 Nov 2026: "panel only"): each statement its own line, verbatim, with its document link and credit, "not in CISA's KEV catalog" where Vigil's KEV copy lacks the CVE; and the Vulnerabilities page lists the CVEs a vendor says were exploited that KEV does not carry (the three Android CVEs, which Vigil holds no row for). Not on `/api/feed` until about a week of clean daily runs, then as separate fields per source. `unclassified` rows stay closed. Credit: "Google, Android security bulletin (CC BY 4.0)" and "Mozilla Foundation Security Advisory (MPL-2.0)". Never a KEV label.

**CERT-FR's alerts (188, 19 Nov 2026)** are kept as CERT-FR's notices, in `certfr_alerts`, one row per alert as CERT-FR published it: its title, summary and risks in French, its CVEs, the vendors it names, first publication, latest revision, the date CERT-FR closed it and the alert's JSON. 401 alerts from 2000 to 2026; 269 name a CVE, 502 CVEs in all, 218 of them in KEV, and Vigil holds no row at all for 284. An alert is CERT-FR's call to act, about exploitation, an incident or a campaign, so no exploitation label is derived from it. The API moved to `cert.cyber.gouv.fr` in 2026 (`www.cert.ssi.gouv.fr` redirects). Shown on the vulnerability panel since 191 as CERT-FR's notice to act, in its French title, never as an exploitation claim; `raw` stays closed. Credit: "CERT-FR, alerte <reference> (Licence Ouverte 2.0), last updated <date>".

**Known exploited: sources checked, 19 Nov 2026.** The test is free public redistribution. Raw findings are kept outside the repo, in `[local path]`.
- No: MSRC's "Exploited" flag and Exploitability Index (Microsoft's site Terms of Use: personal, non-commercial, no redistribution; CSAF is TLP:WHITE, which is not a licence). Project Zero's 0day "In the Wild" sheet (no licence; the Apache-2.0 repo does not hold the table). Tom wrote to both on 18 Nov 2026 asking for permission. Also no: Apple, Cisco, Fortinet, Ivanti, Oracle, CERT/CC, Singapore CSA, INCIBE, ACN. No licence stated: Chrome Releases, Samsung, Adobe, BSI WID, NCSC-NL, JPCERT. Non-commercial only: Canada CCCS. Unclear: ENISA EUVD (16 EU-KEV-only of 1,803).
- Yes: Android Security Bulletins (CC BY 4.0), Mozilla `foundation-security-advisories` (MPL-2.0), CERT-FR (Licence ouverte 2.0; its alerts are "act now" notices, not all exploitation), UK NCSC (OGL v3, no structured feed), Red Hat (CC BY 4.0, but its exploit_status only points at KEV). PoC layer, kept apart: nomi-sec PoC-in-GitHub (CC0; repositories named for a CVE, fakes included), Nuclei templates (MIT), Metasploit (BSD-3-Clause), Exploit-DB (GPL-2.0+).
- Measured against KEV 2026.11.18: MSRC's 23 exploited CVEs from Nov 2025 to Nov 2026 are all in KEV; Project Zero has 4 of 413 not in KEV; CERT-FR's 2024-2026 alerts name 74 CVEs, 17 not in KEV.

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
| State AG breach registries (CA, WA, OR, VT, MT, SC, ID, DE) | `oag.ca.gov`, `atg.wa.gov`, `justice.oregon.gov`; five more (190) | **8,812 + about 8,700 notifications, every cause**           | Daily    | `workers/src/feeds/state-breach-notices.js` → `state-breach-notices` Edge Function | None                       |
| HHS OCR breach portal (HIPAA, 500+ people) | `ocrportal.hhs.gov/ocr/breach`, both lists, CSV export | **8,092 reports from Oct 2009, every cause** (192) | Daily | `workers/src/feeds/hhs-ocr-breaches.js` → `hhs-ocr-breaches` Edge Function | None (form posts, session cookie) |

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

**Five more states, 19 November 2026 (migration 190).** Vermont (566 notices from 17 Apr 2026; Vermont residents; data categories), Montana (6,689 from May 2015; Montanans; breach start date), South Carolina (915 from Jan 2015; South Carolina residents), Idaho (262 from Jan 2021; no count) and Delaware (322 from Jan 2021, none after 11 Jul 2025; Delaware residents). Each publishes its whole list as one HTML table. A notice listed with no reported date (56 across the five) is counted and left out, because `filed_date` is required. Every row now carries its registry's `persons_affected_scope`; until 190, notices added after 144 had none and fell out of `breach_notices_by_state`'s totals (39 Washington and 47 Oregon on 19 Nov). New notices filed in the last 90 days are queued for review against leak-site claims; older ones loaded by a backfill are stored and not queued. Still not available: Hawaii (stale since Apr 2024), Maryland (yearly SharePoint lists, none for 2026), Iowa and Wisconsin (cards and free text), Texas (Salesforce), and Maine, New Hampshire and Massachusetts, which answer scripted clients with 403. The survey is kept outside the repo, in `[local path]`.

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

**Washington's own cause, since 16 November 2026 (migration 174).** The list
page still carries no cause, but the Attorney General publishes the same
notices as an open dataset, "Data Breach Notifications Affecting Washington
Residents" ([data.wa.gov sb4j-ca4h](https://data.wa.gov/d/sb4j-ca4h)), with
`databreachcause` (Cyberattack, Unauthorized Access, Theft or Mistake) and
`cyberattacktype` (Ransomware, Malware, Phishing, Skimmers, Other,
Unclear/unknown). The `wa-breach-causes` Edge Function reads it daily and
`apply_wa_breach_causes` copies those two fields, as given, onto Vigil's
`wa-ag` rows whose name matches (letters and digits, case folded) and whose
filing date is within three days. It is the AG's category, credited to the AG
and shown on the review card; it still matches nothing to a claim. Measured
16 Nov 2026: 1,698 notices, 597 marked Ransomware; 97 of the 104 open
Washington review cards have a row, 61 of them Ransomware. The dataset states
no licence; Tom approved storing and showing these two fields on 16 Nov 2026,
and `source_licences` registers it (`wa-ag-open-data`) as not cleared for
commercial use. California and Oregon publish no cause anywhere found.

**HHS Office for Civil Rights breach portal, since 19 November 2026 (migration 192).**
HIPAA requires a covered entity or its business associate to report a breach of
unsecured protected health information to the Secretary of HHS, and HITECH
section 13402(e)(4) requires the Secretary to publish those affecting 500 or more
people. OCR's [Breach Portal](https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf)
lists them in two parts, both read every day: **Under Investigation** (reports from
the last 24 months OCR has open; 701 on 19 Nov 2026, 12 Oct 2023 to 16 Oct 2026)
and **Archive** (closed or older; 7,391, 21 Oct 2009 to 6 Oct 2026). The portal
is a JavaServer Faces form with no API and no page per report; the
`hhs-ocr-breaches` Edge Function posts the form as a browser would and takes each
list's CSV export (`supabase/functions/_shared/hhsOcr.ts`).

HHS's own fields are kept as given: name of covered entity, the entity's state
(in `business_location`, because `state` is the registry's state and HHS is not a
state registry), covered entity type, individuals affected (`total` scope),
breach submission date (`filed_date`), type of breach (`breach_cause`,
`cause_source = 'hhs-ocr'`), location of breached information, business associate
present, and OCR's Web Description, verbatim, which OCR writes when it closes a
case (7,146 of the archive). Type of breach on 19 Nov: Hacking/IT Incident 4,885,
Unauthorized Access/Disclosure 1,697, Theft 1,005, Loss 216, Improper Disposal
117, Other 75, a few combined. **Nothing is derived:** 1,274 descriptions contain
the word "ransom", and they stay OCR's words; no report is called ransomware
from its name or its text.

HHS publishes no report number, so a report is name, state and submission date,
plus its place among reports the same filer sent the same day (46 such groups;
one business associate filed seven on 11 Aug 2025). Counts are taken as current
on every run, because OCR revises them, and a report moving to the archive keeps
its row. A new report filed in the last 90 days that names a claimed victim goes
to the review queue with HHS's fields on the card. Not on `/api/feed` until about
a week of clean daily runs.

Licence: a list the Secretary publishes by statute, a work of the US government
(17 U.S.C. 105); no terms on the portal and no robots.txt (404), checked 19 Nov
2026. HHS's web disclaimers restrict only licensed stock images and its seals and
logos. Registered as `hhs-ocr`, commercial use allowed. Not read: the portal's
separate list of 42 CFR Part 2 (substance-use treatment records) breaches.

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

### Financial Crime Advisories

| Source          | Endpoint                                                          | Data Type                                              | Schedule | Script                                                                       | Auth |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | -------- | ---------------------------------------------------------------------------- | ---- |
| FinCEN register | `https://www.fincen.gov/resources/advisoriesbulletinsfact-sheets` | Alerts, advisories, notices, bulletins and fact sheets | Daily    | `workers/src/feeds/fincen-advisories.js` → `fincen-advisories` Edge Function | None |

**Licence: US public domain.** A work of the US government, no restriction.
Registered in `source_licences` as `fincen` before anything could write a row.

**Why this source.** Everything else here records what happened. FinCEN records
what institutions are told to look for, and it is the only body on this list
whose output is written to be acted on under a legal obligation.
`FIN-2023-Alert005` is the pig-butchering alert; `FIN-2026-Alert005`, published
3 September 2026, is "Money Laundering Activity Associated with Digital Asset
Investment Scam Centers".

183 documents on first run, going back to October 2007: 137 advisories,
27 alerts, 18 notices, 1 fact sheet. Nine are rescinded and kept — they were
issued and institutions acted on them. Thirteen are Spanish republications
carrying the same identifier as the English original, which is why `language` is
part of the key.

**There is no feed.** `/rss.xml` and `/news-room/rss` both return 404 (checked
24 September 2026). The register is server-rendered HTML, which is the only
reason this is ingestible without a browser. Two pages with two different
shapes: the register is plain tables linking to PDFs, and the advisory archive
is a Drupal view, fifteen rows to a page, linking to landing pages with the date
in a `<time datetime>`. There are two parsers, because one would be wrong about
each of them differently.

A routine run reads the register and the newest two archive pages, about 28
seconds. The full walk is eleven fetches and took 113 seconds, close enough to
the Edge Function wall clock that a daily job would eventually trip over it, so
it is opt-in with `?full=1` and run by hand.

**What is deliberately not ingested.** The red-flag indicators. They are inside
the PDFs, they are the valuable part, and turning a paragraph of prose into a
structured indicator is a judgment — the kind that put two false attributions in
this database when a regular expression made it. `indicators_read` is false on
every row and `review_regulatory_advisories()` queues the fraud-relevant ones
for a person; 29 are queued as of the first run.

There is no topic column either. A phrase table deciding that an alert "is
about" pig butchering asserts something FinCEN did not say in those words.

---

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
| VulnCheck KEV | **Retired 15 Nov 2026** (migration 164): Service Terms s7 forbid making its data available for free | — | — | — | — |
| CISA ICS-CERT | `https://www.cisa.gov/sites/default/files/feeds/ics-cert_advisories.json` | ICS/OT advisories                    | Daily    | `ingest-cisa-alerts.mjs` | None    |

### Ransomware Payment Tracking

| Source                       | Endpoint                                 | Data Type                                                          | Schedule | Script                                                                    | Auth |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------- | ---- |
| Ransomwhere (Zenodo deposit) | `https://zenodo.org/api/records/6512122` | Ransomware BTC payments, wallet addresses, per-transaction amounts | Weekly   | `workers/src/feeds/ransomwhere.js` -> `ransomwhere-archive` Edge Function | None |

**Licence: CC-BY-4.0. Commercial use permitted with attribution** - cite
`https://doi.org/10.5281/zenodo.6512122`. Registered in `source_licences` as
`ransomwhere-archive`. This is the only ransom-payment source Vigil can reach
that may be sold: ransomware.live is personal-use only and the live
`api.ransomwhe.re/export` carried no stated licence at all.

**The live API is dead, which is why this route exists.** It has returned
HTTP 502 since 20 September 2026. Checked from outside the worker on 4 October:
the export path 502s, `api.ransomwhe.re` answers 403, and `ransomwhe.re` serves
200 and still links to the same URL. The service is broken and has not moved.

**It is a snapshot, not a feed.** The concept DOI always resolves to the newest
deposit; v1.1.0 was published 2024-10-27 and its payments end 19 August 2024.
Re-running will not add anything newer. Every row records `snapshot_version` and
`snapshot_published`, so the age of the data is visible rather than the age of
the import, and the Edge Function skips the 5.5 MB download when the version
already matches `feed_cursors`.

**The total needs its split.** 136 families, 11,178 addresses, 21,790
transactions, about USD 1.016bn at the value on the day of each transaction. Of
that, **USD 682m - 67% - is family "Unlabeled"**, the dataset's own label for an
address it could not attribute. `metadata.attributed` is false on that row.
Quoting the billion without the split would be two thirds a guess, which is the
same error migration 144 exists to prevent for "people affected".

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
| **VulnCheck KEV**     | ❌ Retired  | Retired 15 Nov 2026 (migration 164). The free Community tier's Service Terms (rev. 20 Apr 2026) s7 say its data may not be made available for free, and s12 requires prominent attribution; Vigil is free and public. Written consent requested. Other VulnCheck mentions in this file are historical. |
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
