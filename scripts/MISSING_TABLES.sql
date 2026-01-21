-- ==========================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/faqazkwdkajhxmwxchop/sql/new
-- ==========================================

-- ALERTS TABLE
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'cisa',
  alert_type TEXT,
  category TEXT,
  severity TEXT DEFAULT 'high',
  published_date TIMESTAMPTZ,
  url TEXT,
  cve_ids TEXT[],
  actor_ids UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_source ON alerts(source);
CREATE INDEX IF NOT EXISTS idx_alerts_published ON alerts(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_cves ON alerts USING GIN(cve_ids);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for alerts" ON alerts;
CREATE POLICY "Allow all for alerts" ON alerts FOR ALL USING (true);

-- BLOCKLISTS TABLE
CREATE TABLE IF NOT EXISTS blocklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  description TEXT,
  list_type TEXT,
  entry_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocklists_source ON blocklists(source);

ALTER TABLE blocklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for blocklists" ON blocklists;
CREATE POLICY "Allow all for blocklists" ON blocklists FOR ALL USING (true);

-- THREAT_FEEDS TABLE
CREATE TABLE IF NOT EXISTS threat_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  feed_type TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  refresh_interval INTEGER DEFAULT 86400,
  last_fetched TIMESTAMPTZ,
  last_status TEXT,
  entry_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_feeds_active ON threat_feeds(is_active);

ALTER TABLE threat_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for threat_feeds" ON threat_feeds;
CREATE POLICY "Allow all for threat_feeds" ON threat_feeds FOR ALL USING (true);

-- BREACHES TABLE
CREATE TABLE IF NOT EXISTS breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  title TEXT,
  domain TEXT,
  breach_date DATE,
  added_date DATE,
  modified_date DATE,
  pwn_count BIGINT DEFAULT 0,
  description TEXT,
  logo_path TEXT,
  data_classes TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  is_fabricated BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false,
  is_retired BOOLEAN DEFAULT false,
  is_spam_list BOOLEAN DEFAULT false,
  is_malware BOOLEAN DEFAULT false,
  is_subscription_free BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'hibp',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breaches_name ON breaches(name);
CREATE INDEX IF NOT EXISTS idx_breaches_domain ON breaches(domain);
CREATE INDEX IF NOT EXISTS idx_breaches_date ON breaches(breach_date DESC);

ALTER TABLE breaches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for breaches" ON breaches;
CREATE POLICY "Allow all for breaches" ON breaches FOR ALL USING (true);

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('alerts', 'blocklists', 'threat_feeds', 'breaches')
ORDER BY table_name;
