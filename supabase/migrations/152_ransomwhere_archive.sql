-- 152. Take ransom-payment data from the archive instead of the dead API
--
-- STATUS: applied 2026-10-04.
--
-- WHAT BROKE, AND WHY IT IS NOT OURS TO FIX
--
-- api.ransomwhe.re/export has returned HTTP 502 since 20 September - fourteen
-- days. Verified from outside the worker: the export path 502s, api.ransomwhe.re
-- itself answers 403, and ransomwhe.re serves 200 and still links to that exact
-- URL. The host is alive, the service is not, and the endpoint has not moved.
--
-- That left ransomware_payments holding 13 rows, which is the entire corpus
-- Vigil has for where ransom money goes.
--
-- THE ARCHIVE, AND WHY IT IS BETTER THAN THE API WAS
--
-- The same dataset is deposited on Zenodo: "Ransomwhere: A Crowdsourced
-- Ransomware Payment Dataset", concept DOI 10.5281/zenodo.6512122, which always
-- resolves to the newest version (13999026, v1.1.0, published 2024-10-27).
--
-- 11,178 addresses, 136 families, 21,790 transactions with per-transaction
-- amounts in satoshis and USD. The current table has 13 families. The wallets
-- already in iocs number 9,900, so this is more than Vigil holds anywhere.
--
-- And the licence is the point: CC-BY-4.0. Commercial use permitted with
-- attribution, unlike ransomware.live (personal use only) and ETDA
-- (NonCommercial). This is the first ransom-payment source Vigil could sell.
--
-- WHAT THIS DOES NOT RESTORE
--
-- The archive is a snapshot, not a feed. v1.1.0 ends in 2024, so payments since
-- then are missing and no amount of re-importing will add them. A feed that
-- reported itself fresh every day while serving two-year-old data would be
-- lying in the way this project exists not to, so:
--
--   * the import runs weekly, not daily - the file only changes when Zenodo
--     publishes a new version;
--   * every row records snapshot_version and snapshot_published, so the age of
--     the data is visible rather than the age of the import; and
--   * apply_ransom_payments returns both, so the page can show the vintage.
--
-- THE TOTAL THAT MUST NOT BE QUOTED ALONE
--
-- The snapshot totals about USD 1.016 billion. USD 682 million of that - 67% -
-- belongs to family "Unlabeled". A headline of "over a billion dollars in ransom
-- payments tracked" would be two thirds unattributed, which is the same mistake
-- as the 1.45 billion "people affected" figure that migration 144 exists to
-- prevent. Unlabeled is kept as its own family and never folded into an
-- attributed total.

-- The licence has to be registered before anything can write. Rule 8.
insert into source_licences (
  source_id, display_name, licence, licence_url,
  commercial_use, attribution_required, checked_on, notes
)
values (
  'ransomwhere-archive',
  'Ransomwhere crowdsourced ransomware payment dataset (Zenodo)',
  'CC-BY-4.0',
  'https://doi.org/10.5281/zenodo.6512122',
  true,
  true,
  current_date,
  'Zenodo deposit of the Ransomwhere dataset. Concept DOI resolves to the '
    || 'newest version; v1.1.0 was published 2024-10-27. Commercial use is '
    || 'permitted with attribution, which makes this the first ransom-payment '
    || 'source Vigil could sell - the live api.ransomwhe.re has been 502 since '
    || '20 September 2026 and carried no stated licence at all. Attribution: '
    || 'cite the DOI. A snapshot, not a feed: payments after the deposit date '
    || 'are not in it.'
)
on conflict (source_id) do update
set licence = excluded.licence,
    licence_url = excluded.licence_url,
    commercial_use = excluded.commercial_use,
    attribution_required = excluded.attribution_required,
    checked_on = excluded.checked_on,
    notes = excluded.notes;

