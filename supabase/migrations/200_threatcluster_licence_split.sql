-- 200: ThreatCluster's data now has two licences, so its country fills carry two source labels
--
-- WHAT CHANGED UPSTREAM
--
-- Jam0k/Ransomware-Intel (ThreatCluster) published its data under GPL-3.0 with a
-- README line "TLP:CLEAR: free to use, redistribute, and integrate". On 22 November
-- 2026 it dropped the 90- and 365-day files (commit 8763ae8e81, 11:47 UTC), kept a
-- free 7-day file (about 10 to 25 victims a day), and replaced the licence with
-- ThreatCluster's own terms (README c31364c453, 12:23 UTC; LICENSE eaee73985e,
-- 12:27 UTC): free in your own environment and in non-commercial community defence
-- work, with attribution; redistribution inside a commercial product or service
-- needs a licence from ThreatCluster. 3ae0330455 (21 November, 14:54 UTC) is the
-- last commit made under GPL-3.0; it still holds the 365-day file.
--
-- WHAT VIGIL DOES ABOUT IT
--
-- It keeps reading the capped file, with credit. It backfills country only from
-- commits made under GPL-3.0. A row-count floor reads the free file's size (197).
--
-- WHAT THIS DOES
--
-- incidents.victim_country_source names the supplier of a country, and 160's
-- incidents_commercial view shows a country only where that source is in
-- source_licences with commercial_use. One label for both licences would sell
-- data that may not be sold, or withhold data that may be. So:
--
--   threatcluster                  fills made on or before 21 Nov 2026 under the old
--                                  terms (TLP:CLEAR, GPL-3.0). Unchanged: sellable.
--   threatcluster-gpl-20261121     the backfill from 3ae0330455 (GPL-3.0). Sellable.
--   threatcluster-terms-20261122   fills from the free file under ThreatCluster's
--                                  terms of 22 Nov 2026. NOT sellable (commercial_use
--                                  false), the same class as ETDA.
--
-- The threatcluster-victims Edge Function writes the second and third labels (see
-- its header). Order matters: apply this migration first, then deploy the function.
-- A function that wrote a label this table does not know would have its countries
-- withheld from the commercial view, which fails safe but loses the fill's value.
--
-- NOT DONE HERE, deliberately
--
-- Rows filled from the free file between 22 Nov 2026 12:27 UTC and the function's
-- deploy still say 'threatcluster'. The count is small (the cap is 25 rows a day);
-- the VERIFY query below lists them. Relabelling is an UPDATE of incident rows and is
-- done by hand after reading that count.

begin;

insert into public.source_licences
  (source_id, display_name, licence, licence_url, commercial_use, attribution_required, checked_on, notes)
values
  ('threatcluster-gpl-20261121', 'ThreatCluster Ransomware-Intel, GPL-3.0 snapshot of 21 Nov 2026',
   'GPL-3.0', 'https://www.gnu.org/licenses/gpl-3.0.html',
   true, true, '2026-11-25',
   'The 365-day victims file as committed in 3ae03304552ec01bfff7e77a5652e6459d193db2 (21 Nov 2026 14:54 UTC), '
     || 'the last commit made under GPL-3.0 (LICENSE read at that commit). Used only to fill an empty victim '
     || 'country, and credited to ThreatCluster. The later commits are under ThreatCluster''s own terms and are '
     || 'not used here.'),

  ('threatcluster-terms-20261122', 'ThreatCluster Ransomware-Intel, ThreatCluster terms of 22 Nov 2026',
   'ThreatCluster terms: free in your own environment and non-commercial community defence, with attribution',
   'https://threatcluster.io/terms',
   false, true, '2026-11-25',
   'Free to use in your own environment and in non-commercial community defence work, with attribution to '
     || 'ThreatCluster; redistributing the data in a commercial product or service needs a licence from '
     || 'ThreatCluster (LICENSE, eaee73985e, 22 Nov 2026). Treated as ETDA is: free product only, cut from paid '
     || 'access. Countries filled from the free 7-day file carry this label from the function''s deploy on.')
on conflict (source_id) do update
  set display_name = excluded.display_name,
      licence = excluded.licence,
      licence_url = excluded.licence_url,
      commercial_use = excluded.commercial_use,
      attribution_required = excluded.attribution_required,
      checked_on = excluded.checked_on,
      notes = excluded.notes,
      updated_at = now();

update public.source_licences
set licence = 'TLP:CLEAR and GPL-3.0 until 21 Nov 2026; ThreatCluster terms from 22 Nov (see the two rows beside it)',
    checked_on = '2026-11-25',
    notes = 'Countries filled on or before 21 Nov 2026, when the data was GPL-3.0 and its README said TLP:CLEAR. '
         || 'Later fills carry threatcluster-terms-20261122 and the backfill carries threatcluster-gpl-20261121.',
    updated_at = now()
where source_id = 'threatcluster';

commit;

-- VERIFY
--
--   select source_id, licence, commercial_use from source_licences where source_id like 'threatcluster%';
--
--   -- fills made since the licence changed that still carry the old label:
--   select count(*), min(updated_at), max(updated_at) from incidents
--   where victim_country_source = 'threatcluster' and updated_at >= '2026-11-22 12:27:00+00';
