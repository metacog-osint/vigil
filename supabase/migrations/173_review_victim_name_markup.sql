-- 173. Reviewer help for victim_name_markup: each marked-up name read into parts
--
-- STATUS: APPLIED 16:02 UTC 16 November 2026.
--
-- 170 queued one finding, victim_name_markup, over the incidents whose
-- victim_name still holds an angle bracket: 59 on 16 Nov 2026, from the January
-- backfill (57 ransomwatch, 2 ransomware.live). Its question is whether to
-- split "Name<website>" into the name and the site, drop labels like
-- "<Updated>", and what the "</a>" row was. That is a person's call.
--
-- This adds a fifth kind to review_reading_evidence (172) so the card shows,
-- for every such incident, a reading of it:
--
--   as_stored    the victim_name as the source sent it
--   name         what is left once the bracketed part and the labels are out
--   site         the bracketed part, when it is a domain
--   labels       "[Published]", "[UPDATE]", "<Updated>", "<Auction>", "(SOLD)",
--                and a stray tag such as "</a>"
--   cut_off      the source cut the text off before the closing ">"
--   clean_twin   the same group's claim on the same name, held without markup,
--                nearest in date (measured 16 Nov 2026: 58 of 59 have one)
--
-- The reading is a regular expression and is shown as a reading. Nothing is
-- written: no incident changes until a verdict says what to do, and then by
-- its own migration. Leak-site text is data and is returned as text.
--
-- The two placeholder rows that also hold "<" (a template-injection probe and
-- an empty ABOUT list, both ransomlook) are left out: 170 already settled them.
--
-- GRANTS
--
-- Unchanged from 172: security_invoker, signed-in reviewers only.

begin;

create or replace view public.review_reading_evidence
with (security_invoker = true) as
with f as (
  select id as finding_id, check_name, subject, details, status
    from public.data_quality_findings
   where check_name in ('vendor_attribution_candidate', 'leak_site_notice_candidate',
                        'claim_value_unverified', 'advisory_indicators_unread',
                        'victim_name_markup')
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
)
select f.finding_id, f.check_name, f.subject, f.status,
       coalesce(v.evidence, p.evidence, c.evidence, a.evidence, m.evidence) as evidence
  from f
  left join vendor   v on v.finding_id = f.finding_id
  left join post     p on p.finding_id = f.finding_id
  left join claim    c on c.finding_id = f.finding_id
  left join advisory a on a.finding_id = f.finding_id
  left join markup   m on m.finding_id = f.finding_id
 where coalesce(v.evidence, p.evidence, c.evidence, a.evidence, m.evidence) is not null;

comment on view public.review_reading_evidence is
  'Per open-or-closed finding of the five reading kinds, what Vigil holds of the '
  'thing the reviewer is asked to read (172; victim_name_markup added by 173). '
  'Evidence only; decides nothing.';

revoke all on public.review_reading_evidence from anon, authenticated;
grant select on public.review_reading_evidence to authenticated;

commit;
