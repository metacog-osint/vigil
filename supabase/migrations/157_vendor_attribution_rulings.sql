-- 157. A person's reading of a vendor report's attribution can be recorded,
--      and applied to the report
--
-- STATUS: NOT YET APPLIED.
--
-- WHY
--
-- vendor_reports has carried attributed_country, attribution_strength and
-- attribution_phrase since 139, and nothing has ever written them. That was
-- deliberate: across 279 vendor titles not one carried an attribution a parser
-- could read, so attribution lives in prose and a person has to read it. 139
-- queues a review-queue question (vendor_attribution_candidate) for each
-- report whose wording might attribute.
--
-- Recording a verdict on that question (record_verdict, 126) says the
-- question was answered. It does not say what the answer was. There was no
-- way to put a country, a strength and the vendor's own words on the report,
-- so `linguistic`, the weakest strength, added for exactly this corpus, had
-- never been set. SESSION_HANDOFF §2b item 1 names this as what remains.
--
-- WHAT A RULING IS
--
--   attributes        the report attributes the activity. The vendor's own
--                     words are required, with a strength. A country is
--                     required too, except at `linguistic`.
--   names_no_country  read, and it does not attribute. Nothing to quote.
--   deferred          not enough to say yet. The reason is kept and nothing
--                     is applied.
--
-- The vendor's words are required because attribution is quoted, not inferred
-- (131): "China-nexus" and "Chinese state-sponsored" are different claims,
-- and the phrase is what lets a reader see which one was made.
--
-- WHY THE COUNTRY IS OPTIONAL AT `linguistic`
--
-- 139 recorded why `linguistic` exists. GreyNoise wrote of "a suspected
-- Chinese speaker possibly working in UTC+8", which spans China, Taiwan,
-- Singapore, Malaysia, the Philippines and the diaspora. Forcing a country
-- there would turn a statement about language into a statement about a state.
-- A reviewer may record one at that weight, or leave it out and let the phrase
-- carry the language.
--
-- WHAT IT APPLIES
--
-- attributes and names_no_country write the report's attribution columns and
-- attribution_decided_by/_at. names_no_country clears them to null with a
-- decision time, which is how "read, names no one" becomes distinguishable
-- from "never read".
--
-- If the report has an open vendor_attribution_candidate question, it is
-- answered through record_verdict(), so the review queue's status rules stay
-- in one place: attributes -> confirmed, names_no_country -> rejected,
-- deferred -> deferred (stays open). The verdict is then marked applied,
-- because this function applied it. A report can also be ruled on without a
-- queued question; a reviewer can read any report.
--
-- Rulings are append only, like 126 and 156, and vendor_reports carries the
-- current state. The hourly re-import updates only title, summary and
-- last_seen (139), so a ruling survives it; record_finding() keeps a resolved
-- or dismissed question closed on re-run.
--
-- WHO DECIDES
--
-- auth.uid() inside the function, never a value the client sends. The limit
-- 126 records applies: any signed-in user can rule.
--
-- GRANTS
--
-- Revoke everything, then grant what is meant (154, 156): until 30 October
-- 2026 Supabase's defaults grant every new table in full to anon and
-- authenticated.

create table if not exists public.vendor_attribution_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.vendor_reports (id) on delete cascade,
  verdict text not null check (verdict in ('attributes', 'names_no_country', 'deferred')),
  attributed_country text check (attributed_country ~ '^[A-Z]{2}$'),
  attribution_strength text check (attribution_strength in
    ('state', 'affiliated', 'nexus', 'aligned', 'criminal', 'linguistic')),
  attribution_phrase text,
  rationale text not null check (length(btrim(rationale)) >= 10),
  decided_by text not null,
  decided_at timestamptz not null default now(),
  -- The shape of each verdict, so a malformed ruling cannot be stored even by
  -- a caller that skips the function.
  check (
    (verdict = 'attributes'
      and attribution_strength is not null
      and length(btrim(coalesce(attribution_phrase, ''))) >= 3
      and (attributed_country is not null or attribution_strength = 'linguistic'))
    or (verdict <> 'attributes'
      and attributed_country is null
      and attribution_strength is null
      and attribution_phrase is null)
  )
);

create index if not exists idx_vendor_attribution_decisions_report
  on public.vendor_attribution_decisions (report_id, decided_at desc);

comment on table public.vendor_attribution_decisions is
  'Every ruling on what a vendor report attributes, append only. vendor_reports '
  'carries the current state. See migration 157.';

