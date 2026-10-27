-- 161. Does a leak-site claim name an organisation someone is watching?
--
-- STATUS: NOT YET APPLIED.
--
-- WHY
--
-- On 20 September 2026 six real credit-union and vendor incidents were
-- replayed by hand against "would Vigil have told anyone?". Matching on names
-- missed the one that mattered: LockBit listed Susquehanna Valley FCU only as
-- `svfcu.org`. The review that followed agreed a regression suite of real
-- cases, run on every build, so that a change which breaks a known case fails
-- CI. It was never built, and there was no matcher for it to test: the vendor
-- register stored names and domains and nothing ever compared them to a claim.
--
-- This is that matcher. supabase/tests/claimMatcher.test.js holds the cases.
--
-- THE CASES IT HAS TO GET RIGHT (all real, from the incidents table)
--
--   svfcu.org            LockBit, 31 Aug 2026. Listed only by domain. Must match
--                        a watcher who knows the credit union's domain, and so
--                        must "SVFCU", "www.svfcu.org" and the full name.
--   Jack Henry &         ShinyHunters, 29 Aug 2026. A core-banking vendor that
--   Associates           also trades as Symitar, ProfitStars and Banno. A claim
--                        naming a product must reach the vendor's watchers.
--   Fiserv / FISERV.COM  Everest, 3 May 2026, and Clop, 12 Aug 2026. One
--                        organisation, two spellings.
--   Susquehanna Glass    Akira, 19 Dec 2025. Nothing to do with Susquehanna
--                        Valley FCU. A matcher keyed on "Susquehanna" alerts
--                        the wrong customer.
--   "...First Data       leaknet, 8 Jan 2026. "First Data" is a Fiserv company
--   leakage."            name; here it means the first batch. At most a
--                        question for a person, never an alert.
--   Secureworks,         Titles of the law-enforcement banners posted on
--   Prodaft              LockBit's seized site on 20 Feb 2024, moved out of
--                        incidents by 095. Both are real companies. A banner is
--                        not a claim, so it must never match.
--
-- HOW IT DECIDES
--
-- org_key() reduces a name to a comparable form: lower case, punctuation gone,
-- "federal credit union" as fcu, trailing Inc / LLC / Corp / Group / & Associates
-- dropped. A name that is a domain reduces to its label, so `FISERV.COM` and
-- `Fiserv` meet at `fiserv`, and `svfcu.org` and `SVFCU` meet at `svfcu`.
--
-- org_match() returns one of two confidences:
--
--   match      the claim's key equals the watched name, its domain label, or
--              one of the names it also trades under (vendors.aliases).
--   possible   the watched name or an alias appears as whole words inside a
--              longer claim, or the spelling is close (trigram similarity of
--              0.6 or more, both at least 8 characters).
--
-- `possible` is a question for a person, never an alert (CLAUDE.md reminder
-- 7). "Susquehana Valley FCU" is probably a typo; "First Data leakage" is
-- probably not First Data. Only someone reading the post can say.
--
-- Only claims with data_quality = 'ok' are read. Placeholders, redacted names
-- and the notices 095 moved to leak_site_notices are not claims.
--
-- WHAT IS NOT HERE
--
--   * Nothing is written and nothing is scheduled. match_vendor_claims() reads;
--     turning a `match` into a vendor_risk_events row and a notification, and
--     a `possible` into a review-queue question, is the next step.
--   * No list of brands is shipped. Which products a vendor trades under is
--     recorded per vendor, by the person who watches it, in vendors.aliases.
--
-- GRANTS
--
-- The key and match functions are pure and safe for anyone. Reading a
-- vendor's matches goes through vendors' own row-level security, so it is
-- SECURITY INVOKER and open to signed-in users only.

alter table public.vendors add column if not exists aliases text[] not null default '{}';

comment on column public.vendors.aliases is
  'Other names a claim might use for this vendor: products, brands, '
  'subsidiaries (Symitar, ProfitStars and Banno for Jack Henry). See 161.';

