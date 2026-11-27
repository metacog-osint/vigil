-- 203: RansomLook's discovery time, as RansomLook gives it and as UTC
--
-- WHAT IS WRONG
--
-- RansomLook's `discovered` field ("2026-11-27 17:26:22.286794") carries no zone. Vigil
-- took its date part as the UTC date. The times run one to two hours ahead of UTC (a post
-- stamped 17:26 arrived while the UTC clock read 17:18 on 27 Nov 2026), which fits Central
-- European time, CET in winter and CEST in summer. So a post RansomLook saw between
-- midnight and 01:00 or 02:00 Paris time is dated a day after its UTC day. Measured
-- 27 Nov 2026: 4,001 RansomLook rows keep the time in raw_data.discovered, and 165 fall on a
-- different calendar day when that time is read as Europe/Paris and converted to UTC.
--
-- WHAT THIS DOES (additive: no column is changed or dropped)
--
--   discovered_local   text, RansomLook's own discovery time exactly as given (no zone)
--   discovered_at      timestamptz, that time read as Europe/Paris, so stored in UTC
--
-- and fills both for every incident whose raw_data.discovered holds a date and time.
--
-- WHAT THIS DOES NOT DO, deliberately
--
-- discovered_date is unchanged. It is the de-duplication key of the RansomLook feed
-- (actor, victim, discovered_date), and every count and page reads it, so moving it would
-- re-insert claims and shift published daily counts. A reader that wants the UTC day uses
-- (discovered_at at time zone 'UTC')::date. Moving discovered_date itself is a separate change.
--
-- ORDER: apply this before deploying the worker that writes the two columns; a worker that
-- wrote them first would have its RansomLook inserts refused.

begin;

alter table public.incidents
  add column if not exists discovered_local text,
  add column if not exists discovered_at timestamptz;

comment on column public.incidents.discovered_local is
  'The source''s own discovery time, exactly as it gives it, with no zone (RansomLook: Central European time).';
comment on column public.incidents.discovered_at is
  'discovered_local read in the source''s zone (RansomLook: Europe/Paris), stored as a UTC instant.';

update public.incidents
set discovered_local = raw_data->>'discovered',
    discovered_at = ((raw_data->>'discovered')::timestamp at time zone 'Europe/Paris')
where source like '%ransomlook%'
  and discovered_at is null
  and raw_data->>'discovered' ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$';

commit;

-- VERIFY
--
--   select count(*) filled,
--          count(*) filter (where (discovered_at at time zone 'UTC')::date <> discovered_date) day_differs
--   from incidents where discovered_at is not null;
--   -- expected on 27 Nov 2026: about 4,001 filled, about 165 day_differs
