-- 133: health expectations for the two jobs added on 21 September
--
-- A feed with no row in feed_expectations is not watched. It can stop and
-- nothing says so - which is the same class of silence as a query that returns
-- undefined and renders an empty state. Both jobs below are in the worker
-- registry as of this commit, so both need one.
--
-- NEITHER IS CRITICAL, DELIBERATELY
--
-- `cisa-advisories` was marked critical before it had ever run, which is why
-- ingestion_is_healthy() has read false since 21 September 04:00 - accurately,
-- but as the only red thing in the system. The fair version of that question,
-- asked in the handover, is answered here as: a feed earns critical by having
-- run.
--
-- There is also a specific reason in each case.
--
--   ncsc-advisories    Its feed is a rolling window of everything NCSC
--                      publishes - blogs, guidance, news - and a quiet
--                      fortnight legitimately contains no news items at all.
--                      The function returns success with parsed: 0 for that,
--                      and marking it critical would make a quiet fortnight
--                      look like an outage.
--
--   leak-site-notices  A maintenance pass over rows already held, not an
--                      ingest. If it stops, nothing goes stale; a queue simply
--                      stops growing.

begin;

insert into feed_expectations (feed_id, expected_interval_minutes, critical, note) values
  (
    'ncsc-advisories',
    360,
    false,
    'NCSC-UK news items. Open Government Licence v3.0. The second government '
      || 'attributing independently: with CISA alone, "attributed to Russia" '
      || 'means the United States said so. Reads /news/ only - the feed also '
      || 'carries blogs and guidance - and a title naming a country without '
      || 'stating the relationship is queued as attribution_unstated rather '
      || 'than guessed at. Not critical: the window legitimately empties.'
  ),
  (
    'leak-site-notices',
    60,
    false,
    'detect_leak_site_notices: queues leak-site posts that read as '
      || 'announcements rather than victim claims. It had run exactly once, by '
      || 'hand, when migration 095 was generalised beyond LockBit, so every '
      || 'post published since went unexamined. Only ever queues a candidate '
      || 'and never moves a row, which is why running it hourly is safe.'
  )
on conflict (feed_id) do update
  set expected_interval_minutes = excluded.expected_interval_minutes,
      critical = excluded.critical,
      note = excluded.note;

commit;
