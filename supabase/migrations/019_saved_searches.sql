-- Migration 019: Saved Searches & Views
-- Phase 2.4: Save and reuse search filters across pages

-- ============================================
-- Saved Searches Table
-- ============================================
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- Search metadata
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),

    -- Page/context
    page VARCHAR(50) NOT NULL, -- actors, incidents, vulnerabilities, iocs, events, etc.

    -- Filter configuration
    filters JSONB NOT NULL DEFAULT '{}',
    -- Example: { "status": "ESCALATING", "sector": "healthcare", "dateRange": "30d" }

    -- Sort configuration
    sort_by VARCHAR(100),
    sort_order VARCHAR(10) DEFAULT 'desc',

    -- View configuration
    view_mode VARCHAR(20), -- table, grid, timeline, etc.
    visible_columns TEXT[] DEFAULT '{}',

    -- Settings
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    pin_order INTEGER,

    -- Usage tracking
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, page, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_page ON saved_searches(page);
CREATE INDEX IF NOT EXISTS idx_saved_searches_default ON saved_searches(user_id, page, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_saved_searches_pinned ON saved_searches(user_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_saved_searches_shared ON saved_searches(team_id, is_shared) WHERE is_shared = true;

COMMENT ON TABLE saved_searches IS 'Saved search filters and view configurations';

-- ============================================
-- Recent Searches Table (for search history)
-- ============================================
CREATE TABLE IF NOT EXISTS recent_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,

    -- Search details
    page VARCHAR(50) NOT NULL,
    search_type VARCHAR(30), -- quick, advanced, filter
    query TEXT,
    filters JSONB DEFAULT '{}',

    -- Results summary
    result_count INTEGER,

    -- Timestamp
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON recent_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_searches_page ON recent_searches(user_id, page);
CREATE INDEX IF NOT EXISTS idx_recent_searches_time ON recent_searches(searched_at DESC);

-- Limit to last 50 searches per user
CREATE OR REPLACE FUNCTION limit_recent_searches()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM recent_searches
    WHERE user_id = NEW.user_id
    AND id NOT IN (
        SELECT id FROM recent_searches
        WHERE user_id = NEW.user_id
        ORDER BY searched_at DESC
        LIMIT 50
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recent_searches_limit ON recent_searches;
CREATE TRIGGER recent_searches_limit
    AFTER INSERT ON recent_searches
    FOR EACH ROW
    EXECUTE FUNCTION limit_recent_searches();

COMMENT ON TABLE recent_searches IS 'User search history for quick access';

-- ============================================
-- Quick Access Table (pinned items)
-- ============================================
CREATE TABLE IF NOT EXISTS quick_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,

    -- Item reference
    item_type VARCHAR(30) NOT NULL, -- saved_search, actor, incident, vulnerability, ioc, investigation
    item_id UUID,
    item_name VARCHAR(255) NOT NULL,
    item_url VARCHAR(255),

    -- Display
    icon VARCHAR(50),
    color VARCHAR(20),
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_quick_access_user ON quick_access(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_access_order ON quick_access(user_id, sort_order);

COMMENT ON TABLE quick_access IS 'Quick access panel items for navigation';

-- ============================================
-- Trigger to update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_saved_search_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saved_search_timestamp ON saved_searches;
CREATE TRIGGER saved_search_timestamp
    BEFORE UPDATE ON saved_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_search_timestamp();

-- ============================================
-- Function to increment use count
-- ============================================
CREATE OR REPLACE FUNCTION use_saved_search(search_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE saved_searches
    SET use_count = use_count + 1,
        last_used_at = NOW()
    WHERE id = search_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_access ON saved_searches
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
        OR (is_shared = true AND team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = current_setting('app.user_id', true)
        ))
    );

CREATE POLICY recent_searches_access ON recent_searches
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );

CREATE POLICY quick_access_access ON quick_access
    FOR ALL USING (
        user_id = current_setting('app.user_id', true)
    );
