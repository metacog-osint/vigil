-- =====================================================
-- UX Improvements Migration
-- Phase 3: Digest Emails and Comparison Dashboard
-- =====================================================

-- Digest preferences table
CREATE TABLE IF NOT EXISTS digest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'none')) DEFAULT 'weekly',
  send_time TIME DEFAULT '08:00',
  timezone TEXT DEFAULT 'UTC',
  include_sections JSONB DEFAULT '["summary", "actors", "incidents", "cves"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Digest history for tracking sent digests
CREATE TABLE IF NOT EXISTS digest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  digest_type TEXT, -- 'daily' or 'weekly'
  content_hash TEXT, -- To avoid sending duplicate content
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Entity notes for collaboration
CREATE TABLE IF NOT EXISTS entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id),
  entity_type TEXT NOT NULL, -- 'actor', 'incident', 'cve', 'ioc'
  entity_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_team_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_notes_entity ON entity_notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_notes_user ON entity_notes(user_id);

-- Share links for collaboration
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);

-- Dashboard layouts for customization
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Default',
  layout JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user ON dashboard_layouts(user_id);

-- Team watchlists for collaboration
CREATE TABLE IF NOT EXISTS team_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID REFERENCES team_watchlists(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_team_watchlist_items_watchlist ON team_watchlist_items(watchlist_id);

-- Indexes for digest queries
CREATE INDEX IF NOT EXISTS idx_digest_prefs_user ON digest_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_history_user ON digest_history(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_history_sent ON digest_history(sent_at);

-- Enable RLS
ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_watchlist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for digest_preferences
CREATE POLICY "Users can view own digest preferences" ON digest_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest preferences" ON digest_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own digest preferences" ON digest_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for digest_history
CREATE POLICY "Users can view own digest history" ON digest_history
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for entity_notes
CREATE POLICY "Users can view own notes" ON entity_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON entity_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON entity_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON entity_notes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for share_links
CREATE POLICY "Users can view own share links" ON share_links
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create share links" ON share_links
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- RLS Policies for dashboard_layouts
CREATE POLICY "Users can view own layouts" ON dashboard_layouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own layouts" ON dashboard_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own layouts" ON dashboard_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own layouts" ON dashboard_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Add last_visit_at to user_preferences if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences'
    AND column_name = 'last_visit_at'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN last_visit_at TIMESTAMPTZ;
  END IF;
END $$;
