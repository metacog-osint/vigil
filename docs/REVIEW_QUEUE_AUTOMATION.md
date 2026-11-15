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

| Kind                                  | Open | What would cut the work                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sec_disclosure_candidate` (real)     |   17 | Show the gap between filing and claim date (13 of 17 within 90 days), and group 8-K with its 8-K/A. Sort by gap.                                                                                                                                                                                                                                    |
| state notice ↔ claim (not queued)     |    — | **Tom's call.** 141/143 chose not to ask. If wanted, a correctly labelled `breach_notice_candidate` limited to a date window (incident or report date within 90 days of the claim) would keep roughly 350 of the 714 notices (counted per notice, not per finding; not re-measured per finding because the database stopped accepting connections). |
| `victim_country_disagreement`         |   43 | Pre-fill each victim's website TLD and the address the notice or filing gives; batch by source pair. Re-raised daily, so verdicts stick.                                                                                                                                                                                                            |
| `advisory_indicators_unread`          |   29 | This is reading work, not a yes/no. A per-document page with the PDF beside an indicator form.                                                                                                                                                                                                                                                      |
| `claim_value_unverified`              |   17 | Link the primary source and show the stored value beside it; one click sets `verified_on`.                                                                                                                                                                                                                                                          |
| `vendor_attribution_candidate`        |   14 | Show the sentence around the matched phrase ("Traced to"), not just the title.                                                                                                                                                                                                                                                                      |
| `leak_site_notice_candidate`/`review` |   16 | Show the post body where the source has one; 3 have none and should be `deferred` with that reason.                                                                                                                                                                                                                                                 |

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
