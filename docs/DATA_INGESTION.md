# Data Ingestion System

Vigil uses a comprehensive automated data ingestion system that pulls from multiple threat intelligence sources every 6 hours.

## Overview

| Category | Sources | Schedule |
|----------|---------|----------|
| Ransomware | RansomLook, Ransomware.live | Every 6 hours |
| IOCs | ThreatFox, URLhaus, Feodo, Abuse.ch | Every 6 hours |
| Vulnerabilities | CISA KEV, NVD | Every 6 hours |
| Techniques | MITRE ATT&CK | Every 6 hours |

## GitHub Actions Workflow

Automated ingestion runs via `.github/workflows/data-ingestion.yml`:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:       # Manual trigger
```

### Manual Dispatch

You can manually trigger ingestion for specific sources via the GitHub Actions UI:

1. Go to Actions > Scheduled Data Ingestion
2. Click "Run workflow"
3. Select source filter (or leave empty for all):
   - `ransomware` - RansomLook + Ransomware.live
   - `iocs` - ThreatFox, URLhaus, Feodo, Abuse.ch
   - `vulnerabilities` - CISA KEV, NVD
   - `mitre` - MITRE ATT&CK techniques

### Workflow Jobs

| Job | Source | Dependency |
|-----|--------|------------|
| ingest-ransomlook | RansomLook API | None |
| ingest-ransomware-live | Ransomware.live | After RansomLook (dedup) |
| ingest-threatfox | ThreatFox IOCs | None |
| ingest-urlhaus | URLhaus URLs | None |
| ingest-feodo | Feodo C2 trackers | None |
| ingest-abusech | Abuse.ch feeds | None |
| ingest-cisa-kev | CISA KEV | None |
| ingest-nvd | NVD CVEs | None |
| ingest-mitre | MITRE ATT&CK | None |

### Required Secrets

Configure in GitHub repository settings:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## Local Ingestion Scripts

All scripts are in the `scripts/` directory. Run locally for testing or manual updates:

### NPM Scripts

```bash
# All sources
npm run ingest

# Individual sources
npm run ingest:ransomlook      # RansomLook ransomware
npm run ingest:ransomware-live # Ransomware.live
npm run ingest:kev             # CISA KEV
npm run ingest:nvd             # NVD CVEs
npm run ingest:threatfox       # ThreatFox IOCs
npm run ingest:urlhaus         # URLhaus malware URLs
npm run ingest:feodo           # Feodo C2 trackers
npm run ingest:abusech         # All Abuse.ch feeds
npm run ingest:mitre           # MITRE ATT&CK
```

### Script Architecture

Each ingestion script follows a common pattern:

```javascript
// Example: scripts/ingest-ransomlook.mjs
import { createClient } from '@supabase/supabase-js'
import { classifySector } from './lib/sector-classifier.mjs'

// 1. Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// 2. Fetch from external API
const response = await fetch('https://api.example.com/data')
const data = await response.json()

// 3. Transform and classify
const incidents = data.map(item => ({
  victim_name: item.victim,
  victim_sector: classifySector({ victimName: item.victim }),
  // ...
}))

// 4. Upsert to database (deduplication via unique constraints)
await supabase.from('incidents').upsert(incidents, {
  onConflict: 'actor_id,victim_name,incident_date'
})
```

## Data Sources

### Ransomware Sources

#### RansomLook (`ingest-ransomlook.mjs`)
- **URL**: `https://www.ransomlook.io/api/victims`
- **Data**: Ransomware victim claims with group attribution
- **Fields**: victim name, website, group, post date, description
- **Updates**: Hourly (we pull every 6 hours)

#### Ransomware.live (`ingest-ransomware-live.mjs`)
- **URL**: `https://api.ransomware.live/recentvictims`
- **Data**: Additional ransomware claims with country/sector
- **Fields**: victim, group, country, sector, date
- **Dedup**: Runs after RansomLook to corroborate/add new claims

### IOC Sources

#### ThreatFox (`ingest-threatfox.mjs`)
- **URL**: `https://threatfox-api.abuse.ch/api/v1/`
- **Method**: POST `{ query: 'get_iocs', days: 7 }`
- **Data**: Malware IOCs with attribution
- **Types**: IP, domain, URL, hash

#### URLhaus (`ingest-urlhaus.mjs`)
- **URL**: `https://urlhaus-api.abuse.ch/v1/urls/recent/`
- **Data**: Active malware distribution URLs
- **Fields**: URL, threat type, tags, reporter

#### Feodo Tracker (`ingest-feodo.mjs`)
- **URL**: `https://feodotracker.abuse.ch/downloads/ipblocklist.json`
- **Data**: Botnet C2 server IPs
- **Fields**: IP, port, malware family, first/last seen

