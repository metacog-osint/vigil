-- 146: eight claims where the published record disagrees with itself
--
-- WHY SEED DATA AT ALL
--
-- 145 built a schema whose whole argument is that corroboration and echo look
-- identical in every threat-intelligence product, including this one. An empty
-- schema does not make that argument. These eight claims do, because seven of
-- them are real disagreements in the 2025-26 public record on crypto-enabled
-- fraud and the eighth rests on a junta's own account of a raid on its own
-- territory.
--
-- WHAT THESE ROWS ARE AND ARE NOT
--
-- Every figure here is entered from the owner's scam-disruption compilation
-- (v1.0, 21 August 2026), which cites each to a numbered endnote. **Not one of
-- them has been read against its primary source by this migration**, so every
-- value carries verification = 'carried_forward' and entered_from naming the
-- document rather than the publisher. review_contested_claims() will queue all
-- of them as `claim_value_unverified`, which is correct: that is the work, and
-- it has not been done.
--
-- The compilation itself says its figures have a short half-life and that the
-- next annual reports will revise every 2025 number upward. Three of the rows
-- below are already more than a month old on entry. That is the argument for
-- holding them in a database that records verification state rather than in a
-- document that cannot.
--
-- WHY ONE PUBLISHER IS DELIBERATELY UNTIERED
--
-- Three values are recorded against `unattributed-secondary`, because the
-- compilation records them as "secondary coverage" without naming the outlet.
-- That publisher has tier null on purpose, so review_contested_claims() raises
-- `publisher_untiered` and a person has to answer "who actually said this?".
-- Inventing a tier for an unnamed repeater would be exactly the guess this
-- schema exists to stop - and the 694% row is the case in point, since the
-- mis-attribution of a Chainalysis figure to TRM is the reason that claim
-- needed a ruling in the first place.
--
-- NOT AN INGESTION SOURCE
--
-- evidence_publishers is not a feed registry and nothing here writes to
-- threat_actors, incidents or attributed_activity. The source_licences gate
-- (CLAUDE.md, reminder 8) is untouched; where a publisher is also an ingested
-- feed, licence_source_id points at its row so the two cannot drift.

begin;

-- ---------------------------------------------------------------------------
-- 1. Publishers
-- ---------------------------------------------------------------------------
insert into public.evidence_publishers
  (publisher_id, display_name, tier, tier_rationale, publisher_type, licence_source_id, checked_on, notes)
