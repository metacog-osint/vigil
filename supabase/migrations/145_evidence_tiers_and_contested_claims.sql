-- 145: what kind of source is speaking, and what to do when two of them disagree
--
-- WHY THIS EXISTS
--
-- Vigil already records who said a thing (`origin_source`, `attributed_activity.source`)
-- and how strongly they said it (`attribution_strength`). It records nothing
-- about *what kind of body* is speaking, and it has no way at all to hold two
-- conflicting numbers at once. Today the second case is handled by picking one
-- and printing it, which is the failure this project exists to refuse.
--
-- The framework below is not invented here. It is the source hierarchy from
-- the owner's own scam-disruption compilation (v1.0, 21 August 2026), which
-- states it better than this repository ever has:
--
--   Tier 1  Primary documents and forensic record. Court filings and
--           indictments; DOJ, Treasury/OFAC and FinCEN actions; FBI IC3
--           statistical reporting; UN publications; formal corporate
--           announcements of fact.
--   Tier 2  Named commercial research and reputable press. Attributed to the
--           named firm or outlet, never floated as neutral fact. A commercial
--           estimate is always named as that firm's estimate.
--   Tier 3  Interested-party and state messaging. Retained where it discloses
--           what a party claims, not what is established. Never load-bearing.
--
-- THE NON-UPGRADE RULE, WHICH IS THE POINT OF THE WHOLE MIGRATION
--
-- The compilation states it as: "A Tier 2 estimate repeated by a Tier 3
-- interested party does not become Tier 1." The mechanism it describes is the
-- one that actually damages this field:
--
--   a commercial firm publishes a loss estimate, the figure is recycled
--   through vendor blogs, aggregators and press summaries until it acquires
--   the texture of an official statistic.
--
-- Nothing stops that happening, here or anywhere else, because every system
-- that stores a figure stores the source it was read from rather than the
-- source that produced it. Read from enough places, one estimate becomes five
-- corroborating sources.
--
-- So `claim_values.derived_from` points a repetition at what it repeats, and
-- `claim_values_resolved` walks that chain to the root. A value's effective
-- tier is **the tier of the originator**, never of the repeater, and it cannot
-- be improved by being carried. `contested_claims_summary.distinct_origins`
-- then counts originators rather than citations, so a claim supported by one
-- estimate quoted four times reports one origin and not four.
--
-- That count is the difference between corroboration and echo.
--
-- WHY THIS IS NOT FRAUD-SPECIFIC
--
-- The seed data is scam and threat-finance reporting because that is where the
-- worked examples were written down. The problem is general: `incidents`
-- already carries the same disease - `victim_country_disagreement` has 25 open
-- findings, which is this table's question asked about countries instead of
-- numbers. Nothing below mentions a domain.
--
-- WHAT IS DELIBERATELY NOT DONE
--
-- No figure below is asserted by Vigil. Every seeded value is entered with
-- `verification = 'carried_forward'` and an `entered_from` naming the document
-- it was read in, because **none of them has been checked against its primary
-- source by this migration**. review_contested_claims() queues exactly that as
-- work. Recording the numbers while recording that nobody has verified them is
-- the discipline; seeding them as facts would be the thing the table exists to
-- prevent.
--
-- Resolutions are not guessed either. Where the compilation records a handling
-- decision made by a person, it is carried with `decided_by` naming them and
-- the date they made it. Where it does not, `resolution` stays 'unresolved'
-- and the queue asks.

begin;

-- ---------------------------------------------------------------------------
-- 1. Publishers, and what kind of body each one is
--
--    Separate from source_licences on purpose. That table answers "may Vigil
--    sell what this feed produced" and is keyed by ingestion feed. This one
--    answers "what weight does this body's word carry" and includes publishers
--    Vigil has never ingested and never will - a court, a junta's state media.
--    Where a publisher is also a feed, licence_source_id joins them.
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_publishers (
  publisher_id text primary key,
  display_name text not null,

  -- Null means nobody has classified it. An unclassified publisher is not a
  -- Tier 1 publisher - the same rule source_licences.checked_on already states
  -- about an unread licence.
  tier smallint check (tier in (1, 2, 3)),
  tier_rationale text,

  publisher_type text check (publisher_type in (
    'court', 'government_agency', 'intergovernmental',
    'commercial_research', 'press', 'academic',
    'interested_party', 'state_media', 'compilation'
  )),

  -- Set where this publisher is also an ingested feed, so the licence gate and
  -- the evidence tier cannot drift apart.
  licence_source_id text references public.source_licences(source_id),

  checked_on date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A tier is a judgment. It does not get recorded without its reason.
  constraint tier_requires_rationale
    check (tier is null or tier_rationale is not null)
);