-- The registrable label of a domain or URL: www.svfcu.org -> svfcu,
-- FISERV.COM -> fiserv, example.co.uk -> example. Null for anything that is
-- not a domain.
create or replace function public.org_domain_label(p text)
returns text
language plpgsql
immutable
set search_path = public
as $fn$
declare
  h text := lower(btrim(coalesce(p, '')));
  parts text[];
  n int;
begin
  h := regexp_replace(h, '^[a-z][a-z0-9+.-]*://', '');
  h := regexp_replace(h, '[/?#:].*$', '');
  h := regexp_replace(h, '^www[0-9]*\.', '');
  if h !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    return null;
  end if;

  parts := string_to_array(h, '.');
  n := array_length(parts, 1);
  if parts[n] !~ '^[a-z]{2,}$' then
    return null;
  end if;

  -- example.co.uk, example.com.au: skip the second level too.
  if n >= 3 and length(parts[n]) = 2
     and parts[n - 1] in ('co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne', 'go') then
    return nullif(parts[n - 2], '');
  end if;

  return nullif(parts[n - 1], '');
end;
$fn$;

-- A comparable form of an organisation's name.
create or replace function public.org_key(p text)
returns text
language plpgsql
immutable
set search_path = public
as $fn$
declare
  k text := org_domain_label(p);
  suffix constant text :=
    ' (inc|incorporated|llc|l l c|ltd|limited|corp|corporation|co|company|plc|gmbh'
    '|ag|sa|nv|bv|pllc|lp|llp|group|holdings|and associates|associates) $';
begin
  if k is not null then
    return k;
  end if;

  k := lower(btrim(coalesce(p, '')));
  k := replace(k, '&', ' and ');
  -- Trim before padding: "Fiserv, Inc." must end in exactly one space, or the
  -- suffix pattern never sees "inc" (the regression suite caught this).
  k := ' ' || btrim(regexp_replace(k, '[^[:alnum:]]+', ' ', 'g')) || ' ';
  k := replace(k, ' federal credit union ', ' fcu ');
  k := replace(k, ' credit union ', ' cu ');
  k := regexp_replace(k, '^ the ', ' ');

  while k ~ suffix loop
    k := regexp_replace(k, suffix, ' ');
  end loop;

  return nullif(btrim(regexp_replace(k, ' +', ' ', 'g')), '');
end;
$fn$;

-- Does this claim name this organisation? At most one row: the strongest
-- reason, with what it matched on.
create or replace function public.org_match(
  p_victim_name text,
  p_victim_website text,
  p_name text,
  p_domain text,
  p_aliases text[]
)
returns table (match_kind text, confidence text, matched_on text)
language plpgsql
stable
set search_path = public, extensions
as $fn$
declare
  v text := org_key(p_victim_name);
  w text := org_domain_label(p_victim_website);
  v_is_domain boolean := org_domain_label(p_victim_name) is not null;
  n text := org_key(p_name);
  d text := org_domain_label(p_domain);
  a text;
  ak text;
begin
  if v is null and w is null then
    return;
  end if;

  -- match: the same name
  if n is not null and v = n then
    return query select 'name'::text, 'match'::text, p_name;
    return;
  end if;

  -- match: the watched domain, given as a domain or as its bare label
  if d is not null and length(d) >= 3 and (v = d or w = d) then
    return query select 'domain'::text, 'match'::text, p_domain;
    return;
  end if;

  -- match: a name it also trades under
  foreach a in array coalesce(p_aliases, '{}') loop
    ak := org_key(a);
    if ak is not null and v = ak then
      return query select 'alias'::text, 'match'::text, a;
      return;
    end if;
  end loop;

  -- match: a claim given as a domain spelling the name without spaces
  -- (jackhenry.com for Jack Henry)
  if v_is_domain and n is not null and v = replace(n, ' ', '') then
    return query select 'name'::text, 'match'::text, p_name;
    return;
  end if;

  -- possible: the name or an alias inside a longer claim, as whole words
  if n is not null and length(n) >= 5 and (' ' || v || ' ') like ('% ' || n || ' %') then
    return query select 'contains'::text, 'possible'::text, p_name;
    return;
  end if;

  foreach a in array coalesce(p_aliases, '{}') loop
    ak := org_key(a);
    if ak is not null and length(ak) >= 5 and (' ' || v || ' ') like ('% ' || ak || ' %') then
      return query select 'contains'::text, 'possible'::text, a;
      return;
    end if;
  end loop;

  -- possible: a close spelling
  if n is not null and length(n) >= 8 and length(v) >= 8 and similarity(v, n) >= 0.6 then
    return query select 'similar'::text, 'possible'::text, p_name;
    return;
  end if;
