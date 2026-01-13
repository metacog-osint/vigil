# Vigil

**Cyber Threat Intelligence Dashboard**

Real-time monitoring of ransomware groups, incidents, vulnerabilities, and indicators of compromise.

---

## Features

- **Dashboard** - Threat level gauge, sector distribution, activity charts, recent incidents
- **Threat Actors** - 216 ransomware groups with trend status (ESCALATING/STABLE/DECLINING)
- **Incidents** - 16,000+ ransomware attacks with sector classification
- **Vulnerabilities** - CISA KEV catalog with CVSS scores
- **IOC Search** - Hash/IP/domain lookup with external links
- **Advanced Search** - Query language powered search across all data
- **ATT&CK Matrix** - MITRE ATT&CK technique browser
- **Alerts** - CISA security alerts
- **Export** - CSV, JSON, and STIX 2.1 export formats

## Data Sources

| Source | Data | Records |
|--------|------|---------|
| [Ransomwatch](https://github.com/joshhighet/ransomwatch) | Ransomware groups & victims | 16,000+ incidents |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Exploited vulnerabilities | 1,487 KEVs |
| [NVD](https://nvd.nist.gov/) | CVE database | 500+ recent CVEs |
| [Abuse.ch ThreatFox](https://threatfox.abuse.ch/) | IOCs (hashes, IPs, domains) | 600+ IOCs |
| [MITRE ATT&CK](https://attack.mitre.org/) | Techniques & tactics | Full matrix |

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier)

### Installation

```bash
# Clone and install
git clone https://github.com/metacog-osint/vigil.git
cd vigil
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Run database migrations (in Supabase SQL Editor)
# Execute files in supabase/migrations/ in order

# Ingest data
npm run ingest

# Start development server
npm run dev
```

Open http://localhost:5174

## Project Structure

```
vigil/
├── src/
│   ├── components/     # React components (40+ components)
│   ├── pages/          # Route pages (11 pages)
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Supabase client, query parser, export utilities
├── scripts/            # Data ingestion scripts
├── supabase/
│   └── migrations/     # Database schema (5 migrations)
└── docs/               # Documentation
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Data Visualization**: Recharts (charts, gauges, treemaps)

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run ingest       # Run all data ingestion
npm run ingest:kev   # CISA KEV only
npm run ingest:nvd   # NVD CVEs only
```

## Documentation

- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Hosting, pricing, deployment guide
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Development notes and architecture

## License

MIT

---

Built for the iCOUNTER CTI Analyst position.
