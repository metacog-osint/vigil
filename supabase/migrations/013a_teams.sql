-- Teams and Role-Based Access Control
-- Migration: 010_teams.sql

-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL, -- Firebase UID
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Firebase UID
  email TEXT NOT NULL,
  display_name TEXT,
  role team_role NOT NULL DEFAULT 'viewer',
  invited_by TEXT, -- Firebase UID of inviter
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- ============================================
-- TEAM INVITATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role team_role NOT NULL DEFAULT 'viewer',
  token TEXT UNIQUE NOT NULL,
  invited_by TEXT NOT NULL, -- Firebase UID
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);

-- ============================================
-- SHARED WATCHLISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shared_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL, -- Firebase UID
  visibility TEXT DEFAULT 'team' CHECK (visibility IN ('team', 'private')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SHARED WATCHLIST ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shared_watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES shared_watchlists(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('actor', 'incident', 'vulnerability', 'ioc', 'technique')),
  entity_id UUID NOT NULL,
  added_by TEXT NOT NULL, -- Firebase UID
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(watchlist_id, entity_type, entity_id)
);

-- ============================================
-- ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS team_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Firebase UID
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_shared_watchlists_team_id ON shared_watchlists(team_id);
CREATE INDEX idx_shared_watchlist_items_watchlist_id ON shared_watchlist_items(watchlist_id);
CREATE INDEX idx_team_activity_log_team_id ON team_activity_log(team_id);
CREATE INDEX idx_team_activity_log_user_id ON team_activity_log(user_id);
CREATE INDEX idx_team_activity_log_created_at ON team_activity_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_log ENABLE ROW LEVEL SECURITY;

-- Teams: members can view their teams
CREATE POLICY teams_select ON teams FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = auth.uid()::text)
);

-- Team members: members can view other members in their teams
CREATE POLICY team_members_select ON team_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid()::text)
);

-- Shared watchlists: team members can view
CREATE POLICY shared_watchlists_select ON shared_watchlists FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = shared_watchlists.team_id AND user_id = auth.uid()::text)
);

-- Shared watchlist items: team members can view
CREATE POLICY shared_watchlist_items_select ON shared_watchlist_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM shared_watchlists sw
    JOIN team_members tm ON tm.team_id = sw.team_id
    WHERE sw.id = shared_watchlist_items.watchlist_id AND tm.user_id = auth.uid()::text
  )
);

-- Activity log: team members can view their team's activity
CREATE POLICY team_activity_log_select ON team_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = team_activity_log.team_id AND user_id = auth.uid()::text)
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's role in a team
CREATE OR REPLACE FUNCTION get_user_team_role(p_team_id UUID, p_user_id TEXT)
RETURNS team_role AS $$
  SELECT role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has minimum role
CREATE OR REPLACE FUNCTION user_has_role(p_team_id UUID, p_user_id TEXT, p_min_role team_role)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role team_role;
  v_role_order INTEGER;
  v_min_order INTEGER;
BEGIN
  SELECT role INTO v_user_role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;

  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy: owner > admin > analyst > viewer
  v_role_order := CASE v_user_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'analyst' THEN 2
    WHEN 'viewer' THEN 1
  END;

  v_min_order := CASE p_min_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'analyst' THEN 2
    WHEN 'viewer' THEN 1
  END;

  RETURN v_role_order >= v_min_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate invitation token (using md5 of random UUIDs for compatibility)
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
  SELECT md5(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text);
$$ LANGUAGE sql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update teams.updated_at on change
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- Update shared_watchlists.updated_at on change
CREATE TRIGGER shared_watchlists_updated_at
  BEFORE UPDATE ON shared_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();