-- Per-family aggregates, computed in the Edge Function where there is CPU to
-- parse 5.5 MB of JSON, applied here in one statement.
--
-- Raises on an unregistered source, like apply_actor_origins and
-- apply_vendor_research: a row nobody can judge for resale is worse than no row.
create or replace function public.apply_ransom_payments(
  p_source text,
  p_snapshot_version text,
  p_snapshot_published date,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  applied int := 0;
  total int;
begin
  if not exists (select 1 from source_licences where source_id = p_source) then
    raise exception 'apply_ransom_payments: source % is not registered in source_licences', p_source;
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'apply_ransom_payments expects a JSON array';
  end if;

  select count(*) into total from jsonb_array_elements(p_rows);

  -- A short payload means a truncated download, not that ransomware stopped.
  -- The snapshot carries 136 families; refuse anything that looks like a partial.
  if total < 50 then
    raise exception 'refusing a suspiciously short ransom-payment payload (% families)', total;
  end if;

  with incoming as (
    select
      e->>'family_name'                      as family_name,
      (e->>'total_btc')::numeric             as total_btc,
      (e->>'total_usd')::numeric             as total_usd,
      (e->>'payment_count')::int             as payment_count,
      (e->>'unique_addresses')::int          as unique_addresses,
      nullif(e->>'first_payment','')::date   as first_payment,
      nullif(e->>'last_payment','')::date    as last_payment
    from jsonb_array_elements(p_rows) e
  ), upserted as (
    insert into ransomware_payments as r (
      family_name, total_btc, total_usd, payment_count, unique_addresses,
      first_payment, last_payment, source, metadata, updated_at
    )
    select
      i.family_name, i.total_btc, i.total_usd, i.payment_count,
      i.unique_addresses, i.first_payment, i.last_payment, p_source,
      jsonb_build_object(
        'snapshot_version', p_snapshot_version,
        'snapshot_published', p_snapshot_published,
        -- Said on the row, because this is the figure most likely to be quoted
        -- out of context and "Unlabeled" is two thirds of the money.
        'attributed', i.family_name is distinct from 'Unlabeled'
      ),
      now()
    from incoming i
    on conflict (family_name) do update
    set total_btc = excluded.total_btc,
        total_usd = excluded.total_usd,
        payment_count = excluded.payment_count,
        unique_addresses = excluded.unique_addresses,
        first_payment = excluded.first_payment,
        last_payment = excluded.last_payment,
        source = excluded.source,
        metadata = excluded.metadata,
        updated_at = now()
    returning 1
  )
  select count(*) into applied from upserted;

  return jsonb_build_object(
    'source', p_source,
    'families', total,
    'applied', applied,
    'snapshot_version', p_snapshot_version,
    'snapshot_published', p_snapshot_published
  );
end;
$function$;

comment on function public.apply_ransom_payments(text, text, date, jsonb) is
  'Applies per-family ransom payment aggregates from a registered source. '
  'Raises on an unregistered source (rule 8) and on a payload short enough to '
  'be a truncated download. Records the snapshot version and publication date '
  'on every row so the age of the data is visible rather than the age of the '
  'import.';

-- No index is added here: ransomware_payments_family_name_key already makes
-- family_name unique, which is what the ON CONFLICT above needs. Adding a
-- second unique index under a different name would not be caught by
-- `if not exists` and would cost a write on every upsert for nothing.

-- The owner asked for this on 4 October: the only ransom-payment source dying
-- quietly for two weeks is what prompted it. Now that it has a source that
-- works, criticality means "tell me if this stops" rather than a standing alarm
-- about something known-broken - see PR #63, which only reports critical feeds.
update feed_expectations
set critical = true,
    expected_interval_minutes = 10080,
    note = 'Ransom payment aggregates from the Ransomwhere Zenodo deposit '
      || '(CC-BY-4.0, concept DOI 10.5281/zenodo.6512122). Weekly, because the '
      || 'file only changes when a new version is deposited. The live '
      || 'api.ransomwhe.re/export has returned 502 since 20 September 2026; '
      || 'this is the archive route, and it is a snapshot - payments after the '
      || 'deposit date are not in it. Critical because this is the only '
      || 'ransom-payment corpus Vigil holds.'
where feed_id = 'ransomwhere';
