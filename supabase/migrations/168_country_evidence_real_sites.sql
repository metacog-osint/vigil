-- 168: a source's link is not the victim's website
--
-- 166's review_country_evidence read incidents.victim_website as the victim's
-- site. Measured live after applying it (15 Nov 2026): for all 42 victims in
-- the 43 open country disagreements, every non-empty victim_website is a
-- ransomware.live page about the claim (https://www.ransomware.live/id/...),
-- and raw_data->>'website' is empty. So the view reported ".live" as the
-- victim's domain 28 times. That is the aggregator's address, not evidence
-- about the victim, and the review card would have shown it as such.
--
-- Fix: links on a leak-site aggregator's own host are not a victim website.
-- Today that leaves no website for any of the 43, and the card says so. The
-- view stays, so a real site is used as soon as a source supplies one.

begin;

create or replace view public.review_country_evidence
with (security_invoker = true) as
with f as (
  select id as finding_id,
         regexp_replace(subject, ': [A-Z]{2} or [A-Z]{2}$', '') as victim,
         details->>'held' as held,
         details->>'offered' as offered
  from public.data_quality_findings
  where check_name = 'victim_country_disagreement'
),
site as (
  select f.finding_id,
         min(w.website) as website,
         count(i.id) as incidents
  from f
  left join public.incidents i on i.victim_name = f.victim
  left join lateral (
    select nullif(btrim(i.victim_website), '') as website
  ) w0 on true
  left join lateral (
    select w0.website
    where w0.website !~* '^(https?://)?([a-z0-9-]+\.)*(ransomware\.live|ransomlook\.io|ransomwatch\.telemetry\.ltd|threatcluster\.[a-z]+)(/|$)'
  ) w on true
  group by f.finding_id
),
tld as (
  select s.*,
         upper(substring(lower(regexp_replace(s.website, '^[a-z]+://', '')) from '^[^/:]*\.([a-z]{2,})(?:[:/].*)?$')) as tld
  from site s
)
select f.finding_id,
       f.victim,
       f.held,
       f.offered,
       t.website,
       t.tld,
       t.incidents,
       case
         when t.tld is null or length(t.tld) <> 2 then null
         when replace(t.tld, 'UK', 'GB') = f.held then 'held'
         when replace(t.tld, 'UK', 'GB') = f.offered then 'offered'
         else 'neither'
       end as domain_agrees_with
from f
join tld t on t.finding_id = f.finding_id;

revoke all on public.review_country_evidence from anon, authenticated;
grant select on public.review_country_evidence to authenticated;

commit;
