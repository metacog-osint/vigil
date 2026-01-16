-- GitHub Security Advisory Database (GHSA) Schema
-- Stores supply chain vulnerability advisories for open-source packages
-- Run: Apply via Supabase dashboard or CLI

-- ============================================
-- ADVISORIES TABLE
-- GitHub Security Advisories for npm, PyPI, Maven, Go, Rust, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS advisories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghsa_id TEXT UNIQUE NOT NULL,  -- GHSA-xxxx-xxxx-xxxx
  cve_id TEXT,  -- Associated CVE if exists
  summary TEXT NOT NULL,
  description TEXT,
  severity TEXT,  -- critical, high, moderate, low
  cvss_score NUMERIC,
  cvss_vector TEXT,

  -- Affected packages
  ecosystem TEXT,  -- npm, pip, maven, go, rust, nuget, rubygems, etc.
  package_name TEXT,
  vulnerable_versions TEXT,  -- Version range expression
  patched_versions TEXT,

  -- Metadata
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,

  -- References
  references JSONB DEFAULT '[]',  -- Array of {type, url}
  credits JSONB DEFAULT '[]',  -- Array of {type, user}

  -- Source tracking
  source TEXT DEFAULT 'github_ghsa',
  source_url TEXT,

  -- Raw data for audit
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_advisories_ghsa ON advisories(ghsa_id);
CREATE INDEX IF NOT EXISTS idx_advisories_cve ON advisories(cve_id) WHERE cve_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advisories_ecosystem ON advisories(ecosystem);
CREATE INDEX IF NOT EXISTS idx_advisories_package ON advisories(package_name);
CREATE INDEX IF NOT EXISTS idx_advisories_severity ON advisories(severity);
CREATE INDEX IF NOT EXISTS idx_advisories_published ON advisories(published_at DESC);

-- Full-text search on summary and description
CREATE INDEX IF NOT EXISTS idx_advisories_search ON advisories
  USING GIN(to_tsvector('english', COALESCE(summary, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(package_name, '')));

-- ============================================
-- LINK TABLE: CVE to GHSA mapping
-- A CVE can have multiple GHSA advisories (different packages)
-- ============================================
CREATE TABLE IF NOT EXISTS cve_advisories (
  cve_id TEXT NOT NULL REFERENCES vulnerabilities(cve_id) ON DELETE CASCADE,
  advisory_id UUID NOT NULL REFERENCES advisories(id) ON DELETE CASCADE,
  PRIMARY KEY (cve_id, advisory_id)
);

CREATE INDEX IF NOT EXISTS idx_cve_advisories_cve ON cve_advisories(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_advisories_advisory ON cve_advisories(advisory_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get advisories for a specific ecosystem
CREATE OR REPLACE FUNCTION get_advisories_by_ecosystem(target_ecosystem TEXT, limit_count INTEGER DEFAULT 100)
RETURNS SETOF advisories AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM advisories
  WHERE ecosystem = target_ecosystem
  ORDER BY published_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get advisories affecting a specific package
CREATE OR REPLACE FUNCTION get_package_advisories(target_ecosystem TEXT, target_package TEXT)
RETURNS SETOF advisories AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM advisories
  WHERE ecosystem = target_ecosystem
    AND package_name ILIKE target_package
  ORDER BY severity DESC, published_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Count advisories by ecosystem
CREATE OR REPLACE FUNCTION advisory_counts_by_ecosystem()
RETURNS TABLE (
  ecosystem TEXT,
  total BIGINT,
  critical BIGINT,
  high BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.ecosystem,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE a.severity = 'critical') as critical,
    COUNT(*) FILTER (WHERE a.severity = 'high') as high
  FROM advisories a
  WHERE a.ecosystem IS NOT NULL
  GROUP BY a.ecosystem
  ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql;
