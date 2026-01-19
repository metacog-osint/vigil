# Data Correlation Opportunities

> Analysis of cross-data-stream correlation possibilities for enhanced threat intelligence.

## Current Data Inventory

| Data Stream | Records | Key Fields | Update Frequency |
|------------|---------|------------|------------------|
| IOCs | 108,045 | type, value, source, tags | Hourly |
| Incidents | 43,994 | actor, victim, sector, country | Hourly |
| Cyber Events | 16,104 | actor, actor_type, motive, industry | Monthly |
| Threat Actors | 4,327 | name, aliases, origin_country, ttps | Daily |
| Vulnerabilities | 3,245 | cve_id, cvss, epss, kev_status | 6-hourly |
| Techniques | 873 | mitre_id, name, tactics, platforms | Weekly |
| Malware Families | 50 | name, type, actors | Daily |

---

## Correlation Opportunity #1: Actor-IOC Attribution

**Problem:** IOCs are collected from multiple feeds but rarely attributed to specific actors.

**Solution:** Cross-reference IOCs with known actor infrastructure from:
- Malpedia (actor → malware → IOCs)
- MISP Galaxy (actor → infrastructure)
- Cyber Events (actor → incident → potential IOCs in description)

**Implementation:**
```sql
-- Create actor_iocs junction table
CREATE TABLE actor_iocs (
  actor_id UUID REFERENCES threat_actors(id),
  ioc_id UUID REFERENCES iocs(id),
  confidence TEXT, -- high, medium, low
  source TEXT,     -- malpedia, misp, manual
  first_seen TIMESTAMPTZ,
  PRIMARY KEY (actor_id, ioc_id)
);
```

**Customer Value:**
- "These 5 IOCs are associated with APT29"
- "Your blocked IP is known infrastructure for Lazarus Group"
- Alert when known actor infrastructure appears in your logs

---

## Correlation Opportunity #2: Actor-Vulnerability Exploitation

**Problem:** We know CVEs exist, we know actors exist, but not which actors exploit which CVEs.

**Data Sources:**
- CISA KEV (exploited in wild, but no actor attribution)
- NVD references (sometimes link to actor reports)
- Cyber Events descriptions (often mention CVEs)
- MITRE ATT&CK (some techniques reference CVEs)

**Implementation:**
```sql
-- Create actor_vulnerabilities junction table
CREATE TABLE actor_vulnerabilities (
  actor_id UUID REFERENCES threat_actors(id),
  cve_id TEXT,
  exploit_type TEXT, -- zero-day, n-day, public-exploit
  first_observed DATE,
  source TEXT,
  confidence TEXT,
  PRIMARY KEY (actor_id, cve_id)
);

-- Populate from cyber_events descriptions
INSERT INTO actor_vulnerabilities (actor_id, cve_id, source, confidence)
SELECT
  ta.id,
  regexp_matches(ce.description, 'CVE-\d{4}-\d+', 'g')[1],
  'umd-cyber-events',
  'medium'
FROM cyber_events ce
JOIN threat_actors ta ON LOWER(ce.actor_name) = LOWER(ta.name)
WHERE ce.description ~ 'CVE-\d{4}-\d+';
```

**Customer Value:**
- "CVE-2024-1234 is actively exploited by 3 nation-state actors"
- Prioritize patching based on actor threat level, not just CVSS
- "Actors targeting your sector exploit these 10 CVEs"

---

## Correlation Opportunity #3: Industry Targeting Intelligence

**Problem:** Customers want to know "What threats target MY industry?"

**Data Sources:**
- Cyber Events: `target_industry` (NAICS codes), `actor_type`, `motive`
- Incidents: `sector` field
- Threat Actors: `target_sectors` array

**Implementation:**
```sql
-- Materialized view for industry threat landscape
CREATE MATERIALIZED VIEW industry_threat_landscape AS
SELECT
  target_industry as industry,
  actor_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT actor_name) as unique_actors,
  array_agg(DISTINCT actor_name) FILTER (WHERE actor_name != 'Undetermined') as top_actors,
  array_agg(DISTINCT motive) FILTER (WHERE motive IS NOT NULL) as motives,
  MAX(event_date) as last_event
FROM cyber_events
WHERE target_industry IS NOT NULL
GROUP BY target_industry, actor_type
ORDER BY event_count DESC;
```

