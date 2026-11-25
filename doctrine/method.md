# Vigil method (doctrine summary)

The full method lives in the migration headers (`supabase/migrations/`), `README.md` and `docs/`. This page states it
in the terms of The Intelligence Company's doctrine kit (`doctrine/kit/`).

## What it measures
- **Leak-site claims:** victims that extortion groups say they hit, crawled from leak sites (RansomLook since
  29 May 2026). Each is a claim by a criminal, published as `claimed`, never as fact.
- **Group trends:** the site's trend label. Since migration 189, ESCALATING means the group's claims are unusual
  under the rule below (VG-IND-1); DECLINING is migration 077's rule (at least 3 victims the week before and under
  0.75 times that this week), INACTIVE no claim in 30 days, STABLE everything else, including a rise that is not
  unusual for the group.
- **Unusual claims (VG-IND-1):** a group's claims in the last 7 complete UTC days against its own 8 weeks before
  (`apply_actor_surges`, migration 179): at least 5 victims on at least 3 different days, and a count that a negative
  binomial fitted to the group's weekly counts puts below 1 in 100. One batch dump is not a surge, and a group that
  always posts in bursts is judged against its own bursts. A group with no claims in the 8 weeks has no baseline,
  and the feed says so.
- **Known-exploited vulnerabilities:** CISA's KEV catalog, with FIRST's EPSS score and whether ransomware use is known.
- **Victim disclosures:** state attorney-general breach notices (CA, WA, OR) and SEC 8-K Item 1.05 filings, the
  victim's own account.

## Baselines
Unusual claims, and so the ESCALATING label, compare each group with its own previous 8 weeks (rolling); the
DECLINING label with its own previous week. An EPSS alert needs all three: the vulnerability is in CISA's KEV
catalog with known ransomware use, its FIRST EPSS score is at least 0.5 (a fixed threshold), and that score is
current, dated within 3 days. Vigil reads FIRST's daily release once a day, so its score is usually one release
behind FIRST's newest.

## Anomaly versus warning
Everything in the feed is a measurement (kind observation): a group whose claims are unusual for it or a KEV entry that meets the EPSS
alert rule is an anomaly. Warnings, which are judged and carry likelihood and confidence, come later through the
warning problems in `indicators.json`.

## Independent lines of evidence
A leak-site claim and the victim's own filing are independent lines. Two leak-site crawlers relaying the same post are
one line. Judgment calls (which names are one group, when a group is defunct, whether an attribution holds) go to
`data_quality_findings` for a person and are never decided by a rule.

## Licences in the feed
The feed reads claims and group names only from the `*_commercial` views, which hold what a source that permits
redistribution supplied. Ransomware.live's terms forbid re-serving its raw data by API or file, so none of it is in
the feed; counts Vigil computes itself (group trends) are published.

## US persons
Vigil is not bound by EO 12333. Items that name organizations (victims, vendors, filers) say so in
`us_person_data`, so a reader bound by those rules can filter for themselves.

## Gaps and no data
Victim countries arrive later than claims (an independent crawl fills them in), so a new claim often has no place yet;
it is listed without a map point rather than guessed. A feed that misses its expected interval is flagged by
`feed_expectations`; a missing day is "no data", never quiet.

## Feed
`GET /api/feed` returns the current picture in feed contract v2 (`tic-feed/2`, GeoJSON): groups whose claims are unusual for them, leak-site
claims dated from two days before the current UTC date, KEV additions dated from seven days before and victim
disclosures first seen from seven days before (`api/_lib/doctrineFeed.js`, `windowStarts`). The summary names each
window by its first date and states database counts, never a tally of the capped rows. The tests check every item
with the kit's tradecraft linter.