end;
$fn$;

comment on function public.org_match(text, text, text, text, text[]) is
  'Whether a leak-site claim names a watched organisation: match (same name, '
  'domain or alias) or possible (whole words inside a longer claim, or a close '
  'spelling - a question for a person, never an alert). See migration 161.';

-- Running org_match() over every claim took 11 s for one vendor in the dry
-- run on 26 October 2026, past PostgREST's 8 s limit. These indexes let the
-- function score only likely candidates: 14 to 53 ms, same results. Building
-- them took 3.5 s on 40,890 claims.
--
-- They index the output of org_key() and org_domain_label(). If either
-- function changes, REINDEX these three, or lookups go on using the old keys.
create index if not exists idx_incidents_org_key
  on public.incidents (org_key(victim_name));
create index if not exists idx_incidents_org_key_trgm
  on public.incidents using gin (org_key(victim_name) extensions.gin_trgm_ops);
create index if not exists idx_incidents_site_label
  on public.incidents (org_domain_label(victim_website))
  where victim_website is not null;

-- The claims that name one vendor in the caller's register.
create or replace function public.match_vendor_claims(p_vendor_id uuid, p_since date default null)
returns table (
  incident_id uuid,
  victim_name text,
  actor_name text,
  discovered_date date,
  source text,
  match_kind text,
  confidence text,
  matched_on text
)
language sql
stable
security invoker
set search_path = public, extensions
as $fn$
  with w as (
    select v.name,
           coalesce(nullif(v.domain, ''), v.website) as domain,
           v.aliases,
           org_key(v.name) as n,
           org_domain_label(coalesce(nullif(v.domain, ''), v.website)) as d,
           coalesce(
             (select array_agg(org_key(x)) from unnest(v.aliases) x where org_key(x) is not null),
             '{}') as ak
    from vendors v
    where v.id = p_vendor_id
  ), terms as (
    -- the whole-word searches: the name and each alias of five characters or more
    select t from w, unnest(array[w.n] || w.ak) t where length(t) >= 5
  ), candidate as (
    -- each branch can use one of the indexes above
    select i.id from incidents i, w
    where org_key(i.victim_name) = any (array[w.n, w.d, replace(w.n, ' ', '')] || w.ak)
    union
    select i.id from incidents i join terms on org_key(i.victim_name) like '%' || terms.t || '%'
    union
    select i.id from incidents i, w
    where length(w.n) >= 8 and org_key(i.victim_name) % w.n
    union
    select i.id from incidents i, w
    where w.d is not null and i.victim_website is not null
      and org_domain_label(i.victim_website) = w.d
  )
  select i.id, i.victim_name, a.name, i.discovered_date, i.source,
         m.match_kind, m.confidence, m.matched_on
  from candidate c
  join incidents i on i.id = c.id
  cross join w
  left join threat_actors a on a.id = i.actor_id
  cross join lateral org_match(i.victim_name, i.victim_website, w.name, w.domain, w.aliases) m
  where i.data_quality = 'ok'
    and (p_since is null or i.discovered_date >= p_since)
  order by (m.confidence = 'match') desc, i.discovered_date desc;
$fn$;

comment on function public.match_vendor_claims(uuid, date) is
  'Leak-site claims that name a vendor in the caller''s register, strongest '
  'first. Reads through vendors'' row-level security. See migration 161.';

grant execute on function public.org_domain_label(text) to anon, authenticated, service_role;
grant execute on function public.org_key(text) to anon, authenticated, service_role;
grant execute on function public.org_match(text, text, text, text, text[]) to anon, authenticated, service_role;

revoke execute on function public.match_vendor_claims(uuid, date) from public, anon;
grant execute on function public.match_vendor_claims(uuid, date) to authenticated, service_role;
