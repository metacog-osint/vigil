-- 135: watch the campaign linker
--
-- A job with no row in feed_expectations is not watched, and this one has the
-- failure mode that produced the problem 134 fixed: it goes quiet, new MITRE
-- campaigns arrive with a null actor_id, and the campaigns table drifts back
-- to looking like a usable source of attributed operations without being one.
--
-- Not critical. It is a maintenance pass over rows already held, so if it
-- stops nothing goes stale - a link simply does not appear.

begin;

insert into feed_expectations (feed_id, expected_interval_minutes, critical, note) values
  (
    'campaign-links',
    1440,
    false,
    'link_campaign_actors: resolves campaigns.actor_id from the actor names '
      || 'MITRE publishes. Only links an unambiguous single match; a campaign '
      || 'MITRE attributes to two groups, or a name matching several actor '
      || 'records, is queued for review rather than picked.'
  )
on conflict (feed_id) do update
  set expected_interval_minutes = excluded.expected_interval_minutes,
      critical = excluded.critical,
      note = excluded.note;

commit;
