-- Migration 042: Saved View Sharing
-- Adds ability to share saved searches/views with team members

-- Add sharing columns to saved_searches
ALTER TABLE saved_searches
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with_team BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with_users UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pin_order INTEGER,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES auth.users(id);

-- Create view sharing permissions table
CREATE TABLE IF NOT EXISTS saved_search_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  granted_to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_to_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL DEFAULT 'view', -- 'view', 'edit', 'admin'
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT check_grantee CHECK (
    (granted_to_user_id IS NOT NULL AND granted_to_team_id IS NULL) OR
    (granted_to_user_id IS NULL AND granted_to_team_id IS NOT NULL)
  )
);

-- Create default views table (per page)
CREATE TABLE IF NOT EXISTS user_default_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_path TEXT NOT NULL, -- e.g., '/actors', '/incidents'
  saved_search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, page_path)
);

-- Create pinned views for sidebar quick access
CREATE TABLE IF NOT EXISTS user_pinned_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, saved_search_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_shared
ON saved_searches(is_shared, user_id)
WHERE is_shared = true;

CREATE INDEX IF NOT EXISTS idx_saved_search_permissions_user
ON saved_search_permissions(granted_to_user_id)
WHERE granted_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_search_permissions_team
ON saved_search_permissions(granted_to_team_id)
WHERE granted_to_team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_pinned_views_user
ON user_pinned_views(user_id, display_order);

-- Function to get accessible saved searches for a user
CREATE OR REPLACE FUNCTION get_accessible_saved_searches(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  entity_type TEXT,
  query TEXT,
  filters JSONB,
  is_owner BOOLEAN,
  can_edit BOOLEAN,
  shared_by_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.id,
    ss.name,
    ss.entity_type,
    ss.query,
    ss.filters,
    ss.user_id = p_user_id AS is_owner,
    ss.user_id = p_user_id OR ssp.permission_level IN ('edit', 'admin') AS can_edit,
    u.raw_user_meta_data->>'display_name' AS shared_by_name
  FROM saved_searches ss
  LEFT JOIN saved_search_permissions ssp ON ssp.saved_search_id = ss.id
    AND (ssp.granted_to_user_id = p_user_id
      OR ssp.granted_to_team_id IN (
        SELECT team_id FROM team_members WHERE user_id = p_user_id
      ))
  LEFT JOIN auth.users u ON u.id = ss.shared_by
  WHERE ss.user_id = p_user_id
    OR ss.is_shared = true AND ssp.id IS NOT NULL
  ORDER BY ss.is_pinned DESC, ss.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to share a saved search
CREATE OR REPLACE FUNCTION share_saved_search(
  p_saved_search_id UUID,
  p_share_with_team_id UUID DEFAULT NULL,
  p_share_with_user_ids UUID[] DEFAULT NULL,
  p_permission_level TEXT DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_owner_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Verify ownership
  SELECT user_id INTO v_owner_id FROM saved_searches WHERE id = p_saved_search_id;
  IF v_owner_id != v_user_id THEN
    RAISE EXCEPTION 'Only the owner can share this view';
  END IF;

  -- Update saved search
  UPDATE saved_searches SET
    is_shared = true,
    shared_at = NOW(),
    shared_by = v_user_id,
    shared_with_team = p_share_with_team_id IS NOT NULL
  WHERE id = p_saved_search_id;

  -- Add team permission
  IF p_share_with_team_id IS NOT NULL THEN
    INSERT INTO saved_search_permissions (saved_search_id, granted_to_team_id, permission_level, granted_by)
    VALUES (p_saved_search_id, p_share_with_team_id, p_permission_level, v_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Add user permissions
  IF p_share_with_user_ids IS NOT NULL THEN
    INSERT INTO saved_search_permissions (saved_search_id, granted_to_user_id, permission_level, granted_by)
    SELECT p_saved_search_id, unnest(p_share_with_user_ids), p_permission_level, v_user_id
    ON CONFLICT DO NOTHING;

    UPDATE saved_searches SET shared_with_users = p_share_with_user_ids
    WHERE id = p_saved_search_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set default view
CREATE OR REPLACE FUNCTION set_default_view(
  p_page_path TEXT,
  p_saved_search_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO user_default_views (user_id, page_path, saved_search_id)
  VALUES (auth.uid(), p_page_path, p_saved_search_id)
  ON CONFLICT (user_id, page_path)
  DO UPDATE SET saved_search_id = p_saved_search_id, updated_at = NOW();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to pin/unpin view for sidebar
CREATE OR REPLACE FUNCTION toggle_pin_view(p_saved_search_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_pinned BOOLEAN;
BEGIN
  -- Check if already pinned
  SELECT EXISTS(
    SELECT 1 FROM user_pinned_views
    WHERE user_id = auth.uid() AND saved_search_id = p_saved_search_id
  ) INTO v_is_pinned;

  IF v_is_pinned THEN
    -- Unpin
    DELETE FROM user_pinned_views
    WHERE user_id = auth.uid() AND saved_search_id = p_saved_search_id;
    RETURN false;
  ELSE
    -- Pin
    INSERT INTO user_pinned_views (user_id, saved_search_id, display_order)
    VALUES (auth.uid(), p_saved_search_id, (
      SELECT COALESCE(MAX(display_order), 0) + 1
      FROM user_pinned_views WHERE user_id = auth.uid()
    ));
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies
ALTER TABLE saved_search_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_default_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pinned_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view permissions for their searches"
ON saved_search_permissions FOR SELECT
USING (
  saved_search_id IN (SELECT id FROM saved_searches WHERE user_id = auth.uid())
  OR granted_to_user_id = auth.uid()
);

CREATE POLICY "Owners can manage permissions"
ON saved_search_permissions FOR ALL
USING (
  saved_search_id IN (SELECT id FROM saved_searches WHERE user_id = auth.uid())
);

CREATE POLICY "Users can manage their default views"
ON user_default_views FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their pinned views"
ON user_pinned_views FOR ALL
USING (user_id = auth.uid());
