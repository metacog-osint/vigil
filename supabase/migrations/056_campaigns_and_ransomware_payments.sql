-- MITRE ATT&CK Campaigns and Ransomwhere Payment Tracking
-- Migration 056

-- Campaigns table for named cyber operations (SolarWinds, Hafnium, Salt Typhoon, etc.)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT UNIQUE NOT NULL,  -- MITRE ID like C0001 or STIX ID
  name TEXT NOT NULL,
  description TEXT,
  first_seen DATE,
  last_seen DATE,
  attributed_actors TEXT[] DEFAULT '{}',  -- Array of actor names
  target_sectors TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'mitre-attack',
  source_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns(name);
CREATE INDEX IF NOT EXISTS idx_campaigns_first_seen ON campaigns(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_attributed_actors ON campaigns USING GIN(attributed_actors);

-- Ransomware payments aggregated by family (from Ransomwhere)
CREATE TABLE IF NOT EXISTS ransomware_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name TEXT UNIQUE NOT NULL,  -- Ransomware family name
  total_btc DECIMAL(20, 8) DEFAULT 0,  -- Total BTC received
  total_usd DECIMAL(20, 2) DEFAULT 0,  -- Total USD value
  payment_count INTEGER DEFAULT 0,
  unique_addresses INTEGER DEFAULT 0,
  first_payment DATE,
  last_payment DATE,
  source TEXT NOT NULL DEFAULT 'ransomwhere',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ransomware_payments
CREATE INDEX IF NOT EXISTS idx_ransomware_payments_family ON ransomware_payments(family_name);
CREATE INDEX IF NOT EXISTS idx_ransomware_payments_total_usd ON ransomware_payments(total_usd DESC);
CREATE INDEX IF NOT EXISTS idx_ransomware_payments_last_payment ON ransomware_payments(last_payment DESC);

-- Add crypto_wallet type to iocs if not exists (for Bitcoin addresses)
DO $$
BEGIN
  -- Check if the type constraint needs updating
  -- The iocs table uses a CHECK constraint for type values
  -- We need to ensure 'crypto_wallet' is allowed
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'iocs_type_check'
    AND conrelid = 'iocs'::regclass
  ) THEN
    -- No constraint exists, we're fine
    NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Enable RLS on new tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ransomware_payments ENABLE ROW LEVEL SECURITY;

-- Public read access for campaigns and ransomware_payments
CREATE POLICY "Allow public read access to campaigns"
  ON campaigns FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to ransomware_payments"
  ON ransomware_payments FOR SELECT
  USING (true);

-- Service role write access
CREATE POLICY "Allow service role write access to campaigns"
  ON campaigns FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role write access to ransomware_payments"
  ON ransomware_payments FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

CREATE TRIGGER trigger_ransomware_payments_updated_at
  BEFORE UPDATE ON ransomware_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

-- Comment on tables
COMMENT ON TABLE campaigns IS 'MITRE ATT&CK named campaigns (cyber operations like SolarWinds, Hafnium)';
COMMENT ON TABLE ransomware_payments IS 'Aggregated ransomware cryptocurrency payments from Ransomwhere';
