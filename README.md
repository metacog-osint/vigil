# Vigil

**Cyber Threat Intelligence Dashboard**

Real-time monitoring of threat actors, ransomware groups, APTs, incidents, vulnerabilities, and indicators of compromise.

---

## Features

### Core Intelligence
- **Dashboard** - AI-generated threat summary, sector distribution, activity charts, recent incidents
- **Threat Actors** - 1,000+ actors across 6 categories with trend status (ESCALATING/STABLE/DECLINING)
- **Incidents** - 16,000+ ransomware attacks with sector classification
- **Vulnerabilities** - CISA KEV catalog with CVSS scores
- **IOC Search** - Hash/IP/domain lookup with external enrichment links
- **Advanced Search** - Query language powered search across all data
- **ATT&CK Matrix** - MITRE ATT&CK technique browser with heatmap view
- **Alerts** - CISA security alerts
- **Export** - CSV, JSON, and STIX 2.1 export formats

### Threat Actor Categories (v0.4.0)
| Category | Count | Description |
|----------|-------|-------------|
| **Ransomware** | 578 | Encrypt & extort groups (LockBit, Akira, etc.) |
| **APT** | 362 | State-sponsored espionage (APT28, Lazarus, etc.) |
| **Cybercrime** | 25 | Financial fraud (FIN7, Magecart, Scattered Spider) |
| **Hacktivism** | 23 | Political motivation (Anonymous, Killnet, Lapsus$) |
| **Initial Access Broker** | 9 | Sell network access (Emotet, Qakbot operators) |
| **Data Extortion** | 3 | Steal without encrypting (Karakurt, RansomHouse) |

### Analytics Features (v0.3.0)
- **Actor Trajectory Charts** - Compare actor activity over time with multi-line charts
- **Attack Path Visualization** - Visual attack chains (Actor → Technique → Vulnerability → IOC)
- **Incident Flow Diagrams** - Sankey-style visualization of Actor → Sector attack flows
- **Trend Analysis** - Week-over-week comparisons, sector trends, "what changed" summaries
- **Automated Trend Calculation** - ESCALATING/STABLE/DECLINING based on 7-day activity
- **AI Summaries** - Groq-powered threat intelligence summaries

### User Experience
- **Organization Profile** - Configure sector, geography, and tech stack for personalized intelligence
- **Relevance Scoring** - Threats scored based on relevance to your organization
- **Keyboard Shortcuts** - Press `?` for help, `g+d` for Dashboard, `Cmd+K` for search
- **Smart Time Display** - Adaptive formatting ("2 hours ago", "Yesterday", etc.)
- **Data Sources Panel** - View sync status and trigger manual updates

### Threat Actors Page (v0.4.1)
- **Pagination** - Load 50 actors at a time with "Load More" button
- **CSV Export** - Export filtered results with all columns
- **Saved Filters** - Save and load filter combinations for quick access
- **Activity Sparklines** - Mini trend charts showing 7-day activity patterns
- **Related Actors** - Shows similar actors based on shared TTPs and target sectors
- **Quick Watchlist** - Shift+click to select multiple actors, bulk add to watchlist
- **Keyboard Navigation** - Arrow keys to navigate, Enter to view details, / to search
- **Map View** - Visual breakdown of actors by region, sector, and type
- **Risk Score** - Relevance scoring (0-100) based on org profile match

## Data Sources

### Automated (Every 6 Hours)

| Source | Data | Actors/Records |
|--------|------|----------------|
| [RansomLook](https://ransomlook.io/) | Ransomware groups & victims | ~600 groups |
| [Ransomware.live](https://ransomware.live/) | Ransomware attacks | 16,000+ incidents |
| [MITRE ATT&CK](https://attack.mitre.org/) | APT groups & techniques | 172 groups, 691 techniques |
| [Malpedia](https://malpedia.caad.fkie.fraunhofer.de/) | Malware families & actors | 864 actors, 3,638 families |
| [MISP Galaxy](https://github.com/MISP/misp-galaxy) | Community threat actor data | 2,940 actors |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Exploited vulnerabilities | 1,100+ CVEs |
| [CISA Alerts](https://www.cisa.gov/news-events/cybersecurity-advisories) | Security advisories | Latest alerts |
| [NVD](https://nvd.nist.gov/) | CVE database | Recent CVEs |
| [Abuse.ch ThreatFox](https://threatfox.abuse.ch/) | IOCs | Malware indicators |
| [Abuse.ch URLhaus](https://urlhaus.abuse.ch/) | Malicious URLs | Active threats |
| [Abuse.ch Feodo](https://feodotracker.abuse.ch/) | Botnet C2 IPs | C2 servers |

### Curated (Manual Updates)
- Hacktivism groups (no structured feed available)
- Initial Access Brokers (from threat reports)
- Data extortion groups (subset of ransomware)

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier)
- Groq API key (optional, for AI summaries)

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
# Execute files in supabase/migrations/ in order (001-007)

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
│   ├── components/     # React components (70+ components)
│   ├── pages/          # Route pages (13 pages)
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Supabase client, query parser, AI, export
├── scripts/            # Data ingestion & analytics (15 scripts)
├── supabase/
│   ├── migrations/     # Database schema (7 migrations)
│   └── functions/      # Edge functions
├── .github/
│   └── workflows/      # Automated ingestion (every 6 hours)
└── docs/               # Documentation
```

## Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run tests

# Data Ingestion (automated via GitHub Actions)
npm run ingest:ransomlook     # RansomLook ransomware
npm run ingest:ransomware-live # Ransomware.live
npm run ingest:mitre          # MITRE ATT&CK + APT groups
npm run ingest:malpedia       # Malpedia actors + malware
npm run ingest:misp-galaxy    # MISP Galaxy threat actors
npm run ingest:kev            # CISA KEV
npm run ingest:cisa-alerts    # CISA alerts
npm run ingest:nvd            # NVD CVEs
npm run ingest:threatfox      # ThreatFox IOCs
npm run ingest:urlhaus        # URLhaus malicious URLs
npm run ingest:feodo          # Feodo C2 trackers

# Analytics
npm run snapshot:actors         # Daily actor trend snapshot
npm run generate:weekly-summary # Weekly summary generation
npm run seed:correlations       # Actor-CVE correlations
npm run seed:actor-types        # Curated actor categories
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq API (Llama 3.3 70B) for threat summaries
- **Hosting**: Vercel
- **Automation**: GitHub Actions (every 6 hours)

## Documentation

### Product & Features
- [FEATURES.md](./FEATURES.md) - Detailed feature documentation
- [ROADMAP.md](./ROADMAP.md) - Future feature plans
- [CHANGELOG.md](./CHANGELOG.md) - Version history

### Technical
- [DATABASE.md](./DATABASE.md) - Database schema documentation
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [docs/DATA_INGESTION.md](./docs/DATA_INGESTION.md) - Data sources and automation
- [DATA_SOURCES.md](./DATA_SOURCES.md) - All data sources with status

### Operations
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Hosting, pricing, deployment guide
- [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) - Security review findings
- [ALERTING_SYSTEM.md](./ALERTING_SYSTEM.md) - Real-time alerts documentation

### Development
- [CLAUDE.md](./CLAUDE.md) - AI assistant context
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Development notes
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contributor guidelines
- [BUILD_PLAN_V2.md](./BUILD_PLAN_V2.md) - Consolidated development roadmap

## License

MIT

---

*Version 0.4.2 - January 2026*
*Built by The Intelligence Company*
