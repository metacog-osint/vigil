# Vigil Database Schema

> Supabase PostgreSQL database documentation

---

## Connection Details

- **Provider:** Supabase
- **Database:** PostgreSQL 15
- **Project URL:** `https://faqazkwdkajhxmwxchop.supabase.co`

---

## Tables Overview

| Table | Description | Primary Key | Rows (Est.) |
|-------|-------------|-------------|-------------|
| `threat_actors` | Ransomware groups, APTs, cybercrime gangs | UUID | ~162 |
| `incidents` | Ransomware attacks, breaches, claims | UUID | ~8,000 |
| `iocs` | Indicators of Compromise | UUID | ~700 |
| `vulnerabilities` | CVEs with CISA KEV and NVD data | CVE ID (text) | ~2,000 |
| `malware` | Malware samples | UUID | 0 |
| `sync_log` | Data ingestion logs | UUID | ~50 |
| `sector_keywords` | Keyword → sector mapping | keyword (text) | ~50 |
| `actor_aliases` | Alias → actor mapping | alias (text) | ~20 |

---

## Table: `threat_actors`

Stores information about threat actors (ransomware groups, APTs, etc.)

```sql
CREATE TABLE threat_actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  actor_type TEXT DEFAULT 'ransomware',  -- ransomware, apt, cybercrime, hacktivism
  first_seen DATE,
  last_seen DATE,
  target_sectors TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  ttps TEXT[] DEFAULT '{}',              -- MITRE ATT&CK IDs
  description TEXT,
  status TEXT DEFAULT 'active',          -- active, inactive, defunct
  source TEXT,                           -- ransomwatch, ransomlook, etc.
  source_url TEXT,

  -- Trend calculation fields (from migration 002)
  trend_status TEXT DEFAULT 'STABLE',    -- ESCALATING, STABLE, DECLINING
  incident_velocity NUMERIC DEFAULT 0,   -- incidents per day (7-day avg)
  incidents_7d INTEGER DEFAULT 0,        -- incident count last 7 days
  incidents_prev_7d INTEGER DEFAULT 0,   -- incident count previous 7 days
  ai_summary TEXT,                       -- AI-generated summary

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_actors_name` - B-tree on `name`
- `idx_actors_last_seen` - B-tree on `last_seen DESC`
- `idx_actors_sectors` - GIN on `target_sectors`
- `idx_actors_search` - GIN full-text on `name` + `aliases`

### Key Queries
```sql
-- Get escalating actors
SELECT * FROM threat_actors WHERE trend_status = 'ESCALATING' ORDER BY incident_velocity DESC;

-- Search by name or alias
SELECT * FROM threat_actors WHERE name ILIKE '%lockbit%' OR aliases @> ARRAY['lockbit'];

-- Get actors targeting healthcare
SELECT * FROM threat_actors WHERE target_sectors @> ARRAY['healthcare'];
```

---

## Table: `incidents`

Stores ransomware attacks, data breaches, and claims.

```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  victim_name TEXT,
  victim_sector TEXT,
  victim_country TEXT,
  victim_website TEXT,
  incident_date DATE,
  discovered_date DATE DEFAULT CURRENT_DATE,
  claim_date DATE,
  ransom_amount NUMERIC,
  ransom_currency TEXT DEFAULT 'USD',
  ransom_paid BOOLEAN,
  data_leaked BOOLEAN DEFAULT FALSE,
  data_size TEXT,                        -- e.g., "500GB"
  status TEXT DEFAULT 'claimed',         -- claimed, confirmed, leaked, paid, removed
  source TEXT,
  source_url TEXT,
  raw_data JSONB,                        -- preserve original for audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_incidents_actor` - B-tree on `actor_id`
- `idx_incidents_sector` - B-tree on `victim_sector`
- `idx_incidents_discovered` - B-tree on `discovered_date DESC`
- `idx_incidents_country` - B-tree on `victim_country`

### Key Queries
```sql
-- Recent incidents (last 30 days)
SELECT i.*, ta.name as actor_name
FROM incidents i
LEFT JOIN threat_actors ta ON i.actor_id = ta.id
WHERE i.discovered_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY i.discovered_date DESC;

-- Incidents by sector
SELECT victim_sector, COUNT(*)
FROM incidents
WHERE discovered_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY victim_sector
ORDER BY COUNT(*) DESC;
```

---

## Table: `iocs`

Stores Indicators of Compromise (IPs, domains, hashes, URLs).

```sql
CREATE TABLE iocs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,                    -- hash_md5, hash_sha1, hash_sha256, ip, domain, url, email
  value TEXT NOT NULL,
  actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  malware_family TEXT,
  confidence TEXT DEFAULT 'medium',      -- low, medium, high
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  source TEXT,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, value)
);
```

### Indexes
- `idx_iocs_type_value` - B-tree on `(type, value)`
- `idx_iocs_actor` - B-tree on `actor_id`
- `idx_iocs_last_seen` - B-tree on `last_seen DESC`
- `idx_iocs_malware` - B-tree on `malware_family`