values
  -- Tier 1: primary documents and forensic record
  ('doj', 'US Department of Justice', 1,
   'Charging documents, forfeiture complaints and the prosecutions behind them. A claim here is a claim someone must defend in court.',
   'government_agency', null, '2026-09-24', null),

  ('us-courts', 'US federal courts', 1,
   'The filings themselves, including testimony given under examination. The primary record rather than an account of it.',
   'court', null, '2026-09-24', null),

  ('treasury-ofac', 'US Treasury / OFAC', 1,
   'Designations are formal acts of the US government with a published evidentiary basis.',
   'government_agency', 'ofac', '2026-09-24', null),

  ('fincen', 'FinCEN', 1,
   'Advisories and alerts are formal Treasury publications, and their red-flag indicators are written to be acted on by regulated institutions.',
   'government_agency', null, '2026-09-24',
   'Not yet ingested. The most direct fit for typology and indicator content of any source on this list.'),

  ('fbi-ic3', 'FBI Internet Crime Complaint Center', 1,
   'Statistical reporting by a federal agency on complaints it received. Measures reports, not incidence - which is a limit of the instrument, not of its tier.',
   'government_agency', null, '2026-09-24',
   'Under-reporting is structural: IC3 counts what victims chose to file.'),

  ('unodc', 'UN Office on Drugs and Crime', 1,
   'Intergovernmental threat assessment. Built partly on estimates the agency itself describes as incomplete, and says so.',
   'intergovernmental', null, null,
   'LICENCE UNCHECKED. UN publications are frequently CC BY-NC. Register in source_licences before anything here is ingested or sold.'),

  ('sec', 'US Securities and Exchange Commission', 1,
   'Filings made by the disclosing company under legal obligation.',
   'government_agency', 'sec-edgar', '2026-09-24', null),

  ('cisa', 'CISA', 1,
   'Government advisories carrying the US government''s own attribution.',
   'government_agency', 'cisa', '2026-09-24', null),

  -- Tier 2: named commercial research and reputable press
  ('trm-labs', 'TRM Labs', 2,
   'Sells tracing software and has a legitimate commercial interest in the size of the problem it measures. Its figures are that firm''s estimate and are named as such in every sentence that carries them.',
   'commercial_research', null, '2026-09-24', null),

  ('chainalysis', 'Chainalysis', 2,
   'As TRM Labs: named commercial research with a commercial interest in the measured total.',
   'commercial_research', null, '2026-09-24', null),

  ('elliptic', 'Elliptic', 2,
   'Named commercial research in the same market.',
   'commercial_research', null, null, null),

  ('blocksec', 'BlockSec', 2,
   'Named security firm publishing its own measurements.',
   'commercial_research', null, null, null),

  ('the-block', 'The Block', 2,
   'Specialist trade press. Reports others'' figures and occasionally differs from them in rounding.',
   'press', null, null, null),

  ('afp', 'Agence France-Presse', 2,
   'Wire service with reporters on the ground.',
   'press', null, null, null),

  ('ap', 'Associated Press', 2,
   'Wire service with reporters on the ground.',
   'press', null, null, null),

  ('the-irrawaddy', 'The Irrawaddy', 2,
   'Independent Myanmar-focused outlet. Reports against the junta''s account and is itself a party to that country''s information conflict, which is disclosed rather than discounted.',
   'press', null, null, null),

  ('icij', 'ICIJ', 2,
   'Investigative consortium. Named reporting, not a primary document.',
   'press', null, null, null),

  -- Tier 3: interested-party and state messaging
  ('myanmar-state-media', 'Myanmar state media', 3,
   'The military government reporting on its own operation on its own territory. Discloses what the junta claims; never establishes what happened.',
   'state_media', null, '2026-09-24', null),

  -- Deliberately untiered. See the migration header.
  ('unattributed-secondary', 'Unattributed secondary coverage', null, null,
   'press', null, null,
   'A placeholder for figures the compilation records as "secondary coverage" without naming the outlet. Untiered on purpose: an unnamed repeater cannot be classified, and review_contested_claims() will keep asking who it was.'),

  -- Not a publisher of figures; the document these rows were entered from.
  ('brummer-scam-disruption', 'Scam Disruption: A Working Reference (Brummer, v1.0)', null, null,
   'compilation', null, '2026-09-24',
   'Owner''s own compilation, 21 August 2026. Endnotes 1-55 were read with live URLs on that date; 56-60 were carried forward unverified. Source of every claim_values.entered_from below.')
