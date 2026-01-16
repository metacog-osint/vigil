-- DNS & Certificate Intelligence
-- Supporting CIRCL Passive DNS, Censys certificates, and certificate monitoring

-- DNS Records table for passive DNS data
CREATE TABLE IF NOT EXISTS dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  record_type TEXT NOT NULL, -- A, AAAA, CNAME, MX, TXT, NS, etc.
  record_value TEXT NOT NULL,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  times_seen INTEGER DEFAULT 1,
  source TEXT DEFAULT 'circl_pdns', -- circl_pdns, censys, etc.

  -- Threat context
  is_malicious BOOLEAN DEFAULT false,
  threat_type TEXT, -- c2, phishing, malware_hosting, etc.
  confidence_score DECIMAL(3,2),
  associated_ioc_id UUID REFERENCES iocs(id),
  associated_actor_id UUID REFERENCES threat_actors(id),

  -- Metadata
  asn INTEGER,
  asn_name TEXT,
  country_code CHAR(2),
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(domain, record_type, record_value, source)
);

-- SSL/TLS Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_sha256 TEXT NOT NULL UNIQUE,
  fingerprint_sha1 TEXT,
  fingerprint_md5 TEXT,

  -- Subject info
  subject_cn TEXT,
  subject_org TEXT,
  subject_country TEXT,
  subject_san TEXT[], -- Subject Alternative Names

  -- Issuer info
  issuer_cn TEXT,
  issuer_org TEXT,
  is_self_signed BOOLEAN DEFAULT false,

  -- Validity
  not_before TIMESTAMPTZ,
  not_after TIMESTAMPTZ,
  is_expired BOOLEAN DEFAULT false,

  -- Key info
  key_algorithm TEXT,
  key_size INTEGER,
  signature_algorithm TEXT,

  -- Discovery
  source TEXT DEFAULT 'censys',
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  seen_count INTEGER DEFAULT 1,

  -- Threat context
  is_malicious BOOLEAN DEFAULT false,
  threat_indicators TEXT[],
  associated_ioc_id UUID REFERENCES iocs(id),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificate hosts - IP addresses using a certificate
CREATE TABLE IF NOT EXISTS certificate_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  port INTEGER DEFAULT 443,
  hostname TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(certificate_id, ip_address, port)
);

-- Certificate alerts for monitored domains
CREATE TABLE IF NOT EXISTS certificate_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  team_id UUID,
  domain TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- new_cert, expiring, ct_log, unauthorized
  certificate_id UUID REFERENCES certificates(id),

  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Domain monitoring configuration
CREATE TABLE IF NOT EXISTS monitored_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  team_id UUID,
  domain TEXT NOT NULL,

  -- Monitoring options
  monitor_dns_changes BOOLEAN DEFAULT true,
  monitor_certificates BOOLEAN DEFAULT true,
  monitor_ct_logs BOOLEAN DEFAULT true,
  alert_on_new_subdomains BOOLEAN DEFAULT true,
  alert_on_expiring_certs BOOLEAN DEFAULT true,
  expiry_warning_days INTEGER DEFAULT 30,

  -- Status
  is_enabled BOOLEAN DEFAULT true,
  last_checked TIMESTAMPTZ,
  check_count INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, domain)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dns_records_domain ON dns_records(domain);
CREATE INDEX IF NOT EXISTS idx_dns_records_record_value ON dns_records(record_value);
CREATE INDEX IF NOT EXISTS idx_dns_records_last_seen ON dns_records(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_dns_records_malicious ON dns_records(is_malicious) WHERE is_malicious = true;

CREATE INDEX IF NOT EXISTS idx_certificates_subject_cn ON certificates(subject_cn);
CREATE INDEX IF NOT EXISTS idx_certificates_issuer_org ON certificates(issuer_org);
CREATE INDEX IF NOT EXISTS idx_certificates_not_after ON certificates(not_after);
CREATE INDEX IF NOT EXISTS idx_certificates_malicious ON certificates(is_malicious) WHERE is_malicious = true;
CREATE INDEX IF NOT EXISTS idx_certificates_san ON certificates USING GIN(subject_san);

CREATE INDEX IF NOT EXISTS idx_certificate_hosts_ip ON certificate_hosts(ip_address);
CREATE INDEX IF NOT EXISTS idx_certificate_alerts_user ON certificate_alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_monitored_domains_user ON monitored_domains(user_id, is_enabled);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_dns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dns_records_updated_at
  BEFORE UPDATE ON dns_records
  FOR EACH ROW EXECUTE FUNCTION update_dns_timestamp();

CREATE TRIGGER certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_dns_timestamp();

CREATE TRIGGER monitored_domains_updated_at
  BEFORE UPDATE ON monitored_domains
  FOR EACH ROW EXECUTE FUNCTION update_dns_timestamp();