### Key Queries
```sql
-- Search for IOC
SELECT * FROM iocs WHERE value ILIKE '%8.8.8.8%';

-- IOCs by type
SELECT type, COUNT(*) FROM iocs GROUP BY type;

-- Recent IOCs with actor info
SELECT i.*, ta.name as actor_name
FROM iocs i
LEFT JOIN threat_actors ta ON i.actor_id = ta.id
ORDER BY i.last_seen DESC
LIMIT 100;
```

---

## Table: `vulnerabilities`

Stores CVEs with CISA KEV and NVD data.

```sql
CREATE TABLE vulnerabilities (
  cve_id TEXT PRIMARY KEY,               -- CVE-YYYY-NNNNN
  cvss_score NUMERIC,
  cvss_vector TEXT,
  epss_score NUMERIC,                    -- EPSS probability (0-1)
  epss_percentile NUMERIC,
  kev_date DATE,                         -- when added to CISA KEV
  kev_due_date DATE,                     -- CISA remediation deadline
  description TEXT,
  affected_products TEXT[],
  affected_vendors TEXT[],
  patch_available BOOLEAN,
  exploited_in_wild BOOLEAN DEFAULT FALSE,
  ransomware_campaign_use BOOLEAN DEFAULT FALSE,
  associated_actors TEXT[] DEFAULT '{}',
  reference_urls TEXT[] DEFAULT '{}',    -- renamed from 'references' (reserved word)
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- `idx_vulns_cvss` - B-tree on `cvss_score DESC`
- `idx_vulns_kev` - B-tree on `kev_date DESC` (WHERE kev_date IS NOT NULL)
- `idx_vulns_epss` - B-tree on `epss_score DESC`

### Key Queries
```sql
-- CISA KEV vulnerabilities
SELECT * FROM vulnerabilities
WHERE kev_date IS NOT NULL
ORDER BY kev_date DESC;

-- Critical CVEs (CVSS >= 9.0)
SELECT * FROM vulnerabilities
WHERE cvss_score >= 9.0
ORDER BY cvss_score DESC;

-- KEVs used in ransomware
SELECT * FROM vulnerabilities
WHERE ransomware_campaign_use = TRUE
ORDER BY kev_date DESC;
```

---

## Table: `malware`

Stores malware samples (currently unused, future MalwareBazaar integration).

```sql
CREATE TABLE malware (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sha256 TEXT UNIQUE NOT NULL,
  sha1 TEXT,
  md5 TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  malware_family TEXT,
  signature TEXT,
  actor_id UUID REFERENCES threat_actors(id) ON DELETE SET NULL,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  source TEXT,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  yara_rules TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Table: `sync_log`

Tracks data ingestion runs.

```sql
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,                  -- ransomwatch, cisa_kev, abuse_ch, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',         -- running, success, error
  records_processed INTEGER DEFAULT 0,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);
```

---

## Table: `sector_keywords`

Maps keywords to sector names for auto-classification.

```sql
CREATE TABLE sector_keywords (
  keyword TEXT PRIMARY KEY,
  sector TEXT NOT NULL
);
```

Sample data:
| keyword | sector |
|---------|--------|
| hospital | healthcare |
| medical | healthcare |
| bank | finance |
| university | education |

---

## Table: `actor_aliases`

Maps known aliases to canonical actor names.

```sql
CREATE TABLE actor_aliases (
  alias TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL REFERENCES threat_actors(name)
);
```

Sample data:
| alias | canonical_name |
|-------|----------------|
| ALPHV | BlackCat |
| Noberus | BlackCat |
| LockBit 3.0 | LockBit |

---

## Stored Functions

### `apply_actor_trends()`
Updates trend status for all actors based on recent incident counts.

```sql
SELECT apply_actor_trends();
```

### `incidents_by_sector(cutoff_date)`
Returns incident counts grouped by sector.

```sql
SELECT * FROM incidents_by_sector(NOW() - INTERVAL '30 days');
```

### `actor_activity_stats(days_back)`
Returns actor activity statistics.

```sql
SELECT * FROM actor_activity_stats(30);
```

### `resolve_actor_alias(alias_name)`
Resolves an alias to the canonical actor ID.

```sql
SELECT resolve_actor_alias('ALPHV');  -- Returns BlackCat's UUID
```

---

## Data Sources

| Source | Table(s) | Frequency | Notes |
|--------|----------|-----------|-------|
| Ransomwatch | threat_actors, incidents | Historical | Data from June 2025 |
| CISA KEV | vulnerabilities | Daily | ~1,500 entries |
| NVD | vulnerabilities | Daily | ~500 recent CVEs |
| URLhaus | iocs | Daily | Malicious URLs |
| Feodo Tracker | iocs | Daily | Botnet C2 IPs |
| ThreatFox | iocs | Daily | Mixed IOCs |

---

## Maintenance

### Recalculate trends
```sql
SELECT apply_actor_trends();
```

### Check sync status
```sql
SELECT source, status, completed_at, records_added
FROM sync_log
ORDER BY completed_at DESC
LIMIT 10;
```

### Database size
```sql
SELECT
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Backup & Recovery

Supabase provides automatic daily backups. To manually backup:

1. Go to Supabase Dashboard → Settings → Database
2. Click "Download Backup"

For point-in-time recovery, contact Supabase support (Pro plan required).

---

*Last updated: January 2026*
