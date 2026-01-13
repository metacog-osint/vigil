# Vigil

**Cyber Threat Intelligence Dashboard**

Real-time monitoring of ransomware groups, incidents, vulnerabilities, and indicators of compromise.

---

## Features

### Core Intelligence
- **Dashboard** - Threat level gauge, sector distribution, activity charts, recent incidents
- **Threat Actors** - 216 ransomware groups with trend status (ESCALATING/STABLE/DECLINING)
- **Incidents** - 16,000+ ransomware attacks with sector classification
- **Vulnerabilities** - CISA KEV catalog with CVSS scores
- **IOC Search** - Hash/IP/domain lookup with external enrichment links
- **Advanced Search** - Query language powered search across all data
- **ATT&CK Matrix** - MITRE ATT&CK technique browser
- **Alerts** - CISA security alerts
- **Export** - CSV, JSON, and STIX 2.1 export formats

### Differentiating Features (v0.2.0)
- **Organization Profile** - Configure your sector, geography, and tech stack for personalized threat intelligence
- **Relevance Scoring** - Threats scored based on relevance to your organization (sector, vendors, products)
- **IOC Quick Lookup** - Instant enrichment with external links (VirusTotal, Shodan, AbuseIPDB, etc.)
- **Trend Analysis** - Week-over-week comparisons, sector trends, "what changed" summaries
- **Actor Correlations** - View TTPs, exploited CVEs, and IOCs associated with threat actors

### New in v0.3.0
- **Actor Trajectory Charts** - Compare actor activity over time with multi-line charts
- **Attack Path Visualization** - Visual attack chains (Actor → Technique → Vulnerability → IOC)
- **Incident Flow Diagrams** - Sankey-style visualization of Actor → Sector attack flows
- **Keyboard Shortcuts** - Press `?` for help, `g+d` for Dashboard, `Cmd+K` for search
- **Smart Time Display** - Adaptive time formatting ("2 hours ago", "Yesterday", etc.)
- **ATT&CK Matrix Heatmap** - Toggle between table and heatmap views on Techniques page
- **Automated Analytics** - Daily actor snapshots and weekly summary generation

## Data Sources

| Source | Data | Frequency |
|--------|------|-----------|
| [RansomLook](https://ransomlook.io/) | Ransomware groups & victims | Every 6 hours |
| [Ransomware.live](https://ransomware.live/) | Ransomware attacks | Every 6 hours |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Exploited vulnerabilities | Every 6 hours |
| [CISA Alerts](https://www.cisa.gov/news-events/cybersecurity-advisories) | Security advisories | Every 6 hours |
| [NVD](https://nvd.nist.gov/) | CVE database | Every 6 hours |
| [Abuse.ch](https://abuse.ch/) | IOCs (ThreatFox, URLhaus, Feodo) | Every 6 hours |
| [MITRE ATT&CK](https://attack.mitre.org/) | Techniques & tactics | Every 6 hours |

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier)

### Installation

\`\`\`bash
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
\`\`\`

Open http://localhost:5174

## Project Structure

\`\`\`
vigil/
├── src/
│   ├── components/     # React components (60+ components)
│   ├── pages/          # Route pages (12 pages)
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Supabase client, query parser, export utilities
├── scripts/            # Data ingestion & analytics scripts
├── supabase/
│   └── migrations/     # Database schema (7 migrations)
├── .github/
│   └── workflows/      # Automated ingestion & analytics
└── docs/               # Documentation
\`\`\`

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Data Visualization**: Recharts (charts, gauges, treemaps)

## Scripts

\`\`\`bash
# Development
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run tests

# Data Ingestion
npm run ingest             # Run all data ingestion
npm run ingest:ransomlook  # RansomLook ransomware
npm run ingest:kev         # CISA KEV
npm run ingest:cisa-alerts # CISA alerts
npm run ingest:nvd         # NVD CVEs
npm run ingest:mitre       # MITRE ATT&CK

# Analytics
npm run snapshot:actors         # Daily actor trend snapshot
npm run generate:weekly-summary # Weekly summary generation
npm run seed:correlations       # Actor-CVE correlations
\`\`\`

## Documentation

- [FEATURES.md](./FEATURES.md) - Detailed feature documentation
- [DATABASE.md](./DATABASE.md) - Database schema documentation
- [DATA_INGESTION.md](./docs/DATA_INGESTION.md) - Data sources and automation
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Hosting, pricing, deployment guide
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Development notes and architecture
- [ROADMAP.md](./ROADMAP.md) - Future feature plans

## License

MIT

---

Built for the iCOUNTER CTI Analyst position.
