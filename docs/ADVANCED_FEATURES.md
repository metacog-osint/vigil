# Advanced Features Documentation

> **Last Updated:** January 20, 2026
> **Version:** 1.0

This document covers advanced Vigil features that are implemented but not covered in the main `CLAUDE.md` documentation.

---

## Table of Contents

1. [Asset Monitoring](#asset-monitoring)
2. [Custom IOC Lists](#custom-ioc-lists)
3. [Threat Hunts](#threat-hunts)
4. [Investigations](#investigations)
5. [Benchmarking](#benchmarking)
6. [Multi-Tenancy & White-Label](#multi-tenancy--white-label)
7. [Team Collaboration](#team-collaboration)
8. [API Key Management](#api-key-management)
9. [Chat Integrations](#chat-integrations)

---

## Asset Monitoring

**Files:** `src/lib/assets.js`, `src/pages/Assets.jsx`

Attack surface monitoring allows users to track their organizational assets and receive alerts when they appear in threat feeds.

### Asset Types

```javascript
import { ASSET_TYPES, assets } from '../lib/assets'

// Available asset types
ASSET_TYPES.domain       // Domains (example.com)
ASSET_TYPES.ip           // IP Addresses (192.168.1.1)
ASSET_TYPES.ip_range     // IP Ranges (192.168.1.0/24)
ASSET_TYPES.email_domain // Email Domains (company.com)
ASSET_TYPES.keyword      // Brand keywords
ASSET_TYPES.executive    // Executive names
```

### Criticality Levels

- **Critical** - Mission-critical assets
- **High** - Important business assets
- **Medium** - Standard assets
- **Low** - Non-critical assets

### Usage

```javascript
// Get all assets for a user
const userAssets = await assets.getAll(userId, {
  assetType: 'domain',
  criticality: 'critical',
  monitored: true,
  search: 'example'
})

// Create a new asset
await assets.create(userId, {
  value: 'example.com',
  asset_type: 'domain',
  name: 'Main Website',
  criticality: 'critical',
  category: 'infrastructure'
})

// Get matches (alerts) for an asset
const matches = await assets.getMatches(assetId)
```

### Match Types

- **IOC Match** - Asset found in IOC feed
- **Breach** - Asset found in breach data
- **Certificate** - Certificate transparency match
- **Mention** - Asset mentioned in incident

---

## Custom IOC Lists

**Files:** `src/lib/customIocs.js`, `src/pages/CustomIOCs.jsx`

Private IOC collection management for organizational threat intelligence.

### Supported IOC Types

```javascript
import { IOC_TYPES, customIocLists, customIocs } from '../lib/customIocs'

// Available types
IOC_TYPES.ip           // IPv4 addresses
IOC_TYPES.ipv6         // IPv6 addresses
IOC_TYPES.domain       // Domain names
IOC_TYPES.url          // Full URLs
IOC_TYPES.email        // Email addresses
IOC_TYPES.md5          // MD5 hashes
IOC_TYPES.sha1         // SHA1 hashes
IOC_TYPES.sha256       // SHA256 hashes
IOC_TYPES.filename     // File names
IOC_TYPES.filepath     // File paths
IOC_TYPES.registry_key // Windows registry keys
IOC_TYPES.user_agent   // HTTP user agents
IOC_TYPES.asn          // ASN numbers
IOC_TYPES.cidr         // CIDR ranges
IOC_TYPES.bitcoin_address // Bitcoin addresses
IOC_TYPES.cve          // CVE identifiers
```

### Import Formats

- **CSV** - Comma-separated values
- **STIX 2.1** - STIX 2.1 bundle
- **MISP JSON** - MISP event export
- **JSON** - Simple JSON array
- **Plain Text** - One IOC per line

### Usage

```javascript
// Create a new IOC list
const list = await customIocLists.create(userId, {
  name: 'Q1 2026 Campaign IOCs',
  description: 'IOCs from ongoing investigation',
  tags: ['campaign', 'active']
})

// Add IOCs to a list
await customIocs.create(userId, {
  list_id: list.id,
  value: '192.168.1.100',
  ioc_type: 'ip',
  threat_type: 'c2',
  confidence: 'high',
  notes: 'C2 server observed in traffic'
})

// Bulk import
await customIocs.bulkCreate(userId, listId, [
  { value: '8.8.8.8', ioc_type: 'ip' },
  { value: 'evil.com', ioc_type: 'domain' }
])

// Search across all lists
const results = await customIocs.search(userId, '192.168')
```

---

## Threat Hunts

**Files:** `src/pages/ThreatHunts.jsx`, `src/lib/supabase/threatHunts.js`

Guided threat hunting exercises with progress tracking.

### Hunt Structure

Each hunt contains:
- **Title** and description
- **Confidence level** (high/medium/low)
- **Category** (e.g., ransomware, APT, phishing)
- **Checklist** of hunting steps
- **IOC indicators** to search for
- **References** to external sources

### Usage

```javascript
import { threatHunts } from '../lib/supabase'

// Get all active hunts
const { data: hunts } = await threatHunts.getAll({ activeOnly: true })

// Get user's progress on hunts
const { data: progress } = await threatHunts.getUserProgress(userId)

// Update progress on a hunt
await threatHunts.updateProgress(userId, huntId, {
  completed_checks: ['step1', 'step2'],
  notes: 'Found suspicious activity',
  status: 'in_progress'
})
```

### Hunt Filters

- **Confidence**: High, Medium, Low
- **Status**: Not Started, In Progress, Completed
- **Search**: Free-text search

---

## Investigations

**Files:** `src/pages/Investigations.jsx`, `src/lib/supabase/investigations.js`

Case management for security investigations.

### Investigation States

- **Open** - Active investigation
- **In Progress** - Being worked on
- **Pending** - Awaiting action
- **Closed** - Completed

### Usage

```javascript
import { investigations } from '../lib/supabase'

// Create investigation
const inv = await investigations.create(userId, {
  title: 'Ransomware Incident - Jan 2026',
  description: 'Investigating LockBit intrusion',
  severity: 'critical',
  status: 'open'
})

// Add evidence
await investigations.addEvidence(inv.id, {
  type: 'ioc',
  value: '192.168.1.100',
  notes: 'C2 server IP'
})

// Add timeline event
await investigations.addTimelineEvent(inv.id, {
  timestamp: new Date().toISOString(),
  event_type: 'discovery',
  description: 'Initial detection via EDR alert'
})

// Get investigation with all related data
const full = await investigations.getWithDetails(invId)
```

---

## Benchmarking

**Files:** `src/pages/Benchmarks.jsx`, `src/lib/benchmarks.js`, `src/lib/benchmarking.js`

Industry benchmarking and security metrics comparison.

### Metrics Tracked

- Incident counts by sector
- Response times
- Attack vector distribution
- Threat actor activity
- Vulnerability exposure

### Usage

```javascript
import { benchmarks, benchmarking } from '../lib'

// Get sector benchmarks
const { data } = await benchmarks.getSectorBenchmarks('healthcare')

// Generate benchmark report
const report = await benchmarking.generateReport(orgProfile, {
  sectors: ['healthcare'],
  metrics: ['incident_count', 'response_time'],
  period: '30d'
})

// Compare against industry
const comparison = await benchmarking.compareToIndustry(orgMetrics, 'healthcare')
```

---

## Multi-Tenancy & White-Label

**Files:** `src/lib/multitenancy.js`, `api/scim/`

Enterprise multi-tenant and white-label deployment support.

### Tenant Plans

```javascript
import { TENANT_PLANS, tenants } from '../lib/multitenancy'

TENANT_PLANS.STANDARD      // Basic multi-tenant
TENANT_PLANS.PROFESSIONAL  // Professional features
TENANT_PLANS.ENTERPRISE    // Full enterprise
TENANT_PLANS.WHITE_LABEL   // Full white-label
```

### Member Roles

- **Owner** - Full control
- **Admin** - Manage members and settings
- **Member** - Standard access
- **Viewer** - Read-only access

### Usage

```javascript
// Get current tenant
const { data: tenant } = await tenants.getCurrent()

// Create tenant
const newTenant = await tenants.create({
  name: 'Acme Corp',
  slug: 'acme-corp',
  plan: 'enterprise'
})

// Manage branding
await tenants.updateBranding(tenantId, {
  primary_color: '#00ffd5',
  logo_url: 'https://...',
  company_name: 'Acme Security'
})

// Custom domain
await tenants.addDomain(tenantId, 'security.acme.com')
```

### SCIM Provisioning

Enterprise identity management via SCIM 2.0:

```
POST   /api/scim/v2/Users          # Create user
GET    /api/scim/v2/Users/:id      # Get user
PATCH  /api/scim/v2/Users/:id      # Update user
DELETE /api/scim/v2/Users/:id      # Delete user
GET    /api/scim/v2/Groups         # List groups
```

---

## Team Collaboration

**Files:** `src/lib/supabase/teams.js`

Team management and shared resources.

### Usage

```javascript
import { teams } from '../lib/supabase'

// Get user's teams
const userTeams = await teams.getUserTeams(userId)

// Create team
const team = await teams.createTeam(userId, 'SOC Team', 'Security Operations')

// Invite member
await teams.inviteMember(teamId, {
  email: 'analyst@company.com',
  role: 'member'
})

// Shared watchlists
await teams.createSharedWatchlist(teamId, {
  name: 'Priority Actors',
  description: 'Actors targeting our sector'
})
```

### Team Member Roles

- **Owner** - Can delete team, manage all settings
- **Admin** - Can invite/remove members
- **Member** - Can view and contribute
- **Viewer** - Read-only access

---

## API Key Management

**Files:** `src/lib/apiKeys.js`

Programmatic API access with key rotation.

### Usage

```javascript
import { apiKeys } from '../lib/apiKeys'

// Create API key
const key = await apiKeys.create(userId, {
  name: 'CI/CD Pipeline',
  scopes: ['read:incidents', 'read:iocs'],
  expires_in_days: 90
})

// List keys
const keys = await apiKeys.list(userId)

// Rotate key (with grace period)
const { newKey, oldKey } = await apiKeys.rotate(keyId, {
  gracePeriodDays: 7
})

// Check rotation status
const status = await apiKeys.getRotationStatus(keyId)

// Revoke key
await apiKeys.revoke(keyId)
```

### Key Scopes

- `read:incidents` - Read incident data
- `read:iocs` - Read IOC data
- `read:actors` - Read threat actor data
- `read:vulnerabilities` - Read vulnerability data
- `write:assets` - Manage assets
- `write:iocs` - Manage custom IOCs

---

## Chat Integrations

**Files:** `src/lib/chat.js`, `src/lib/chatBots.js`, `src/pages/ChatIntegrations.jsx`

Integration with Slack, Microsoft Teams, and Discord.

### Supported Platforms

- **Slack** - Slash commands and webhooks
- **Microsoft Teams** - Adaptive cards and connectors
- **Discord** - Bot commands and webhooks

### Usage

```javascript
import { chatIntegrations } from '../lib/chat'

// Configure Slack integration
await chatIntegrations.configure('slack', {
  webhook_url: 'https://hooks.slack.com/...',
  channel: '#security-alerts',
  events: ['ransomware', 'kev', 'escalating']
})

// Send test message
await chatIntegrations.sendTest('slack')

// Get integration status
const status = await chatIntegrations.getStatus('slack')
```

### Bot Commands

Available in Slack/Teams/Discord:

- `/vigil hunt <query>` - Search threat data
- `/vigil actor <name>` - Get actor details
- `/vigil cve <id>` - Get vulnerability info
- `/vigil ioc <value>` - Check IOC
- `/vigil summary` - Get threat summary
- `/vigil help` - Show available commands

---

## Database Tables

### Assets Module

```sql
assets (
  id, user_id, value, asset_type, name,
  criticality, category, is_monitored,
  metadata, created_at, updated_at
)

asset_matches (
  id, asset_id, match_type, source,
  matched_value, confidence, details,
  status, discovered_at, resolved_at
)
```

### Custom IOCs Module

```sql
custom_ioc_lists (
  id, user_id, name, description,
  tags, is_public, created_at, updated_at
)

custom_iocs (
  id, list_id, value, ioc_type,
  threat_type, confidence, notes,
  first_seen, last_seen, status
)
```

### Multi-Tenancy Module

```sql
tenants (
  id, name, slug, plan, status,
  settings, branding, custom_domain,
  owner_id, created_at
)

tenant_members (
  tenant_id, user_id, email, role,
  status, invited_by, joined_at
)

tenant_domains (
  id, tenant_id, domain, status,
  verification_token, verified_at
)
```

### Teams Module

```sql
teams (
  id, name, slug, description,
  owner_id, settings, created_at
)

team_members (
  team_id, user_id, email, role,
  joined_at, invited_by
)

team_watchlists (
  id, team_id, name, description,
  entity_type, entity_ids
)
```

---

## Route Reference

| Route | Component | Feature |
|-------|-----------|---------|
| `/assets` | Assets.jsx | Asset Monitoring |
| `/custom-iocs` | CustomIOCs.jsx | Custom IOC Lists |
| `/threat-hunts` | ThreatHunts.jsx | Threat Hunting |
| `/investigations` | Investigations.jsx | Case Management |
| `/benchmarks` | Benchmarks.jsx | Industry Benchmarks |
| `/settings/team` | TeamSettings.jsx | Team Management |
| `/settings/integrations` | ChatIntegrations.jsx | Chat Setup |
| `/settings/api-keys` | ApiKeys.jsx | API Key Management |

---

## Feature Flags

Some features require specific subscription tiers:

| Feature | Required Tier |
|---------|---------------|
| Asset Monitoring | Professional |
| Custom IOC Lists | Professional |
| Threat Hunts | Free (limited) |
| Investigations | Professional |
| Benchmarking | Professional |
| Multi-Tenancy | Enterprise |
| SCIM Provisioning | Enterprise |
| White-Label | Enterprise |
| API Access | Professional |
| Chat Integrations | Professional |

Check feature access:

```javascript
import { useSubscription } from '../contexts/SubscriptionContext'

const { canAccess } = useSubscription()

if (canAccess('asset_monitoring')) {
  // Show asset monitoring UI
}
```
