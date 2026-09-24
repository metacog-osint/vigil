-- 147: the register of what a financial regulator has told banks to watch for
--
-- WHY FINCEN AND NOT A SCAM FEED
--
-- THREAT_COVERAGE_GAPS section 5 concluded there were "limited public data
-- sources" for fraud. That was wrong in the way section 1 was wrong about
-- CERT-EU: it counted indicator feeds. The public record on fraud is large and
-- authoritative and free, and it is held by prosecutors, Treasury and
-- regulators rather than published as a blocklist.
--
-- FinCEN is the best-shaped of them. Its alerts and advisories are not news:
-- they are typology plus red-flag indicators, written to be acted on by
-- institutions with a legal obligation to act. FIN-2023-Alert005 is the
-- pig-butchering alert; FIN-2026-Alert005, published three weeks ago, is
-- "Money Laundering Activity Associated with Digital Asset Investment Scam
-- Centers".
--
-- WHAT THIS INGESTS, AND WHAT IT POINTEDLY DOES NOT
--
-- This ingests **the register**: what FinCEN published, under what identifier,
-- on what date, and where the document is. That is a fact, it is cheap, and it
-- is Tier 1.
--
-- It does not extract the red-flag indicators. Those live in the PDFs, they
-- are the valuable part, and turning a paragraph of prose into a structured
-- indicator is a judgment. A regular expression doing it is how two false
-- attributions reached this database (CLAUDE.md, reminder 7). So
-- `indicators_read` is false on every row, and the review queue asks a person
-- to read the ones that matter.
--
-- There is deliberately no topic column either. A phrase table deciding that
-- an alert "is about" pig butchering asserts something FinCEN did not say in
-- those words. The queue selects candidates for a person to read; it never
-- records a subject.
--
-- WHY THE TABLE IS NOT CALLED fincen_advisories
--
-- DOJ press releases, OFAC designation notices and FTC actions are the same
-- shape: an identified document, published by a named body on a date, saying
-- what institutions should do. `source` distinguishes them. Naming the table
-- after its first occupant would mean renaming it for the second.
--
-- THE LICENCE GATE COMES FIRST
--
-- apply_regulatory_advisories raises on an unregistered source, as
-- apply_actor_origins and apply_vendor_research do. FinCEN is a work of the US
-- government and carries no restriction, which is registered below before
-- anything can write a row.

begin;

-- ---------------------------------------------------------------------------
-- 1. The licence, before the data
-- ---------------------------------------------------------------------------
insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('fincen', 'FinCEN advisories, alerts and notices', 'US public domain',
   'https://www.fincen.gov/resources/advisoriesbulletinsfact-sheets',
   true, false, '2026-09-24',
   'A work of the US government. No restriction. The register is ingested; the '
     || 'red-flag indicators inside each PDF are not, and reading them is queued '
     || 'rather than parsed.')
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      checked_on = excluded.checked_on,
      notes = excluded.notes;

-- 146 registered FinCEN as a Tier 1 publisher with no licence row to point at,
-- because there was not one yet. There is now, and the two must not drift.
update public.evidence_publishers
set licence_source_id = 'fincen', updated_at = now()
where publisher_id = 'fincen' and licence_source_id is null;

-- ---------------------------------------------------------------------------
-- 2. The register
-- ---------------------------------------------------------------------------
create table if not exists public.regulatory_advisories (
  id uuid primary key default gen_random_uuid(),
  source text not null,

  -- FIN-2026-Alert005, FIN-2023-A003. Not unique on its own: FinCEN republishes
  -- some alerts in Spanish under the same identifier and a different date.
  advisory_id text not null,
  language text not null default 'en',

  kind text not null check (kind in ('alert', 'advisory', 'notice', 'bulletin', 'fact_sheet')),
  title text not null,
  published date,

  -- Where the register lists it, and where the document itself is. Often a PDF
  -- on the same host; occasionally only a landing page.
  url text not null,
  document_url text,

  -- FinCEN marks a withdrawn item in the description: "(Rescinded as of
  -- January 29, 2025)". A rescinded alert is not deleted here - it was issued,
  -- institutions acted on it, and the history is the product.
  rescinded boolean not null default false,
  rescinded_note text,

  -- False on every row this migration can create. The indicators are in the
  -- PDF and reading them is a person's job.
  indicators_read boolean not null default false,

  raw jsonb not null default '{}'::jsonb,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),

  unique (source, advisory_id, language)
);

create index if not exists idx_regulatory_advisories_published
  on public.regulatory_advisories (published desc nulls last);
create index if not exists idx_regulatory_advisories_source_kind
  on public.regulatory_advisories (source, kind);

comment on table public.regulatory_advisories is
  'What a regulator published, under what identifier, on what date. The '
  'register only - the red-flag indicators inside each document are not '
  'extracted, and indicators_read says so.';
comment on column public.regulatory_advisories.indicators_read is
  'False means nobody has read the document. It does not mean the document '
  'carries no indicators; almost all of them do.';
comment on column public.regulatory_advisories.rescinded is
  'Withdrawn by the issuer. Kept, because it was issued and acted on.';

