# Development Notes

## Recent Work (January 2026)

### Completed Features

**Sprint 1-4: Core Infrastructure**
- React + Vite setup with Tailwind CSS
- Supabase integration with real-time subscriptions
- Dashboard, Threat Actors, Incidents, Vulnerabilities pages
- IOC Search with bulk search capability

**Sprint 5: Visualizations**
- ThreatGauge - threat level indicator (0-100)
- SectorChart - pie chart of targeted sectors
- VulnTreemap - vulnerability severity breakdown
- AttackMatrixHeatmap - MITRE ATT&CK visualization
- ActivityCalendar - GitHub-style activity heatmap
- Sparkline - inline trend charts

**Sprint 6: User Features**
- Watchlists page
- Settings/preferences page
- Tag system for organizing entities

**Sprint 7: Additional Data Sources**
- CISA Alerts ingestion
- Spamhaus DROP lists
- Enhanced MalwareBazaar integration

**Sprint 8: Export & Integration**
- CSV export
- JSON export
- STIX 2.1 format export
- ExportButton component

**Sprint 9: Advanced Features**
- Query language parser for advanced search
- Timeline visualization component
- AdvancedSearch page with query syntax

**Sprint 10: Performance**
- Lazy loading for route pages
- Vite manual chunk splitting
- Reduced initial bundle from ~1MB to ~215KB

**Sprint 11: User Experience Enhancements**
- NewBadge indicators on list items (actors, incidents, vulnerabilities)
- WatchButton for quick watchlist management
- Escalating Actors alert box on Dashboard
- AI BLUF (Bottom Line Up Front) summary via Groq API (optional)
- ActivityCalendar on Dashboard (90-day heatmap)
- Timeline in actor detail panel (recent incidents)
- SeverityBar visualization on vulnerability rows
- Sync status display in Settings page
- Last sync timestamp in Dashboard header

### Bug Fixes

| Issue | Fix |
|-------|-----|
| Missing ransomwatch ingestion | Created `ingest-ransomwatch.mjs` |
| firebase.js getDoc bug | Changed to `getDocs()` for queries |
| ActivityChart empty | Fixed date parsing, expanded range |
| Dashboard missing visualizations | Added ThreatGauge, SectorChart, VulnTreemap |

## Architecture

### Frontend Structure

```
src/
├── components/          # 40+ reusable components
│   ├── index.js        # Barrel exports
│   ├── Sidebar.jsx     # Navigation sidebar
│   ├── Header.jsx      # Top header with search
│   ├── ThreatGauge.jsx # Threat level visualization
│   ├── SectorChart.jsx # Sector pie chart
│   └── ...
├── pages/              # 11 route pages
│   ├── Dashboard.jsx
│   ├── ThreatActors.jsx
│   ├── Incidents.jsx
│   ├── Vulnerabilities.jsx
│   ├── IOCSearch.jsx
│   ├── BulkSearch.jsx
│   ├── AdvancedSearch.jsx
│   ├── Techniques.jsx
│   ├── Alerts.jsx
│   ├── Watchlists.jsx
│   └── Settings.jsx
├── hooks/              # Custom React hooks
│   ├── useAuth.js
│   ├── useOnlineStatus.js
│   └── useKeyboardShortcuts.js
└── lib/                # Utilities
    ├── supabase.js     # Database client & queries
    ├── firebase.js     # Auth (optional)
    ├── queryParser.js  # Advanced search parser
    └── export.js       # Export utilities
```

### Database Schema

```
threat_actors     # Ransomware groups (216 records)
incidents         # Victim claims (16,000+ records)
vulnerabilities   # CVEs with KEV data (2,000+ records)
iocs              # Indicators of compromise (600+ records)
techniques        # MITRE ATT&CK techniques
watchlists        # User watchlists
watchlist_items   # Items in watchlists
user_preferences  # User settings
tags              # Custom tags
entity_tags       # Tag assignments
alerts            # CISA alerts
malware_samples   # MalwareBazaar samples
sync_log          # Ingestion history
```

### Data Flow

```
External APIs → Ingestion Scripts → Supabase → React Frontend
     ↓                                              ↓
Ransomwatch ─────────────────────────────────→ Dashboard
CISA KEV    ─────────────────────────────────→ Vulnerabilities
NVD         ─────────────────────────────────→ Vulnerabilities
ThreatFox   ─────────────────────────────────→ IOC Search
MITRE       ─────────────────────────────────→ Techniques
```

## Known Issues / Technical Debt

### Dead Code (can be removed)
- `FilterBar.jsx` - Created but never used
- `SparklineBar`, `TimelineMini`, `ActorTimeline` - Exported but not imported
- `malwareSamples`, `syncLog` queries - Defined but unused
- Firebase auth functions - Partially implemented (using Supabase instead)

### Potential Improvements
- Add FilterBar to Incidents/Vulnerabilities pages
- Wire up Timeline component to actor detail view
- Implement malware samples page
- Add sync log viewer to Settings page
- Consolidate auth to single provider (Supabase recommended)

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 5174)
npm run build            # Production build
npm run preview          # Preview production build

# Code Quality
npm run lint             # ESLint check
npm run format           # Prettier format
npm run test             # Run tests

# Data Ingestion
npm run ingest           # All sources
npm run ingest:kev       # CISA KEV only
npm run ingest:nvd       # NVD CVEs only
```

## Environment Variables

```bash
# Required
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Optional - AI Summaries (free tier)
VITE_GROQ_API_KEY=xxx  # Get from https://console.groq.com/keys

# Optional (Firebase - not currently used)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

### AI Features (Optional)

The dashboard includes an AI-generated BLUF (Bottom Line Up Front) summary powered by Groq's free API tier. To enable:

1. Create a free account at https://console.groq.com
2. Generate an API key
3. Add `VITE_GROQ_API_KEY` to your `.env` file or Vercel environment variables
4. Restart the dev server or redeploy

Without the API key, the dashboard works normally without the AI summary.

## Contributing

1. Create feature branch from `main`
2. Make changes
3. Run `npm run lint && npm run build`
4. Push and create PR
5. Vercel creates preview deployment automatically
