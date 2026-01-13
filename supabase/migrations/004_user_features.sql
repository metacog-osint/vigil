-- Sprint 6: User Features
-- Watchlists, saved searches, user preferences, and tagging

-- ============================================================
-- 6.1 WATCHLISTS
-- Track specific entities of interest
-- ============================================================

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL DEFAULT 'anonymous',  -- For future auth integration
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('actor', 'vulnerability', 'ioc', 'incident')),
  color TEXT DEFAULT '#3b82f6',  -- Blue default
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,  -- The ID of the watched entity
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(watchlist_id, entity_id)
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);
CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_entity ON watchlist_items(entity_id);

-- ============================================================
-- 6.2 SAVED SEARCHES
-- Persist filter/search configurations
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  name TEXT NOT NULL,
  description TEXT,
  search_type TEXT NOT NULL CHECK (search_type IN ('actors', 'incidents', 'vulnerabilities', 'iocs', 'global')),
  filters JSONB NOT NULL DEFAULT '{}',  -- Stores filter parameters
  is_default BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_type ON saved_searches(search_type);

-- ============================================================
-- 6.3 USER PREFERENCES
-- User settings and personalization
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY DEFAULT 'anonymous',
  preferences JSONB NOT NULL DEFAULT '{
    "defaultTimeRange": "30d",
    "defaultSeverity": "all",
    "itemsPerPage": 25,
    "darkMode": true,
    "compactView": false,
    "showNewIndicators": true,
    "sidebarCollapsed": false,
    "dashboardLayout": "default"
  }',
  last_visit TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update last_visit
CREATE OR REPLACE FUNCTION update_user_last_visit(p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_preferences (user_id, last_visit)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET last_visit = NOW(), updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6.4 TAGGING SYSTEM
-- Flexible tagging for any entity
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',  -- Gray default
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS entity_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('actor', 'vulnerability', 'ioc', 'incident', 'technique')),
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tag_id, entity_type, entity_id)
);

CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_type, entity_id);

-- ============================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================

-- Watchlist with item counts
CREATE OR REPLACE VIEW watchlists_with_counts AS
SELECT
  w.*,
  COUNT(wi.id) as item_count
FROM watchlists w
LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
GROUP BY w.id;

-- Tags with usage counts
CREATE OR REPLACE VIEW tags_with_counts AS
SELECT
  t.*,
  COUNT(et.id) as usage_count
FROM tags t
LEFT JOIN entity_tags et ON t.id = et.tag_id
GROUP BY t.id;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (for future auth)
-- ============================================================

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anonymous access (update when adding auth)
CREATE POLICY "Allow all for watchlists" ON watchlists FOR ALL USING (true);
CREATE POLICY "Allow all for watchlist_items" ON watchlist_items FOR ALL USING (true);
CREATE POLICY "Allow all for saved_searches" ON saved_searches FOR ALL USING (true);
CREATE POLICY "Allow all for user_preferences" ON user_preferences FOR ALL USING (true);
CREATE POLICY "Allow all for tags" ON tags FOR ALL USING (true);
CREATE POLICY "Allow all for entity_tags" ON entity_tags FOR ALL USING (true);
