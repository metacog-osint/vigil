import { useState } from 'react'

const HELP_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    content: `
## Welcome to Vigil

Vigil is a cyber threat intelligence platform that aggregates data from multiple public threat feeds and presents it in an analyst-friendly interface.

### Key Features

- **Dashboard**: Real-time overview of threat landscape with key metrics
- **Threat Actors**: Track ransomware groups and APTs with trend analysis
- **Incidents**: Monitor ransomware attacks and breaches
- **Vulnerabilities**: CISA KEV and CVE tracking with EPSS scores
- **IOC Search**: Search and enrich indicators of compromise
- **Watchlists**: Track entities relevant to your organization
- **Alerts**: CISA cybersecurity alerts and advisories

### Quick Start

1. **Explore the Dashboard** - Get an overview of recent threat activity
2. **Set up your Organization Profile** - Configure sector and tech stack for relevance scoring
3. **Create Watchlists** - Track actors and vulnerabilities relevant to you
4. **Enable Notifications** - Get alerts when tracked entities update
    `,
  },
  {
    id: 'search-syntax',
    title: 'Search Syntax',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    content: `
## Advanced Search Syntax

Vigil supports powerful search queries across all data types.

### Basic Search

Simply type keywords to search across all relevant fields:

\`\`\`
lockbit
healthcare ransomware
CVE-2024
\`\`\`

### Field-Specific Search

Use \`field:value\` to search specific fields:

\`\`\`
actor:lockbit           # Actor name
sector:healthcare       # Target sector
type:ip                 # IOC type
confidence:high         # Confidence level
\`\`\`

### Comparison Operators

Use operators for numeric and date comparisons:

\`\`\`
cvss:>7.0               # CVSS score greater than 7
cvss:>=9.0              # CVSS score 9 or higher
incidents:<10           # Fewer than 10 incidents
date:>2024-01-01        # After January 2024
\`\`\`

### Boolean Operators

Combine conditions with AND/OR:

\`\`\`
actor:lockbit AND sector:healthcare
type:ip OR type:domain
status:active AND trend:escalating
\`\`\`

### Wildcards

Use \`*\` for partial matching:

\`\`\`
actor:lock*             # Matches lockbit, lockbit3, etc.
domain:*.ru             # Russian domains
hash:a1b2c3*            # Hash prefix
\`\`\`

### Negation

Use \`-\` or \`NOT\` to exclude:

\`\`\`
-sector:finance         # Exclude finance sector
NOT status:inactive     # Exclude inactive
\`\`\`

### Examples

| Query | Description |
|-------|-------------|
| \`actor:lockbit sector:healthcare\` | LockBit attacks on healthcare |
| \`type:ip confidence:high\` | High-confidence IP IOCs |
| \`cvss:>=9 kev:true\` | Critical KEV vulnerabilities |
| \`trend:escalating incidents:>5\` | Escalating actors with 5+ incidents |
    `,
  },
  {
    id: 'ioc-enrichment',
    title: 'IOC Enrichment',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    content: `
## IOC Enrichment Sources

Vigil enriches indicators of compromise with data from multiple sources.

### Shodan InternetDB

**Enriched Data:**
- Open ports
- Known vulnerabilities (CVEs)
- Hostnames
- Service tags (honeypot, cloud, etc.)

**IOC Types:** IP addresses only

### VirusTotal

**Enriched Data:**
- Detection ratio (malicious/total)
- Threat classification
- File type and names
- Country and ASN (for IPs)
- Registrar info (for domains)

**IOC Types:** Hashes (SHA256, MD5), IPs, domains

### Hybrid Analysis

**Enriched Data:**
- Sandbox verdict (malicious/suspicious/clean)
- Threat score (0-100)
- Malware family
- File type
- Behavioral tags

**IOC Types:** Hashes (SHA256, MD5, SHA1)

### Understanding Enrichment Badges

| Badge | Meaning |
|-------|---------|
| \`VT 15/70\` | 15 of 70 VirusTotal engines detected as malicious |
| \`3 CVEs\` | Shodan found 3 known vulnerabilities |
| \`Malicious\` | Hybrid Analysis verdict |
| \`HA 85/100\` | High threat score from Hybrid Analysis |

### Data Freshness

Enrichment data is refreshed:
- **Shodan**: Daily for new IPs
- **VirusTotal**: Daily (rate limited to ~500/day)
- **Hybrid Analysis**: Daily (rate limited to ~200/day)
    `,
  },
  {
    id: 'watchlists',
    title: 'Watchlists',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
    content: `
## Watchlists

Track entities relevant to your organization with personal and shared watchlists.

### Creating Watchlists

1. Navigate to **Watchlists** in the sidebar
2. Click **Create Watchlist**
3. Name your watchlist and add an optional description
4. Start adding entities

### Adding Items

You can add items to watchlists from:
- **Actor profiles**: Click the bookmark icon
- **Vulnerability pages**: Click "Add to Watchlist"
- **IOC search results**: Click the watch button
- **Incident details**: Add actors or IOCs

### Watchlist Types

| Type | Description |
|------|-------------|
| **Actors** | Threat actors and ransomware groups |
| **Vulnerabilities** | CVEs and KEV entries |
| **IOCs** | Hashes, IPs, domains, URLs |
| **Techniques** | MITRE ATT&CK techniques |

### Shared Watchlists (Teams)

With a team, you can:
- Create watchlists visible to all team members
- Collaborate on tracking relevant threats
- Share notes on watchlist items
- See who added each item

### Notifications

Enable notifications to get alerts when:
- A watched actor has new incidents
- A watched vulnerability is added to KEV
- A watched IOC is seen in new contexts
    `,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    content: `
## Integrations

Connect Vigil to your existing security tools and workflows.

### Slack

Send alerts and summaries to Slack channels.

**Setup:**
1. Go to **Settings > Integrations**
2. Click **Connect Slack**
3. Authorize the Vigil app
4. Select channels for different alert types

**Available Notifications:**
- New incidents for watched actors
- KEV updates
- Weekly digest summary

### Microsoft Teams

Similar to Slack, with Teams webhook integration.

**Setup:**
1. Create an Incoming Webhook in your Teams channel
2. Copy the webhook URL
3. Paste in **Settings > Integrations > Teams**

### Jira

Create tickets for incidents and vulnerabilities.

**Setup:**
1. Generate a Jira API token
2. Configure in **Settings > Integrations > Jira**
3. Map Vigil fields to Jira fields

**Supported Actions:**
- Create issue from incident
- Create issue from vulnerability
- Link issues to threat actors

### SIEM Export

Export data in SIEM-compatible formats.

**Supported Formats:**
- **Splunk**: JSON with CIM-compatible fields
- **Elastic**: NDJSON for Elasticsearch
- **Sentinel**: Azure Sentinel format

**Export from:**
- IOC search results
- Threat actor IOCs
- Vulnerability data
    `,
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    content: `
## Keyboard Shortcuts

Navigate Vigil efficiently with keyboard shortcuts.

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| \`/\` or \`Ctrl+K\` | Open search |
| \`Esc\` | Close modal/panel |
| \`?\` | Show keyboard shortcuts |
| \`g then h\` | Go to Dashboard |
| \`g then a\` | Go to Actors |
| \`g then i\` | Go to Incidents |
| \`g then v\` | Go to Vulnerabilities |
| \`g then o\` | Go to IOC Search |

### List Navigation

| Shortcut | Action |
|----------|--------|
| \`j\` or \`↓\` | Next item |
| \`k\` or \`↑\` | Previous item |
| \`Enter\` | Open selected item |
| \`w\` | Add to watchlist |

### Search

| Shortcut | Action |
|----------|--------|
| \`Tab\` | Next search suggestion |
| \`Shift+Tab\` | Previous suggestion |
| \`Enter\` | Execute search |
| \`Ctrl+Enter\` | Search in new tab |

### Detail Panels

| Shortcut | Action |
|----------|--------|
| \`Esc\` | Close panel |
| \`e\` | Expand/collapse sections |
| \`c\` | Copy to clipboard |
| \`n\` | Next tab |
| \`p\` | Previous tab |
    `,
  },
  {
    id: 'data-sources',
    title: 'Data Sources',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
    content: `
## Data Sources

Vigil aggregates data from multiple trusted public threat intelligence feeds.

### Ransomware & Incidents

| Source | Data | Update Frequency |
|--------|------|------------------|
| RansomLook | Ransomware incidents | Every 6 hours |
| Ransomware.live | Leak site monitoring | Every 6 hours |
| HIBP | Data breaches | Weekly |

### Vulnerabilities

| Source | Data | Update Frequency |
|--------|------|------------------|
| CISA KEV | Known Exploited Vulnerabilities | Every 6 hours |
| NVD | CVE database with CVSS | Daily |

### Indicators of Compromise

| Source | Data | Update Frequency |
|--------|------|------------------|
| ThreatFox | Malware IOCs | Every 6 hours |
| URLhaus | Malware distribution URLs | Every 6 hours |
| Feodo Tracker | Botnet C2 servers | Every 6 hours |
| AlienVault OTX | Community threat intel | Daily |
| MalwareBazaar | Malware samples | Daily |
| PhishTank | Verified phishing URLs | Daily |

### Enrichment Sources

| Source | Data | Update Frequency |
|--------|------|------------------|
| Shodan InternetDB | IP ports & vulns | Daily |
| VirusTotal | File/URL reputation | Daily (rate limited) |
| Hybrid Analysis | Sandbox reports | Daily (rate limited) |
| GreyNoise | Internet scanner detection | Daily |

### Threat Intelligence

| Source | Data | Update Frequency |
|--------|------|------------------|
| MITRE ATT&CK | Techniques & tactics | Weekly |
| CISA Alerts | Cybersecurity advisories | Every 6 hours |

### Data Freshness

Look for the sync status indicator in the footer to see when data was last updated. Most feeds are refreshed every 6 hours via automated ingestion.
    `,
  },
  {
    id: 'api',
    title: 'API Access',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    content: `
## API Access

Access Vigil data programmatically with our REST API.

### Authentication

Generate an API key in **Settings > API Keys**.

Include your key in requests:
\`\`\`
Authorization: Bearer vgl_your_api_key_here
\`\`\`

### Endpoints

| Endpoint | Description |
|----------|-------------|
| \`GET /api/actors\` | List threat actors |
| \`GET /api/actors/:id\` | Get actor details |
| \`GET /api/incidents\` | List incidents |
| \`GET /api/vulnerabilities\` | List vulnerabilities |
| \`GET /api/iocs\` | Search IOCs |
| \`GET /api/alerts\` | List CISA alerts |

### Query Parameters

| Parameter | Description |
|-----------|-------------|
| \`limit\` | Results per page (max 100) |
| \`offset\` | Pagination offset |
| \`search\` | Search query |
| \`sort\` | Sort field |
| \`order\` | asc or desc |

### Example Request

\`\`\`bash
curl -H "Authorization: Bearer vgl_xxx" \\
  "https://vigil.theintelligence.company/api/actors?limit=10&sort=incident_velocity"
\`\`\`

### Rate Limits

| Plan | Requests/hour |
|------|---------------|
| Free | 100 |
| Pro | 1,000 |
| Enterprise | Unlimited |

See **API Documentation** in the sidebar for full reference.
    `,
  },
]

