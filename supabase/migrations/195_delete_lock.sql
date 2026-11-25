-- 195: no function or browser grant can delete Vigil's data without an archive.
--
-- Removes no rows. Three retention functions go, anon loses DELETE and TRUNCATE everywhere, signed-in users lose
-- TRUNCATE everywhere and keep DELETE only on the tables the app deletes from. service_role is unchanged.
-- Row level security still decides which rows a signed-in user may delete.

set local lock_timeout = '5s';

-- Nothing calls these (no cron job, function, worker, Edge Function or app code, checked 23 Nov 2026). Their
-- definitions stay in migrations 028, 052, 064 and 171.
drop function if exists public.purge_old_changelog(integer);
drop function if exists public.cleanup_old_alerts();
drop function if exists public.cleanup_old_audit_logs(integer);

do $$
declare
  -- Tables the app's own delete calls reach and that exist live (src/, audited 23 Nov 2026).
  app_deletes constant text[] := array[
    'alert_webhooks', 'api_keys', 'asset_group_members', 'asset_groups', 'assets', 'custom_ioc_lists', 'custom_iocs',
    'dashboard_layouts', 'entity_notes', 'entity_tags', 'investigation_checklist', 'investigation_entries',
    'investigations', 'notifications', 'outbound_webhooks', 'saved_searches', 'scheduled_reports', 'share_links',
    'tags', 'team_invitations', 'team_members', 'team_watchlist_items', 'team_watchlists', 'teams',
    'tenant_invitations', 'user_alert_rules', 'user_integrations', 'watchlist_items', 'watchlists'
  ];
  rel record;
begin
  for rel in
    select c.oid::regclass as name, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('revoke delete, truncate on %s from anon', rel.name);
    execute format('revoke truncate on %s from authenticated', rel.name);
    if not rel.relname = any (app_deletes) then
      execute format('revoke delete on %s from authenticated', rel.name);
    end if;
  end loop;
end
$$;

-- Exact duplicates on iocs, none with a recorded scan. iocs_type_value_key and idx_iocs_last_seen_at_desc stay.
drop index if exists public.idx_iocs_type_value;
drop index if exists public.idx_iocs_last_seen;
