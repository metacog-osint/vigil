-- 174. Washington's own record of each breach's cause, on the review card
--
-- STATUS: applied 16 November 2026, 18:37 UTC, before PR #109 merged (b357e18).
-- First run 17 Nov 03:46 UTC: 1,609 of 1,698 dataset rows matched; 97 of the
-- 104 open Washington cards carry a cause, 61 Ransomware.
--
-- 377 breach_notice_candidate findings (166) ask whether a state breach notice
-- is the victim's own account of an attack a group claimed. The reviewer had to
-- open every notice to learn the cause. Vigil's state feed reads the registries'
-- web pages, and none of them gives a cause there.
--
-- Washington's Attorney General also publishes the same notices as an open
-- dataset, "Data Breach Notifications Affecting Washington Residents"
-- (data.wa.gov, sb4j-ca4h), and that dataset records the cause: databreachcause
-- ("Cyberattack", "Unauthorized Access", "Theft or Mistake") and
-- cyberattacktype ("Ransomware", "Malware", "Phishing", "Skimmers", "Other",
-- "Unclear/unknown"). Measured 16 Nov 2026: 1,698 notices, 2015 to 9 Nov 2026,
-- 597 marked Ransomware. Of the 104 open Washington candidates, 97 have a row:
-- 61 Ransomware, 17 Unauthorized Access, 10 Other, 4 Phishing, 3 unknown,
-- 2 Malware. 7 have none.
--
-- This stores the two fields against Vigil's own Washington notice rows and
-- shows them on the card as the Attorney General's record. It decides nothing:
-- a matching cause is evidence for the reviewer, and match_status is untouched
-- (reminder 7).
--
-- MATCHING
--
-- Same organization name, letters and digits only and case folded, and the
-- dataset's datesubmitted within 3 days of Vigil's filed_date. Nearest date
-- wins. A notice with no such row keeps nulls, and the card says so.
--
-- LICENCE
--
-- The dataset states no licence (license and licenseId are null in its
-- metadata, checked 16 Nov 2026). It is a state agency's public record of
-- facts. Tom approved storing and showing the cause, credited to the Attorney
-- General, on 16 Nov 2026. Registered as not cleared for commercial use.
--
-- GRANTS
--
-- apply_wa_breach_causes is SECURITY DEFINER and service_role only: the
-- wa-breach-causes Edge Function calls it. The view keeps 172's grants.

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('wa-ag-open-data',
   'Washington Attorney General breach notifications, open dataset (data.wa.gov sb4j-ca4h)',
   'US state government public record; the dataset states no licence',
   'https://data.wa.gov/d/sb4j-ca4h',
   false, true, '2026-11-16',
   'Only databreachcause and cyberattacktype are taken, onto Vigil''s own wa-ag notice rows. '
   'No licence is stated in the dataset metadata; Tom approved storing and showing the cause, '
   'credited to the Washington Attorney General, on 16 Nov 2026.')
on conflict (source_id) do nothing;

alter table public.victim_disclosures
  add column if not exists breach_cause text,
  add column if not exists cyberattack_type text,
  add column if not exists cause_source text,
  add column if not exists cause_recorded_at timestamptz;

comment on column public.victim_disclosures.breach_cause is
  'The registry''s own record of the cause (174). Washington only: databreachcause from data.wa.gov sb4j-ca4h.';
comment on column public.victim_disclosures.cyberattack_type is
  'The registry''s own record of the attack type (174). Washington only: cyberattacktype from data.wa.gov sb4j-ca4h.';

-- p_rows: [{ "name": text, "submitted": date, "cause": text, "attack_type": text }]
create or replace function public.apply_wa_breach_causes(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rows int := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  v_updated int;
begin
  with incoming as (
    select lower(regexp_replace(r ->> 'name', '[^A-Za-z0-9]', '', 'g')) as key,
           (r ->> 'submitted')::date as submitted,
           nullif(btrim(r ->> 'cause'), '') as cause,
           nullif(btrim(r ->> 'attack_type'), '') as attack_type
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
     where coalesce(r ->> 'name', '') <> '' and (r ->> 'submitted') is not null
  ),
  best as (
    select distinct on (d.id) d.id, i.cause, i.attack_type
      from public.victim_disclosures d
      join incoming i
        on i.key = lower(regexp_replace(d.company_name, '[^A-Za-z0-9]', '', 'g'))
       and abs(d.filed_date - i.submitted) <= 3
     where d.source = 'wa-ag'
     order by d.id, abs(d.filed_date - i.submitted), i.cause nulls last
  )
  update public.victim_disclosures d
     set breach_cause = b.cause,
         cyberattack_type = b.attack_type,
         cause_source = 'wa-ag-open-data',
         cause_recorded_at = now()
    from best b
   where d.id = b.id
     and (d.breach_cause is distinct from b.cause
          or d.cyberattack_type is distinct from b.attack_type
          or d.cause_source is distinct from 'wa-ag-open-data');
  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'rows', v_rows,
    'updated', v_updated,
    'with_cause', (select count(*) from public.victim_disclosures
                    where source = 'wa-ag' and cause_source = 'wa-ag-open-data'));
