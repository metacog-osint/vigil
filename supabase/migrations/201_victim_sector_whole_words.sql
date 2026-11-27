-- 201: a victim's sector comes from whole words of its name; each tag replaced is kept
--
-- WHAT WAS WRONG
--
-- The RansomLook feed guessed a claim's sector from the victim's name with
-- name.includes(keyword), so a keyword inside another word set it: "Soils" and
-- "Gastroenterologists" filed as energy ("oil", "gas"), "Magasin" as energy,
-- "Biotechnology" as technology, "eMarketer" as retail. Measured on 23 November
-- 2026, 70 of 257 tags in five sectors over 60 days rested on such a match, and
-- /api/feed carries the sector to COP.
--
-- WHAT THIS DOES
--
-- The rule now lives in workers/src/lib/victimSector.js and matches each keyword
-- as a whole word (with its plural). This migration adds the place a replaced
-- tag goes and the one function that replaces tags. It changes no row itself.
--
-- incidents.victim_sector_history is a JSON array, oldest first, of the tags a
-- row has had: {sector, rule, replaced_at, replaced_by}. Nothing is dropped: a
-- tag is replaced only by appending the old one here.
--
-- apply_victim_sector_retag(p_changes) takes [{id, from, to}] and, for each
-- RansomLook row whose victim_sector is still `from`, appends `from` to the
-- history and sets `to` (which may be null). A row whose tag has changed since
-- the plan was made is skipped and counted. Run twice, it changes nothing the
-- second time.
--
-- The plan is made by scripts/retag-victim-sectors.mjs, which reads the rows,
-- runs the old and new rules from the same module the worker uses, and proposes a
-- change only where the stored tag is the one the old rule gives for that name.
-- A tag from anywhere else is left alone. Dry run by default; --apply calls the
-- function with the service-role key.
--
-- ORDER
--
-- Either order is safe: the worker writes only victim_sector, never this column.
-- Rows the old worker tags between this migration and the worker deploy are
-- picked up by running the script again after the deploy.
--
-- WHO CAN REACH IT
--
-- The column is read with the table, as before. The function runs as its caller
-- (SECURITY INVOKER) and only service_role may execute it.

alter table public.incidents
  add column if not exists victim_sector_history jsonb not null default '[]'::jsonb;

comment on column public.incidents.victim_sector_history is
  'Earlier victim_sector tags, oldest first: {sector, rule, replaced_at, replaced_by}. Appended by '
  'apply_victim_sector_retag (201); never trimmed.';

create or replace function public.apply_victim_sector_retag(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_changed int;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'apply_victim_sector_retag: p_changes must be a JSON array of {id, from, to}';
  end if;

  select count(*) into v_total from jsonb_array_elements(p_changes);

  with c as (
    select distinct on ((e->>'id')::uuid)
           (e->>'id')::uuid as id,
           nullif(e->>'from', '') as from_sector,
           nullif(e->>'to', '') as to_sector
      from jsonb_array_elements(p_changes) e
  ), u as (
    update public.incidents i
       set victim_sector = c.to_sector,
           victim_sector_history = i.victim_sector_history || jsonb_build_array(
             jsonb_build_object(
               'sector', c.from_sector,
               'rule', 'name-substring',
               'replaced_at', now(),
               'replaced_by', 'name-whole-word-1'
             ))
      from c
     where i.id = c.id
       and i.source = 'ransomlook'
       and i.victim_sector is not distinct from c.from_sector
       and c.to_sector is distinct from c.from_sector
    returning 1
  )
  select count(*) into v_changed from u;

  return jsonb_build_object('changed', v_changed, 'skipped', v_total - v_changed);
end
$$;

comment on function public.apply_victim_sector_retag(jsonb) is
  'Replaces RansomLook victim_sector tags the substring rule wrote with the whole-word rule''s, '
  'keeping each replaced tag in victim_sector_history (201). Plan: scripts/retag-victim-sectors.mjs.';

revoke execute on function public.apply_victim_sector_retag(jsonb) from public, anon, authenticated;
grant execute on function public.apply_victim_sector_retag(jsonb) to service_role;
