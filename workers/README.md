# Vigil Ingestion Worker

Cloudflare Worker for scheduled threat intelligence ingestion. Replaces GitHub Actions for $0 operating cost.

## Why Cloudflare Workers?

| Factor | GitHub Actions | Cloudflare Workers |
|--------|---------------|-------------------|
| Free tier | 2,000 min/month | 100,000 req/day |
| Cron triggers | Counts as minutes | Free (5 triggers) |
| Cold start | ~60s (npm install) | ~5ms |
| Cost at scale | $0.008/min | Free |

## Setup

### 1. Install Wrangler CLI

```bash
cd workers
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Add Secrets

```bash
npx wrangler secret put SUPABASE_URL
# Enter your Supabase URL when prompted

npx wrangler secret put SUPABASE_KEY
# Enter your Supabase service role key when prompted

# Required for abuse.ch APIs (ThreatFox, URLhaus, MalwareBazaar)
npx wrangler secret put ABUSECH_API_KEY

# Optional API keys
npx wrangler secret put PULSEDIVE_API_KEY
npx wrangler secret put VULNCHECK_API_KEY
npx wrangler secret put CENSYS_API_KEY
```

### 4. Deploy

```bash
npm run deploy
```

## Cron Schedule

| Schedule | Frequency | Feeds |
|----------|-----------|-------|
| `*/30 * * * *` | Every 30 min | Ransomlook, CISA KEV, ThreatFox, Feodo, URLhaus |
| `0 */6 * * *` | Every 6 hours | NVD, VulnCheck, EPSS |
| `0 0 * * *` | Daily midnight UTC | Malpedia, MISP Galaxy, MITRE ATT&CK |
| `0 6 * * *` | Daily 6am UTC | MalwareBazaar, Tor Exits |
| `0 12 * * *` | Daily noon UTC | Pulsedive, Censys |

## Manual Triggers

The worker also exposes HTTP endpoints for manual testing:

```bash
# Health check
curl https://vigil-ingestion.<your-subdomain>.workers.dev/health

# Trigger specific feeds
curl https://vigil-ingestion.<your-subdomain>.workers.dev/ingest/kev
curl https://vigil-ingestion.<your-subdomain>.workers.dev/ingest/threatfox
curl https://vigil-ingestion.<your-subdomain>.workers.dev/ingest/ransomlook
```

## Local Development

```bash
npm run dev
```

This starts a local server at `http://localhost:8787` for testing.

## View Logs

```bash
npm run tail
```

## Architecture

```
workers/
├── src/
│   ├── index.js          # Main entry, cron routing
│   ├── lib/
│   │   └── supabase.js   # Lightweight Supabase REST client
│   └── feeds/
│       ├── cisa-kev.js   # CISA KEV vulnerabilities
│       ├── nvd.js        # NVD CVE database
│       ├── vulncheck.js  # VulnCheck extended KEV
│       ├── epss.js       # EPSS exploit prediction scores
│       ├── ransomlook.js # Ransomware incidents
│       ├── threatfox.js  # ThreatFox IOCs
│       ├── urlhaus.js    # URLhaus malicious URLs
│       ├── feodo.js      # Feodo botnet C2s
│       ├── malwarebazaar.js # MalwareBazaar samples
│       ├── malpedia.js   # Malpedia threat actors
│       ├── misp-galaxy.js # MISP Galaxy actors
│       ├── mitre.js      # MITRE ATT&CK groups
│       ├── tor-exits.js  # Tor exit node IPs
│       ├── pulsedive.js  # Pulsedive community intel
│       └── censys.js     # Censys infrastructure
├── wrangler.toml         # Cloudflare config
└── package.json
```

## Adding New Feeds

1. Create a new file in `src/feeds/`
2. Export an async function that takes `(supabase, env)`
3. Import and call it in `src/index.js` under the appropriate cron schedule
4. Deploy with `npm run deploy`
