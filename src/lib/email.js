/**
 * Email Service using Resend
 * Handles transactional emails and alert notifications
 */

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || ''
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'alerts@vigil.theintelligence.company'
const FROM_NAME = 'Vigil Alerts'

/**
 * Send an email via Resend API
 * Note: In production, this should be called from an edge function for security
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_API_KEY) {
    console.warn('Resend API key not configured')
    return { success: false, error: 'Email not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Generate HTML for ransomware alert email
 */
export function generateRansomwareAlertEmail(data) {
  const { victim_name, threat_actor, sector, country, discovered_date, source } = data

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ransomware Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .alert-badge { display: inline-block; background: #dc2626; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .victim-name { font-size: 24px; font-weight: 700; color: white; margin: 0 0 8px 0; }
    .actor-name { color: #00ff9d; font-weight: 600; }
    .details { background: #1a1a1a; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a2a; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #888; font-size: 14px; }
    .detail-value { color: #e5e5e5; font-size: 14px; font-weight: 500; }
    .cta { display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #0a0a0a; text-align: center; font-size: 12px; color: #666; }
    .footer a { color: #00ff9d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Ransomware Incident Alert</h1>
    </div>
    <div class="content">
      <span class="alert-badge">NEW VICTIM CLAIM</span>
      <h2 class="victim-name">${escapeHtml(victim_name)}</h2>
      <p style="color: #888; margin: 0;">
        Claimed by <span class="actor-name">${escapeHtml(threat_actor || 'Unknown Actor')}</span>
      </p>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Sector</span>
          <span class="detail-value">${escapeHtml(sector || 'Unknown')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Country</span>
          <span class="detail-value">${escapeHtml(country || 'Unknown')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Discovered</span>
          <span class="detail-value">${formatDate(discovered_date)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Source</span>
          <span class="detail-value">${escapeHtml(source || 'Leak Site')}</span>
        </div>
      </div>

      <a href="https://vigil.theintelligence.company/ransomware" class="cta">
        View in Vigil
      </a>
    </div>
    <div class="footer">
      <p>You received this alert based on your notification preferences.</p>
      <p><a href="https://vigil.theintelligence.company/settings">Manage alert settings</a></p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
RANSOMWARE ALERT: New Victim Claim

Victim: ${victim_name}
Threat Actor: ${threat_actor || 'Unknown'}
Sector: ${sector || 'Unknown'}
Country: ${country || 'Unknown'}
Discovered: ${formatDate(discovered_date)}
Source: ${source || 'Leak Site'}

View details: https://vigil.theintelligence.company/ransomware

---
Vigil - Cyber Threat Intelligence
Manage alerts: https://vigil.theintelligence.company/settings
  `

  return { html, text, subject: `Ransomware Alert: ${victim_name} claimed by ${threat_actor || 'unknown actor'}` }
}

/**
 * Generate HTML for KEV alert email
 */
export function generateKEVAlertEmail(data) {
  const { cve_id, title, vendor, product, cvss_score, kev_date } = data

  const severityColor = cvss_score >= 9 ? '#dc2626' : cvss_score >= 7 ? '#f97316' : '#eab308'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KEV Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #f97316 0%, #c2410c 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .alert-badge { display: inline-block; background: #f97316; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .cve-id { font-size: 24px; font-weight: 700; color: #f97316; margin: 0 0 8px 0; }
    .cvss { display: inline-block; background: ${severityColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; font-weight: 600; }
    .title { color: #e5e5e5; font-size: 16px; margin: 12px 0; }
    .details { background: #1a1a1a; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a2a; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #888; font-size: 14px; }
    .detail-value { color: #e5e5e5; font-size: 14px; font-weight: 500; }
    .warning { background: #7f1d1d; border: 1px solid #dc2626; border-radius: 6px; padding: 12px; margin: 16px 0; }
    .warning-text { color: #fca5a5; font-size: 14px; margin: 0; }
    .cta { display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #0a0a0a; text-align: center; font-size: 12px; color: #666; }
    .footer a { color: #00ff9d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CISA KEV Alert</h1>
    </div>
    <div class="content">
      <span class="alert-badge">ACTIVELY EXPLOITED</span>
      <h2 class="cve-id">${escapeHtml(cve_id)}</h2>
      <span class="cvss">CVSS ${cvss_score || 'N/A'}</span>
      <p class="title">${escapeHtml(title || 'No description available')}</p>

      <div class="warning">
        <p class="warning-text">
          <strong>This vulnerability is being actively exploited in the wild.</strong>
          CISA requires federal agencies to patch within 2-3 weeks.
        </p>
      </div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Vendor</span>
          <span class="detail-value">${escapeHtml(vendor || 'Unknown')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Product</span>
          <span class="detail-value">${escapeHtml(product || 'Unknown')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Added to KEV</span>
          <span class="detail-value">${formatDate(kev_date)}</span>
        </div>
      </div>

      <a href="https://vigil.theintelligence.company/vulnerabilities?kev=true" class="cta">
        View in Vigil
      </a>
    </div>
    <div class="footer">
      <p>You received this alert based on your notification preferences.</p>
      <p><a href="https://vigil.theintelligence.company/settings">Manage alert settings</a></p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
CISA KEV ALERT: Actively Exploited Vulnerability

${cve_id}
CVSS Score: ${cvss_score || 'N/A'}

${title || 'No description available'}

WARNING: This vulnerability is being actively exploited in the wild.

Vendor: ${vendor || 'Unknown'}
Product: ${product || 'Unknown'}
Added to KEV: ${formatDate(kev_date)}

View details: https://vigil.theintelligence.company/vulnerabilities?kev=true

---
Vigil - Cyber Threat Intelligence
Manage alerts: https://vigil.theintelligence.company/settings
  `

  return { html, text, subject: `KEV Alert: ${cve_id} - ${vendor || 'Unknown'} ${product || ''}` }
}

/**
 * Generate HTML for CISA alert email
 */
export function generateCISAAlertEmail(data) {
  const { alert_id, title, severity, published_date, url } = data

  const severityColor = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    info: '#3b82f6'
  }[severity?.toLowerCase()] || '#6b7280'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CISA Alert</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .alert-badge { display: inline-block; background: ${severityColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; text-transform: uppercase; }
    .alert-id { font-size: 14px; color: #888; margin: 0 0 8px 0; }
    .title { font-size: 20px; font-weight: 700; color: white; margin: 0 0 16px 0; }
    .details { background: #1a1a1a; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a2a; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #888; font-size: 14px; }
    .detail-value { color: #e5e5e5; font-size: 14px; font-weight: 500; }
    .cta { display: inline-block; background: #00ff9d; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; margin-right: 12px; }
    .cta-secondary { display: inline-block; background: #333; color: #e5e5e5; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #0a0a0a; text-align: center; font-size: 12px; color: #666; }
    .footer a { color: #00ff9d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CISA Security Alert</h1>
    </div>
    <div class="content">
      <span class="alert-badge">${escapeHtml(severity || 'INFO')}</span>
      <p class="alert-id">${escapeHtml(alert_id || '')}</p>
      <h2 class="title">${escapeHtml(title)}</h2>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Published</span>
          <span class="detail-value">${formatDate(published_date)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Severity</span>
          <span class="detail-value">${escapeHtml(severity || 'Not specified')}</span>
        </div>
      </div>

      <a href="https://vigil.theintelligence.company/alerts" class="cta">
        View in Vigil
      </a>
      ${url ? `<a href="${escapeHtml(url)}" class="cta-secondary">Read Full Alert</a>` : ''}
    </div>
    <div class="footer">
      <p>You received this alert based on your notification preferences.</p>
      <p><a href="https://vigil.theintelligence.company/settings">Manage alert settings</a></p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
CISA SECURITY ALERT

${alert_id || ''}
Severity: ${severity || 'Not specified'}

${title}

Published: ${formatDate(published_date)}

View in Vigil: https://vigil.theintelligence.company/alerts
${url ? `Full Alert: ${url}` : ''}

---
Vigil - Cyber Threat Intelligence
Manage alerts: https://vigil.theintelligence.company/settings
  `

  return { html, text, subject: `CISA Alert: ${title}` }
}

// Utility functions
function escapeHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

export default {
  sendEmail,
  generateRansomwareAlertEmail,
  generateKEVAlertEmail,
  generateCISAAlertEmail
}