comment on table public.evidence_publishers is
  'What kind of body each publisher is, on the three-tier hierarchy. Distinct '
  'from source_licences, which records what a feed permits rather than what a '
  'publisher word is worth.';
comment on column public.evidence_publishers.tier is
  '1 primary/forensic, 2 named commercial research or reputable press, '
  '3 interested party. Null means unclassified, which is not the same as '
  'trustworthy.';

-- ---------------------------------------------------------------------------
-- 2. The question under dispute
-- ---------------------------------------------------------------------------
create table if not exists public.contested_claims (
  id uuid primary key default gen_random_uuid(),
  claim_key text not null unique,
  question text not null,

  -- What is being measured, and over what window. Most disagreements in this
  -- field are two bodies measuring different things, and recording the window
  -- is what makes that visible instead of arguable.
  unit text,
  period_start date,
  period_end date,
  scope_note text,

  resolution text not null default 'unresolved' check (resolution in (
    'unresolved',            -- nobody has ruled
    'present_both',          -- both stand; show both
    'present_range',         -- one range, not one number
    'prefer_one',            -- one value is right and the reason is recorded
    'do_not_quote',          -- no figure is quotable; describe it another way
    'transcription_artefact' -- not a disagreement; someone mistyped
  )),
  handling text,             -- what a person must do when using this claim

  decided_by text,
  decided_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A ruling without a reason and a name is the guess this project refuses.
  constraint resolution_requires_reasoning
    check (resolution = 'unresolved'
           or (handling is not null and decided_by is not null))
);

comment on table public.contested_claims is
  'One parameter that two or more sources measure differently. Resolution '
  'records what a person decided to do about it, never what a rule inferred.';

-- ---------------------------------------------------------------------------
-- 3. The competing values
-- ---------------------------------------------------------------------------
create table if not exists public.claim_values (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.contested_claims(id) on delete cascade,
  publisher_id text not null references public.evidence_publishers(publisher_id),

  -- value_text carries what cannot honestly be a number: "61,000 BTC", a range
  -- as published, a figure withdrawn.
  value_numeric numeric,
  value_text text,

  -- The measured/projected distinction, which is the most common way a reader
  -- is misled without anyone lying.
  measurement text not null check (measurement in (
    'measured', 'estimated', 'projected', 'reported', 'claimed'
  )),

  as_of date,
  window_note text,
  source_url text,
  citation text,

  -- THE NON-UPGRADE MECHANISM. Set when this row is a repetition of another
  -- row rather than an independent measurement. The effective tier is then the
  -- originator's, and this row adds no corroboration.
  derived_from uuid references public.claim_values(id) on delete set null,

  verification text not null default 'unconfirmed' check (verification in (
    'verified',         -- read against the primary source, on verified_on
    'carried_forward',  -- taken from an earlier compilation, not re-checked
    'unconfirmed'       -- could not be confirmed, or single-source and flagged
  )),
  verified_on date,

  -- How the row reached Vigil, which is not the same as who published the
  -- figure. A value entered from a compilation has not been read at source.
  entered_from text,
  notes text,

  created_at timestamptz not null default now(),

  constraint has_a_value check (value_numeric is not null or value_text is not null),
  constraint verified_has_a_date check (verification <> 'verified' or verified_on is not null),
  constraint not_its_own_source check (derived_from is null or derived_from <> id)
);

create index if not exists idx_claim_values_claim on public.claim_values (claim_id);
create index if not exists idx_claim_values_derived on public.claim_values (derived_from)
  where derived_from is not null;

comment on column public.claim_values.derived_from is
  'The value this one repeats. Repetition never improves a tier and never '
  'counts as corroboration; see claim_values_resolved.';
comment on column public.claim_values.entered_from is
  'The document Vigil read this in, as opposed to the body that published it.';

-- ---------------------------------------------------------------------------
-- 4. Cycles. A -> B -> A would make the recursive walk below run forever, and
--    it is the obvious way to fake an origin.
-- ---------------------------------------------------------------------------
create or replace function public.claim_value_no_cycle()
returns trigger language plpgsql set search_path = public as $fn$
declare
  cursor_id uuid := new.derived_from;
  hops int := 0;