### Vulnerability Sources

#### CISA KEV (`ingest-kev.mjs`)
- **URL**: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **Data**: Known Exploited Vulnerabilities catalog
- **Fields**: CVE ID, vendor, product, due date, notes

#### NVD (`ingest-nvd.mjs`)
- **URL**: `https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Data**: CVE details with CVSS scores
- **Rate Limit**: 5 requests per 30 seconds (with API key)

### Technique Sources

#### MITRE ATT&CK (`ingest-mitre.mjs`)
- **URL**: `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json`
- **Data**: ATT&CK techniques, tactics, and procedures
- **Format**: STIX 2.0 bundles

## Sector Classification

All ransomware ingestion scripts use the sector classifier for victim categorization:

### Usage

```javascript
import { classifySector, SECTORS } from './lib/sector-classifier.mjs'

const sector = classifySector({
  victimName: 'City Hospital',
  website: 'cityhospital.org',
  description: 'Healthcare provider',
  apiSector: 'medical',       // From API if available
  activity: ''                // Alternative sector field
})
// Returns: 'healthcare'
```

### Classification Logic

1. **API sector first**: If source provides a valid sector, use it
2. **TLD detection**: .edu = education, .gov = government, .mil = defense
3. **Keyword matching**: 400+ keywords across 21 sectors
4. **Default**: "Other" if no match found

### Supported Sectors

| Sector | Examples |
|--------|----------|
| healthcare | hospital, clinic, medical, nursing |
| pharmaceuticals | pharma, biotech, drug, vaccine |
| finance | bank, insurance, investment, accounting |
| technology | software, IT, cyber, cloud, SaaS |
| manufacturing | factory, industrial, automotive, aerospace |
| retail | store, ecommerce, wholesale, grocery |
| education | school, university, college, academic |
| energy | oil, gas, utilities, power, solar |
| government | city, county, federal, municipal |
| defense | military, army, navy, contractor |
| legal | law firm, attorney, solicitor |
| construction | contractor, builder, engineering |
| real_estate | property, housing, realtor |
| transportation | logistics, shipping, freight, airline |
| telecommunications | telecom, mobile, wireless, ISP |
| media | broadcast, publishing, entertainment |
| hospitality | hotel, restaurant, tourism, travel |
| agriculture | farm, crop, livestock, dairy |
| nonprofit | charity, NGO, church, foundation |
| professional_services | consulting, marketing, HR, staffing |

### Batch Reclassification

To reclassify existing incidents with improved logic:

```bash
npm run reclassify-sectors
```

This updates all incidents where a more specific sector can be determined.

## Database Tables

### incidents
```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES threat_actors(id),
  victim_name TEXT NOT NULL,
  victim_sector TEXT,
  victim_country TEXT,
  victim_website TEXT,
  incident_date DATE,
  discovered_at TIMESTAMPTZ,
  source TEXT,
  raw_data JSONB,
  UNIQUE(actor_id, victim_name, incident_date)
);
```

### iocs
```sql
CREATE TABLE iocs (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL, -- ip, domain, url, hash
  value TEXT NOT NULL,
  malware_family TEXT,
  confidence INTEGER,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  source TEXT,
  UNIQUE(type, value)
);
```

### sync_log
```sql
CREATE TABLE sync_log (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  error TEXT,
  status TEXT
);
```

## Monitoring

### GitHub Actions Summary

After each workflow run, a summary table is generated showing:
- Source name
- Status (success/failure/skipped)

### Sync Log Table

Query recent ingestion status:

```sql
SELECT source, started_at, completed_at, records_processed, status
FROM sync_log
ORDER BY started_at DESC
LIMIT 20;
```

### Dashboard Status

The Settings page displays sync status for each data source with last update timestamps.

## Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| API rate limit | Too many requests | Wait for reset, use API key if available |
| Supabase timeout | Large batch insert | Reduce batch size |
| Invalid JSON | API response changed | Check API documentation, update parser |
| Missing environment vars | Secrets not configured | Add to GitHub secrets or .env |

### Debug Mode

Add verbose logging to any script:

```javascript
// At the start of the script
const DEBUG = process.env.DEBUG === 'true'

// Throughout the script
if (DEBUG) console.log('Fetched', data.length, 'records')
```

Run with debug:
```bash
DEBUG=true npm run ingest:ransomlook
```

## Adding New Sources

1. Create script in `scripts/ingest-{source}.mjs`
2. Add npm script to `package.json`
3. Add job to `.github/workflows/data-ingestion.yml`
4. Create/update database tables if needed
5. Add query functions to `src/lib/supabase.js`
6. Document in this file
