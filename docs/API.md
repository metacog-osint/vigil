# Vigil API Documentation

**Base URL:** `https://vigil.theintelligence.company/api/v1`

**Version:** 1.0

---

## Public feed (no key)

`GET https://vigil.theintelligence.company/api/feed` returns Vigil's current picture as GeoJSON in The
Intelligence Company's feed contract v2 (`tic-feed/2`, described in `doctrine/kit/docs/feed-contract-v2.md`):
escalating groups; leak-site claims dated from two days before the current UTC date (three calendar dates, today's
included); CISA KEV additions dated from seven days before; and victim breach disclosures Vigil first saw from
midnight UTC seven days before, plus a summary item. It needs no key, is cached for 15 minutes, and reads claims
and group names only from the `*_commercial` views, so nothing a restricted source supplied is re-served.
Built by `api/_lib/doctrineFeed.js`; `src/lib/__tests__/doctrineFeed.test.js` runs the kit's linter over it.
The summary names each window by its first date ("since 29 Oct"), and its figures are the database's counts
(`Prefer: count=exact`), not the number of items listed, which the queries cap at 50 groups, 300 claims, 100 KEV
additions and 200 notices. When there are more than the feed lists, the summary says how many it lists (for groups,
how many it names: a group whose name only a restricted source supplied is counted but not listed); a count that
fails reads "count unavailable", never a number.

## Daily summary (no key)

`GET https://vigil.theintelligence.company/api/summary` returns one sentence about the latest complete day, for
The Intelligence Company's home page. No key, `Access-Control-Allow-Origin: *`, cached for an hour at the edge
(`s-maxage=3600, stale-while-revalidate=86400`). Any failure is a 503 with no detail and `no-store`; a reader
should ignore it and keep its own text.

The live response on 31 Oct 2026, run locally against the production database:

```json
{
  "built_at": "2026-10-31T21:42:17Z",
  "day": "2026-10-30",
  "brief": "Ransomware leak sites showed 43 new victim claims on 30 Oct 2026, from 16 groups; Qilin posted the most (11). Claims are unverified.",
  "claims": 43,
  "groups": 16,
  "unattributed": 0,
  "top": {
    "claims": 11,
    "groups": [
      {
        "name": "Qilin",
        "url": "https://vigil.theintelligence.company/actors/785a7c44-ceff-4550-9d57-a2802bfc1835"
      }
    ]
  },
  "day_basis": "Claims by the date RansomLook first saw them on a leak site, as RansomLook dates them (measured at one to two hours ahead of UTC).",
  "ingest_confirmed_at": "2026-10-31T01:15:15Z",
  "link": "https://vigil.theintelligence.company/incidents",
  "source": { "publisher": "RansomLook", "url": "https://www.ransomlook.io/", "licence": "CC BY 4.0" },
  "attribution": "Vigil, The Intelligence Company. Leak-site claims: RansomLook (CC BY 4.0).",
  "method": "vigil-summary-1"
}
```

- `day` is RansomLook's calendar day, not a strict UTC day: its dates run one to two hours ahead of UTC.
- A day is summarised only when a successful RansomLook run followed it with no gap over 12 hours between runs;
  otherwise the day before is tried, back three days, then 503.
- `claims` is the database's exact count. `groups`, `unattributed` and `top` are null when the day's rows did not
  all come back. `top` is null when a leading group has no name a sellable source supplied; the runner-up is
  never named in its place.
- A zero day is a 503, not `"claims": 0`: Vigil's fetch working does not prove RansomLook's crawler was.
- Claims and names come only from the `*_commercial` views, read with the anonymous key. Showing `brief` means
  crediting RansomLook (CC BY 4.0); `attribution` is the line to use.

Built by `api/_lib/publicSummary.js`, whose header carries the measurements behind each rule;
`src/lib/__tests__/publicSummary.test.js` holds them.

---

## Authentication

All API endpoints require authentication via API key. Include your API key in the `Authorization` header:

```
Authorization: Bearer vgl_xxxxxxxxxxxxxxxxxxxx
```

### API Key Requirements

- API access requires **Team plan or higher**
- Keys are generated in Settings > API Keys
- Keys have scopes: `read` (default), `write`, `admin`

### Rate Limits

| Plan | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| Team | 60 | 10,000 |
| Enterprise | 120 | 50,000 |

---

## Endpoints

### Threat Actors

#### List Actors

