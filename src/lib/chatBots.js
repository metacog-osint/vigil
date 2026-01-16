/**
 * Chat Bot Integration Module
 *
 * Handles Slack and Microsoft Teams bot interactions.
 * Supports slash commands, interactive messages, and automated alerts.
 */

import { supabase } from './supabase'

// ============================================
// CONSTANTS
// ============================================

export const PLATFORMS = {
  SLACK: 'slack',
  TEAMS: 'teams',
  DISCORD: 'discord',
}

export const COMMANDS = {
  SEARCH: 'search',
  ACTOR: 'actor',
  IOC: 'ioc',
  CVE: 'cve',
  STATS: 'stats',
  ALERT: 'alert',
  HELP: 'help',
}

// ============================================
// COMMAND HANDLERS
// ============================================

/**
 * Handle /vigil search <query>
 */
export async function handleSearchCommand(query, context = {}) {
  if (!query || query.trim().length < 2) {
    return {
      success: false,
      message: 'Please provide a search query (minimum 2 characters)',
    }
  }

  // Search across multiple tables
  const [actors, iocs, vulns] = await Promise.all([
    supabase
      .from('threat_actors')
      .select('id, name, trend_status, incident_count')
      .or(`name.ilike.%${query}%,aliases.cs.{${query}}`)
      .limit(5),
    supabase
      .from('iocs')
      .select('id, value, type, threat_level, source')
      .ilike('value', `%${query}%`)
      .limit(5),
    supabase
      .from('vulnerabilities')
      .select('id, cve_id, severity, cvss_score, is_kev')
      .ilike('cve_id', `%${query}%`)
      .limit(5),
  ])

  const results = {
    actors: actors.data || [],
    iocs: iocs.data || [],
    vulnerabilities: vulns.data || [],
    totalResults:
      (actors.data?.length || 0) + (iocs.data?.length || 0) + (vulns.data?.length || 0),
  }

  return {
    success: true,
    data: results,
    message: formatSearchResults(results, context.platform),
  }
}

/**
 * Handle /vigil actor <name>
 */
export async function handleActorCommand(actorName, context = {}) {
  if (!actorName) {
    return {
      success: false,
      message: 'Please provide an actor name',
    }
  }

  const { data: actor, error } = await supabase
    .from('threat_actors')
    .select(
      `
      *,
      incidents:incidents(count)
    `
    )
    .or(`name.ilike.%${actorName}%,aliases.cs.{${actorName}}`)
    .single()

  if (error || !actor) {
    return {
      success: false,
      message: `Actor "${actorName}" not found`,
    }
  }

  return {
    success: true,
    data: actor,
    message: formatActorCard(actor, context.platform),
  }
}

/**
 * Handle /vigil ioc <value>
 */
export async function handleIOCCommand(iocValue, context = {}) {
  if (!iocValue) {
    return {
      success: false,
      message: 'Please provide an IOC value',
    }
  }

  const { data: iocs, error } = await supabase
    .from('iocs')
    .select('*')
    .ilike('value', `%${iocValue}%`)
    .limit(5)

  if (error || !iocs || iocs.length === 0) {
    return {
      success: false,
      message: `No IOCs found matching "${iocValue}"`,
    }
  }

  return {
    success: true,
    data: iocs,
    message: formatIOCResults(iocs, context.platform),
  }
}

/**
 * Handle /vigil cve <cve-id>
 */
export async function handleCVECommand(cveId, context = {}) {
  if (!cveId) {
    return {
      success: false,
      message: 'Please provide a CVE ID (e.g., CVE-2024-1234)',
    }
  }

  // Normalize CVE ID
  const normalizedCve = cveId.toUpperCase().replace(/^CVE-?/i, 'CVE-')

  const { data: vuln, error } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('cve_id', normalizedCve)
    .single()

  if (error || !vuln) {
    return {
      success: false,
      message: `CVE "${normalizedCve}" not found`,
    }
  }

  return {
    success: true,
    data: vuln,
    message: formatCVECard(vuln, context.platform),
  }
}

/**
 * Handle /vigil stats
 */