begin
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'derived_from would create a cycle at claim_value %', new.id;
    end if;
    hops := hops + 1;
    if hops > 32 then
      raise exception 'derived_from chain deeper than 32 from claim_value %', new.id;
    end if;
    select derived_from into cursor_id from claim_values where id = cursor_id;
  end loop;
  return new;
end;
$fn$;

drop trigger if exists claim_value_no_cycle on public.claim_values;
create trigger claim_value_no_cycle
  before insert or update of derived_from on public.claim_values
  for each row when (new.derived_from is not null)
  execute function public.claim_value_no_cycle();

-- ---------------------------------------------------------------------------
-- 5. Resolution: walk each value back to the body that produced it
-- ---------------------------------------------------------------------------
create or replace view public.claim_values_resolved
with (security_invoker = true) as
with recursive origin as (
  -- An independent value is its own origin.
  select
    v.id            as value_id,
    v.id            as origin_value_id,
    v.publisher_id  as origin_publisher_id,
    0               as repetition_depth
  from public.claim_values v
  where v.derived_from is null

  union all

  -- A repetition inherits the origin of what it repeats.
  select
    v.id,
    o.origin_value_id,
    o.origin_publisher_id,
    o.repetition_depth + 1
  from public.claim_values v
  join origin o on o.value_id = v.derived_from
)
select
  v.id,
  v.claim_id,
  c.claim_key,
  v.publisher_id,
  p.display_name        as publisher_name,
  p.tier                as publisher_tier,
  o.origin_publisher_id,
  op.display_name       as origin_publisher_name,
  -- The whole rule, in one column: the tier of whoever produced the figure.
  op.tier               as effective_tier,
  o.repetition_depth,
  (o.repetition_depth > 0) as is_repetition,
  v.value_numeric,
  v.value_text,
  v.measurement,
  v.as_of,
  v.window_note,
  v.verification,
  v.verified_on,
  v.entered_from,
  v.source_url,
  v.citation,
  v.notes
from public.claim_values v
join origin o on o.value_id = v.id
join public.contested_claims c on c.id = v.claim_id
join public.evidence_publishers p on p.publisher_id = v.publisher_id
join public.evidence_publishers op on op.publisher_id = o.origin_publisher_id;

comment on view public.claim_values_resolved is
  'Each value with the tier of the body that produced it, not the one it was '
  'read from. effective_tier cannot be improved by repetition.';

-- ---------------------------------------------------------------------------
-- 6. The summary a page reads. distinct_origins is the number that matters.
-- ---------------------------------------------------------------------------
create or replace view public.contested_claims_summary
with (security_invoker = true) as
select
  c.id,
  c.claim_key,
  c.question,
  c.unit,
  c.period_start,
  c.period_end,
  c.scope_note,
  c.resolution,
  c.handling,
  c.decided_by,
  c.decided_at,
  count(r.id)                                              as values_recorded,
  count(distinct r.origin_publisher_id)                    as distinct_origins,
  count(r.id) filter (where r.is_repetition)               as repetitions,
  min(r.effective_tier)                                    as best_tier,
  count(r.id) filter (where r.measurement = 'projected')   as projections,
  count(r.id) filter (where r.verification = 'verified')   as values_verified,
  min(r.value_numeric)                                     as lowest_value,
  max(r.value_numeric)                                     as highest_value,
  -- How far apart the extremes are, as a share of the smaller. Null where the
  -- values are not numeric or not comparable.
  case
    when min(r.value_numeric) > 0 and count(r.value_numeric) > 1
    then round((max(r.value_numeric) - min(r.value_numeric)) / min(r.value_numeric), 3)
  end                                                      as spread_ratio
from public.contested_claims c
left join public.claim_values_resolved r on r.claim_id = c.id
group by c.id;

comment on view public.contested_claims_summary is
  'distinct_origins counts bodies that produced a figure, not citations. Four '
  'values and one origin is one estimate quoted four times.';

-- ---------------------------------------------------------------------------
-- 7. RLS. Read-only to the product; writes are service-role.
-- ---------------------------------------------------------------------------
alter table public.evidence_publishers enable row level security;
alter table public.contested_claims    enable row level security;
alter table public.claim_values        enable row level security;

drop policy if exists evidence_publishers_read on public.evidence_publishers;
create policy evidence_publishers_read on public.evidence_publishers
  for select to anon, authenticated using (true);