end;
$$;

revoke execute on function public.apply_wa_breach_causes(jsonb) from public, anon, authenticated;
grant execute on function public.apply_wa_breach_causes(jsonb) to service_role;

insert into public.feed_expectations (feed_id, expected_interval_minutes, critical, note)
values ('wa-breach-causes', 1440, false,
        'Washington AG open dataset (data.wa.gov sb4j-ca4h): the cause of each Washington notice (174). Not critical until it has run.')
on conflict (feed_id) do nothing;

create or replace view public.review_reading_evidence
with (security_invoker = true) as
with f as (
  select id as finding_id, check_name, subject, details, status
    from public.data_quality_findings
   where check_name in ('vendor_attribution_candidate', 'leak_site_notice_candidate',
                        'claim_value_unverified', 'advisory_indicators_unread',
                        'victim_name_markup', 'breach_notice_candidate')
),
vendor as (
  select f.finding_id,
         jsonb_build_object(
           'title', r.title,
           'url', r.url,
           'published', r.published,
           'phrase', f.details ->> 'phrase',
           'sentences', coalesce((
             select jsonb_agg(s.sentence order by s.n)
               from regexp_split_to_table(coalesce(r.summary, ''), '(?<=[.!?])\s+')
                    with ordinality as s(sentence, n)
              where f.details ->> 'phrase' is not null
                and position(lower(f.details ->> 'phrase') in lower(s.sentence)) > 0
           ), '[]'::jsonb)
         ) as evidence
    from f
    join public.vendor_reports r on r.url = f.details ->> 'url'
   where f.check_name = 'vendor_attribution_candidate'
),
post as (
  select f.finding_id,
         jsonb_build_object(
           'body', (array_agg(nullif(btrim(i.raw_data ->> 'description'), '')
                              order by length(i.raw_data ->> 'description') desc nulls last))[1],
           'sources', (select jsonb_agg(distinct s) from unnest(array_agg(i.source)) s
                        where s is not null),
           'incidents', count(i.id)
         ) as evidence
    from f
    left join public.threat_actors a
      on lower(a.name) = lower(split_part(f.subject, ' / ', 1))
    left join public.incidents i
      on i.actor_id = a.id
     and i.victim_name = substr(f.subject, length(split_part(f.subject, ' / ', 1)) + 4)
     and i.discovered_date = (f.details ->> 'posted_on')::date
   where f.check_name = 'leak_site_notice_candidate'
     and f.details ? 'posted_on'
   group by f.finding_id
),
claim as (
  select f.finding_id,
         jsonb_build_object(
           'question', q.question,
           'unit', q.unit,
           'publisher', p.display_name,
           'publisher_tier', p.tier,
           'entered_from', v.entered_from,
           'value_numeric', v.value_numeric,
           'value_text', v.value_text,
           'measurement', v.measurement,
           'as_of', v.as_of,
           'window_note', v.window_note,
           'source_url', v.source_url,
           'citation', v.citation,
           'verification', v.verification,
           'verified_on', v.verified_on
         ) as evidence
    from f
    join public.claim_values v
      on f.subject ~ ' / [0-9a-f-]{36}$'
     and v.id = right(f.subject, 36)::uuid
    left join public.contested_claims q on q.id = v.claim_id
    left join public.evidence_publishers p on p.publisher_id = v.publisher_id
   where f.check_name = 'claim_value_unverified'
),
-- One advisory id can be published in more than one language (FinCEN's
-- Spanish editions share the English id). The English one is the reading copy.
advisory as (
  select distinct on (f.finding_id) f.finding_id,
         jsonb_build_object(
           'source', a.source,
           'advisory_id', a.advisory_id,
           'title', a.title,
           'published', a.published,
           'kind', a.kind,
           'document_url', coalesce(a.document_url, a.url),
           'url', a.url,
           'indicators_read', a.indicators_read
         ) as evidence
    from f
    join public.regulatory_advisories a
      on lower(a.source) = lower(split_part(f.subject, ' / ', 1))
     and a.advisory_id = substr(f.subject, length(split_part(f.subject, ' / ', 1)) + 4)
   where f.check_name = 'advisory_indicators_unread'
   order by f.finding_id, (coalesce(a.language, 'en') = 'en') desc, a.published
),
-- victim_name_markup: one finding over many incidents (59 on 16 Nov 2026). Each
-- incident whose victim_name still holds an angle bracket, read into its parts
-- for display. Nothing is written back: the reading is for the reviewer to judge.
markup_src as (
  select i.id, i.source, i.discovered_date, i.victim_name, i.actor_id, a.name as actor
    from public.incidents i
    left join public.threat_actors a on a.id = i.actor_id
   where i.victim_name like '%<%'
     and i.data_quality is distinct from 'placeholder'
),
-- A leading "[Published]" or "[UPDATE]" is the group's label, not the name.
markup_lead as (
  select s.*,
         (regexp_match(s.victim_name, '^\s*\[([^\]]*)\]'))[1] as lead_label,
         regexp_replace(s.victim_name, '^\s*\[[^\]]*\]\s*', '') as rest1
    from markup_src s
),
-- So is a "(SOLD)" after the bracketed part.
markup_tail as (
  select l.*,
         (regexp_match(l.rest1, '>\s*\(([^)]*)\)\s*$'))[1] as tail_label,
         regexp_replace(l.rest1, '>\s*\([^)]*\)\s*$', '>') as rest2
    from markup_lead l
),
-- The bracketed part, and what is left once it is taken out. A bracket the
-- source cut off before its ">" is read to the end of the text.
markup_split as (
  select t.*,
         btrim((regexp_match(t.rest2, '<([^>]*)(>|$)'))[1]) as inner_text,
         t.rest2 !~ '<[^>]*>' as cut_off,
         btrim(regexp_replace(regexp_replace(t.rest2, '<[^>]*(>|$)', ''), '[\s:–-]+$', '')) as name_text
    from markup_tail t
),
-- A bracket holding a domain is the victim's site; one holding a word
-- ("Updated", "Auction") is a label; one holding "/a" is a stray HTML tag.
markup_read as (
  select m.*,
         case when m.inner_text ~* '^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)+(/\S*)?$'
              then regexp_replace(m.inner_text, '^https?://', '', 'i') end as site_text,
         case when m.inner_text ~ '^/' then '<' || m.inner_text || '>'
              when m.inner_text !~* '^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)+(/\S*)?$'
               and coalesce(m.inner_text, '') <> '' then m.inner_text end as inner_label
    from markup_split m
),
markup as (
  select f.finding_id,
         jsonb_build_object(
           'rows', coalesce(jsonb_agg(jsonb_build_object(
               'incident_id', r.id,
               'group', r.actor,
               'source', r.source,
               'posted', r.discovered_date,
               'as_stored', r.victim_name,
               'name', nullif(r.name_text, ''),
               'site', r.site_text,
               'labels', to_jsonb(array_remove(array[r.lead_label, r.inner_label, r.tail_label], null)),
               'cut_off', r.cut_off,
               -- The same group's claim on the same name, held without markup,
               -- nearest in date. Shown so the reviewer can see whether the
               -- marked-up row is a second copy of a claim Vigil already holds.
               'clean_twin', (
                 select jsonb_build_object('incident_id', c.id, 'source', c.source,
                                           'posted', c.discovered_date, 'name', c.victim_name)
                   from public.incidents c
                  where c.actor_id = r.actor_id
                    and c.id <> r.id
                    and c.victim_name not like '%<%'
                    and nullif(r.name_text, '') is not null
                    and lower(btrim(regexp_replace(c.victim_name, '[\s:–-]+$', ''))) = lower(r.name_text)
                  order by abs(c.discovered_date - r.discovered_date) nulls last, c.id
                  limit 1)
             ) order by r.source, r.discovered_date, r.victim_name) filter (where r.id is not null),
             '[]'::jsonb),
           'incidents', count(r.id)
         ) as evidence
    from f
    left join markup_read r on true
   where f.check_name = 'victim_name_markup'
   group by f.finding_id
),
-- breach_notice_candidate (174): the registry's own record of the cause, where
-- the registry publishes one. Only Washington does, through its open dataset.
-- A Washington notice the dataset has no row for says so; California and
-- Oregon notices get nothing, because those registries record no cause.
cause as (
  select f.finding_id,
         jsonb_build_object(
           'registry', d.source,
           'cause', d.breach_cause,
           'attack_type', d.cyberattack_type,
           'recorded_by', d.cause_source,
           'dataset_url', 'https://data.wa.gov/d/sb4j-ca4h'
         ) as evidence
    from f
    join public.victim_disclosures d
      on d.filing_url = f.details ->> 'notice'
     and d.source = 'wa-ag'
   where f.check_name = 'breach_notice_candidate'
)
select f.finding_id, f.check_name, f.subject, f.status,
       coalesce(v.evidence, p.evidence, c.evidence, a.evidence, m.evidence, w.evidence) as evidence
  from f
  left join vendor   v on v.finding_id = f.finding_id
  left join post     p on p.finding_id = f.finding_id
  left join claim    c on c.finding_id = f.finding_id
  left join advisory a on a.finding_id = f.finding_id
  left join markup   m on m.finding_id = f.finding_id
  left join cause    w on w.finding_id = f.finding_id
 where coalesce(v.evidence, p.evidence, c.evidence, a.evidence, m.evidence, w.evidence) is not null;

comment on view public.review_reading_evidence is
  'Per open-or-closed finding of the six reading kinds, what Vigil holds of the '
  'thing the reviewer is asked to read (172; victim_name_markup added by 173, '
  'the registry''s recorded cause on breach_notice_candidate by 174). '
  'Evidence only; decides nothing.';

revoke all on public.review_reading_evidence from anon, authenticated;
grant select on public.review_reading_evidence to authenticated;

commit;
