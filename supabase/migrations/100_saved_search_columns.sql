-- Migration: give saved_searches the columns its interface already writes
-- Drafted: September 20, 2026
--
-- Saved searches has been broken end to end since it shipped, in both directions.
-- The table was created with sixteen columns; src/lib/savedSearches.js reads and
-- writes eleven more that were never added, so every call failed with a 400:
--
--   getAll()    orders by is_pinned            - the main list, on every page
--   getDefault() filters on page
--   getPinned() filters on is_pinned, orders by pin_order
--   create()    inserts icon, color, page, sort_by, sort_order, view_mode,
--               visible_columns, is_pinned
--   recordUse() calls use_saved_search(), which does not exist
--
-- The interface in SavedSearches.jsx is complete - naming, pinning, per-page
-- defaults, usage counts - so this is schema drift, not an unfinished feature.
-- The columns are added rather than the feature removed.
--
-- Two are deliberately not added. is_shared and team_id exist only in the query
-- module: there is no sharing interface, and no teams table for a team_id to
-- point at. Adding columns to carry a feature that does not exist is the
-- scaffolding 0c608bb removed, so getShared() and those two writes go instead.

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS page            text,
  ADD COLUMN IF NOT EXISTS icon            text,
  ADD COLUMN IF NOT EXISTS color           text,
  ADD COLUMN IF NOT EXISTS sort_by         text,
  ADD COLUMN IF NOT EXISTS sort_order      text NOT NULL DEFAULT 'desc',
  ADD COLUMN IF NOT EXISTS view_mode       text,
  ADD COLUMN IF NOT EXISTS visible_columns text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_order       integer;

COMMENT ON COLUMN public.saved_searches.page IS
  'Which page the search belongs to (actors, incidents, iocs...); scopes getDefault and getAll';
COMMENT ON COLUMN public.saved_searches.pin_order IS
  'Manual ordering among pinned searches; null sorts last';

-- getAll orders by is_pinned then use_count, and getDefault filters by
-- (user_id, page). Both run on page load.
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_page
  ON public.saved_searches (user_id, page);
CREATE INDEX IF NOT EXISTS idx_saved_searches_pinned
  ON public.saved_searches (user_id, pin_order) WHERE is_pinned;

-- Not added: a unique index on (user_id, page) WHERE is_default. It is the right
-- shape for the rule, but create() inserts the new default first and unsets the
-- previous one afterwards, so the index would reject the insert before the code
-- ever got to clear the old row. Enforcing it needs create() reordered first.

-- ---------------------------------------------------------------------------
-- recordUse(): count the use and stamp the time, in one statement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_saved_search(search_uuid uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE saved_searches
  SET use_count = coalesce(use_count, 0) + 1,
      last_used_at = now()
  WHERE id = search_uuid;
$$;

COMMENT ON FUNCTION public.use_saved_search(uuid) IS
  'Increments use_count and stamps last_used_at. SECURITY INVOKER, so RLS still decides whose rows may be touched.';

GRANT EXECUTE ON FUNCTION public.use_saved_search(uuid) TO authenticated;