drop policy if exists contested_claims_read on public.contested_claims;
create policy contested_claims_read on public.contested_claims
  for select to anon, authenticated using (true);

drop policy if exists claim_values_read on public.claim_values;
create policy claim_values_read on public.claim_values
  for select to anon, authenticated using (true);

grant select on public.evidence_publishers      to anon, authenticated;
grant select on public.contested_claims         to anon, authenticated;
grant select on public.claim_values             to anon, authenticated;
grant select on public.claim_values_resolved    to anon, authenticated;
grant select on public.contested_claims_summary to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. The review checks. Every one of these is a question for a person.
-- ---------------------------------------------------------------------------
create or replace function public.review_contested_claims()
returns void language plpgsql security definer set search_path = public as $fn$
declare r record;
begin
  -- The flagship check: looks corroborated, is not. Three or more values that
  -- all trace to one body.
  for r in
    select claim_key, question, values_recorded, distinct_origins
    from contested_claims_summary
    where values_recorded >= 3 and distinct_origins = 1
  loop
    perform record_finding(
      'claim_single_origin_repeated', r.claim_key, 'warning', 'open',
      jsonb_build_object('question', r.question,
                         'values', r.values_recorded,
                         'origins', r.distinct_origins,
                         'asks', 'Values agree because they are one estimate repeated. Is any of them independent?'));
  end loop;

  -- Two bodies disagree and nobody has said what to do about it.
  for r in
    select claim_key, question, distinct_origins, spread_ratio
    from contested_claims_summary
    where distinct_origins >= 2 and resolution = 'unresolved'
  loop
    perform record_finding(
      'claim_unresolved_disagreement', r.claim_key, 'warning', 'open',
      jsonb_build_object('question', r.question,
                         'origins', r.distinct_origins,
                         'spread_ratio', r.spread_ratio,
                         'asks', 'Different measurements, or a real disagreement?'));
  end loop;

  -- A projection is the only thing on the record. Quoting it alone is the
  -- error the compilation names explicitly.
  for r in
    select claim_key, question
    from contested_claims_summary
    where projections > 0 and projections = values_recorded
  loop
    perform record_finding(
      'claim_projection_only', r.claim_key, 'warning', 'open',
      jsonb_build_object('question', r.question,
                         'asks', 'Only a projection is recorded. Is there a measured figure?'));
  end loop;

  -- Everything on the record for this claim is interested-party messaging.
  -- Tier 3 is retained because it discloses what a party claims; a claim that
  -- rests on nothing else must never be load-bearing.
  for r in
    select claim_key, question, best_tier
    from contested_claims_summary
    where best_tier = 3
  loop
    perform record_finding(
      'claim_rests_on_tier_3', r.claim_key, 'warning', 'open',
      jsonb_build_object('question', r.question,
                         'asks', 'Only interested-party messaging is recorded. Find a Tier 1 or 2 source, or mark the claim as what a party asserts.'));
  end loop;

  -- Carried forward and never checked at source.
  for r in
    select c.claim_key, v.id::text as value_id, p.display_name, v.entered_from
    from claim_values v
    join contested_claims c on c.id = v.claim_id
    join evidence_publishers p on p.publisher_id = v.publisher_id
    where v.verification <> 'verified'
  loop
    perform record_finding(
      'claim_value_unverified', r.claim_key || ' / ' || r.value_id, 'info', 'open',
      jsonb_build_object('publisher', r.display_name,
                         'entered_from', r.entered_from,
                         'asks', 'Read against the primary source and set verified_on.'));
  end loop;

  -- A publisher nobody has tiered, already carrying values.
  for r in
    select distinct p.publisher_id, p.display_name
    from claim_values v
    join evidence_publishers p on p.publisher_id = v.publisher_id
    where p.tier is null
  loop
    perform record_finding(
      'publisher_untiered', r.publisher_id, 'warning', 'open',
      jsonb_build_object('publisher', r.display_name,
                         'asks', 'Classify 1/2/3 with a rationale, or its values carry no weight.'));
  end loop;
end;
$fn$;

revoke execute on function public.review_contested_claims() from public;
revoke execute on function public.review_contested_claims() from anon;

comment on function public.review_contested_claims() is
  'Queues every judgment this schema can detect but must not make. Called '
  'after ingestion; safe to re-run.';

commit;
