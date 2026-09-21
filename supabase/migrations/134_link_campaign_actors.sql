-- 134: campaigns that name an actor, and did not point at one
--
-- WHAT WAS WRONG
--
-- `campaigns` holds 56 MITRE ATT&CK campaigns. Twenty-five carry
-- `attributed_actors` - an array of names MITRE published - and all 56 have
-- `actor_id` null. So the table looked like a usable source of attributed
-- operations and was not one: nothing could navigate from Volt Typhoon to the
-- KV Botnet activity, or from Sandworm to the 2022 Ukraine Electric Power
-- Attack, because the link existed only as text.
--
-- This matters more than the row count suggests. Every incident Vigil holds
-- is a ransomware leak-site claim, and these campaigns are the opposite:
-- named state operations against infrastructure, with dates, that no attacker
-- published for extortion. They were already in the database, unreachable.
--
-- WHAT IS LINKED, AND WHAT IS NOT
--
-- Only an unambiguous match. All 26 name references resolve against
-- threat_actors on an exact case-insensitive name, so there is no fuzzy
-- matching here and there should not be - "APT5" and "APT-5" being the same
-- group is a judgment, and judgments go to the queue.
--
-- Two kinds are refused and queued instead:
--
--   * A campaign MITRE attributes to more than one group. C0052 "SPACEHOP
--     Activity" names Ke3chang and APT5. `actor_id` holds one actor, so
--     filling it would be choosing one of MITRE's two and publishing that
--     choice as fact.
--
--   * A name matching more than one row in threat_actors. Six do. Picking the
--     first would attach a real campaign to an arbitrary one of several
--     records that happen to share a name.
--
-- In both cases `attributed_actors` keeps every name MITRE gave, so nothing is
-- lost - only the shortcut is withheld, which is the right way round.
--
-- `target_countries` stays empty. MITRE's campaign objects do not carry a
-- target country and inferring one from a campaign name - "2022 Ukraine
-- Electric Power Attack" - would be Vigil asserting something its source did
-- not. The column is empty because the data is absent, which is a different
-- answer from zero.

begin;

/**
 * Resolve campaigns.actor_id from the names MITRE published.
 *
 * Idempotent, and it only ever fills a null: a link a person has set by hand
 * is never overwritten. Returns what it did and what it refused.
 */
create or replace function public.link_campaign_actors()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked int := 0;
  v_ambiguous int := 0;
  v_multi int := 0;
begin
  -- Campaigns with exactly one attributed actor, whose name resolves to
  -- exactly one threat actor.
  with candidate as (
    select c.id as campaign_id,
           c.attributed_actors[1] as actor_name
    from campaigns c
    where c.actor_id is null
      and array_length(c.attributed_actors, 1) = 1
  ),
  resolved as (
    select cand.campaign_id, cand.actor_name,
           -- There is no min(uuid) in Postgres, and with matches = 1 there is
           -- only ever one element to take.
           (array_agg(ta.id))[1] as actor_id,
           count(ta.id) as matches
    from candidate cand
    join threat_actors ta on lower(ta.name) = lower(cand.actor_name)
    group by cand.campaign_id, cand.actor_name
  ),
  applied as (
    update campaigns c
       set actor_id = r.actor_id,
           actor_name = r.actor_name,
           updated_at = now()
      from resolved r
     where c.id = r.campaign_id
       and r.matches = 1
    returning 1
  )
  select count(*) into v_linked from applied;

  -- A name that matches several actor records. Queued, never picked.
  with candidate as (
    select c.id as campaign_id, c.campaign_id as mitre_id, c.name,
           c.attributed_actors[1] as actor_name
    from campaigns c
    where c.actor_id is null
      and array_length(c.attributed_actors, 1) = 1
  ),
  ambiguous as (
    select cand.*, count(ta.id) as matches
    from candidate cand
    join threat_actors ta on lower(ta.name) = lower(cand.actor_name)
    group by cand.campaign_id, cand.mitre_id, cand.name, cand.actor_name
    having count(ta.id) > 1
  )
  select count(*) into v_ambiguous from ambiguous;

  perform record_finding(
    'campaign_actor_ambiguous',
    a.mitre_id,
    'info',
    'open',
    jsonb_build_object(
      'campaign', a.name,
      'actor_name', a.actor_name,
      'matching_actor_records', a.matches,
      'question',
      'MITRE names one group for this campaign and ' || a.matches
        || ' threat_actors rows share that name. Which record is it?'
    )
  )
  from (
    select c.campaign_id as mitre_id, c.name, c.attributed_actors[1] as actor_name,
           count(ta.id) as matches
    from campaigns c
    join threat_actors ta on lower(ta.name) = lower(c.attributed_actors[1])
    where c.actor_id is null and array_length(c.attributed_actors, 1) = 1
    group by c.campaign_id, c.name, c.attributed_actors[1]
    having count(ta.id) > 1
  ) a;

  -- A campaign MITRE attributes to more than one group. actor_id holds one,
  -- so filling it would publish a choice MITRE did not make.
  select count(*) into v_multi
  from campaigns
  where actor_id is null and array_length(attributed_actors, 1) > 1;

  perform record_finding(
    'campaign_multiple_actors',
    c.campaign_id,
    'info',
    'open',
    jsonb_build_object(
      'campaign', c.name,
      'attributed_actors', to_jsonb(c.attributed_actors),
      'question',
      'MITRE attributes this campaign to ' || array_length(c.attributed_actors, 1)
        || ' groups. actor_id holds one. Is one of them primary, or should this '
        || 'campaign stay unlinked?'
    )
  )
  from campaigns c
  where c.actor_id is null and array_length(c.attributed_actors, 1) > 1;

  return jsonb_build_object(
    'source', 'campaigns',
    'linked', v_linked,
    'queued_ambiguous_name', v_ambiguous,
    'queued_multiple_actors', v_multi
  );
end;
$$;

revoke execute on function public.link_campaign_actors() from public, anon, authenticated;
grant execute on function public.link_campaign_actors() to service_role;

select public.link_campaign_actors();

commit;