export async function handleStatsCommand(context = {}) {
  const [actors, incidents, iocs, vulns] = await Promise.all([
    supabase.from('threat_actors').select('id', { count: 'exact', head: true }),
    supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .gte('discovered_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('iocs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('vulnerabilities')
      .select('id', { count: 'exact', head: true })
      .eq('is_kev', true),
  ])

  const stats = {
    totalActors: actors.count || 0,
    incidents7d: incidents.count || 0,
    newIOCs7d: iocs.count || 0,
    kevCount: vulns.count || 0,
  }

  return {
    success: true,
    data: stats,
    message: formatStatsCard(stats, context.platform),
  }
}

/**
 * Handle /vigil help
 */
export function handleHelpCommand(context = {}) {
  const helpText = `
*Vigil Bot Commands*

\`/vigil search <query>\` - Search across actors, IOCs, and CVEs
\`/vigil actor <name>\` - Get details about a threat actor
\`/vigil ioc <value>\` - Look up an IOC (IP, domain, hash)
\`/vigil cve <cve-id>\` - Get CVE details
\`/vigil stats\` - Show current threat statistics
\`/vigil help\` - Show this help message

*Examples:*
• \`/vigil search lockbit\`
• \`/vigil actor APT29\`
• \`/vigil ioc 8.8.8.8\`
• \`/vigil cve CVE-2024-1234\`
`.trim()

  return {
    success: true,
    message: helpText,
  }
}

// ============================================
// MAIN COMMAND ROUTER
// ============================================

/**
 * Route incoming bot command
 */
export async function handleCommand(command, args, context = {}) {
  const cmd = command.toLowerCase()
  const argString = Array.isArray(args) ? args.join(' ') : args

  switch (cmd) {
    case COMMANDS.SEARCH:
      return handleSearchCommand(argString, context)
    case COMMANDS.ACTOR:
      return handleActorCommand(argString, context)
    case COMMANDS.IOC:
      return handleIOCCommand(argString, context)
    case COMMANDS.CVE:
      return handleCVECommand(argString, context)
    case COMMANDS.STATS:
      return handleStatsCommand(context)
    case COMMANDS.HELP:
      return handleHelpCommand(context)
    default:
      return {
        success: false,
        message: `Unknown command: ${command}. Use \`/vigil help\` for available commands.`,
      }
  }
}

/**
 * Parse slash command text
 */
export function parseSlashCommand(text) {
  const parts = text.trim().split(/\s+/)
  const command = parts[0] || 'help'
  const args = parts.slice(1)

  return { command, args }
}

// ============================================
// SLACK FORMATTING
// ============================================

export function formatSlackBlocks(data, type) {
  switch (type) {
    case 'actor':
      return formatSlackActorBlocks(data)
    case 'ioc':
      return formatSlackIOCBlocks(data)
    case 'cve':
      return formatSlackCVEBlocks(data)
    case 'stats':
      return formatSlackStatsBlocks(data)
    case 'search':
      return formatSlackSearchBlocks(data)
    default:
      return [{ type: 'section', text: { type: 'mrkdwn', text: JSON.stringify(data) } }]
  }
}

function formatSlackActorBlocks(actor) {
  const statusEmoji =
    actor.trend_status === 'ESCALATING'
      ? ':arrow_up:'
      : actor.trend_status === 'DECLINING'
        ? ':arrow_down:'
        : ':left_right_arrow:'

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Threat Actor: ${actor.name}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Status:* ${statusEmoji} ${actor.trend_status || 'Unknown'}` },
        { type: 'mrkdwn', text: `*Type:* ${actor.actor_type || 'Unknown'}` },
        { type: 'mrkdwn', text: `*Incidents:* ${actor.incident_count || 0}` },
        { type: 'mrkdwn', text: `*Origin:* ${actor.origin_country || 'Unknown'}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: actor.description
          ? actor.description.substring(0, 300) + (actor.description.length > 300 ? '...' : '')
          : 'No description available',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Vigil' },
          url: `https://vigil.theintelligence.company/actors/${actor.id}`,
        },
      ],
    },
  ]
}

