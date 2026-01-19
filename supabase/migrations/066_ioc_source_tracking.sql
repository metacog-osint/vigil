-- Migration: IOC Source Feed Tracking
-- Created: January 18, 2026
-- Purpose: Track source feed for IOCs to enable deduplication and provenance

-- Add source_feed column to iocs table
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS source_feed TEXT;
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS source_ref TEXT;
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS sighting_count INT DEFAULT 1;

-- Create index for source tracking queries
CREATE INDEX IF NOT EXISTS idx_iocs_source_feed ON iocs(source_feed);
CREATE INDEX IF NOT EXISTS idx_iocs_source_ref ON iocs(source_ref);
CREATE INDEX IF NOT EXISTS idx_iocs_first_seen ON iocs(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_iocs_last_seen ON iocs(last_seen_at DESC);

-- Create a composite unique constraint for deduplication
-- An IOC is unique by value + type + source_feed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'iocs_value_type_source_unique'
  ) THEN
    ALTER TABLE iocs ADD CONSTRAINT iocs_value_type_source_unique
      UNIQUE (value, type, source_feed);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Constraint may already exist or there may be duplicates
  NULL;
END $$;

-- Create function to upsert IOCs with source tracking
CREATE OR REPLACE FUNCTION upsert_ioc_with_source(
  p_value TEXT,
  p_type TEXT,
  p_source_feed TEXT,
  p_source_ref TEXT DEFAULT NULL,
  p_threat_level TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  is_new BOOLEAN,
  sighting_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_is_new BOOLEAN := false;
  v_count INT;
BEGIN
  -- Try to find existing IOC
  SELECT iocs.id, iocs.sighting_count INTO v_id, v_count
  FROM iocs
  WHERE iocs.value = p_value
    AND iocs.type = p_type
    AND (iocs.source_feed = p_source_feed OR (iocs.source_feed IS NULL AND p_source_feed IS NULL));

  IF v_id IS NOT NULL THEN
    -- Update existing IOC
    UPDATE iocs SET
      last_seen_at = NOW(),
      sighting_count = sighting_count + 1,
      threat_level = COALESCE(p_threat_level, iocs.threat_level),
      tags = COALESCE(
        CASE WHEN p_tags IS NOT NULL THEN
          array_cat(iocs.tags, p_tags)
        ELSE
          iocs.tags
        END,
        iocs.tags
      ),
      metadata = iocs.metadata || p_metadata,
      updated_at = NOW()
    WHERE iocs.id = v_id
    RETURNING iocs.sighting_count INTO v_count;

    v_is_new := false;
  ELSE
    -- Insert new IOC
    INSERT INTO iocs (
      value,
      type,
      source_feed,
      source_ref,
      threat_level,
      tags,
      metadata,
      first_seen_at,
      last_seen_at,
      sighting_count
    ) VALUES (
      p_value,
      p_type,
      p_source_feed,
      p_source_ref,
      p_threat_level,
      COALESCE(p_tags, '{}'),
      p_metadata,
      NOW(),
      NOW(),
      1
    )
    RETURNING iocs.id, iocs.sighting_count INTO v_id, v_count;

    v_is_new := true;
  END IF;

  RETURN QUERY SELECT v_id, v_is_new, v_count;
END;
$$;

-- Create view for IOC source statistics
CREATE OR REPLACE VIEW ioc_source_stats AS
SELECT
  source_feed,
  COUNT(*) as ioc_count,
  COUNT(*) FILTER (WHERE first_seen_at > NOW() - INTERVAL '24 hours') as new_24h,
  COUNT(*) FILTER (WHERE first_seen_at > NOW() - INTERVAL '7 days') as new_7d,
  MAX(last_seen_at) as last_update,
  SUM(sighting_count) as total_sightings
FROM iocs
WHERE source_feed IS NOT NULL
GROUP BY source_feed
ORDER BY ioc_count DESC;

-- Create function to get IOC overlap between sources
CREATE OR REPLACE FUNCTION get_ioc_source_overlap(
  p_source_a TEXT,
  p_source_b TEXT
)
RETURNS TABLE (
  overlap_count BIGINT,
  source_a_unique BIGINT,
  source_b_unique BIGINT,
  overlap_percentage NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_overlap BIGINT;
  v_a_only BIGINT;
  v_b_only BIGINT;
  v_a_total BIGINT;
BEGIN
  -- Count overlapping IOCs (same value and type)
  SELECT COUNT(*) INTO v_overlap
  FROM iocs a
  INNER JOIN iocs b ON a.value = b.value AND a.type = b.type
  WHERE a.source_feed = p_source_a AND b.source_feed = p_source_b;

  -- Count IOCs unique to source A
  SELECT COUNT(*) INTO v_a_only
  FROM iocs a
  WHERE a.source_feed = p_source_a
    AND NOT EXISTS (
      SELECT 1 FROM iocs b
      WHERE b.value = a.value AND b.type = a.type AND b.source_feed = p_source_b
    );

  -- Count IOCs unique to source B
  SELECT COUNT(*) INTO v_b_only
  FROM iocs b
  WHERE b.source_feed = p_source_b
    AND NOT EXISTS (
      SELECT 1 FROM iocs a
      WHERE a.value = b.value AND a.type = b.type AND a.source_feed = p_source_a
    );

  -- Get total for source A
  SELECT COUNT(*) INTO v_a_total FROM iocs WHERE source_feed = p_source_a;

  RETURN QUERY SELECT
    v_overlap,
    v_a_only,
    v_b_only,
    CASE WHEN v_a_total > 0
      THEN ROUND((v_overlap::NUMERIC / v_a_total) * 100, 2)
      ELSE 0
    END;
END;
$$;

-- Grant permissions
GRANT SELECT ON ioc_source_stats TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_ioc_with_source TO authenticated;
GRANT EXECUTE ON FUNCTION get_ioc_source_overlap TO authenticated;

-- Add comments
COMMENT ON COLUMN iocs.source_feed IS 'Source feed identifier (e.g., threatfox, urlhaus, feodo)';
COMMENT ON COLUMN iocs.source_ref IS 'Reference ID from the source feed';
COMMENT ON COLUMN iocs.first_seen_at IS 'First time this IOC was seen from any source';
COMMENT ON COLUMN iocs.last_seen_at IS 'Most recent sighting of this IOC';
COMMENT ON COLUMN iocs.sighting_count IS 'Number of times this IOC has been reported';
COMMENT ON FUNCTION upsert_ioc_with_source IS 'Insert or update IOC with automatic sighting tracking';
