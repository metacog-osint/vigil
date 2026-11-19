-- 185. trim_entity_changelog() archives before it deletes
--
-- STATUS: NOT YET APPLIED.
--
-- WHY
--
-- 080 defined trim_entity_changelog(), which deletes entity_changelog rows older
-- than 90 days. Nothing in the repo calls it and pg_cron is not installed, so it
-- has never run: on 18 Nov 2026 the table held 2,865,393 rows from 17 Jan 2026,
-- 2.63M of them older than 85 days. If anyone ever scheduled or ran it, every
-- logged change to an actor (status, trend, sectors, ttps, aliases) and to an
-- IOC would go with no copy.
--
-- WHAT CHANGES
--
-- The function now moves rows: one statement deletes them and inserts the same
-- rows into archive.entity_changelog, so a row cannot be deleted without being
-- archived (both happen or neither does). Its signature, grants and 20,000-row
-- limit are as in 080. It is NOT scheduled by this migration, and the worker does
-- not call it.
--
-- archive.entity_changelog keeps every column of the original plus archived_at.
-- No foreign key (changed_by is kept as a plain uuid).

begin;

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

create table if not exists archive.entity_changelog (
  id uuid primary key,
  entity_type text not null,
  entity_id uuid not null,
  entity_identifier text,
  change_type text not null,
  changed_fields jsonb not null default '{}',
  changed_by uuid,
  source text,
  created_at timestamptz,
  archived_at timestamptz not null default now()
);

create index if not exists archive_entity_changelog_created_idx
  on archive.entity_changelog (created_at);

create or replace function public.trim_entity_changelog(p_limit int default 3000) returns jsonb
language plpgsql security definer set search_path = public, archive as $fn$
declare trimmed int;
begin
  with moved as (
    delete from entity_changelog where id in (
      select id from entity_changelog where created_at < now() - interval '90 days'
      order by created_at limit least(greatest(p_limit, 0), 20000))
    returning id, entity_type, entity_id, entity_identifier, change_type,
              changed_fields, changed_by, source, created_at
  ), kept as (
    insert into archive.entity_changelog
      (id, entity_type, entity_id, entity_identifier, change_type, changed_fields,
       changed_by, source, created_at)
    select id, entity_type, entity_id, entity_identifier, change_type, changed_fields,
           changed_by, source, created_at
    from moved
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into trimmed from moved;
  return jsonb_build_object('changelog_rows_trimmed', trimmed, 'archived_to', 'archive.entity_changelog');
end;
$fn$;

revoke execute on function public.trim_entity_changelog(int) from public, anon, authenticated;
grant execute on function public.trim_entity_changelog(int) to service_role;

commit;
