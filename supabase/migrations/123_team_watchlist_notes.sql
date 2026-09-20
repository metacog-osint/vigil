-- Migration: the one column team watchlist items were missing
-- Drafted: September 20, 2026
--
-- src/lib/supabase/sharedWatchlists.js has been querying shared_watchlists and
-- shared_watchlist_items, which have never existed. The tables it wants are
-- team_watchlists and team_watchlist_items, which do - they were created at some
-- point without a migration, pointed a foreign key at a teams table that was not
-- there, and carried no RLS policies at all, so they returned empty to everyone
-- until 120 fixed both.
--
-- The module moves onto them in the same commit. Three things did not line up,
-- and only one of them needs the database:
--
--   * notes. addItem writes it and updateItemNotes exists specifically to edit
--     it, so the column is real and is added here.
--   * created_at. The module orders items by it; the column is added_at. Fixed
--     in the module, since the table's name for it is the accurate one - an item
--     is added to a list, not created by it.
--   * The entity enrichment looks up vulnerabilities by id. That table is keyed
--     on cve_id and has no id, so every vulnerability item on a watchlist would
--     have 400'd. Fixed in the module.
--
-- Both tables are empty, so the unique constraint below cannot fail on existing
-- rows. It stops the same entity being pinned to one list twice, which is what
-- investigation_entities already does.

ALTER TABLE public.team_watchlist_items
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.team_watchlist_items.notes IS
  'Why this entity is on the list. Written by addItem, edited by updateItemNotes.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_watchlist_items_entity
  ON public.team_watchlist_items (watchlist_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_team_watchlist_items_list
  ON public.team_watchlist_items (watchlist_id, added_at DESC);
