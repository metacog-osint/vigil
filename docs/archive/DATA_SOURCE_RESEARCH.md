# Data Source Research - EPSS and GHSA APIs

**Date:** January 15, 2026
**Purpose:** Documentation for upcoming ingestion script development

---

## FIRST EPSS (Exploit Prediction Scoring System)

### Overview
EPSS provides a probability score (0-1) estimating the likelihood a CVE will be exploited in the next 30 days.

### API Details

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.first.org/data/v1/epss` |
| **Authentication** | None required (public API) |
| **Rate Limit** | 1,000 requests/minute |
| **Current Model** | v4 (released March 17, 2025) |

### Query Examples

**Single CVE:**
```
GET https://api.first.org/data/v1/epss?cve=CVE-2021-44228
```

**Multiple CVEs (batch):**
```
GET https://api.first.org/data/v1/epss?cve=CVE-2022-27225,CVE-2022-27223
```

**High-risk CVEs only:**
```
GET https://api.first.org/data/v1/epss?epss-gt=0.5
```

**Top percentile:**
```
GET https://api.first.org/data/v1/epss?percentile-gt=0.95
```

### Response Schema

```json
{
  "status": "OK",
  "status-code": 200,
  "total": 1,
  "data": [
    {
      "cve": "CVE-2021-44228",
      "epss": "0.97547",
      "percentile": "0.99996",
      "date": "2025-01-15"
    }
  ]
}
```

**Note:** `epss` and `percentile` are returned as strings, not numbers.

### Bulk Download (Recommended for Initial Load)

**Daily CSV:**
```
https://epss.empiricalsecurity.com/epss_scores-YYYY-MM-DD.csv.gz
```

**CSV Format:**
- Line 1: Comment with model version
- Line 2: Headers (`cve,epss,percentile`)
- Subsequent lines: Data

**Historical data available back to:** April 14, 2021

### Recommended Ingestion Strategy

1. **Initial Load:** Download daily CSV (gzipped)
2. **Updates:** Query API for specific CVEs from vulnerabilities table
3. **Monitoring:** Query `epss-gt=0.5` for high-risk CVEs

### Database Changes Required

```sql
ALTER TABLE vulnerabilities
ADD COLUMN epss_score FLOAT,
ADD COLUMN epss_percentile FLOAT,
ADD COLUMN epss_updated_at TIMESTAMP WITH TIME ZONE;
```

---

## GitHub Security Advisory (GHSA)

### Overview
The GitHub Advisory Database covers open source vulnerabilities, supply chain issues, and package registry malware.

### API Details

| Property | Value |
|----------|-------|
| **REST URL** | `https://api.github.com/advisories` |
| **GraphQL URL** | `https://api.github.com/graphql` |
| **Auth (Unauthenticated)** | 60 requests/hour |
| **Auth (Token)** | 5,000 requests/hour |
| **Format** | OSV (Open Source Vulnerability) |

### Authentication

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     "https://api.github.com/advisories"
```

### Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ghsa_id` | Filter by GHSA ID | `GHSA-abcd-1234-efgh` |
| `cve_id` | Filter by CVE ID | `CVE-2024-12345` |
| `type` | Advisory type | `reviewed`, `malware`, `unreviewed` |
| `ecosystem` | Package ecosystem | `npm`, `pip`, `maven`, `go`, `rust` |
| `severity` | Severity level | `critical`, `high`, `medium`, `low` |
| `published` | Publication date range | `2024-01-01..2024-12-31` |
| `updated` | Update date range | `>=2024-01-01` |
| `per_page` | Results per page (max 100) | `100` |

### Supported Ecosystems

- `npm` (npmjs.com)
- `pip` (PyPI)
- `maven` (Maven Central)
- `go` (Go modules)
- `rust` (crates.io)
- `nuget` (NuGet)
- `rubygems` (RubyGems)
- `composer` (Packagist/PHP)
- `pub` (pub.dev/Dart)
- `actions` (GitHub Actions)

### Response Schema

```json
{
  "ghsa_id": "GHSA-xxxx-xxxx-xxxx",
  "cve_id": "CVE-2024-12345",
  "summary": "Short vulnerability summary",
  "description": "Detailed description in markdown",
  "severity": "high",
  "cvss": {
    "vector_string": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "score": 9.8
  },
  "cwes": [
    { "cwe_id": "CWE-79", "name": "Cross-site Scripting" }
  ],
  "vulnerabilities": [
    {
      "package": {
        "ecosystem": "npm",
        "name": "vulnerable-package"
      },
      "vulnerable_version_range": "< 2.0.0",
      "first_patched_version": "2.0.0"
    }
  ],
  "published_at": "2024-01-15T12:00:00Z",
  "updated_at": "2024-01-16T08:00:00Z"
}
```

### GraphQL Query Example

```graphql
{
  securityAdvisories(first: 100, publishedSince: "2024-01-01T00:00:00Z") {
    nodes {
      ghsaId
      summary
      severity
      cvss { score vectorString }
      vulnerabilities(first: 10) {
        nodes {
          package { ecosystem name }
          vulnerableVersionRange
          firstPatchedVersion { identifier }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Recommended Ingestion Strategy

1. **Use REST API** - Simpler for bulk ingestion
2. **Authenticate** - Set `GITHUB_TOKEN` for 5,000 req/hour
3. **Filter by ecosystem** - Process one ecosystem at a time
4. **Use `updated` parameter** - For incremental updates
5. **Handle pagination** - Parse `Link` header for cursors

### Database Changes Required

```sql
CREATE TABLE advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghsa_id VARCHAR(20) UNIQUE NOT NULL,
  cve_id VARCHAR(20),
  summary TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(20),
  cvss_score FLOAT,
  cvss_vector TEXT,
  ecosystem VARCHAR(50),
  package_name VARCHAR(255),
  vulnerable_range VARCHAR(255),
  patched_version VARCHAR(100),
  published_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_advisories_cve ON advisories(cve_id);
CREATE INDEX idx_advisories_ecosystem ON advisories(ecosystem);
CREATE INDEX idx_advisories_severity ON advisories(severity);
```

---

## Environment Variables Required

| Variable | Source | Notes |
|----------|--------|-------|
| `GITHUB_TOKEN` | GitHub GHSA | Optional but recommended for higher rate limits |

---

## Sources

- [FIRST EPSS API Documentation](https://www.first.org/epss/api)
- [EPSS User Guide](https://www.first.org/epss/user-guide)
- [GitHub REST API - Global Security Advisories](https://docs.github.com/en/rest/security-advisories/global-advisories)
- [GitHub GraphQL API](https://docs.github.com/en/graphql/reference/queries)
- [GitHub Advisory Database Repository](https://github.com/github/advisory-database)

---

*Last Updated: January 15, 2026*