function formatSlackIOCBlocks(iocs) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Found ${iocs.length} IOC(s)` },
    },
  ]

  iocs.forEach((ioc) => {
    const levelEmoji =
      ioc.threat_level === 'critical'
        ? ':red_circle:'
        : ioc.threat_level === 'high'
          ? ':orange_circle:'
          : ':yellow_circle:'

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${levelEmoji} \`${ioc.value}\`\n*Type:* ${ioc.type} | *Level:* ${ioc.threat_level || 'Unknown'} | *Source:* ${ioc.source || 'Unknown'}`,
      },
    })
  })

  return blocks
}

function formatSlackCVEBlocks(vuln) {
  const severityEmoji =
    vuln.severity === 'CRITICAL'
      ? ':red_circle:'
      : vuln.severity === 'HIGH'
        ? ':orange_circle:'
        : vuln.severity === 'MEDIUM'
          ? ':yellow_circle:'
          : ':green_circle:'

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: vuln.cve_id },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Severity:* ${severityEmoji} ${vuln.severity}` },
        { type: 'mrkdwn', text: `*CVSS:* ${vuln.cvss_score || 'N/A'}` },
        { type: 'mrkdwn', text: `*KEV:* ${vuln.is_kev ? ':warning: Yes' : 'No'}` },
        { type: 'mrkdwn', text: `*Exploit:* ${vuln.has_public_exploit ? ':warning: Yes' : 'No'}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: vuln.description
          ? vuln.description.substring(0, 500) + (vuln.description.length > 500 ? '...' : '')
          : 'No description available',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Vigil' },
          url: `https://vigil.theintelligence.company/vulnerabilities/${vuln.id}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View on NVD' },
          url: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
        },
      ],
    },
  ]
}

function formatSlackStatsBlocks(stats) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Vigil Threat Intelligence Stats' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Threat Actors:* ${stats.totalActors}` },
        { type: 'mrkdwn', text: `*Incidents (7d):* ${stats.incidents7d}` },
        { type: 'mrkdwn', text: `*New IOCs (7d):* ${stats.newIOCs7d}` },
        { type: 'mrkdwn', text: `*CISA KEV Count:* ${stats.kevCount}` },
      ],
    },
  ]
}

function formatSlackSearchBlocks(results) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Found ${results.totalResults} result(s)` },
    },
  ]

  if (results.actors.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*Threat Actors:*\n' +
          results.actors
            .map((a) => `• ${a.name} (${a.trend_status || 'Unknown'})`)
            .join('\n'),
      },
    })
  }

  if (results.iocs.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*IOCs:*\n' + results.iocs.map((i) => `• \`${i.value}\` (${i.type})`).join('\n'),
      },
    })
  }

  if (results.vulnerabilities.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*Vulnerabilities:*\n' +
          results.vulnerabilities
            .map((v) => `• ${v.cve_id} (${v.severity}${v.is_kev ? ' :warning: KEV' : ''})`)
            .join('\n'),
      },
    })
  }

  return blocks
}

// ============================================
// TEAMS FORMATTING
// ============================================

export function formatTeamsCard(data, type) {
  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [],
    actions: [],
  }

  switch (type) {
    case 'actor':
      return formatTeamsActorCard(data)
    case 'cve':
      return formatTeamsCVECard(data)
    case 'stats':
      return formatTeamsStatsCard(data)
    default:
      card.body.push({
        type: 'TextBlock',
        text: JSON.stringify(data),
        wrap: true,
      })
      return card
  }
}

function formatTeamsActorCard(actor) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: `Threat Actor: ${actor.name}`,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Status', value: actor.trend_status || 'Unknown' },
          { title: 'Type', value: actor.actor_type || 'Unknown' },
          { title: 'Incidents', value: String(actor.incident_count || 0) },
          { title: 'Origin', value: actor.origin_country || 'Unknown' },
        ],
      },
      {
        type: 'TextBlock',
        text: actor.description || 'No description available',
        wrap: true,
        maxLines: 5,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View in Vigil',
        url: `https://vigil.theintelligence.company/actors/${actor.id}`,
      },
    ],
  }
}

