# Review queue: what a rule can close, and what still needs a person

_Measured live, read-only, 15 Nov 2026 (Supabase `faqazkwdkajhxmwxchop`). The
auto-close is migration 165; tests in `supabase/tests/reviewAutoClose.test.js`._

## The finding that changes the picture

750 findings are open, 600 of them `sec_disclosure_candidate`. **583 of those
600 are not SEC filings.** Each says "_company_ filed 8-K Item 1.05 on _date_",
but joined back to `victim_disclosures` on that subject, every matching record
is a state breach notice:

| Matching records              | Findings |
| ----------------------------- | -------: |
| CA AG only                    |      329 |
| WA AG only                    |       90 |
| OR AG only                    |       63 |
| two or three state registries |      101 |
| **SEC 8-K / 8-K/A**           |   **17** |

Cause: migrations 141 and 143 put state notices in `victim_disclosures` and say
they are never matched to an incident. But 130's `apply_victim_disclosures`,
run on every SEC sync, scans every `unreviewed` row whatever its `source`, so
from 21 Sep it swept up to 100 state notices a run into the queue under an SEC
label, and set 714 of them to `match_status = 'candidate'`. `/disclosures`
counts `candidate` as reviewed, and `/api/feed` publishes it.

## Classification of every open kind

### Auto-closable by a deterministic rule (migration 165)

| Rule                | Applies to                                                                                             | Why it is not a judgment                                                                                                                                       | Closes  |
| ------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `not_an_sec_filing` | open `sec_disclosure_candidate` whose subject matches no `sec-edgar` row and at least one state notice | The finding asserts an 8-K that is not there. It was raised by a bug against a documented design. The 714 notices go back to `unreviewed`, logged per finding. | **583** |
| `feed_recovered`    | open `source_upstream_down` whose feed now reads `fresh` in `feed_health`                              | The finding reports a feed down. `ransomwhere` has run on the Zenodo route since; fresh on 9 Nov.                                                              | **1**   |

Considered and rejected as rules: an open finding whose latest verdict is
confirmed or rejected (measured: 0, `record_verdict` already prevents it);
alias pairs already decided (all 7 are `unreviewed` in
`actor_relationship_decisions`); the 100 malformed KEV keys (still 100).

