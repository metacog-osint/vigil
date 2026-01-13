# Vigil

**Cyber Threat Intelligence Dashboard**
*A product of [The Intelligence Company](https://theintelligence.company)*

Real-time monitoring of ransomware groups, incidents, vulnerabilities, and indicators of compromise.

🌐 **Live:** [vigil.theintelligence.company](https://vigil.theintelligence.company)

---

## Architecture

Vigil uses a **hybrid Firebase + Supabase** architecture:

- **Supabase (PostgreSQL)**: Stores threat data (actors, incidents, IOCs, vulnerabilities)
  - Enables complex SQL queries and correlations
  - Edge Functions for scheduled data ingestion
  - Real-time subscriptions for live updates

- **Firebase**: Handles user-facing features
  - Authentication (email/password, Google SSO)
  - User preferences and watchlists (Firestore)
  - Hosting and CDN

## Data Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| [Ransomwatch](https://github.com/joshhighet/ransomwatch) | Ransomware groups & victims | 30 min |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Exploited vulnerabilities | 6 hours |
| [Abuse.ch ThreatFox](https://threatfox.abuse.ch/) | IOCs (hashes, IPs, domains) | 1 hour |
| [Abuse.ch MalwareBazaar](https://bazaar.abuse.ch/) | Malware samples | 1 hour |

## Features

- **Dashboard** - Stats, activity charts, recent incidents, top actors
- **Threat Actors** - Browse ransomware groups with trend status (ESCALATING/STABLE/DECLINING)
- **Incidents** - Ransomware attacks by sector/timeframe with auto-sector inference
- **Vulnerabilities** - CISA KEV catalog with CVSS/EPSS scores
- **IOC Search** - Hash/IP/domain search with external lookup links

## Setup

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Firebase account (free tier works)

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project at https://supabase.com
2. Run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_trend_calculations.sql`
3. Copy your project URL and anon key

### 3. Configure Firebase

1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password and Google)
3. Create a Firestore database
4. Copy your Firebase config values

### 4. Environment Variables

```bash
cp .env.example .env
```

Fill in your Supabase and Firebase credentials.

### 5. Deploy Edge Functions (Supabase)

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy ingest-ransomwatch
supabase functions deploy ingest-cisa-kev
supabase functions deploy ingest-abusech
supabase functions deploy calculate-trends
```

### 6. Run Development Server

```bash
npm run dev
```

Open http://localhost:5174

## Project Structure

```
vigil/
├── src/
│   ├── components/       # React components
│   ├── pages/           # Route pages
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Supabase & Firebase clients
│   └── services/        # API service layers
├── supabase/
│   ├── migrations/      # Database schema
│   └── functions/       # Edge functions for data ingestion
├── public/              # Static assets
└── index.html
```

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts
- **Backend**: Supabase (PostgreSQL), Firebase
- **Data Ingestion**: Supabase Edge Functions (Deno)
- **Authentication**: Firebase Auth

## Roadmap

- [ ] Vertex AI summaries for threat actors
- [ ] MITRE ATT&CK mapping
- [ ] Threat actor relationship graphs
- [ ] Email/Slack alerting
- [ ] API for external integrations
- [ ] PDF report generation

---

**The Intelligence Company**
*Clarity in chaos.*