alter table public.regulatory_advisories enable row level security;

drop policy if exists regulatory_advisories_read on public.regulatory_advisories;
create policy regulatory_advisories_read on public.regulatory_advisories
  for select to anon, authenticated using (true);

grant select on public.regulatory_advisories to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The writer, gated on the licence
-- ---------------------------------------------------------------------------
create or replace function public.apply_regulatory_advisories(p_rows jsonb, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_before int;
  v_after int;
  v_seen int;
begin
  if p_source is null or not exists (select 1 from source_licences where source_id = p_source) then
    raise exception 'unregistered advisory source: %', coalesce(p_source, '<null>');
  end if;

  select count(*) into v_before from regulatory_advisories where source = p_source;

  with incoming as (
    select
      p_source                                             as source,
      r->>'advisory_id'                                    as advisory_id,
      coalesce(r->>'language', 'en')                       as language,
      r->>'kind'                                           as kind,
      r->>'title'                                          as title,
      nullif(r->>'published', '')::date                    as published,
      r->>'url'                                            as url,
      nullif(r->>'document_url', '')                       as document_url,
      coalesce((r->>'rescinded')::boolean, false)          as rescinded,
      nullif(r->>'rescinded_note', '')                     as rescinded_note,
      r                                                    as raw
    from jsonb_array_elements(p_rows) as r
    where r->>'advisory_id' is not null
      and r->>'title' is not null
      and r->>'url' is not null
      and r->>'kind' is not null
  )
  insert into regulatory_advisories
    (source, advisory_id, language, kind, title, published, url, document_url,
     rescinded, rescinded_note, raw)
  select source, advisory_id, language, kind, title, published, url, document_url,
         rescinded, rescinded_note, raw
  from incoming
  on conflict (source, advisory_id, language) do update
    set title = excluded.title,
        kind = excluded.kind,
        published = coalesce(excluded.published, regulatory_advisories.published),
        url = excluded.url,
        document_url = coalesce(excluded.document_url, regulatory_advisories.document_url),
        rescinded = excluded.rescinded,
        rescinded_note = excluded.rescinded_note,
        raw = excluded.raw,
        last_seen = now();

  select count(*) into v_after from regulatory_advisories where source = p_source;
  select jsonb_array_length(p_rows) into v_seen;

  perform review_regulatory_advisories();

  return jsonb_build_object(
    'source', p_source,
    'received', v_seen,
    'new', v_after - v_before,
    'held', v_after
  );
end;
$fn$;

revoke execute on function public.apply_regulatory_advisories(jsonb, text) from public;
revoke execute on function public.apply_regulatory_advisories(jsonb, text) from anon;

-- ---------------------------------------------------------------------------
-- 4. The question the register raises but cannot answer
--
--    The phrase list below does NOT decide what an advisory is about. It
--    selects documents a person should read, on the strength of words the
--    issuer put in its own title. The finding asks; nothing is recorded as a
--    topic, and nothing is written to any other table.
-- ---------------------------------------------------------------------------
create or replace function public.review_regulatory_advisories()
returns void language plpgsql security definer set search_path = public as $fn$
declare r record;
begin
  for r in
    select source, advisory_id, title, published, coalesce(document_url, url) as doc
    from regulatory_advisories
    where not indicators_read
      and not rescinded
      and kind in ('alert', 'advisory')
      and title ~* '(scam|fraud|pig butchering|investment|elder|romance|money mule|virtual currency|digital asset|convertible virtual)'
  loop
    perform record_finding(
      'advisory_indicators_unread', r.source || ' / ' || r.advisory_id, 'info', 'open',
      jsonb_build_object(
        'title', r.title,
        'published', r.published,
        'document', r.doc,
        'asks', 'Read the red-flag indicators in this document and record them. The register says it exists; nothing yet says what it tells an institution to look for.'));
  end loop;
end;
$fn$;

revoke execute on function public.review_regulatory_advisories() from public;
revoke execute on function public.review_regulatory_advisories() from anon;

-- ---------------------------------------------------------------------------
-- 5. Watch it, or it can stop with nothing saying so
--
--    Not critical. It has never run, and a feed earns critical by having run -
--    the rule migration 133 set after cisa-advisories was marked critical
--    before its first success and made ingestion_is_healthy() read false for
--    two days.
-- ---------------------------------------------------------------------------
insert into feed_expectations (feed_id, expected_interval_minutes, critical, note) values
  (
    'fincen-advisories',
    1440,
    false,
    'FinCEN alerts, notices, bulletins and fact sheets, plus the advisory '
      || 'archive. US public domain. Two HTML pages parsed in an Edge Function; '
      || 'FinCEN publishes no RSS and /rss.xml is a 404. Daily is generous - the '
      || 'register gained six alerts in the whole of 2026 - but the page is 58KB '
      || 'and costs one subrequest. Not critical until it has run.'
  )
on conflict (feed_id) do update
  set expected_interval_minutes = excluded.expected_interval_minutes,
      critical = excluded.critical,
      note = excluded.note;

commit;
