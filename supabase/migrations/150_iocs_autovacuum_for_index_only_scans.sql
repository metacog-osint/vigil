-- 150. Keep the iocs visibility map current, so ioc-geo stops timing out
--
-- STATUS: applied 2026-10-04, together with a one-off VACUUM (ANALYZE) of both
-- tables.
--
-- WHAT WAS BROKEN
--
-- ioc-geo failed 42 times against 116 successes in the seven days to 4 October,
-- always with 57014 - canceling statement due to statement timeout.
--
-- The timeout is 8 seconds and it is not obvious from anywhere in the code.
-- PostgREST logs in as `authenticator`, which carries
-- `statement_timeout=8s`; `service_role` sets nothing of its own, and SET ROLE
-- does not change an already-established session setting. So every worker RPC
-- gets 8 seconds, whatever the function.
--
-- WHY THE QUERY WAS SLOW, WHICH IS NOT WHAT IT LOOKS LIKE
--
-- resolve_ioc_geo starts with
--
--   SELECT i.id, i.value FROM iocs i
--   WHERE i.type IN ('ip','cidr')
--     AND NOT EXISTS (SELECT 1 FROM ioc_geo g WHERE g.ioc_id = i.id)
--   LIMIT 5000
--
-- Every ip and cidr row is already placed - 59,094 of them, 0 remaining - so
-- the anti-join matches nothing and the LIMIT can never stop early. It reads
-- both sides in full to return zero rows. That is inherent to the query and it
-- is not what made it time out.
--
-- What made it time out is that the scan had stopped being index-only:
--
--   Index Only Scan using idx_iocs_ip_like ... Heap Fetches: 26746
--   Buffers: shared hit=36761          Execution Time: 1296 ms
--
-- 26,746 heap fetches is a stale visibility map. Warm and uncontended that is
-- 1.3 seconds; cold, or sharing the tick with the bulk writers, it passes 8.
--
-- After VACUUM (ANALYZE) on iocs and ioc_geo:
--
--   Heap Fetches: 0
--   Buffers: shared hit=7330           Execution Time: 345 ms
--
-- Four times faster, and five times fewer buffers.
--
-- WHY AUTOVACUUM NEVER DID THIS
--
-- `autovacuum_count` is 0 and `last_autovacuum` is null for iocs, with database
-- statistics never reset - so autovacuum has genuinely never touched a table of
-- 603,713 rows. iocs is close to insert-only, so dead tuples stay near zero and
-- the dead-tuple trigger never fires. The insert trigger should have, but the
-- default needs
--
--   autovacuum_vacuum_insert_threshold + insert_scale_factor * reltuples
--   = 1000 + 0.2 * 603,713 = about 121,700 inserts
--
-- At roughly 37,000 IOCs a month that is once a quarter, which is how long the
-- visibility map is allowed to rot. The same arithmetic gets worse as the table
-- grows: the bigger it is, the longer it waits.
--
-- WHAT THIS CHANGES
--
-- Per-table settings, so the scale factor stops being a function of a table
-- that only grows. At 0.02 the insert trigger fires about every 13,000 rows -
-- every ten days or so at the current rate - instead of every 121,700.
--
-- WHAT THIS DOES NOT FIX
--
-- The scan is still O(every ip row), and it is 345 ms today only because the
-- table is clean. The IOC rate is rising (15k in May, 37k in September), so this
-- buys time rather than settling it. The durable fix is to make the pending set
-- directly findable - a `geo_checked boolean` on iocs with a partial index on
-- `type IN ('ip','cidr') AND NOT geo_checked`, set when a row is placed - which
-- turns "nothing to do" into an empty index scan instead of a full pass over
-- both tables. That is a schema change to a subsystem another session owns, so
-- it is written down here rather than taken.

alter table iocs set (
  autovacuum_vacuum_insert_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);

alter table ioc_geo set (
  autovacuum_vacuum_insert_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);
