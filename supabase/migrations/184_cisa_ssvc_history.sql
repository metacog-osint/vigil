-- 184. CISA's earlier SSVC judgments, kept when they change
--
-- STATUS: NOT YET APPLIED. Builds on 176 (cisa_ssvc).
--
-- WHY
--
-- cisa_ssvc holds one row per CVE with CISA's latest values. The hourly
-- cisa-vulnrichment function upserts it, "including a change back to none", so a
-- change of Exploitation (none, poc, active), Automatable or Technical Impact
-- overwrote the earlier assessment with no trace. CISA's git history can replay
-- it, but Vigil did not hold it.
--
-- WHAT CHANGES
--
-- cisa_ssvc_history: when an UPDATE changes a decision point, the assessment
-- time or the KEV date, the row being replaced is copied here (insert on change,
-- written by an AFTER UPDATE trigger, so the Edge Function is untouched). An
-- upsert that rewrites identical decision values, or only moves the commit
-- pointer or fetched_at, adds nothing.
--
-- SIZE (estimate, unverified): a few to tens of changed CVEs a day, about 200
-- bytes each: well under 10 KB a day.

begin;

create table public.cisa_ssvc_history (
  id bigint generated always as identity primary key,
  cve_id text not null,
  exploitation text,
  automatable text,
  technical_impact text,
  ssvc_version text,
  assessed_at timestamptz,
  adp_updated_at timestamptz,
  kev_date_added date,
  source_commit text,
  fetched_at timestamptz,
  superseded_at timestamptz not null default now()
);

create index cisa_ssvc_history_cve_idx on public.cisa_ssvc_history (cve_id, superseded_at desc);

comment on table public.cisa_ssvc_history is
  'The cisa_ssvc row as it was before an update that changed exploitation, automatable, technical_impact, '
  'assessed_at or kev_date_added. superseded_at is when Vigil replaced it. 184.';

revoke all on public.cisa_ssvc_history from anon, authenticated;
grant select, insert, update, delete on public.cisa_ssvc_history to service_role;
alter table public.cisa_ssvc_history enable row level security;

create or replace function public.cisa_ssvc_record_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if (OLD.exploitation, OLD.automatable, OLD.technical_impact, OLD.ssvc_version,
      OLD.assessed_at, OLD.kev_date_added)
     is distinct from
     (NEW.exploitation, NEW.automatable, NEW.technical_impact, NEW.ssvc_version,
      NEW.assessed_at, NEW.kev_date_added) then
    insert into public.cisa_ssvc_history
      (cve_id, exploitation, automatable, technical_impact, ssvc_version, assessed_at,
       adp_updated_at, kev_date_added, source_commit, fetched_at)
    values
      (OLD.cve_id, OLD.exploitation, OLD.automatable, OLD.technical_impact, OLD.ssvc_version,
       OLD.assessed_at, OLD.adp_updated_at, OLD.kev_date_added, OLD.source_commit, OLD.fetched_at);
  end if;
  return null;
end;
$fn$;

drop trigger if exists trg_cisa_ssvc_record_history on public.cisa_ssvc;
create trigger trg_cisa_ssvc_record_history
  after update on public.cisa_ssvc
  for each row execute function public.cisa_ssvc_record_history();

revoke execute on function public.cisa_ssvc_record_history() from public, anon, authenticated;

commit;