**Customer Value:**
- "Healthcare sector: 847 events, 23 unique actors, primarily Criminal (financial motive)"
- Benchmark against industry peers
- Executive briefing: "Your industry threat landscape this month"

---

## Correlation Opportunity #4: Attack Chain Reconstruction

**Problem:** Individual data points don't tell the full story of an attack.

**Concept:** Link Technique → Vulnerability → IOC → Actor into attack chains.

**Example Chain:**
```
APT29 (Actor)
  └─→ Uses Technique T1566 (Phishing)
      └─→ Exploits CVE-2023-23397 (Outlook vulnerability)
          └─→ Deploys malware that phones home to IOC 185.xx.xx.xx
              └─→ Results in data exfiltration
```

**Implementation:**
```sql
-- Attack chain table
CREATE TABLE attack_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  actor_id UUID REFERENCES threat_actors(id),
  techniques TEXT[], -- MITRE IDs
  vulnerabilities TEXT[], -- CVE IDs
  ioc_ids UUID[],
  malware_families TEXT[],
  description TEXT,
  source TEXT,
  confidence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Customer Value:**
- Visualize full attack paths
- Understand "how would this actor attack us?"
- Map defenses to each chain link

---

## Correlation Opportunity #5: Temporal Pattern Analysis

**Problem:** Point-in-time data misses trends and predictive signals.

**Concept:** Analyze time-series patterns across data streams.

**Patterns to Detect:**
1. **IOC Surge → Incident Spike**: Do IOC increases precede incidents?
2. **CVE Publication → Exploitation**: How fast are new CVEs exploited?
3. **Actor Dormancy/Activity Cycles**: Are there patterns in actor activity?
4. **Sector Targeting Waves**: Do actors rotate through industries?

**Implementation:**
```sql
-- Weekly activity aggregation
CREATE MATERIALIZED VIEW weekly_activity AS
SELECT
  date_trunc('week', created_at) as week,
  'iocs' as data_type,
  COUNT(*) as count
FROM iocs
GROUP BY 1
UNION ALL
SELECT
  date_trunc('week', discovered_at) as week,
  'incidents' as data_type,
  COUNT(*) as count
FROM incidents
GROUP BY 1
UNION ALL
SELECT
  date_trunc('week', event_date) as week,
  'cyber_events' as data_type,
  COUNT(*) as count
FROM cyber_events
GROUP BY 1;
```

**Customer Value:**
- Predictive alerting: "IOC activity for LockBit increased 300% this week"
- Trend analysis for executive reporting
- Early warning before public incident disclosure

---

## Correlation Opportunity #6: Geographic Threat Mapping

**Problem:** Global threat data lacks geographic context for specific customers.

**Data Sources:**
- Cyber Events: `target_country`, `actor_country`, geopolitical flags
- Incidents: `country` field
- IOCs: Can be enriched with geolocation

**Implementation:**
```sql
-- Country threat profile
CREATE MATERIALIZED VIEW country_threat_profile AS
SELECT
  target_country,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE actor_type = 'Nation-State') as nation_state_events,
  COUNT(*) FILTER (WHERE actor_type = 'Criminal') as criminal_events,
  array_agg(DISTINCT actor_country) FILTER (WHERE actor_country != 'Undetermined') as attacking_countries,
  jsonb_object_agg(
    actor_type,
    COUNT(*)
  ) as events_by_actor_type
FROM cyber_events
WHERE target_country IS NOT NULL
GROUP BY target_country;
```

**Customer Value:**
- "Threats targeting organizations in your country"
- Geopolitical risk assessment
- "Nation-state actors from X are targeting Y sector in your region"

---

## Implementation Priority

| Opportunity | Effort | Customer Value | Priority |
|------------|--------|----------------|----------|
| #3 Industry Targeting | Low | High | **P1** |
| #6 Geographic Mapping | Low | High | **P1** |
| #1 Actor-IOC Attribution | Medium | Very High | **P2** |
| #2 Actor-Vulnerability | Medium | Very High | **P2** |
| #5 Temporal Patterns | Medium | High | **P3** |
| #4 Attack Chains | High | Very High | **P3** |

---

## Quick Wins (Can Implement Today)

### 1. Industry Threat Dashboard Query
```sql
SELECT
  target_industry,
  actor_type,
  COUNT(*) as events,
  array_agg(DISTINCT actor_name ORDER BY actor_name) FILTER (WHERE actor_name != 'Undetermined') as actors
