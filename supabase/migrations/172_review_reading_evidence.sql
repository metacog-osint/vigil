-- 172. Reviewer help: put the thing to be read beside the question
--
-- STATUS: APPLIED about 06:55 UTC 16 November 2026.
--
-- Four kinds of open finding ask a person to read something, and until now the
-- card named it without showing it. This view gathers, per finding, what Vigil
-- already holds of that thing. It decides nothing: every verdict is still the
-- reviewer's, and an empty field means Vigil does not hold the
-- text, not that there is nothing to read.
--
--   kind                          what the view adds (open, measured 16 Nov 2026)
--   vendor_attribution_candidate  the sentences of the stored report summary that
--                                 contain the matched phrase, the title and the
--                                 report's link (14). In 4 the phrase is only
--                                 in the title, so the sentences list is empty
--   leak_site_notice_candidate    the post body, where the source sent one, and
--                                 which sources carry the post (12 single posts,
--                                 1 with a body: ransomwatch and ransomware.live
--                                 send none; the 13th finding is a pattern
--                                 question with no one post to show)
--   claim_value_unverified        the stored value, its measurement, date and
--                                 window, the claim's question, the publisher and
--                                 its tier, and the citation (17). The primary
--                                 source link is source_url, which is null for all
--                                 17: they were carried forward from a working
--                                 reference by endnote, so the page says no link is
--                                 stored rather than inventing one
--   advisory_indicators_unread    the advisory's title, date and document link,
--                                 for the reading page /review/reading (29; the
--                                 English edition where FinCEN has two)
--
-- leak_site_notice_review (3) is a group-level question about a pattern of
-- posts, not one post, and gets nothing here.
--
-- Leak-site post bodies are written by the groups. They are returned as text
-- and rendered as text; nothing here or on the page interprets them.
--
-- GRANTS
--
-- security_invoker, so each base table's own policy applies to the reader.
-- Signed-in reviewers only, as review_country_evidence (166).

begin;

create or replace view public.review_reading_evidence
with (security_invoker = true) as
with f as (
  select id as finding_id, check_name, subject, details, status
    from public.data_quality_findings
   where check_name in ('vendor_attribution_candidate', 'leak_site_notice_candidate',
                        'claim_value_unverified', 'advisory_indicators_unread')
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
)
select f.finding_id, f.check_name, f.subject, f.status,
       coalesce(v.evidence, p.evidence, c.evidence, a.evidence) as evidence
  from f
  left join vendor   v on v.finding_id = f.finding_id
  left join post     p on p.finding_id = f.finding_id
  left join claim    c on c.finding_id = f.finding_id
  left join advisory a on a.finding_id = f.finding_id
 where coalesce(v.evidence, p.evidence, c.evidence, a.evidence) is not null;

comment on view public.review_reading_evidence is
  'Per open-or-closed finding of the four reading kinds, what Vigil holds of the '
  'thing the reviewer is asked to read (172). Evidence only; decides nothing.';

revoke all on public.review_reading_evidence from anon, authenticated;
grant select on public.review_reading_evidence to authenticated;

commit;