on conflict (publisher_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The claims and their competing values
-- ---------------------------------------------------------------------------
do $seed$
declare
  c_id uuid;
  v_origin uuid;
  ruled_by constant text := 'T. R. Brummer, scam-disruption compilation v1.0';
  ruled_on constant timestamptz := '2026-08-21';
  entered  constant text := 'Scam Disruption: A Working Reference (Brummer, v1.0, 21 Aug 2026)';
begin
  if exists (select 1 from public.contested_claims) then
    raise notice '146: contested_claims already populated; leaving it alone';
    return;
  end if;

  -- 2.1 --------------------------------------------------------------------
  -- The worked example of the non-upgrade rule: a Chainalysis figure that
  -- secondary coverage attributes to TRM.
  insert into public.contested_claims
    (claim_key, question, unit, period_start, period_end, scope_note,
     resolution, handling, decided_by, decided_at)
  values
    ('sanctions_related_crypto_growth_2025',
     'By how much did sanctions-related cryptocurrency activity grow in 2025?',
     'percent_change_yoy', '2025-01-01', '2025-12-31',
     'Not one quantity. TRM reports growth in sanctions-related activity; Chainalysis reports growth in value received by sanctioned entities. Different denominators.',
     'prefer_one',
     'Attribute the 694% to Chainalysis. Secondary coverage has muddled the provenance and the figure is repeatedly cited as TRM''s.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, value_text, measurement, as_of,
     verification, entered_from, citation, notes)
  values (c_id, 'trm-labs', 400, 'more than 400%', 'estimated', '2026-01-31',
          'carried_forward', entered, 'endnote [21]', null);

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement, as_of,
     verification, entered_from, citation)
  values (c_id, 'chainalysis', 694, 'estimated', '2026-01-31',
          'carried_forward', entered, 'endnote [15]')
  returning id into v_origin;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, citation, derived_from, notes)
  values (c_id, 'unattributed-secondary', 694, 'reported',
          'carried_forward', entered, 'endnote [53]', v_origin,
          'Carried as TRM''s figure. It is Chainalysis''s. This row exists to make the mis-attribution visible rather than to record a third measurement.');

  -- 2.2 --------------------------------------------------------------------
  insert into public.contested_claims
    (claim_key, question, unit, period_start, period_end, scope_note,
     resolution, handling, decided_by, decided_at)
  values
    ('a7a5_stablecoin_volume_2025',
     'What total volume did the A7A5 ruble-pegged stablecoin move in its first year?',
     'usd_billions', '2025-02-01', '2025-12-31',
     'A gap of roughly 30%. Different measurement windows are the likely cause; A7A5 launched in February 2025.',
     'present_range',
     'Give the range, roughly $72bn to $93.3bn. Neither endpoint is the figure.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, value_text, measurement,
     verification, entered_from, citation)
  values
    (c_id, 'trm-labs', 72, 'more than $72 billion', 'estimated',
     'carried_forward', entered, 'endnote [6]'),
    (c_id, 'chainalysis', 93.3, null, 'estimated',
     'carried_forward', entered, 'endnotes [53][54]');

  -- 2.3 --------------------------------------------------------------------
  -- Measured against projected, which is the commonest way a reader is misled
  -- without anyone lying.
  insert into public.contested_claims
    (claim_key, question, unit, period_start, period_end,
     resolution, handling, decided_by, decided_at)
  values
    ('global_crypto_scam_losses_2025',
     'How much did cryptocurrency scams receive on-chain globally in 2025?',
     'usd_billions', '2025-01-01', '2025-12-31',
     'present_both',
     '"$14 billion measured, projected above $17 billion." Never present the projection alone.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, citation, notes)
  values (c_id, 'chainalysis', 14, 'measured',
          'carried_forward', entered, 'endnote [15]',
          'At least $14bn, on addresses identified at time of publication.');

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, value_text, measurement,
     verification, entered_from, citation, notes)
  values (c_id, 'chainalysis', 17, 'above $17 billion', 'projected',
          'carried_forward', entered, 'endnote [15]',
          'Built on the firm''s own historical revision rate, averaging about 24% between reporting periods.')
  returning id into v_origin;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, citation, derived_from, notes)
  values (c_id, 'unattributed-secondary', 17, 'reported',
          'carried_forward', entered, 'endnote [53]', v_origin,
          'Cited without the word "projected", and in coverage of TRM rather than Chainalysis.');

  -- 2.4 --------------------------------------------------------------------
  insert into public.contested_claims
    (claim_key, question, unit, period_start, period_end,
     resolution, handling, decided_by, decided_at)
  values
    ('ic3_elder_losses_2025',
     'What did FBI IC3 report as 2025 losses by complainants aged 60 and over, across all crime types?',
     'usd_billions', '2025-01-01', '2025-12-31',
     'prefer_one',
     'Minor and immaterial. Use the FBI''s own figure of approximately $7.7 billion.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, citation, notes)
  values (c_id, 'fbi-ic3', 7.7, 'reported',
          'carried_forward', entered, 'endnote [1]', 'FBI press release; up 37%.')
  returning id into v_origin;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, citation, derived_from, notes)
  values (c_id, 'the-block', 7.8, 'reported',
          'carried_forward', entered, 'endnote [24]', v_origin,
          'Reports the same IC3 figure with different rounding and a different year-on-year percentage (up 59%). Not a second measurement.');

  -- 2.5 --------------------------------------------------------------------
  insert into public.contested_claims
    (claim_key, question, unit, period_start, period_end,
     resolution, handling, decided_by, decided_at)
  values
    ('ic3_crypto_investment_fraud_2025',
     'What did FBI IC3 report as 2025 losses to crypto investment fraud?',
     'usd_billions', '2025-01-01', '2025-12-31',
     'transcription_artefact',
     'Use $7.23 billion. The $7.277 billion in secondary coverage is a transcription artefact, not a second measurement.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, citation, notes)
  values (c_id, 'fbi-ic3', 7.228, 'reported',
          'carried_forward', entered, 'endnotes [24][25]',
          '61,559 complaints; losses up 25%, complaint volume up 48%.')
  returning id into v_origin;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement,
     verification, entered_from, derived_from, notes)
  values (c_id, 'unattributed-secondary', 7.277, 'reported',
          'carried_forward', entered, v_origin,
          'One secondary account. Almost certainly a transposition of the IC3 figure.');

  -- 2.6 --------------------------------------------------------------------
  -- The case where the right answer is to quote no figure at all.
  insert into public.contested_claims
    (claim_key, question, unit, scope_note,
     resolution, handling, decided_by, decided_at)
  values
    ('uk_met_btc_seizure_valuation',
     'What was the value of the Bitcoin seized by the UK Metropolitan Police?',
     'usd_or_gbp',
     'An order-of-magnitude conflict, almost certainly seizure-date versus current valuation.',
     'do_not_quote',
     'Do not quote a currency figure. Describe it as 61,000 BTC.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_text, measurement,
     verification, entered_from, citation)
  values
    (c_id, 'chainalysis', 'approximately GBP 5 billion, in one account', 'reported',
     'carried_forward', entered, 'endnote [15]'),
    (c_id, 'unattributed-secondary', 'approximately USD 400 million at the time of recovery', 'reported',
     'carried_forward', entered, 'endnote [55]');

  -- 2.7 --------------------------------------------------------------------
  -- Same publisher, two scopes. Not every disagreement is between two bodies.
  insert into public.contested_claims
    (claim_key, question, unit, scope_note,
     resolution, handling, decided_by, decided_at)
  values
    ('scam_center_strike_force_recovered',
     'How much has the US Scam Center Strike Force frozen, seized and forfeited?',
     'usd_millions',
     'Different scopes and different dates rather than a disagreement: one figure covers frozen, seized and forfeited together, the other counts seizures and a separate forfeiture filing.',
     'prefer_one',
     'Use the $580 million. It is the later and broader figure.',
     ruled_by, ruled_on)
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, value_text, measurement,
     verification, entered_from, citation, notes)
  values
    (c_id, 'doj', 580, 'more than $580 million', 'reported',
     'carried_forward', entered, 'endnote [42]',
     'US Attorney Pirro: frozen, seized and forfeited.'),
    (c_id, 'doj', 401.657274, '$401,657,274.33', 'measured',
     'carried_forward', entered, 'endnote [32]',
     'Crypto-seizure team figure, plus a separate $80 million forfeiture filing.');

  -- 2.8 --------------------------------------------------------------------
  -- Nothing on the record but an interested party's own account.
  insert into public.contested_claims
    (claim_key, question, unit, period_start, period_end, scope_note)
  values
    ('kk_park_detained_october_2025',
     'How many people were detained in the October 2025 raid on KK Park, Myanmar?',
     'people', '2025-10-19', '2025-10-20',
     'The raid narrative originates with Myanmar junta state media, an interested party, which simultaneously claimed to find no evidence of scam operations at the site. The Irrawaddy reported residents and experts characterising the operation as a public-relations exercise; AFP identified far more satellite equipment than was said to be seized; AP reporting in December 2025 found workers relocated to other compounds.')
  returning id into c_id;

  insert into public.claim_values
    (claim_id, publisher_id, value_numeric, measurement, as_of,
     verification, entered_from, citation, notes)
  values (c_id, 'myanmar-state-media', 2198, 'claimed', '2025-10-20',
          'carried_forward', entered, 'endnotes [28][33]',
          '1,645 men, 445 women and 98 security personnel, across roughly 200 to 250 buildings.');

  raise notice '146: seeded % claims', (select count(*) from public.contested_claims);
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 3. Ask the questions this data raises, now, rather than at next ingestion
-- ---------------------------------------------------------------------------
select public.review_contested_claims();

commit;
