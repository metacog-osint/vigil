-- 194. Reported exploitation from CIRCL Vulnerability-Lookup sightings, kept apart from KEV
--
-- STATUS: APPLIED 25 November 2026 (20261125171153), exactly as written. Written 21 November 2026 (ideas#135).
--
-- WHY
--
-- VulnCheck KEV was retired on 15 Nov 2026 (164). Tom asked on 21 Nov 2026 for
-- CIRCL's sightings as a separate "reported exploited" signal.
--
-- WHAT IS TAKEN
--
-- An allow-list (supabase/functions/_shared/circlSightings.ts). Anything not on
-- it is counted in the run's result and not stored:
--
--   honeypot       Shadowserver honeypots, OffSeq Mirage
--   government     ENISA's catalogue entries
--   vendor_press   named vendor research and security press hosts
--   social_code    Telegram and GitHub: named by platform, with no link or text
--
-- WHAT IS LEFT OUT, AND WHY
--
--   Previdian      formerly KEVIntel; its terms forbid scraping
--   CIRCL combined CIRCL's scorecard names VulnCheck as a known aggregator and
--                  the origin of this list's entries is unproven
--   SiberKapan     an aggregator of unknown origin
--   CISA catalogue Vigil reads KEV from CISA directly
--   CrowdSec       reuse not stated; ask before adding
--
-- WHAT IS STORED
--
-- Facts only: CVE, source class, source name, link where allowed, first and
-- last sighting. One row per CVE and source: Shadowserver repeats the same CVEs
-- every day. No post text. Never writes is_kev or kev_date. No foreign key to
-- vulnerabilities, because CIRCL sees CVEs Vigil may not hold.
--
-- GRANTS
--
-- anon and authenticated: select on circl_sightings for the vulnerability
-- panel. The cursor is internal. Only apply_circl_sightings writes the table.

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('circl-sightings',
   'CIRCL Vulnerability-Lookup sightings',
   'No named licence for sightings; automated access welcomed',
   'https://vulnerability.circl.lu/about',
   false, true, '2026-11-21',
   'CIRCL''s access patterns welcome automated consumers and its About page calls its dumps open data. '
   'commercial_use stays false until CIRCL confirms. Facts only, credited to CIRCL and the named source. 194.')
on conflict (source_id) do nothing;

create table public.circl_sightings (
  cve_id text not null check (cve_id ~ '^CVE-[0-9]{4}-[0-9]{4,}$'),
  source_class text not null
    check (source_class in ('honeypot', 'government', 'vendor_press', 'social_code')),
  source_name text not null,
  source_link text not null default '',
  first_sighted_at timestamptz not null,
  last_sighted_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  primary key (cve_id, source_class, source_name, source_link)
);

comment on table public.circl_sightings is
  'Reported exploitation per CVE and source, from CIRCL Vulnerability-Lookup. Not KEV and not a '
  'confirmation. Allow-listed sources only. 194.';
comment on column public.circl_sightings.source_link is
  'Empty for social_code: those sources are named by platform and not linked.';

create index circl_sightings_last_idx on public.circl_sightings (last_sighted_at desc);

create table public.circl_sightings_cursor (
  id text primary key default 'exploited' check (id = 'exploited'),
  day date not null,
  next_page int not null default 1 check (next_page >= 1),
  updated_at timestamptz not null default now()
);

comment on table public.circl_sightings_cursor is
  'Start of the date window the circl-sightings job is reading, and the page to resume at. 194.';

-- CIRCL's oldest exploited sighting is dated 21 Dec 2015.
insert into public.circl_sightings_cursor (id, day, next_page)
values ('exploited', '2015-12-01', 1);

revoke all on public.circl_sightings from anon, authenticated;
revoke all on public.circl_sightings_cursor from anon, authenticated;
grant select on public.circl_sightings to anon, authenticated;
grant select on public.circl_sightings to service_role;
grant select, insert, update on public.circl_sightings_cursor to service_role;
alter table public.circl_sightings enable row level security;
alter table public.circl_sightings_cursor enable row level security;

create policy circl_sightings_read on public.circl_sightings
  for select to anon, authenticated using (true);

-- The one writer. Re-reading a day changes nothing: dates only widen.
create or replace function public.apply_circl_sightings(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  added int := 0;
  total int := 0;
begin
  with incoming as (
    select r.cve_id, r.source_class, r.source_name, coalesce(r.source_link, '') as source_link,
           min(r.sighted_at) as first_at, max(r.sighted_at) as last_at
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(
      cve_id text, source_class text, source_name text, source_link text, sighted_at timestamptz
    )
    group by 1, 2, 3, 4
  ), written as (
    insert into public.circl_sightings as t
      (cve_id, source_class, source_name, source_link, first_sighted_at, last_sighted_at)
    select cve_id, source_class, source_name, source_link, first_at, last_at from incoming
    on conflict (cve_id, source_class, source_name, source_link) do update
      set first_sighted_at = least(t.first_sighted_at, excluded.first_sighted_at),
          last_sighted_at = greatest(t.last_sighted_at, excluded.last_sighted_at),
          fetched_at = now()
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) into added, total from written;

  return jsonb_build_object('added', added, 'updated', total - added);
end;
$$;

revoke execute on function public.apply_circl_sightings(jsonb) from public, anon, authenticated;
grant execute on function public.apply_circl_sightings(jsonb) to service_role;

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values
  ('circl-sightings', 60, false,
   'Reported exploitation from CIRCL sightings into circl_sightings (194), allow-listed sources '
   'only, apart from KEV. Not critical until it has run.')
on conflict (feed_id) do nothing;

commit;
