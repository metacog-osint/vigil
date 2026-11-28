-- 170. Lift five victim names out of leak-site markup; mark the empty one
--
-- STATUS: APPLIED about 05:41 UTC 16 November 2026.
--
-- Finding victim_name_quality (55aad300, raised 20 Sep 2026). The verdict on
-- 16 Nov 2026: confirmed. Each name below was read by a person from the post
-- itself; nothing here parses markup to find a name.
--
-- THE ROWS (measured 05:00 UTC 16 Nov 2026)
--
--   id        source      as received                                  becomes
--   7a5d9ddb  ransomlook  <h2 id="about">ABOUT</h2><p>Nissin Foods Do   Nissin Foods Do Brasil Ltda
--                         Brasil Ltda is a company that operates in the
--   0fdd93be  ransomlook  ...<p>SCHERDELWiesauplast ist ein ...         SCHERDELWiesauplast
--   21d72f12  ransomlook  ...<p>The Beacon Insurance Company Limited    The Beacon Insurance Company Limited
--                         is ranked as the fourth
--   1238c091  ransomlook  ...<p>The RKW Group is an independent ...     The RKW Group
--   ea736cff  ransomwatch USA Rice<br />                                USA Rice
--   5d359240  ransomlook  <h2 id="about">ABOUT</h2><ul><li></li></ul>  unchanged; reads placeholder
--                         <h2 id="target">TARGET</h2><p>ni*usa.com
--
-- The four ransomlook names are the dataleak group's posts of 8 Jul 2026, whose
-- post_title was the description block cut at 90 characters. SCHERDELWiesauplast
-- is kept as the group wrote it. The Beacon name is the description's own
-- ("Limited" included), which is also how ransomwatch and ransomware.live
-- recorded the same company in January.
--
-- The text as received is kept in raw_data.victim_name_as_received, so nothing
-- the source sent is lost. Whether the July Beacon and RKW posts are the
-- January incidents again is not decided here; the claim matcher and the review
-- queue are where that question belongs.
--
-- THE EMPTY ONE
--
-- incidents.data_quality is a generated column (077, widened since). It gains
-- one rule: a description block whose ABOUT list is empty names nobody, so it
-- reads 'placeholder' and leaves the public site through 077's policy. Every
-- earlier rule is kept exactly, in the same order. The redacted target
-- (ni*usa.com) is not lifted: half a domain is not a name.
--
-- NOT IN THIS MIGRATION
--
-- The same measurement found 59 other victim names holding angle brackets,
-- outside the finding: 57 ransomwatch rows of 13 Jan 2026 (54 stored as
-- "Name<website>", 3 as "Name<Updated>" or "<Auction>"), and 2 ransomware.live
-- rows of 14 Jan ("</a>" alone, and "www.clevo.com.tw<UPDATED>"). They are
-- queued as their own finding below (reminder 7), not fixed.
--
-- GRANTS
--
-- No new object. data_quality keeps its grants and 077's policy.

do $$
declare
  n integer;
begin
  -- every row is still as the finding saw it
  select count(*) into n from public.incidents
   where (id = '7a5d9ddb-8a70-43f2-a351-ec5038664a07' and victim_name like '%Nissin Foods Do Brasil Ltda%')
      or (id = '0fdd93be-f4f5-44d2-ac00-8ef0950e7f72' and victim_name like '%SCHERDELWiesauplast%')
      or (id = '21d72f12-7a37-4c57-a4f2-fa361aa670d7' and victim_name like '%The Beacon Insurance Company Limited%')
      or (id = '1238c091-0abd-45da-8ab1-bc542eb607f7' and victim_name like '%The RKW Group%')
      or (id = 'ea736cff-113a-4b12-a626-8ba6fd113eda' and victim_name = 'USA Rice<br />');
  if n <> 5 then
    raise exception '170 expected the five rows of victim_name_quality as received; found %', n;
  end if;
end
$$;

with lift(id, name) as (values
  ('7a5d9ddb-8a70-43f2-a351-ec5038664a07'::uuid, 'Nissin Foods Do Brasil Ltda'),
  ('0fdd93be-f4f5-44d2-ac00-8ef0950e7f72'::uuid, 'SCHERDELWiesauplast'),
  ('21d72f12-7a37-4c57-a4f2-fa361aa670d7'::uuid, 'The Beacon Insurance Company Limited'),
  ('1238c091-0abd-45da-8ab1-bc542eb607f7'::uuid, 'The RKW Group'),
  ('ea736cff-113a-4b12-a626-8ba6fd113eda'::uuid, 'USA Rice')
),
clash as (
  select l.id
    from lift l
    join public.incidents i on i.id = l.id
    join public.incidents o
      on o.id <> i.id
     and o.actor_id is not distinct from i.actor_id
     and o.victim_name = l.name
     and o.discovered_date is not distinct from i.discovered_date
)
update public.incidents i
   set raw_data    = coalesce(i.raw_data, '{}'::jsonb)
                     || jsonb_build_object('victim_name_as_received', i.victim_name),
       victim_name = l.name
  from lift l
 where i.id = l.id
   and i.victim_name <> l.name
   and not exists (select 1 from clash c where c.id = l.id);

do $$
declare
  n integer;
begin
  select count(*) into n from public.incidents
   where id in ('7a5d9ddb-8a70-43f2-a351-ec5038664a07', '0fdd93be-f4f5-44d2-ac00-8ef0950e7f72',
                '21d72f12-7a37-4c57-a4f2-fa361aa670d7', '1238c091-0abd-45da-8ab1-bc542eb607f7',
                'ea736cff-113a-4b12-a626-8ba6fd113eda')
     and victim_name !~ '[<>]';
  if n <> 5 then
    raise exception
      '170 lifted % of 5 names; a lifted name would duplicate an incident '
      'already held for the same group and day. Queue it for a person.', n;
  end if;
end
$$;

alter table public.incidents
  alter column data_quality set expression as (
    case
      when victim_name ~* '^\s*(company\s*id\s*:|audit\s+entity\s*:)' then 'placeholder'
      when victim_name ~ '\{\{.*\}\}|<%=|\$\{' then 'placeholder'
      when victim_name ~* '^\s*<h2[^>]*>\s*about\s*</h2>\s*<ul>\s*<li>\s*</li>\s*</ul>' then 'placeholder'
      when victim_name ~~ '%***%' then 'redacted'
      when victim_name ~ '\?\?' then 'redacted'
      else 'ok'
    end
  );

select public.record_finding(
  'victim_name_markup',
  '59 incidents from the January backfill whose victim_name holds angle brackets',
  'warning',
  'open',
  jsonb_build_object(
    'question', 'Split "Name<website>" into the name and the website, drop the "<Updated>" labels, and decide what the "</a>" row was?',
    'name_with_site', '54 ransomwatch rows of 13 Jan 2026 stored as Name<website>, e.g. [Published]Constelacion Savings and Credit Society<www.constelacion.com.sv>',
    'name_with_label', '3 ransomwatch rows ending <Updated> or <Auction>, and 1 ransomware.live row www.clevo.com.tw<UPDATED>',
    'bare_tag', '1 ransomware.live row of 14 Jan 2026 whose victim_name is only </a>',
    'check_it_yourself', 'select source, count(*) from incidents where victim_name like ''%<%'' group by source;',
    'raised_by', 'migration 170, measuring victim_name_quality on 16 Nov 2026'
  )
);
