-- 151. Answer "do any wallets we hold appear on the SDN list?" as a measurement
--
-- STATUS: applied 2026-10-04.
--
-- WHY THIS EXISTS AT ALL
--
-- Migration 088 recorded, in prose, that none of the 1,043 OFAC addresses
-- matched the 9,900 ransom wallets Vigil holds - and that this is expected
-- rather than a gap, because ransom addresses are generated per victim while
-- OFAC designates exchange deposit and actor-controlled addresses.
--
-- That sentence was true in September. Left in a comment it would be an
-- assertion about live data that nobody re-checks, and both sides of it grow
-- every day. The /financial-crime page needs to state the overlap, because
-- putting "9,900 wallets" and "1,050 sanctioned addresses" on one screen
-- without it invites the reader to infer that a victim paid a sanctioned
-- address - which nothing in this database supports.
--
-- So it is a query, not a comment. Re-measured on every page load.
--
-- WHY IT IS AN RPC AND NOT DONE IN THE CLIENT
--
-- The client cannot join these two tables, and doing it browser-side means
-- fetching 9,900 wallets to compare against 1,050 addresses. As a function it
-- is one call: 13 ms, a hash semi join over two index-only scans.
--
-- lower() on both sides because Bitcoin addresses are case-sensitive and
-- Ethereum's are not, and the stored case is whatever the source published.
-- idx_sanctioned_addresses_lower serves it.
--
-- STABLE, not IMMUTABLE: the answer changes as either table changes.

create or replace function public.sanctions_wallet_overlap()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'wallets_held', (
      select count(*) from iocs where type = 'crypto_wallet'
    ),
    'sanctioned_addresses', (
      select count(*) from sanctioned_addresses
    ),
    'wallets_on_sdn_list', (
      select count(*) from iocs i
      where i.type = 'crypto_wallet'
        and exists (
          select 1 from sanctioned_addresses s
          where lower(s.address) = lower(i.value)
        )
    ),
    'measured_at', now()
  );
$function$;

comment on function public.sanctions_wallet_overlap() is
  'Overlap between held crypto wallets and OFAC-designated addresses. Zero is '
  'the expected answer, not a gap: ransom addresses are per-victim, OFAC '
  'designates exchange deposit and actor-controlled addresses. Measured rather '
  'than asserted so the figure cannot go stale in a comment.';

grant execute on function public.sanctions_wallet_overlap() to anon, authenticated;