FROM cyber_events
WHERE target_industry IS NOT NULL
  AND event_date > NOW() - INTERVAL '1 year'
GROUP BY target_industry, actor_type
ORDER BY events DESC
LIMIT 20;
```

### 2. Actor Activity Scoring
```sql
SELECT
  ta.name,
  ta.origin_country,
  COUNT(DISTINCT ce.id) as cyber_events,
  COUNT(DISTINCT i.id) as incidents,
  MAX(ce.event_date) as last_cyber_event,
  MAX(i.discovered_at) as last_incident
FROM threat_actors ta
LEFT JOIN cyber_events ce ON LOWER(ce.actor_name) = LOWER(ta.name)
LEFT JOIN incidents i ON LOWER(i.threat_actor->>'name') = LOWER(ta.name)
GROUP BY ta.id, ta.name, ta.origin_country
HAVING COUNT(DISTINCT ce.id) > 0 OR COUNT(DISTINCT i.id) > 0
ORDER BY (COUNT(DISTINCT ce.id) + COUNT(DISTINCT i.id)) DESC
LIMIT 50;
```

### 3. Sector-Specific IOC Feed
For a healthcare customer, what IOCs are relevant?
```sql
-- Find actors targeting healthcare
WITH healthcare_actors AS (
  SELECT DISTINCT actor_name
  FROM cyber_events
  WHERE target_industry ILIKE '%health%'
    AND actor_name != 'Undetermined'
)
-- This would need actor-IOC linkage to complete
SELECT * FROM healthcare_actors;
```

---

## Data Quality Requirements

To enable these correlations, we need:

1. **Consistent Actor Names**: Normalize actor names across sources
   - "APT29" = "Cozy Bear" = "The Dukes"
   - Use `actor_aliases` table for resolution

2. **Industry Code Mapping**: Map various industry fields to NAICS
   - Incidents use free-text sectors
   - Cyber Events use NAICS codes

3. **Timestamp Normalization**: Ensure all dates are comparable
   - Some sources use event date, others discovery date

4. **Confidence Scoring**: Track reliability of correlations
   - Direct observation vs. inferred vs. suspected

---

## Implementation Plan

### Phase 1: Foundation (Migration 062)
Create all correlation tables and materialized views in a single migration.

**Tables:**
- `actor_iocs` - Actor to IOC attribution
- `actor_vulnerabilities` - Actor to CVE exploitation mapping
- `attack_chains` - Full attack chain documentation

**Materialized Views:**
- `industry_threat_landscape` - Industry targeting aggregation
- `country_threat_profile` - Geographic threat mapping
- `weekly_activity_trends` - Temporal pattern analysis
- `actor_activity_summary` - Cross-source actor activity

**Functions:**
- `refresh_correlation_views()` - Refresh all materialized views
- `resolve_actor_name()` - Normalize actor names via aliases
- `get_industry_threats()` - Get threats for a specific industry
- `get_actor_iocs()` - Get IOCs attributed to an actor

### Phase 2: Data Population Scripts
- `scripts/correlate-actor-iocs.mjs` - Mine existing data for actor-IOC links
- `scripts/correlate-actor-cves.mjs` - Extract CVEs from cyber_events descriptions
- `scripts/build-attack-chains.mjs` - Construct attack chains from correlated data

### Phase 3: API Endpoints (Supabase Module)
- `src/lib/supabase/correlations.js` - Query functions for correlations
- Functions: `getIndustryThreats()`, `getActorIOCs()`, `getActorCVEs()`, etc.

### Phase 4: UI Components
- Industry Threat Dashboard
- Actor Dossier (aggregated view)
- Attack Chain Visualizer
- Geographic Threat Map

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/062_correlations.sql` | All correlation tables and views |
| `scripts/correlate-actor-iocs.mjs` | Populate actor-IOC links |
| `scripts/correlate-actor-cves.mjs` | Extract CVE-actor relationships |
| `scripts/build-attack-chains.mjs` | Build attack chain records |
| `src/lib/supabase/correlations.js` | Query functions |

---

*Document created: January 17, 2026*
*Implementation started: January 17, 2026*