**How a close is recorded:** status `auto_closed` (new, distinct from
`auto_resolved`, which a check uses for its own findings, and from
`resolved`/`dismissed`, which only a person's verdict sets). One row per close
in `finding_auto_closures`: rule, reason, prior status, and what else changed.
`reopen_auto_closed(rule, reason[, finding_id])` restores the finding and the
notices exactly. Nothing is deleted. The `/review` page gets a "Closed by a
rule" tab that shows the rule and reason on each card.

**Re-running:** not scheduled, and no worker deploy. 165 fixes the scan
(`source = 'sec-edgar'` only), so the first rule has nothing new to find; the
second is a one-off. `select * from auto_close_findings(false)` is the dry run
and `(true)` applies. If rules accumulate, call it from the daily quality
check. `record_finding` reopens an `auto_closed` row if its check raises it
again, which is intended: the check outranks the rule.

### Automatable with help (a person still decides)

| Kind                                  | Open | What would cut the work                                                                                                                  |
| ------------------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `sec_disclosure_candidate` (real)     |   17 | Show the gap between filing and claim date (13 of 17 within 90 days), and group 8-K with its 8-K/A. Sort by gap.                         |
| state notice ↔ claim                  |    — | Built in 166: see below.                                                                                                                 |
| `victim_country_disagreement`         |   43 | Pre-fill each victim's website TLD and the address the notice or filing gives; batch by source pair. Re-raised daily, so verdicts stick. |
| `advisory_indicators_unread`          |   29 | This is reading work, not a yes/no. A per-document page with the PDF beside an indicator form.                                           |
| `claim_value_unverified`              |   17 | Link the primary source and show the stored value beside it; one click sets `verified_on`.                                               |
| `vendor_attribution_candidate`        |   14 | Show the sentence around the matched phrase ("Traced to"), not just the title.                                                           |
| `leak_site_notice_candidate`/`review` |   16 | Show the post body where the source has one; 3 have none and should be `deferred` with that reason.                                      |

Common to all: the page loads every open finding at once (750) with no filter
by kind. A filter by `check_name` and bulk "defer with this reason" would make
the queue readable.

### Needs a person

`actor_alias_review` (7), `actor_origin_ambiguous` (5), `family_actor_review`
(3), `attribution_unstated` (2), `actor_origin_disagreement`,
`campaign_multiple_actors`, `sanctions_alias_match`, `actor_row_may_be_malware_family`,
`actor_resumed_after_takedown`, `claim_rests_on_tier_3`,
`claim_single_origin_repeated`, `publisher_untiered`: attribution and identity
calls, which reminder 7 keeps human.

`audit_log_trust`, `review_authority`, `ioc_actor_backfill`,
`victim_name_quality`, `vulnerability_key_quality`: design decisions for Tom,
each with a recommendation already in its details. Each is one verdict.

## After 165

Open falls from 750 to 166. Of those, about 100 are mechanical-with-help and
about 66 are calls only a person can make.

## Done in the second pass (migration 166 and the page)

| Item                          | What shipped                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC candidates                | Each card shows the days between claim and filing. Filtering to the kind sorts by company then date, so an 8-K sits beside its 8-K/A, and says how many other filings the company has queued.                                                                                                                                                                                                             |
| Readable queue                | A kind filter with counts. With one kind chosen, "Defer all shown" records `deferred` with one reason on each item. It is the only bulk verdict: confirm and reject stay one at a time.                                                                                                                                                                                                                   |
| State notice ↔ claim          | Tom decided on 15 Nov to ask. `breach_notice_candidate`, one per notice whose claim falls within 90 days of the breach or report date, listing every qualifying claim. Never a match: `match_status` stays `unreviewed`. Triggers on new notices and new claims keep it current. **377 notices** (measured 15 Nov: 434 pairs, 285 claims).                                                                |
| `/disclosures` reviewed count | Counts `corroborated` and `unrelated` only. It counted `candidate` too, which read 731 filings as ruled on when none had been.                                                                                                                                                                                                                                                                            |
| Country disagreements         | `review_country_evidence`: the victim's website, its domain and, for a country-code domain, which side it agrees with. Shown on the card, never applied. **Today none of the 43 has a victim website on file**: every link held is the ransomware.live page for the claim, which 168 stops the view from reading as the victim's site. The card says so, and uses a real site when a source supplies one. |

## The five design questions, with recommendations

Each needs one verdict on `/review`, recorded by Tom. None is recorded here.

1. **`audit_log_trust`: should browser audit entries go through the API?**
   Recommend **confirmed**: route `src/lib/auditLogs.js` through
   `api/_lib/audit.js` (service key, server side) and drop the insert policy
   for `authenticated`. While Tom is the only user, it changes nothing visible,
   and it makes the log evidence rather than self-report.
2. **`review_authority`: should a verdict need a server-side reviewer list?**
   Recommend **deferred**, with the reason "only the operator signs in today".
   It matters once Vigil has users other than Tom. The fix then is a
   `reviewers` table checked inside `record_verdict`.
3. **`ioc_actor_backfill`: derive `iocs.actor_id` from `malware_family`?**
   Recommend **rejected** (do not backfill). This is already the
   recommendation in the finding: a name match is not an attribution (Mirai,
   Snake, XWorm), and 3.8% match at all. The defensible route is a provenance
   column set at ingestion.
4. **`victim_name_quality`: lift the names out of six HTML descriptions?**
   Recommend **confirmed**: lift the five names, keep the raw markup in
   `raw_data`, and mark the sixth (an empty list) placeholder. Each is
   identifiable by reading it, so this is a cleanup and not a guess.
5. **`vulnerability_key_quality`: remove the 100 malformed KEV duplicates?**
   Recommend **confirmed**, with an archive copy first, per migration 094's
   rule. Every one has a well-formed twin that is already KEV and carries
   more. Removing them ends the 1,825 vs 1,925 KEV count disagreement.

## After 166

The open queue is 166 + 377 new state-notice questions, about 543. The new
ones are sortable by gap, and 220 of them are within 30 days.
