-- Migration: somewhere for a feed to remember what it last saw
-- Reviewed: September 20, 2026
--
-- OFAC publishes SDN.XML as a full snapshot: 29 MB, no delta endpoint, and the
-- server ignores If-Modified-Since (asked for one, got 200 and all 29 MB back).
-- But it does set Last-Modified, and a HEAD returns it without the body:
--
--   HEAD .../exports/SDN.XML
--   last-modified: Fri, 18 Sep 2026 14:01:54 GMT
--
-- The list changes a few times a month, so comparing that header against the last
-- run turns a daily 29 MB download into a few hundred bytes on most days. That
-- matters on a platform that bills CPU in milliseconds, and it is the difference
-- between a feed that is expensive to keep current and one that is nearly free.
--
-- This is the place to keep the comparison value. Deliberately generic: NVD's
-- lastModStartDate and any other "what did I see last time" marker belong here
-- too, rather than each feed inventing its own column somewhere.
--
-- Not a cache of the data itself. The data belongs in its own tables, and a
-- snapshot on disk would only be a staler copy of what the database already has.

CREATE TABLE IF NOT EXISTS feed_cursors (
  feed_id    TEXT PRIMARY KEY,
  cursor     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feed_cursors IS
  'Per-feed "what did I last see" markers, so a feed can decide whether a fetch is needed at all. Not a data cache.';
COMMENT ON COLUMN feed_cursors.cursor IS
  'Feed-defined. ofac-sdn stores { last_modified, addresses }.';

ALTER TABLE feed_cursors ENABLE ROW LEVEL SECURITY;

-- Readable for the same reason feed_health is: it says when a source last changed,
-- which is part of being able to check what Vigil claims. Written only by the
-- service role.
DROP POLICY IF EXISTS "feed_cursors readable" ON feed_cursors;
CREATE POLICY "feed_cursors readable" ON feed_cursors
  FOR SELECT TO anon, authenticated USING (true);
