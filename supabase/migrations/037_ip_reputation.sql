-- IP Reputation Aggregation
-- Adds aggregated reputation scoring for IOCs

-- Add reputation fields to IOCs table
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS reputation_score INTEGER;
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS reputation_level TEXT CHECK (reputation_level IN ('malicious', 'suspicious', 'risky', 'low_risk', 'unknown'));
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS reputation_factors JSONB DEFAULT '[]';
ALTER TABLE iocs ADD COLUMN IF NOT EXISTS reputation_updated_at TIMESTAMPTZ;

-- Indexes for reputation queries
CREATE INDEX IF NOT EXISTS idx_iocs_reputation_score ON iocs(reputation_score DESC NULLS LAST) WHERE type = 'ip';
CREATE INDEX IF NOT EXISTS idx_iocs_reputation_level ON iocs(reputation_level) WHERE type = 'ip';

-- Comments
COMMENT ON COLUMN iocs.reputation_score IS 'Aggregated reputation score 0-100 from multiple sources';
COMMENT ON COLUMN iocs.reputation_level IS 'Reputation level: malicious (80+), suspicious (60-80), risky (30-60), low_risk (1-30), unknown (0)';
COMMENT ON COLUMN iocs.reputation_factors IS 'Array of {source, threat_type, weight} objects contributing to score';
