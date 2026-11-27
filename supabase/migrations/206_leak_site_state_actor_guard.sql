-- 206. A leak-site group is not merged into a state actor by name alone
--
-- STATUS: NOT APPLIED. Replaces upsert_actors (098) and upsert_group_profiles (087).
--
-- WHY
--
-- upsert_actors and upsert_group_profiles resolve a group to an actor by its
-- normalised name. Both leak-site feeds (RansomLook claims, Ransomware.live group
-- profiles) go through them, and so do MITRE ATT&CK, MISP Galaxy and Malpedia.
-- When a new leak site takes the name of an espionage group, its claims land on
-- that group's record:
--
--   * RansomLook's group "inception" (13 claims, 17 to 26 Nov 2026) resolved to
--     MITRE G0100 "Inception", a cyber espionage group active since at least 2014
--     (https://attack.mitre.org/groups/G0100/). The record took the leak site's
--     first_seen (2026-11-17), last_seen, trend status and the alias "inception".
--   * Ransomware.live's profile of the same leak site resolved to the same record,
--     added its .onion address to actor_sites and, because ttps is rebuilt from
--     actor_techniques (empty for this record), cleared the record's 22 ATT&CK
--     technique ids on 18 Nov 2026.
--
-- Matching by type alone would not do: MITRE types every group it tracks "apt",
-- including ransomware groups it tracks under its own ids (Akira G1024, Play G1040,
-- BlackByte G1043), whose leak-site claims belong on those records.
--
-- WHAT CHANGES
--
-- 1. A leak-site source (ransomlook, ransomware.live, ransomwatch) that resolves to
--    an actor typed apt or nation-state that has no leak-site claims and no leak
--    site yet does not write to it. The group goes to its own record, typed
--    ransomware and marked metadata.leak_site_key, and record_finding queues
--    leak_site_name_collision for a person: whether the two are one group. If a
--    person decides they are, merge_actor(leak-site record, state record) joins
--    them; the state record then has claims and later runs attach to it.
--    Records that already carry leak-site claims (Akira, Play and the rest) are
--    unchanged.
-- 2. Both functions first look for a record holding that leak_site_key, so a split
--    group keeps resolving to its own record.
-- 3. One-off: the "inception" leak site moves off G0100. Every moved row's old
--    actor id is kept in archive.actor_split_moves, with the G0100 values replaced.
--    G0100's first_seen, last_seen and trend status go back to what they were
--    before 17 Nov 2026 (archive.entity_changelog / entity_changelog), the alias
--    "inception" is removed and its ttps are restored from the changelog.
--
-- The rest of both functions is as in 098 and 087.

begin;

-- ---------------------------------------------------------------------------
-- Moves made by a split, with each row's old actor id
-- ---------------------------------------------------------------------------
create table if not exists archive.actor_split_moves (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_key jsonb not null,
  old_actor_id uuid not null,
  new_actor_id uuid,
  old_values jsonb,
  reason text not null,
  moved_at timestamptz not null default now()
);
revoke all on archive.actor_split_moves from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Is writing a leak-site group to this actor a name collision?
-- ---------------------------------------------------------------------------
create or replace function public.leak_site_collides(p_target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from threat_actors a
    where a.id = p_target
      and a.actor_type in ('apt', 'nation-state')
      and coalesce(a.metadata->>'leak_site_key', '') = ''
      and not exists (select 1 from incidents i where i.actor_id = a.id)
      and not exists (select 1 from actor_sites s where s.actor_id = a.id)
  )
$$;
revoke execute on function public.leak_site_collides(uuid) from public, anon, authenticated;
grant execute on function public.leak_site_collides(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The leak-site group's own record: found by key, or made and queued for review
-- ---------------------------------------------------------------------------
create or replace function public.leak_site_actor(p_key text, p_name text, p_state uuid, p_source text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  found uuid;
  nm text := format('%s (leak site)', btrim(p_name));
  st threat_actors%rowtype;
begin
  select a.id into found from threat_actors a
  where a.metadata->>'leak_site_key' = p_key order by a.created_at limit 1;

  if found is null then
    if exists (select 1 from threat_actors a where a.name = nm) then
      nm := format('%s (leak site, %s)', btrim(p_name), left(md5(p_key), 6));
    end if;
    insert into threat_actors (name, aliases, actor_type, status, source, metadata)
    values (nm, array[btrim(p_name)], 'ransomware', 'active', p_source,
            jsonb_build_object('leak_site_key', p_key, 'name_collides_with', p_state))
    returning id into found;
  end if;

  select * into st from threat_actors where id = p_state;
  perform record_finding(
    'leak_site_name_collision', p_key, 'warning', 'open',
    jsonb_build_object(
      'question', 'Is this leak-site group the same as the named state-linked actor? '
                  || 'If so, merge_actor(leak_site_actor_id, state_actor_id).',
      'leak_site_name', p_name,
      'leak_site_source', p_source,
      'leak_site_actor_id', found,
      'state_actor_id', p_state,
      'state_actor_name', st.name,
      'state_actor_type', st.actor_type,
      'state_actor_source', st.source));
  return found;
end;
$$;
revoke execute on function public.leak_site_actor(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.leak_site_actor(text, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- upsert_actors: 098 plus the leak-site lookup and guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_actors(p_actors jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, archive AS $$
DECLARE
  e jsonb;
  k text;
  target uuid;
  leak boolean;
  result jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_actors) <> 'array' THEN
    RAISE EXCEPTION 'upsert_actors expects a JSON array';
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_actors) LOOP
    k := actor_key(e->>'name');
    CONTINUE WHEN k = '';
    target := NULL;
    leak := coalesce(e->>'source', '') IN ('ransomlook', 'ransomware.live', 'ransomwatch');

    -- 0. A leak-site group split from a same-named state actor earlier
    IF leak THEN
      SELECT a.id INTO target FROM threat_actors a
      WHERE a.metadata->>'leak_site_key' = k ORDER BY a.created_at LIMIT 1;
    END IF;

    -- 1. Same normalised name
    IF target IS NULL THEN
      SELECT a.id INTO target FROM threat_actors a
      WHERE actor_key(a.name) = k ORDER BY canonical_rank(a), a.created_at LIMIT 1;
    END IF;

    -- 2. A spelling that was merged away earlier
    IF target IS NULL THEN
      SELECT m.canonical_id INTO target
      FROM archive.threat_actors_merged_20260919 m
      JOIN threat_actors t ON t.id = m.canonical_id
      WHERE actor_key(m.name) = k LIMIT 1;
    END IF;

    -- A name alone does not join a leak site to a state actor (206)
    IF leak AND target IS NOT NULL AND leak_site_collides(target) THEN
      target := leak_site_actor(k, e->>'name', target, e->>'source');
    END IF;

    IF target IS NULL THEN
      INSERT INTO threat_actors (name, aliases, actor_type, status, source, description,
                                 first_seen, last_seen, target_sectors, target_countries, metadata,
                                 origin_country, origin_confidence, origin_source)
      VALUES (e->>'name',
              jsonb_text_array(e->'aliases'),
              coalesce(e->>'actor_type', 'unknown'),
              coalesce(e->>'status', 'active'),
              e->>'source',
              e->>'description',
              safe_date(e->>'first_seen'),
              safe_date(e->>'last_seen'),
              jsonb_text_array(e->'target_sectors'),
              jsonb_text_array(e->'target_countries'),
              coalesce(e->'metadata', '{}'::jsonb),
              upper(nullif(btrim(coalesce(e->>'origin_country', '')), '')),
              nullif(btrim(coalesce(e->>'origin_confidence', '')), '')::int,
              nullif(btrim(coalesce(e->>'origin_source', '')), ''))
      RETURNING id INTO target;
    ELSE
      UPDATE threat_actors t SET
        -- coalesce: array_agg over nothing is NULL, which would count as a change
        aliases = coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(
                     coalesce(t.aliases, '{}') || jsonb_text_array(e->'aliases') || ARRAY[e->>'name']) x
                   WHERE x IS NOT NULL AND x <> '' AND x <> t.name), '{}'),
        target_sectors = coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(t.target_sectors, '{}') || jsonb_text_array(e->'target_sectors')) x), '{}'),
        target_countries = coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(t.target_countries, '{}') || jsonb_text_array(e->'target_countries')) x), '{}'),
        description = coalesce(t.description, e->>'description'),
        actor_type = CASE WHEN t.actor_type IS NULL OR t.actor_type = 'unknown'
                          THEN coalesce(e->>'actor_type', t.actor_type) ELSE t.actor_type END,
        first_seen = LEAST(t.first_seen, safe_date(e->>'first_seen')),
        last_seen = GREATEST(t.last_seen, safe_date(e->>'last_seen')),
        metadata = coalesce(t.metadata, '{}'::jsonb) || coalesce(e->'metadata', '{}'::jsonb),
        -- Origin is filled where unknown and never overwritten: a reviewed
        -- attribution should not be replaced by a feed's default.
        origin_country = coalesce(t.origin_country,
                                  upper(nullif(btrim(coalesce(e->>'origin_country', '')), ''))),
        origin_confidence = coalesce(t.origin_confidence,
                                     nullif(btrim(coalesce(e->>'origin_confidence', '')), '')::int),
        origin_source = coalesce(t.origin_source, nullif(btrim(coalesce(e->>'origin_source', '')), ''))
      WHERE t.id = target;
    END IF;

    result := result || jsonb_build_array(jsonb_build_object('name', e->>'name', 'id', target));
  END LOOP;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_actors(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_actors(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- upsert_group_profiles: 087 plus the leak-site lookup and guard
-- (Ransomware.live profiles are always a leak-site source)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_group_profiles(p_groups jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, archive AS $$
DECLARE
  g jsonb; tac jsonb; t jsonb; tool_cat record; tool text;
  target uuid; k text;
  matched int := 0; unknown int := 0; techs int := 0; skipped int := 0; tools int := 0; sites int := 0;
BEGIN
  IF jsonb_typeof(p_groups) <> 'array' THEN
    RAISE EXCEPTION 'upsert_group_profiles expects a JSON array';
  END IF;

  FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    k := actor_key(g->>'name');
    CONTINUE WHEN k = '';
    target := NULL;

    SELECT a.id INTO target FROM threat_actors a
    WHERE a.metadata->>'leak_site_key' = k ORDER BY a.created_at LIMIT 1;

    IF target IS NULL THEN
      SELECT a.id INTO target FROM threat_actors a
      WHERE actor_key(a.name) = k ORDER BY canonical_rank(a), a.created_at LIMIT 1;
    END IF;

    IF target IS NULL AND coalesce(g->>'altname', 'None') <> 'None' THEN
      SELECT a.id INTO target FROM threat_actors a
      WHERE actor_key(a.name) = actor_key(g->>'altname') ORDER BY canonical_rank(a), a.created_at LIMIT 1;
    END IF;

    IF target IS NULL THEN
      SELECT m.canonical_id INTO target FROM archive.threat_actors_merged_20260919 m
      JOIN threat_actors t2 ON t2.id = m.canonical_id WHERE actor_key(m.name) = k LIMIT 1;
    END IF;

    IF target IS NULL THEN
      unknown := unknown + 1;
      CONTINUE;
    END IF;

    -- A name alone does not join a leak site to a state actor (206)
    IF leak_site_collides(target) THEN
      target := leak_site_actor(k, g->>'name', target, 'ransomware.live');
    END IF;
    matched := matched + 1;

    -- aliases from the source's alternate name
    IF coalesce(g->>'altname', 'None') <> 'None' THEN
      UPDATE threat_actors a SET aliases = coalesce((
        SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(coalesce(a.aliases, '{}') || ARRAY[g->>'altname']) x
        WHERE x IS NOT NULL AND x <> '' AND x <> a.name), '{}')
      WHERE a.id = target;
    END IF;

    -- ATT&CK techniques (skip ids not in the local catalogue: deprecated or tactic ids)
    FOR tac IN SELECT value FROM jsonb_array_elements(coalesce(g->'ttps', '[]'::jsonb)) LOOP
      FOR t IN SELECT value FROM jsonb_array_elements(coalesce(tac->'techniques', '[]'::jsonb)) LOOP
        IF EXISTS (SELECT 1 FROM techniques x WHERE x.id = t->>'technique_id') THEN
          INSERT INTO actor_techniques (actor_id, technique_id, confidence, source, notes, first_seen, last_seen)
          VALUES (target, t->>'technique_id', 'medium', 'ransomware.live',
                  nullif(t->>'technique_details', ''), current_date, current_date)
          ON CONFLICT (actor_id, technique_id) DO UPDATE
          SET last_seen = current_date,
              notes = coalesce(nullif(excluded.notes, ''), actor_techniques.notes)
          WHERE actor_techniques.notes IS DISTINCT FROM excluded.notes
             OR actor_techniques.last_seen IS DISTINCT FROM current_date;
          techs := techs + 1;
        ELSE
          skipped := skipped + 1;
        END IF;
      END LOOP;
    END LOOP;

    -- tools, grouped by category in the source payload
    FOR tool_cat IN
      SELECT kv.key AS cat, kv.value AS names
      FROM jsonb_array_elements(coalesce(g->'tools', '[]'::jsonb)) AS e(entry),
           LATERAL jsonb_each(e.entry) AS kv(key, value)
    LOOP
      FOR tool IN SELECT jsonb_array_elements_text(tool_cat.names) LOOP
        INSERT INTO actor_tools (actor_id, tool_name, category, source, last_seen)
        VALUES (target, tool, tool_cat.cat, 'ransomware.live', current_date)
        ON CONFLICT (actor_id, tool_name, category) DO UPDATE SET last_seen = current_date
        WHERE actor_tools.last_seen IS DISTINCT FROM current_date;
        tools := tools + 1;
      END LOOP;
    END LOOP;

    -- leak-site addresses
    FOR t IN SELECT value FROM jsonb_array_elements(coalesce(g->'locations', '[]'::jsonb)) LOOP
      CONTINUE WHEN coalesce(t->>'fqdn', '') = '';
      INSERT INTO actor_sites (actor_id, fqdn, enabled, available, source, last_seen)
      VALUES (target, t->>'fqdn', (t->>'enabled')::boolean, (t->>'available')::boolean, 'ransomware.live', current_date)
      ON CONFLICT (actor_id, fqdn) DO UPDATE
      SET enabled = excluded.enabled, available = excluded.available, last_seen = current_date;
      sites := sites + 1;
    END LOOP;

    -- keep the actor's ttps array in step for quick display
    UPDATE threat_actors a SET ttps = coalesce((
      SELECT array_agg(DISTINCT technique_id ORDER BY technique_id)
      FROM actor_techniques at WHERE at.actor_id = target), '{}')
    WHERE a.id = target
      AND a.ttps IS DISTINCT FROM (SELECT array_agg(DISTINCT technique_id ORDER BY technique_id)
                                   FROM actor_techniques at WHERE at.actor_id = target);
  END LOOP;

  RETURN jsonb_build_object('matched', matched, 'unknown_groups', unknown,
    'techniques', techs, 'techniques_skipped', skipped, 'tools', tools, 'sites', sites);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_group_profiles(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_group_profiles(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- One-off: the "inception" leak site off MITRE G0100
-- ---------------------------------------------------------------------------
do $split$
declare
  state_id uuid;
  leak_id uuid;
  why text := '206: leak-site group "inception" split from MITRE G0100 Inception';
  st threat_actors%rowtype;
  old_ttps text[];
begin
  select a.id into state_id from threat_actors a
  where a.metadata->>'mitre_id' = 'G0100' and a.source = 'mitre-attack' limit 1;
  if state_id is null then
    raise notice '206: no G0100 record, nothing to split';
    return;
  end if;
  if not exists (select 1 from incidents i where i.actor_id = state_id
                 and i.source in ('ransomlook', 'ransomware.live', 'ransomwatch')) then
    raise notice '206: G0100 holds no leak-site claims, nothing to split';
    return;
  end if;

  select * into st from threat_actors where id = state_id;
  leak_id := leak_site_actor('inception', 'inception', state_id, 'ransomlook');

  -- claims
  insert into archive.actor_split_moves (table_name, row_key, old_actor_id, new_actor_id, reason)
  select 'incidents', jsonb_build_object('id', i.id), state_id, leak_id, why
  from incidents i where i.actor_id = state_id
    and i.source in ('ransomlook', 'ransomware.live', 'ransomwatch');
  update incidents set actor_id = leak_id
  where actor_id = state_id and source in ('ransomlook', 'ransomware.live', 'ransomwatch');

  -- leak-site addresses
  insert into archive.actor_split_moves (table_name, row_key, old_actor_id, new_actor_id, reason)
  select 'actor_sites', jsonb_build_object('fqdn', s.fqdn), state_id, leak_id, why
  from actor_sites s where s.actor_id = state_id and s.source = 'ransomware.live';
  update actor_sites set actor_id = leak_id
  where actor_id = state_id and source = 'ransomware.live';

  -- trend rows, all computed from the leak site's claims (none before 17 Nov 2026)
  insert into archive.actor_split_moves (table_name, row_key, old_actor_id, new_actor_id, reason)
  select 'actor_trend_history', jsonb_build_object('id', h.id), state_id, leak_id, why
  from actor_trend_history h where h.actor_id = state_id and h.recorded_date >= date '2026-11-17';
  update actor_trend_history set actor_id = leak_id
  where actor_id = state_id and recorded_date >= date '2026-11-17';

  -- G0100's ATT&CK ids, cleared on 18 Nov 2026 by the leak site's empty profile
  select array(select jsonb_array_elements_text(c.changed_fields->'ttps'->'old')) into old_ttps
  from entity_changelog c
  where c.entity_id = state_id and c.changed_fields ? 'ttps'
    and jsonb_array_length(c.changed_fields->'ttps'->'new') = 0
    and c.created_at >= timestamptz '2026-11-17'
  order by c.created_at limit 1;

  -- G0100 as it was before the leak site, old values kept
  insert into archive.actor_split_moves (table_name, row_key, old_actor_id, new_actor_id, old_values, reason)
  values ('threat_actors', jsonb_build_object('id', state_id), state_id, null,
          jsonb_build_object('aliases', st.aliases, 'first_seen', st.first_seen, 'last_seen', st.last_seen,
                             'trend_status', st.trend_status, 'incidents_7d', st.incidents_7d,
                             'incidents_prev_7d', st.incidents_prev_7d,
                             'incident_velocity', st.incident_velocity, 'ttps', st.ttps,
                             'surge', st.surge, 'surge_claims_7d', st.surge_claims_7d),
          why);
  update threat_actors set
    aliases = array_remove(aliases, 'inception'),
    first_seen = null,
    last_seen = null,
    trend_status = null,
    incidents_7d = 0,
    incidents_prev_7d = 0,
    incident_velocity = 0,
    surge = false,
    surge_claims_7d = null,
    ttps = case when coalesce(cardinality(ttps), 0) = 0 and coalesce(cardinality(old_ttps), 0) > 0
                then old_ttps else ttps end
  where id = state_id;

  -- the leak site's own dates, from its claims
  update threat_actors a set
    first_seen = (select min(discovered_date) from incidents where actor_id = leak_id),
    last_seen = (select max(discovered_date) from incidents where actor_id = leak_id)
  where a.id = leak_id;
end
$split$;

commit;
