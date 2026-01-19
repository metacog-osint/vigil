/**
 * Digest Email Templates
 *
 * HTML and text templates for digest emails.
 */

const BASE_URL = 'https://vigil.theintelligence.company'

/**
 * Generate HTML email for digest
 * @param {Object} digest - Digest content from generateDigest
 * @returns {Object} { html, text, subject }
 */
export function generateDigestEmail(digest) {
  const isDaily = digest.type === 'daily'
  const periodLabel = isDaily ? 'Today' : 'This Week'

  const subject = `${digest.profile?.sector ? '🎯 ' : ''}Vigil ${isDaily ? 'Daily' : 'Weekly'} Digest - ${digest.summary.totalIncidents} incidents, ${digest.summary.escalatingActors} escalating actors`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #1e293b;
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: white;
      font-size: 24px;
    }
    .header p {
      margin: 8px 0 0;
      color: rgba(255,255,255,0.8);
      font-size: 14px;
    }
    .content {
      padding: 24px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #06b6d4;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .stat-card {
      background-color: #334155;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: white;
    }
    .stat-label {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .stat-change {
      font-size: 12px;
      margin-top: 4px;
    }
    .stat-change.up { color: #f87171; }
    .stat-change.down { color: #4ade80; }
    .relevant-box {
      background-color: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 8px;
      padding: 16px;
    }
    .relevant-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #334155;
    }
    .relevant-item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-weight: 500;
      color: white;
    }
    .item-meta {
      font-size: 12px;
      color: #94a3b8;
    }
    .list-item {
      padding: 12px;
      background-color: #334155;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .list-item-title {
      font-weight: 500;
      color: white;
      margin-bottom: 4px;
    }
    .list-item-meta {
      font-size: 12px;
      color: #94a3b8;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge-escalating { background-color: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-kev { background-color: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-critical { background-color: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-high { background-color: rgba(249, 115, 22, 0.2); color: #fb923c; }
    .badge-medium { background-color: rgba(234, 179, 8, 0.2); color: #facc15; }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      margin-top: 16px;
    }
    .footer {
      text-align: center;
      padding: 24px;
      background-color: #0f172a;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #06b6d4;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Vigil ${isDaily ? 'Daily' : 'Weekly'} Digest</h1>
      <p>${digest.profile ? `${digest.profile.sector} | ${digest.profile.region || digest.profile.country}` : 'Threat Intelligence Summary'} | ${formatDateRange(digest.period)}</p>
    </div>

    <div class="content">
      <!-- Summary Stats -->
      <div class="section">
        <div class="section-title">📊 ${periodLabel} at a Glance</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${digest.summary.totalIncidents}</div>
            <div class="stat-label">Incidents</div>
            ${digest.summary.incidentChange !== 0 ? `
              <div class="stat-change ${digest.summary.incidentChange > 0 ? 'up' : 'down'}">
                ${digest.summary.incidentChange > 0 ? '↑' : '↓'} ${Math.abs(digest.summary.incidentChange)}%
              </div>
            ` : ''}
          </div>
          <div class="stat-card">
            <div class="stat-value">${digest.summary.escalatingActors}</div>
            <div class="stat-label">Escalating Actors</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${digest.summary.newKEVs}</div>
            <div class="stat-label">New KEVs</div>
          </div>
        </div>
      </div>

      ${digest.relevantToYou ? `
      <!-- Relevant to You -->
      <div class="section">
        <div class="section-title">🎯 Relevant to You</div>
        <div class="relevant-box">
          ${digest.relevantToYou.actors.map(actor => `
            <div class="relevant-item">
              <div>
                <div class="item-name">${actor.name}</div>
                <div class="item-meta">${actor.incidentCount} incidents | ${actor.reason}</div>
              </div>
            </div>
          `).join('')}
          ${digest.relevantToYou.vulnerabilities.map(vuln => `
            <div class="relevant-item">
              <div>
                <div class="item-name">${vuln.name}</div>
                <div class="item-meta">${vuln.reason}</div>
              </div>
              <span class="badge badge-${vuln.severity?.toLowerCase() || 'medium'}">${vuln.severity || 'Unknown'}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Top Actors -->
      <div class="section">
        <div class="section-title">👤 Top Threat Actors</div>
        ${digest.topActors.map(actor => `
          <div class="list-item">
            <div class="list-item-title">
              ${actor.name}
              ${actor.trendStatus === 'ESCALATING' ? '<span class="badge badge-escalating">ESCALATING</span>' : ''}
            </div>
            <div class="list-item-meta">${actor.incidentCount} incidents this period</div>
          </div>
        `).join('')}
      </div>

      <!-- Top Incidents -->
      <div class="section">
        <div class="section-title">🔥 Recent Incidents</div>
        ${digest.topIncidents.map(inc => `
          <div class="list-item">
            <div class="list-item-title">${inc.victimName}</div>
            <div class="list-item-meta">${inc.actorName} | ${inc.sector || 'Unknown sector'} | ${formatDate(inc.date)}</div>
          </div>
        `).join('')}
      </div>

      <!-- New Vulnerabilities -->
      ${digest.newVulnerabilities.length > 0 ? `
      <div class="section">
        <div class="section-title">🔓 New Vulnerabilities</div>
        ${digest.newVulnerabilities.map(vuln => `
          <div class="list-item">
            <div class="list-item-title">
              ${vuln.name}
              ${vuln.isKEV ? '<span class="badge badge-kev">KEV</span>' : ''}
              <span class="badge badge-${vuln.severity?.toLowerCase() || 'medium'}">${vuln.severity || 'Unknown'}</span>
            </div>
            <div class="list-item-meta">${vuln.description || 'No description available'}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="${BASE_URL}" class="cta-button">View Full Dashboard →</a>
      </div>
    </div>

    <div class="footer">
      <p>You're receiving this because you subscribed to ${isDaily ? 'daily' : 'weekly'} digests.</p>
      <p><a href="${BASE_URL}/settings">Manage preferences</a> | <a href="${BASE_URL}">Open Vigil</a></p>
      <p style="margin-top: 12px;">© ${new Date().getFullYear()} The Intelligence Company</p>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = generateTextVersion(digest)

  return { html, text, subject }
}

/**
 * Generate plain text version of digest
 */
function generateTextVersion(digest) {
  const isDaily = digest.type === 'daily'
  const periodLabel = isDaily ? 'Today' : 'This Week'

  let text = `
VIGIL ${isDaily ? 'DAILY' : 'WEEKLY'} DIGEST
${digest.profile ? `${digest.profile.sector} | ${digest.profile.region || digest.profile.country}` : 'Threat Intelligence Summary'}
${formatDateRange(digest.period)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 ${periodLabel.toUpperCase()} AT A GLANCE

• ${digest.summary.totalIncidents} incidents ${digest.summary.incidentChange !== 0 ? `(${digest.summary.incidentChange > 0 ? '+' : ''}${digest.summary.incidentChange}%)` : ''}
• ${digest.summary.escalatingActors} escalating actors
• ${digest.summary.newKEVs} new KEVs

`

  if (digest.relevantToYou) {
    text += `
🎯 RELEVANT TO YOU

`
    digest.relevantToYou.actors.forEach(actor => {
      text += `• ${actor.name} - ${actor.incidentCount} incidents (${actor.reason})\n`
    })
    digest.relevantToYou.vulnerabilities.forEach(vuln => {
      text += `• ${vuln.name} [${vuln.severity}] - ${vuln.reason}\n`
    })
  }

  text += `
👤 TOP THREAT ACTORS

`
  digest.topActors.forEach(actor => {
    text += `• ${actor.name} - ${actor.incidentCount} incidents${actor.trendStatus === 'ESCALATING' ? ' [ESCALATING]' : ''}\n`
  })

  text += `
🔥 RECENT INCIDENTS

`
  digest.topIncidents.forEach(inc => {
    text += `• ${inc.victimName} - ${inc.actorName} (${formatDate(inc.date)})\n`
  })

  if (digest.newVulnerabilities.length > 0) {
    text += `
🔓 NEW VULNERABILITIES

`
    digest.newVulnerabilities.forEach(vuln => {
      text += `• ${vuln.name} [${vuln.severity}]${vuln.isKEV ? ' [KEV]' : ''}\n`
    })
  }

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View full dashboard: ${BASE_URL}
Manage preferences: ${BASE_URL}/settings

© ${new Date().getFullYear()} The Intelligence Company
`

  return text.trim()
}

/**
 * Format date range for display
 */
function formatDateRange(period) {
  const start = new Date(period.start)
  const end = new Date(period.end)
  const options = { month: 'short', day: 'numeric' }

  if (period.days === 1) {
    return end.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  }

  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
}

/**
 * Format single date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default {
  generateDigestEmail,
}
