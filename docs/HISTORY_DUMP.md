# History dump

`.github/workflows/history-dump.yml` runs Sundays 06:17 UTC (and on demand). It dumps the
history tables, restores them into a scratch Postgres to prove they read back, and files the
dump in the private `metacog-osint/tic-archive` (lane `pgdump`, one release per month, tag
`vigil-pgdump-YYYY-MM`). It only reads from the live database.

The restore test counts every dumped table at the source before the dump, and fails, so nothing
is filed, when any table restores fewer rows (entity_changelog exactly; the others below 99.9%,
room for a delete between the count and the dump), when a table's data fails to load, or on any
restore error other than a missing dependency the dump does not carry (the key functions behind
some indexes).

Sizes measured 23 Nov 2026 (heap): entity_changelog 927 MB, iocs 351 MB, ioc_sightings 132 MB,
the rest small. A compressed custom-format dump should be a few hundred MB, under the 1.5 GB
tic_archive input limit and GitHub's 2 GiB asset limit. The first run prints the real size;
if it nears 1.5 GB, split per table.

## Setup (the repository owner runs these, so the password and keys go straight to the secret store)

1. In the Supabase SQL editor, create the read-only role (pick the password yourself):

```sql
create role tic_dump login password '<choose one>';
grant usage on schema public to tic_dump;
grant select on public.entity_changelog, public.ioc_sightings, public.iocs, public.incidents,
  public.victim_disclosures, public.cyber_events, public.sync_log, public.vulnerabilities,
  public.advisories, public.threat_actors to tic_dump;
alter role tic_dump bypassrls;  -- may be refused on Supabase; see below
```

   Tables have row-level security. Without BYPASSRLS the role reads zero rows and no error. The
   workflow fails if it sees fewer than 2,000,000 changelog rows, so that case is caught, not
   filed. If `bypassrls` is refused, ask for an RLS policy `for select to tic_dump using (true)`
   on each table instead (a migration).

2. Copy the **Session pooler** connection string (Project Settings > Database > Connection
   string; the direct host is IPv6-only and GitHub runners cannot reach it). The user part is
   `tic_dump.faqazkwdkajhxmwxchop`. Then set it without printing it:

```powershell
gh secret set VIGIL_DUMP_DB_URL --repo metacog-osint/vigil
```

3. `TIC_ARCHIVE_TOKEN` is the same secret other repos use. Check `gh secret list --repo
   metacog-osint/vigil` first; set it only if missing.

4. Run once by hand: `gh workflow run history-dump.yml --repo metacog-osint/vigil`, then read
   the restore step's row counts.