function formatTeamsCVECard(vuln) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: vuln.cve_id,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Severity', value: vuln.severity },
          { title: 'CVSS', value: String(vuln.cvss_score || 'N/A') },
          { title: 'In KEV', value: vuln.is_kev ? 'Yes' : 'No' },
          { title: 'Public Exploit', value: vuln.has_public_exploit ? 'Yes' : 'No' },
        ],
      },
      {
        type: 'TextBlock',
        text: vuln.description || 'No description available',
        wrap: true,
        maxLines: 5,
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View in Vigil',
        url: `https://vigil.theintelligence.company/vulnerabilities/${vuln.id}`,
      },
      {
        type: 'Action.OpenUrl',
        title: 'View on NVD',
        url: `https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`,
      },
    ],
  }
}

function formatTeamsStatsCard(stats) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: 'Vigil Threat Intelligence Stats',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Threat Actors', value: String(stats.totalActors) },
          { title: 'Incidents (7d)', value: String(stats.incidents7d) },
          { title: 'New IOCs (7d)', value: String(stats.newIOCs7d) },
          { title: 'CISA KEV Count', value: String(stats.kevCount) },
        ],
      },
    ],
  }
}

// ============================================
// SIMPLE TEXT FORMATTERS
// ============================================

function formatSearchResults(results, platform) {
  if (platform === PLATFORMS.SLACK) {
    return { blocks: formatSlackSearchBlocks(results) }
  }

  let text = `Found ${results.totalResults} result(s)\n\n`

  if (results.actors.length > 0) {
    text += 'Actors:\n' + results.actors.map((a) => `  - ${a.name}`).join('\n') + '\n\n'
  }
  if (results.iocs.length > 0) {
    text += 'IOCs:\n' + results.iocs.map((i) => `  - ${i.value} (${i.type})`).join('\n') + '\n\n'
  }
  if (results.vulnerabilities.length > 0) {
    text +=
      'CVEs:\n' + results.vulnerabilities.map((v) => `  - ${v.cve_id} (${v.severity})`).join('\n')
  }

  return text
}

function formatActorCard(actor, platform) {
  if (platform === PLATFORMS.SLACK) {
    return { blocks: formatSlackActorBlocks(actor) }
  }
  if (platform === PLATFORMS.TEAMS) {
    return formatTeamsActorCard(actor)
  }

  return `Actor: ${actor.name}\nStatus: ${actor.trend_status}\nIncidents: ${actor.incident_count}\n${actor.description || ''}`
}

function formatIOCResults(iocs, platform) {
  if (platform === PLATFORMS.SLACK) {
    return { blocks: formatSlackIOCBlocks(iocs) }
  }

  return iocs.map((i) => `${i.value} (${i.type}) - ${i.threat_level}`).join('\n')
}

function formatCVECard(vuln, platform) {
  if (platform === PLATFORMS.SLACK) {
    return { blocks: formatSlackCVEBlocks(vuln) }
  }
  if (platform === PLATFORMS.TEAMS) {
    return formatTeamsCVECard(vuln)
  }

  return `${vuln.cve_id}\nSeverity: ${vuln.severity}\nCVSS: ${vuln.cvss_score}\nKEV: ${vuln.is_kev ? 'Yes' : 'No'}\n${vuln.description || ''}`
}

function formatStatsCard(stats, platform) {
  if (platform === PLATFORMS.SLACK) {
    return { blocks: formatSlackStatsBlocks(stats) }
  }
  if (platform === PLATFORMS.TEAMS) {
    return formatTeamsStatsCard(stats)
  }

  return `Vigil Stats\nActors: ${stats.totalActors}\nIncidents (7d): ${stats.incidents7d}\nNew IOCs (7d): ${stats.newIOCs7d}\nKEV Count: ${stats.kevCount}`
}

export default {
  handleCommand,
  parseSlashCommand,
  handleSearchCommand,
  handleActorCommand,
  handleIOCCommand,
  handleCVECommand,
  handleStatsCommand,
  handleHelpCommand,
  formatSlackBlocks,
  formatTeamsCard,
  PLATFORMS,
  COMMANDS,
}
