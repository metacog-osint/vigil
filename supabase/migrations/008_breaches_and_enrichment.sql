-- Migration 008: Breaches Table and IOC Enrichment Support
-- Stores breach data from HIBP and adds enrichment fields to IOCs

-- ============================================
-- BREACHES TABLE
-- Stores breach data from Have I Been Pwned
-- ============================================
CREATE TABLE IF NOT EXISTS breaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indexes for breach lookups
CREATE INDEX IF NOT EXISTS idx_breaches_domain ON breaches(domain);
CREATE INDEX IF NOT EXISTS idx_breaches_breach_date ON breaches(breach_date DESC);
CREATE INDEX IF NOT EXISTS idx_breaches_pwn_count ON breaches(pwn_count DESC);

-- ============================================
-- IOC ENRICHMENT COLUMNS
-- Add columns to store geolocation and enrichment data
-- ============================================

-- Add geolocation columns to IOCs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'iocs' AND column_name = 'country_code') THEN
    ALTER TABLE iocs ADD COLUMN country_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'iocs' AND column_name = 'country') THEN
    ALTER TABLE iocs ADD COLUMN country TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'iocs' AND column_name = 'asn') THEN
    ALTER TABLE iocs ADD COLUMN asn TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'iocs' AND column_name = 'asn_org') THEN
    ALTER TABLE iocs ADD COLUMN asn_org TEXT;
  END IF;
END $$;

-- Index for country lookups
CREATE INDEX IF NOT EXISTS idx_iocs_country_code ON iocs(country_code);

-- ============================================
-- VIEWS
-- ============================================

-- View for breach statistics
CREATE OR REPLACE VIEW breach_statistics AS
SELECT
  COUNT(*) as total_breaches,
  COUNT(*) FILTER (WHERE is_verified) as verified_breaches,
  SUM(pwn_count) as total_pwned_accounts,
  MAX(breach_date) as most_recent_breach,
  (
    SELECT jsonb_agg(data_class)
    FROM (
      SELECT unnest(data_classes) as data_class, COUNT(*) as cnt
      FROM breaches
      GROUP BY data_class
      ORDER BY cnt DESC
      LIMIT 10
    ) t
  ) as top_data_classes
FROM breaches;

-- View for IOC country distribution
CREATE OR REPLACE VIEW ioc_country_distribution AS
SELECT
  COALESCE(country_code, 'Unknown') as country_code,
  COALESCE(country, 'Unknown') as country,
  COUNT(*) as ioc_count,
  type
FROM iocs
GROUP BY country_code, country, type
ORDER BY ioc_count DESC;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE breaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for breaches" ON breaches
  FOR SELECT USING (true);
