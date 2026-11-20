-- 193. Vendor statements on re-read: kind follows the wordings, a removed statement is retired,
--      Google's note-only CVEs are flagged, and the public read is a column list
--
-- STATUS: not applied. Tom's yes, 20 Nov 2026 (ideas#75, "defaults on all six"): migration 193
-- for C + D.1, and B's guard as "annotate plus a finding, no hold".
--
-- WHY (the Fable review of 191, ideas#75)
--
-- C. record_vendor_statements (187) moved only last_seen_at and document_url on a statement it
--    already held. So a wording first stored as 'unclassified' stayed hidden after a person added
--    it to MOZILLA_WORDINGS, a corrected classification stayed public as first stored, and a note
--    Google or Mozilla removed stayed on the panel, since nothing reads last_seen_at.
-- D.1. 191 granted SELECT on the whole table, so a column added later (a reviewer's note, say)
--    would be public at once. certfr_alerts already uses a column list; this does the same.
-- B. Some of Google's bulletins carry a note naming CVEs the bulletin does not otherwise list:
--    2022-04-01 names CVE-2022-38181 and CVE-2023-21096 (a 2023 CVE on an April 2022 page), and
--    2023-05-01 names CVE-2021-22600 and CVE-2022-0847, each in the note and nowhere else on the
--    page; both pairs are in the tables of 2023-04-01 and 2022-05-01. CVE-2020-0500 rests on
--    2022-09-01's note alone. Checked again 20 Nov 2026 about 18:40 UTC: the new parser, run on
--    all 32 bulletins that hold a note (English pages), flags these five and no other.
--    It is Google's sentence either way, so nothing is held: the row is flagged, the panel adds
--    "named in Google's note only", and a finding asks a person to look.
--
-- WHAT CHANGES
--
-- vendor_exploit_statements
--   note_flags  text[]: 'not_in_tables' (the CVE appears nowhere else in that bulletin),
--               'later_than_bulletin' (the CVE's year is later than the bulletin's). Set by the
--               vendor-exploited function's parser; set here for the five rows above, because
--               the daily job re-reads only bulletins from the last 120 days.
--   retired_at  when a re-read of the same document no longer carried the statement. The row is
--               kept, never deleted (memory never-lose-data); the panel's queries skip it. Cleared
--               if the statement comes back.
-- record_vendor_statements
--   - a held statement whose kind differs from the parser's is updated, and the change is logged
--     as a 'vendor_statement_kind_changed' finding (old and new kind);
--   - note_flags are stored when the caller sends them (an older caller that sends none leaves
--     them as they are); a statement arriving with flags, or gaining them, opens a
--     'vendor_statement_note_only' warning finding;
--   - for each document in p_documents, statements of that document not in p_statements get
--     retired_at. Only documents actually read this run count: a bulletin that failed to load is
--     not in p_documents, so nothing of it is retired.
--   It returns kind_changed, retired and restored besides added, seen and documents.
-- Grants: anon and authenticated read a column list; the policy (kind <> 'unclassified') stays.

begin;

alter table public.vendor_exploit_statements
  add column note_flags text[] not null default '{}'
    check (note_flags <@ array['not_in_tables', 'later_than_bulletin']::text[]),
  add column retired_at timestamptz;

comment on column public.vendor_exploit_statements.note_flags is
  'Android: not_in_tables = the CVE appears in the bulletin''s note and nowhere else on that page; '
  'later_than_bulletin = the CVE''s year is later than the bulletin''s. Google''s sentence either '
  'way; shown with "named in Google''s note only". 193.';
comment on column public.vendor_exploit_statements.retired_at is
  'Set when a re-read of the same document no longer carried this statement; cleared if it comes '
  'back. Rows are never deleted. 193.';

create index vendor_exploit_statements_doc_idx
  on public.vendor_exploit_statements (source_id, document_id);

-- The five rows the review found (B), flagged as the new parser flags them.
update public.vendor_exploit_statements s
   set note_flags = v.flags
  from (values
    ('2022-04-01', 'CVE-2022-38181', array['not_in_tables']::text[]),
    ('2022-04-01', 'CVE-2023-21096', array['not_in_tables', 'later_than_bulletin']::text[]),
    ('2023-05-01', 'CVE-2021-22600', array['not_in_tables']::text[]),
    ('2023-05-01', 'CVE-2022-0847', array['not_in_tables']::text[]),
    ('2022-09-01', 'CVE-2020-0500', array['not_in_tables']::text[])
  ) as v(document_id, cve_id, flags)
 where s.source_id = 'android-bulletins' and s.document_id = v.document_id
   and s.cve_id = v.cve_id;

select public.record_finding(
  'vendor_statement_note_only', 'android-bulletins:' || s.document_id || ':' || s.cve_id,
  'warning', 'open',
  jsonb_build_object('flags', to_jsonb(s.note_flags), 'statement', s.statement,
                     'url', s.document_url,
                     'note', 'Google''s bulletin names this CVE in its exploitation note and nowhere '
                             'else on the page. Shown as Google wrote it, with "named in Google''s '
                             'note only". A person may check the bulletin and Google''s other pages.'))
  from public.vendor_exploit_statements s
 where s.source_id = 'android-bulletins' and s.note_flags <> '{}';

create or replace function public.record_vendor_statements(
  p_source text, p_statements jsonb, p_documents jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  added int := 0;
  seen int := 0;
  docs int := 0;
  kind_changed int := 0;
  retired int := 0;
  restored int := 0;
  r record;
  held record;
  flags text[];
begin
  if p_source not in ('android-bulletins', 'mozilla-mfsa') then
    raise exception 'unknown source %', p_source;
  end if;

  for r in
    select * from jsonb_to_recordset(coalesce(p_statements, '[]'::jsonb)) as s(
      family text, document_id text, document_url text, document_date date,
      cve_id text, statement text, kind text, note_flags text[])
  loop
    select id, kind, note_flags, retired_at into held
      from vendor_exploit_statements
     where source_id = p_source and document_id = r.document_id
       and cve_id = r.cve_id and statement = r.statement;

    if found then
      flags := coalesce(r.note_flags, held.note_flags);
      update vendor_exploit_statements
         set last_seen_at = now(), document_url = r.document_url, kind = r.kind,
             note_flags = flags, retired_at = null
       where id = held.id;
      seen := seen + 1;
      if held.retired_at is not null then
        restored := restored + 1;
      end if;
      if held.kind is distinct from r.kind then
        kind_changed := kind_changed + 1;
        perform record_finding(
          'vendor_statement_kind_changed',
          p_source || ':' || r.document_id || ':' || r.cve_id || ':' || held.kind || '>' || r.kind,
          'info', 'open',
          jsonb_build_object('from', held.kind, 'to', r.kind, 'statement', r.statement,
                             'url', r.document_url,
                             'note', 'The wording''s kind changed on re-read (MOZILLA_WORDINGS or '
                                     'the Android note pattern). The row now shows as the new kind.'));
      end if;
      if flags <> '{}' and not (flags <@ held.note_flags) then
        perform record_finding(
          'vendor_statement_note_only', p_source || ':' || r.document_id || ':' || r.cve_id,
          'warning', 'open',
          jsonb_build_object('flags', to_jsonb(flags), 'statement', r.statement,
                             'url', r.document_url,
                             'note', 'The vendor''s note names this CVE and the same document does '
                                     'not otherwise support it. Shown as written, flagged.'));
      end if;
      continue;
    end if;

    insert into vendor_exploit_statements
      (source_id, family, document_id, document_url, document_date, cve_id, statement, kind,
       note_flags)
    values
      (p_source, r.family, r.document_id, r.document_url, r.document_date, r.cve_id, r.statement,
       r.kind, coalesce(r.note_flags, '{}'));
    added := added + 1;
    if r.kind = 'unclassified' then
      perform record_finding(
        'vendor_statement_unclassified', p_source || ':' || r.document_id || ':' || r.cve_id,
        'warning', 'open',
        jsonb_build_object('statement', r.statement, 'url', r.document_url,
                           'note', 'A vendor sentence about exploitation in a wording not yet read. '
                                   'A person decides its kind; add the wording to MOZILLA_WORDINGS or '
                                   'the Android note pattern.'));
    end if;
    if coalesce(r.note_flags, '{}') <> '{}' then
      perform record_finding(
        'vendor_statement_note_only', p_source || ':' || r.document_id || ':' || r.cve_id,
        'warning', 'open',
        jsonb_build_object('flags', to_jsonb(r.note_flags), 'statement', r.statement,
                           'url', r.document_url,
                           'note', 'The vendor''s note names this CVE and the same document does '
                                   'not otherwise support it. Shown as written, flagged.'));
    end if;
  end loop;

  -- Statements of a document read this run that the read no longer carried.
  update vendor_exploit_statements s
     set retired_at = now()
   where s.source_id = p_source and s.retired_at is null
     and s.document_id in (
       select x.document_id from jsonb_to_recordset(coalesce(p_documents, '[]'::jsonb))
         as x(document_id text))
     and not exists (
       select 1 from jsonb_to_recordset(coalesce(p_statements, '[]'::jsonb))
         as p(document_id text, cve_id text, statement text)
        where p.document_id = s.document_id and p.cve_id = s.cve_id
          and p.statement = s.statement);
  get diagnostics retired = row_count;

  insert into vendor_documents_read as d
    (source_id, document_id, document_url, document_date, statements)
  select p_source, x.document_id, x.document_url, x.document_date, coalesce(x.statements, 0)
    from jsonb_to_recordset(coalesce(p_documents, '[]'::jsonb)) as x(
      document_id text, document_url text, document_date date, statements int)
  on conflict (source_id, document_id) do update
    set last_read_at = now(), document_url = excluded.document_url,
        document_date = excluded.document_date, statements = excluded.statements;
  get diagnostics docs = row_count;

  return jsonb_build_object('added', added, 'seen', seen, 'documents', docs,
                            'kind_changed', kind_changed, 'retired', retired,
                            'restored', restored);
end;
$$;

comment on function public.record_vendor_statements(text, jsonb, jsonb) is
  'Writes vendor exploitation statements and the documents read: updates a held statement''s kind '
  '(logged), stores note_flags, retires statements a re-read no longer carries, and opens findings '
  'for an unclassified wording or a note-only CVE. service_role only. 187, 193.';

revoke execute on function public.record_vendor_statements(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_vendor_statements(text, jsonb, jsonb) to service_role;

-- D.1: the public read is a column list, so a column added later is not public by accident.
revoke select on public.vendor_exploit_statements from anon, authenticated;
grant select (id, source_id, family, document_id, document_url, document_date, cve_id, statement,
              kind, first_seen_at, last_seen_at, note_flags, retired_at)
  on public.vendor_exploit_statements to anon, authenticated;

commit;
