-- 175. The hub's daily line, built by the worker and stored with its real time
--
-- STATUS: not applied.
--
-- GET /api/summary (31 Oct 2026) built "Latest from Vigil" on every request:
-- three reads, 4.3 s measured on 12 Nov 2026, and a built_at that was always
-- the request time. So a reader could not tell a summary built a minute ago
-- from one Vigil last managed to build days ago, and nor could COP (suite
-- review of 15 Nov 2026, findings.md: "Vigil can never look stale to COP while
-- its API answers").
--
-- Now the worker's public-summary job builds it each hour with the same reads,
-- as the public makes them (the anon key, so the public policies decide what
-- counts), and stores it here. /api/summary reads this one row. built_at is
-- when the worker built it; if the worker stops, built_at stops with it.
--
-- One row, id 'latest'. A build with nothing true to state (no day whose
-- ingestion can be shown complete, or a count of zero) leaves the last good
-- row alone, so its built_at ages and says so. Each run is in sync_log as
-- source 'public-summary', whatever it found.
--
-- GRANTS
--
-- anon and authenticated read it, as they read every other part of the
-- summary today. Only service_role writes, which is the worker's key.

begin;

create table public.public_summary (
  id text primary key default 'latest' check (id = 'latest'),
  built_at timestamptz not null,
  day date not null,
  summary jsonb not null
);

comment on table public.public_summary is
  'The hub''s daily line (GET /api/summary), built hourly by the worker''s public-summary job '
  'from the public reads. built_at is when it was built. 175.';

revoke all on public.public_summary from anon, authenticated;
grant select on public.public_summary to anon, authenticated;
grant select, insert, update on public.public_summary to service_role;
alter table public.public_summary enable row level security;

create policy public_summary_read on public.public_summary
  for select to anon, authenticated using (true);

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values
  ('public-summary', 60, false,
   'Builds the hub''s daily line from the public reads and stores it in public_summary (175). '
   'Not critical until it has run.')
on conflict (feed_id) do nothing;

commit;