function HelpSection({ section, isActive }) {
  if (!isActive) return null

  return (
    <div className="prose prose-invert max-w-none">
      <div
        className="help-content"
        dangerouslySetInnerHTML={{
          __html: formatMarkdown(section.content),
        }}
      />
    </div>
  )
}

function formatMarkdown(md) {
  // Simple markdown to HTML conversion
  return md
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-white mt-8 mb-4">$1</h2>')
    .replace(/^\| (.*) \|$/gim, (match) => {
      const cells = match.split('|').filter(c => c.trim())
      const isHeader = cells.some(c => c.includes('---'))
      if (isHeader) return ''
      return `<tr>${cells.map(c => `<td class="border border-gray-700 px-3 py-2 text-sm">${c.trim()}</td>`).join('')}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table class="w-full border-collapse mb-4">${match}</table>`)
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1.5 py-0.5 rounded text-cyber-accent text-sm font-mono">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 p-4 rounded-lg overflow-x-auto mb-4"><code class="text-sm font-mono text-gray-300">$2</code></pre>')
    .replace(/^- (.*$)/gim, '<li class="text-gray-300 ml-4">$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc mb-4">$&</ul>')
    .replace(/^\d+\. (.*$)/gim, '<li class="text-gray-300 ml-4">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-gray-400 mb-4">')
    .replace(/^(?!<[huptl])/gim, '<p class="text-gray-400 mb-4">')
}

export default function Help() {
  const [activeSection, setActiveSection] = useState('getting-started')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Help Center</h1>
        <p className="text-gray-400 text-sm mt-1">
          Learn how to use Vigil effectively
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="cyber-card sticky top-6 space-y-1">
            {HELP_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-cyber-accent/20 text-cyber-accent'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {section.icon}
                <span className="text-sm font-medium">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="cyber-card">
            {HELP_SECTIONS.map((section) => (
              <HelpSection
                key={section.id}
                section={section}
                isActive={activeSection === section.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="cyber-card">
        <h3 className="text-lg font-semibold text-white mb-4">Need More Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/api-docs"
            className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-8 h-8 text-cyber-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <div>
              <div className="text-white font-medium">API Documentation</div>
              <div className="text-gray-500 text-sm">Full API reference</div>
            </div>
          </a>
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-8 h-8 text-cyber-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <div className="text-white font-medium">Report an Issue</div>
              <div className="text-gray-500 text-sm">GitHub Issues</div>
            </div>
          </a>
          <a
            href="mailto:support@theintelligence.company"
            className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-8 h-8 text-cyber-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div>
              <div className="text-white font-medium">Contact Support</div>
              <div className="text-gray-500 text-sm">Email us directly</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
