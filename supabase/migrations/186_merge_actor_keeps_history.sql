-- 186. merge_actor keeps the merged-away actor's history rows
--
-- STATUS: APPLIED 19 Nov 2026, 03:56 UTC, as 186_merge_actor_keeps_history (version 20261119035641). Replaces merge_actor as defined in 094.
--
-- WHY
--
-- merge_actor ends with DELETE FROM threat_actors, and these tables reference the
-- actor ON DELETE CASCADE: actor_trend_history (007), actor_takedowns (096),
-- actor_sanctions (088) and actor_activity_snapshots (070). Every auto-merge or
-- reviewed same_entity merge therefore deleted the merged actor's trend history,
-- takedown record, sanction links and activity snapshots. 094 fixed the same fault
-- for actor_tools and actor_sites only.
--
-- WHAT CHANGES
--
-- Before the delete, each of the four tables' rows for the duplicate are moved to
-- the canonical actor, except a row whose key the canonical actor already holds
-- (same day, same sanction entity, same takedown date and source). Those are
-- copied as JSON to archive.actor_merge_children before the cascade removes them.
-- The rest of the function is as in 094.

begin;

create table if not exists archive.actor_merge_children (
  id bigint generated always as identity primary key,
  source_table text not null,
  dup_actor_id uuid not null,
  canonical_id uuid not null,
  row_data jsonb not null,
  archived_at timestamptz not null default now()
);

create or replace function public.merge_actor(p_dup uuid, p_canonical uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, archive as $fn$
declare
  d threat_actors%rowtype;
  moved int := 0; archived int := 0;
begin
  if p_dup = p_canonical then return jsonb_build_object('skipped', 'same id'); end if;
  select * into d from threat_actors where id = p_dup;
  if not found or not exists (select 1 from threat_actors where id = p_canonical) then
    return jsonb_build_object('skipped', 'missing actor');
  end if;

  update threat_actors c set
    aliases = (select array_agg(distinct x) from unnest(coalesce(c.aliases, '{}') || array[d.name] || coalesce(d.aliases, '{}')) x
               where x is not null and x <> c.name),
    ttps = (select array_agg(distinct x) from unnest(coalesce(c.ttps, '{}') || coalesce(d.ttps, '{}')) x where x is not null),
    target_sectors = (select array_agg(distinct x) from unnest(coalesce(c.target_sectors, '{}') || coalesce(d.target_sectors, '{}')) x where x is not null),
    target_countries = (select array_agg(distinct x) from unnest(coalesce(c.target_countries, '{}') || coalesce(d.target_countries, '{}')) x where x is not null),
    first_seen = least(c.first_seen, d.first_seen),
    last_seen = greatest(c.last_seen, d.last_seen),
    description = coalesce(c.description, d.description),
    actor_type = case when d.actor_type = 'ransomware' then 'ransomware' else c.actor_type end
  where c.id = p_canonical;

  with gone as (
    delete from incidents i
    where i.actor_id = p_dup and exists (
      select 1 from incidents k where k.actor_id = p_canonical
        and k.victim_name = i.victim_name and k.discovered_date is not distinct from i.discovered_date)
    returning i.*
  )
  insert into archive.incidents_superseded
  select (jsonb_populate_record(null::archive.incidents_superseded,
            to_jsonb(g) || jsonb_build_object('keep_id', p_canonical, 'superseded_at', now()))).*
  from gone g;
  get diagnostics archived = row_count;

  update incidents set actor_id = p_canonical where actor_id = p_dup;
  get diagnostics moved = row_count;

  insert into actor_techniques (actor_id, technique_id)
  select p_canonical, technique_id from actor_techniques where actor_id = p_dup on conflict do nothing;
  insert into actor_vulnerabilities (actor_id, cve_id, confidence, source, first_seen)
  select p_canonical, cve_id, confidence, source, first_seen from actor_vulnerabilities where actor_id = p_dup
  on conflict do nothing;

  insert into actor_tools (actor_id, tool_name, category, source, first_seen, last_seen)
  select p_canonical, tool_name, category, source, first_seen, last_seen
  from actor_tools where actor_id = p_dup on conflict do nothing;
  insert into actor_sites (actor_id, fqdn, enabled, available, source, first_seen, last_seen)
  select p_canonical, fqdn, enabled, available, source, first_seen, last_seen
  from actor_sites where actor_id = p_dup on conflict do nothing;

  -- History rows (migration 186). Move what does not collide; archive what does.
  update actor_trend_history h set actor_id = p_canonical
  where h.actor_id = p_dup and not exists (
    select 1 from actor_trend_history k where k.actor_id = p_canonical and k.recorded_date = h.recorded_date);
  insert into archive.actor_merge_children (source_table, dup_actor_id, canonical_id, row_data)
  select 'actor_trend_history', p_dup, p_canonical, to_jsonb(h) from actor_trend_history h where h.actor_id = p_dup;

  update actor_takedowns t set actor_id = p_canonical
  where t.actor_id = p_dup and not exists (
    select 1 from actor_takedowns k where k.actor_id = p_canonical
      and k.event_date = t.event_date and k.source_url = t.source_url);
  insert into archive.actor_merge_children (source_table, dup_actor_id, canonical_id, row_data)
  select 'actor_takedowns', p_dup, p_canonical, to_jsonb(t) from actor_takedowns t where t.actor_id = p_dup;

  update actor_sanctions s set actor_id = p_canonical
  where s.actor_id = p_dup and not exists (
    select 1 from actor_sanctions k where k.actor_id = p_canonical and k.entity_uid = s.entity_uid);
  insert into archive.actor_merge_children (source_table, dup_actor_id, canonical_id, row_data)
  select 'actor_sanctions', p_dup, p_canonical, to_jsonb(s) from actor_sanctions s where s.actor_id = p_dup;

  update actor_activity_snapshots a set actor_id = p_canonical
  where a.actor_id = p_dup and not exists (
    select 1 from actor_activity_snapshots k where k.actor_id = p_canonical and k.snapshot_date = a.snapshot_date);
  insert into archive.actor_merge_children (source_table, dup_actor_id, canonical_id, row_data)
  select 'actor_activity_snapshots', p_dup, p_canonical, to_jsonb(a) from actor_activity_snapshots a where a.actor_id = p_dup;

  insert into archive.threat_actors_merged_20260919
  select (jsonb_populate_record(null::archive.threat_actors_merged_20260919,
            to_jsonb(d) || jsonb_build_object('canonical_id', p_canonical))).*;
  delete from threat_actors where id = p_dup;

  perform record_finding('actor_merged', d.name || ' -> ' || (select name from threat_actors where id = p_canonical),
    'info', 'auto_resolved', jsonb_build_object('reason', p_reason, 'incidents_moved', moved, 'duplicates_archived', archived));
  return jsonb_build_object('merged', d.name, 'moved', moved, 'archived', archived);
end;
$fn$;

revoke execute on function public.merge_actor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_actor(uuid, uuid, text) to service_role;

commit;