alter table public.vendor_attribution_decisions enable row level security;

drop policy if exists vendor_attribution_decisions_select on public.vendor_attribution_decisions;
create policy vendor_attribution_decisions_select on public.vendor_attribution_decisions
  for select to authenticated using (true);

revoke all on public.vendor_attribution_decisions from anon, authenticated;
grant select on public.vendor_attribution_decisions to authenticated, service_role;

create or replace function public.rule_vendor_attribution(
  p_report_id uuid,
  p_verdict text,
  p_country text,
  p_strength text,
  p_phrase text,
  p_rationale text
) returns public.vendor_attribution_decisions
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user text := (auth.uid())::text;
  v_url text;
  v_country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
  v_phrase text := nullif(btrim(coalesce(p_phrase, '')), '');
  v_row public.vendor_attribution_decisions;
  v_finding uuid;
  v_verdict public.finding_verdicts;
begin
  if v_user is null then
    raise exception 'a ruling must be made by a signed-in reviewer'
      using errcode = '28000';
  end if;

  if p_verdict is null or p_verdict not in ('attributes', 'names_no_country', 'deferred') then
    raise exception 'unknown ruling: %', p_verdict using errcode = '22023';
  end if;

  if p_rationale is null or length(btrim(p_rationale)) < 10 then
    raise exception 'a ruling needs its reasoning, in at least ten characters'
      using errcode = '22023';
  end if;

  select url into v_url from vendor_reports where id = p_report_id;
  if v_url is null then
    raise exception 'no such report' using errcode = '23503';
  end if;

  if p_verdict = 'attributes' then
    if p_strength is null or p_strength not in
        ('state', 'affiliated', 'nexus', 'aligned', 'criminal', 'linguistic') then
      raise exception 'an attribution needs a strength' using errcode = '22023';
    end if;
    if v_phrase is null or length(v_phrase) < 3 then
      raise exception 'an attribution needs the vendor''s own words' using errcode = '22023';
    end if;
    if v_country is null and p_strength <> 'linguistic' then
      raise exception 'a country is required, except at linguistic strength'
        using errcode = '22023';
    end if;
    if v_country is not null and v_country !~ '^[A-Z]{2}$' then
      raise exception 'a country is a two-letter ISO code' using errcode = '22023';
    end if;
  elsif v_country is not null or p_strength is not null or v_phrase is not null then
    raise exception 'only an attribution carries a country, strength or phrase'
      using errcode = '22023';
  end if;

  insert into vendor_attribution_decisions (
    report_id, verdict, attributed_country, attribution_strength, attribution_phrase,
    rationale, decided_by
  )
  values (
    p_report_id, p_verdict,
    case when p_verdict = 'attributes' then v_country end,
    case when p_verdict = 'attributes' then p_strength end,
    case when p_verdict = 'attributes' then v_phrase end,
    btrim(p_rationale), v_user
  )
  returning * into v_row;

  -- Deferred applies nothing, on purpose.
  if p_verdict <> 'deferred' then
    update vendor_reports
    set attributed_country = v_row.attributed_country,
        attribution_strength = v_row.attribution_strength,
        attribution_phrase = v_row.attribution_phrase,
        attribution_decided_by = v_user,
        attribution_decided_at = v_row.decided_at
    where id = p_report_id;
  end if;

  -- Answer the report's open question, if it has one, through the one code
  -- path that owns the review queue's status rules.
  select id into v_finding
  from data_quality_findings
  where check_name = 'vendor_attribution_candidate'
    and subject = v_url
    and status = 'open'
  limit 1;

  if v_finding is not null then
    v_verdict := record_verdict(
      v_finding,
      case p_verdict
        when 'attributes' then 'confirmed'
        when 'names_no_country' then 'rejected'
        else 'deferred'
      end,
      btrim(p_rationale)
    );
    if p_verdict <> 'deferred' then
      update finding_verdicts set applied_at = v_row.decided_at where id = v_verdict.id;
    end if;
  end if;

  return v_row;
end;
$fn$;

comment on function public.rule_vendor_attribution(uuid, text, text, text, text, text) is
  'Records and applies a ruling on what a vendor report attributes: attributes '
  '(country, strength, the vendor''s words), names_no_country, or deferred. '
  'Answers the report''s open review-queue question. See migration 157.';

revoke execute on function public.rule_vendor_attribution(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.rule_vendor_attribution(uuid, text, text, text, text, text)
  to authenticated, service_role;
