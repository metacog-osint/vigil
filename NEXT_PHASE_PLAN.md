# Vigil Next Phase Plan

## Status Overview

### Completed
- All 6 BUILD_PLAN sprints
- User customization/personalization wizard
- Jake's feedback addressed
- Testing & Polish (174 unit tests, 19/20 E2E tests, ESLint setup)

---

## Phase 7: Remaining Roadmap Items

### 1. Data Sources (COMPLETED)
**Goal:** Add enrichment sources to enhance IOC and threat intelligence data

| Source | Type | Script Status | Purpose |
|--------|------|---------------|---------|
| Shodan InternetDB | Enrichment | Complete | IP reputation, open ports, services |
| VirusTotal | Enrichment | Complete | File/URL/IP malware analysis |
| HybridAnalysis | Enrichment | Complete | Malware sandbox analysis |
| Phishtank | New Source | Complete | Phishing URL database |

**Tasks:**
- [x] Review existing scaffolded scripts
- [x] Complete Shodan InternetDB integration
- [x] Complete VirusTotal integration
- [x] Complete HybridAnalysis integration
- [x] Add Phishtank as new IOC source (`scripts/ingest-phishtank.mjs`)
- [x] Add UI for enrichment data display (`src/components/EnrichmentPanel.jsx`)
- [x] Update IOC detail panels with enrichment (EnrichmentBadges, EnrichmentPanel)
- [x] Add all enrichment scripts to GitHub Actions workflow

---

### 2. Team Features (COMPLETED)
**Goal:** Enable collaborative threat intelligence workflows

**Features:**
- [x] Multi-user support with Firebase Auth
- [x] Role-based access control (Owner/Admin/Analyst/Viewer)
- [x] Shared watchlists between team members
- [x] Activity audit log
- [x] Team settings management
- [x] Team invitations with email and expiry

**Files Created:**
- `supabase/migrations/010_teams.sql` - Full schema with RLS policies
- `src/components/TeamManagement.jsx` - Team UI with modals
- `src/lib/supabase.js` - Added `teams` and `sharedWatchlists` modules

---

### 3. Security (COMPLETED)
**Goal:** Harden authentication and session security

**Features:**
- [x] Two-factor authentication (2FA) via Firebase Phone Auth
- [x] Session management UI (active sessions list)
- [x] MFA enrollment/unenrollment flow
- [x] Session information display
- [x] Sign out all sessions option

**Files Created:**
- `src/components/SecuritySettings.jsx` - 2FA and session management UI

---

### 4. Performance (COMPLETED)
**Goal:** Improve load times and enable offline access

**Features:**
- [x] Service worker for offline mode
- [x] Cache-first strategy for static assets
- [x] Network-first strategy for API data
- [x] Offline indicator in UI
- [x] PWA manifest already configured

**Files Created:**
- `public/sw.js` - Service worker with caching strategies
- `src/lib/serviceWorker.js` - Registration and management utilities

---

### 5. Documentation (COMPLETED)
**Goal:** Help users get the most from Vigil

**Features:**
- [x] In-app help center (/help page)
- [x] Feature documentation sections:
  - Getting Started guide
  - IOC search syntax with examples
  - IOC enrichment sources explained
  - Watchlists usage guide
  - Integration setup (Slack, Teams, Jira, SIEM)
  - Keyboard shortcuts reference
  - Data sources overview
  - API access documentation
- [x] Help link in sidebar navigation

**Files Created:**
- `src/pages/Help.jsx` - Comprehensive help center with 8 sections

---

## Current Focus: Data Sources

### Enrichment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     IOC Search/Detail                        │
├─────────────────────────────────────────────────────────────┤
│  IOC: 192.168.1.1                                           │
│  Type: IP Address                                           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Shodan      │ │ VirusTotal  │ │ HybridAnalysis      │   │
│  │ Ports: 22,80│ │ 15/70 detect│ │ Malware: Emotet     │   │
│  │ ASN: AS1234 │ │ Last seen:  │ │ Sandbox: malicious  │   │
│  │ Org: Acme   │ │ 2024-01-10  │ │ C2 behavior: yes    │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### API Keys Required
- `SHODAN_API_KEY` - Free tier available
- `VIRUSTOTAL_API_KEY` - Free tier: 4 req/min
- `HYBRIDANALYSIS_API_KEY` - Free tier available
- `PHISHTANK_API_KEY` - Free, requires registration

### Files to Create/Modify
- `scripts/enrich-shodan-internetdb.mjs` - Complete implementation
- `scripts/enrich-virustotal.mjs` - Complete implementation
- `scripts/enrich-hybridanalysis.mjs` - Complete implementation
- `scripts/ingest-phishtank.mjs` - New ingestion script
- `src/lib/supabase.js` - Add enrichment query functions
- `src/components/EnrichmentPanel.jsx` - New component for enrichment display
- `supabase/migrations/010_enrichment_data.sql` - Schema for enrichment cache

---

## Notes
- Enrichment should be on-demand (user clicks "Enrich") to manage API limits
- Cache enrichment results to avoid repeated API calls
- Show enrichment source and timestamp for data freshness
