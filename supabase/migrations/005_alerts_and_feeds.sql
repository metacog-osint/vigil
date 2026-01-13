-- Sprint 7: Additional Data Sources
-- Alerts, blocklists, and threat feeds

-- ============================================================
-- ALERTS TABLE
-- Store security alerts from CISA, US-CERT, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'cisa',
  alert_type TEXT,  -- 'alert', 'current_activity', 'advisory'
  category TEXT,    -- 'ransomware', 'malware', 'vulnerability', etc.
  severity TEXT DEFAULT 'high',
  published_date TIMESTAMPTZ,
  url TEXT,
  cve_ids TEXT[],
  actor_ids UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_source ON alerts(source);
CREATE INDEX idx_alerts_published ON alerts(published_date DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_category ON alerts(category);
CREATE INDEX idx_alerts_cves ON alerts USING GIN(cve_ids);

-- ============================================================
-- BLOCKLISTS TABLE
-- Store IP/domain blocklist metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS blocklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT,
  description TEXT,
  list_type TEXT,  -- 'ip', 'domain', 'url'
  entry_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocklists_source ON blocklists(source);

-- ============================================================
-- MALWARE SAMPLES TABLE
-- Store malware sample metadata from MalwareBazaar
-- ============================================================

CREATE TABLE IF NOT EXISTS malware_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sha256 TEXT UNIQUE NOT NULL,
  sha1 TEXT,
  md5 TEXT,
  filename TEXT,
  file_type TEXT,
  file_size INTEGER,
  signature TEXT,  -- Malware family/name
  tags TEXT[],
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  source TEXT DEFAULT 'malwarebazaar',
  reporter TEXT,
  delivery_method TEXT,  -- How it was delivered
  c2_urls TEXT[],
  actor_id UUID REFERENCES threat_actors(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_malware_sha256 ON malware_samples(sha256);
CREATE INDEX idx_malware_md5 ON malware_samples(md5);
CREATE INDEX idx_malware_signature ON malware_samples(signature);
CREATE INDEX idx_malware_tags ON malware_samples USING GIN(tags);
CREATE INDEX idx_malware_first_seen ON malware_samples(first_seen DESC);

-- ============================================================
-- THREAT FEEDS TABLE
-- Track configured threat intelligence feeds
-- ============================================================

CREATE TABLE IF NOT EXISTS threat_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  feed_type TEXT NOT NULL,  -- 'stix', 'csv', 'json', 'txt', 'rss'
  category TEXT,  -- 'ip', 'domain', 'hash', 'url', 'mixed'
  is_active BOOLEAN DEFAULT TRUE,
  refresh_interval INTEGER DEFAULT 86400,  -- Seconds between updates
  last_fetched TIMESTAMPTZ,
  last_status TEXT,
  entry_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threat_feeds_active ON threat_feeds(is_active);

-- ============================================================
-- SYNC LOG TABLE
-- Track data ingestion status
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_sync_log_source ON sync_log(source);
CREATE INDEX idx_sync_log_completed ON sync_log(completed_at DESC);

-- ============================================================
-- UPDATE IOCs TABLE
-- Add support for IP ranges and blocklist sources
-- ============================================================

-- Add new IOC types if not exists (alter type is tricky in postgres)
DO $$
BEGIN
  -- Add blocklist flag to IOCs
  ALTER TABLE iocs ADD COLUMN IF NOT EXISTS is_blocklist BOOLEAN DEFAULT FALSE;
  ALTER TABLE iocs ADD COLUMN IF NOT EXISTS blocklist_source TEXT;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- VIEWS
-- ============================================================

-- Recent alerts view
CREATE OR REPLACE VIEW recent_alerts AS
SELECT *
FROM alerts
WHERE published_date > NOW() - INTERVAL '30 days'
ORDER BY published_date DESC;

-- Active blocklist entries
CREATE OR REPLACE VIEW blocklist_iocs AS
SELECT *
FROM iocs
WHERE is_blocklist = TRUE
  AND last_seen > NOW() - INTERVAL '7 days';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE malware_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Permissive policies
CREATE POLICY "Allow all for alerts" ON alerts FOR ALL USING (true);
CREATE POLICY "Allow all for blocklists" ON blocklists FOR ALL USING (true);
CREATE POLICY "Allow all for malware_samples" ON malware_samples FOR ALL USING (true);
CREATE POLICY "Allow all for threat_feeds" ON threat_feeds FOR ALL USING (true);
CREATE POLICY "Allow all for sync_log" ON sync_log FOR ALL USING (true);