```
GET /actors
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or alias |
| `trend_status` | string | Filter by trend: `ESCALATING`, `STABLE`, `DECLINING` |
| `sector` | string | Filter by target sector |
| `country` | string | Filter by attributed country |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 50, max: 100) |
| `sort_by` | string | Sort field (default: `last_seen`) |
| `sort_order` | string | `asc` or `desc` (default: `desc`) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "LockBit",
      "aliases": ["LockBit 3.0", "LockBit Black"],
      "actor_type": "ransomware",
      "trend_status": "ESCALATING",
      "incident_velocity": 2.5,
      "target_sectors": ["healthcare", "finance"],
      "attributed_countries": ["RU"],
      "first_seen": "2019-09-01",
      "last_seen": "2024-01-15",
      "ttps": ["T1486", "T1490"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 578,
    "pages": 12
  }
}
```

#### Get Single Actor

```
GET /actors?id={uuid}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "name": "LockBit",
    ...
  }
}
```

---

### Incidents

#### List Incidents

```
GET /incidents
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by victim name |
| `sector` | string | Filter by victim sector |
| `actor_id` | uuid | Filter by threat actor |
| `days` | integer | Filter to last N days |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 50, max: 100) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "victim_name": "Acme Corp",
      "victim_sector": "manufacturing",
      "victim_country": "US",
      "actor_id": "uuid",
      "threat_actor": {
        "id": "uuid",
        "name": "LockBit"
      },
      "discovered_date": "2024-01-15",
      "status": "confirmed",
      "source": "ransomware.live"
    }
  ],
  "pagination": { ... }
}
```

---

### IOCs (Indicators of Compromise)

#### List IOCs

```
GET /iocs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by IOC value |
| `type` | string | Filter by type: `ip`, `domain`, `hash`, `url` |
| `actor_id` | uuid | Filter by associated actor |
| `page` | integer | Page number |
| `limit` | integer | Results per page (max: 100) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "ip",
      "value": "192.168.1.1",
      "confidence": 85,
      "tags": ["c2", "malware"],
      "actor_id": "uuid",
      "source": "threatfox",
      "first_seen": "2024-01-10",
      "last_seen": "2024-01-15"
    }
  ],
  "pagination": { ... }
}
```

---

### Vulnerabilities

#### List Vulnerabilities

```
GET /vulnerabilities
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by CVE ID or description |
| `severity` | string | Filter by severity: `critical`, `high`, `medium`, `low` |
| `kev_only` | boolean | Only show CISA KEV entries |
| `vendor` | string | Filter by vendor |
| `page` | integer | Page number |
| `limit` | integer | Results per page (max: 100) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "cve_id": "CVE-2024-1234",
      "title": "Remote Code Execution in Example Product",
      "description": "...",
      "cvss_score": 9.8,
      "severity": "critical",
      "vendor": "Example Corp",
      "product": "Example Product",
      "kev_date": "2024-01-10",
      "published_date": "2024-01-05"
    }
  ],
  "pagination": { ... }
}
```

---

### Export

#### Export Data

```
GET /export
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Data type: `actors`, `incidents`, `iocs`, `vulnerabilities` |
| `format` | string | Output format: `csv`, `json`, `stix` |
| `days` | integer | Filter to last N days |
| `sector` | string | Filter by sector (for incidents) |
| `trend_status` | string | Filter by trend (for actors) |

**Response:**

Returns data in the requested format with appropriate `Content-Type` header.

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error message"
}
```

### Error Codes

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Insufficient permissions or plan |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## CORS

The API supports CORS for browser-based requests:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Authorization, Content-Type`

---

## Code Examples

### Python

```python
import requests

API_KEY = "vgl_xxxxxxxxxxxxxxxxxxxx"
BASE_URL = "https://vigil.theintelligence.company/api/v1"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Get escalating actors
response = requests.get(
    f"{BASE_URL}/actors",
    headers=headers,
    params={"trend_status": "ESCALATING", "limit": 10}
)

actors = response.json()["data"]
for actor in actors:
    print(f"{actor['name']}: {actor['incident_velocity']} incidents/day")
```

### JavaScript

```javascript
const API_KEY = "vgl_xxxxxxxxxxxxxxxxxxxx";
const BASE_URL = "https://vigil.theintelligence.company/api/v1";

async function getActors() {
  const response = await fetch(`${BASE_URL}/actors?trend_status=ESCALATING`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  const { data } = await response.json();
  return data;
}
```

### cURL

```bash
curl -H "Authorization: Bearer vgl_xxxxxxxxxxxxxxxxxxxx" \
  "https://vigil.theintelligence.company/api/v1/actors?trend_status=ESCALATING&limit=10"
```

---

*Last Updated: January 15, 2026*
