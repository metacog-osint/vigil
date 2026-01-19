/**
 * Email Service
 * Handles transactional emails and alert notifications
 * Uses server-side API endpoint to protect Resend API key
 */

import { supabase } from './supabase/client'
import { logger } from './logger'

/**
 * Send an email via backend API endpoint
 * The API endpoint securely handles Resend API calls server-side
 */
export async function sendEmail({ to, subject, html, text }) {
  try {
    // Get Supabase session token for authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      logger.warn('sendEmail: No authenticated user')
      return { success: false, error: 'Not authenticated' }
    }

    const token = session.access_token

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, html, text })
    })

    const data = await response.json()

    if (!response.ok) {
      logger.error('Email send failed:', data.error)
      return { success: false, error: data.error || 'Failed to send email' }
    }

    return { success: true, id: data.id }
  } catch (error) {
    logger.error('Email send error:', error)
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

/**
 * Generate HTML for payment failure email
 */
export function generatePaymentFailureEmail(data) {
  const { user_name, tier, amount, currency, retry_date, update_payment_url } = data

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .alert-badge { display: inline-block; background: #f59e0b; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .message { font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
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
      <h1>Payment Failed</h1>
    </div>
    <div class="content">
      <span class="alert-badge">ACTION REQUIRED</span>
      <p class="message">
        Hi${user_name ? ` ${escapeHtml(user_name)}` : ''},<br><br>
        We were unable to process your payment for your Vigil ${escapeHtml(tier || 'Professional')} subscription.
      </p>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Plan</span>
          <span class="detail-value">${escapeHtml(tier || 'Professional')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount</span>
          <span class="detail-value">${currency || '$'}${amount || '29'}</span>
        </div>
        ${retry_date ? `
        <div class="detail-row">
          <span class="detail-label">Next Retry</span>
          <span class="detail-value">${formatDate(retry_date)}</span>
        </div>
        ` : ''}
      </div>

      <div class="warning">
        <p class="warning-text">
          <strong>Your subscription is at risk.</strong>
          Please update your payment method to avoid service interruption.
        </p>
      </div>

      <a href="${escapeHtml(update_payment_url || 'https://vigil.theintelligence.company/settings')}" class="cta">
        Update Payment Method
      </a>
    </div>
    <div class="footer">
      <p>If you believe this is an error, please contact support.</p>
      <p><a href="https://vigil.theintelligence.company/settings">Manage subscription</a></p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
PAYMENT FAILED - Action Required

Hi${user_name ? ` ${user_name}` : ''},

We were unable to process your payment for your Vigil ${tier || 'Professional'} subscription.

Plan: ${tier || 'Professional'}
Amount: ${currency || '$'}${amount || '29'}
${retry_date ? `Next Retry: ${formatDate(retry_date)}` : ''}

Your subscription is at risk. Please update your payment method to avoid service interruption.

Update Payment Method: ${update_payment_url || 'https://vigil.theintelligence.company/settings'}

---
Vigil - Cyber Threat Intelligence
  `

  return { html, text, subject: `Action Required: Payment failed for your Vigil subscription` }
}

/**
 * Generate HTML for dunning email (payment reminder)
 */
export function generateDunningEmail(data) {
  const { user_name, tier, days_overdue, grace_period_end, update_payment_url, attempt_number } = data

  const urgencyLevel = days_overdue > 7 ? 'critical' : days_overdue > 3 ? 'high' : 'medium'
  const urgencyColor = urgencyLevel === 'critical' ? '#dc2626' : urgencyLevel === 'high' ? '#f97316' : '#f59e0b'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Payment Reminder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}cc 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .alert-badge { display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 16px; text-transform: uppercase; }
    .message { font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
    .countdown { background: #1a1a1a; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center; }
    .countdown-number { font-size: 48px; font-weight: 700; color: ${urgencyColor}; }
    .countdown-label { font-size: 14px; color: #888; }
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
      <h1>Payment Reminder</h1>
    </div>
    <div class="content">
      <span class="alert-badge">${urgencyLevel === 'critical' ? 'FINAL NOTICE' : urgencyLevel === 'high' ? 'URGENT' : 'REMINDER'}</span>
      <p class="message">
        Hi${user_name ? ` ${escapeHtml(user_name)}` : ''},<br><br>
        Your Vigil ${escapeHtml(tier || 'Professional')} subscription payment is overdue.
        ${attempt_number ? `We've attempted to charge your card ${attempt_number} time${attempt_number > 1 ? 's' : ''} without success.` : ''}
      </p>

      ${grace_period_end ? `
      <div class="countdown">
        <div class="countdown-number">${Math.max(0, Math.ceil((new Date(grace_period_end) - new Date()) / (1000 * 60 * 60 * 24)))}</div>
        <div class="countdown-label">days until service suspension</div>
      </div>
      ` : ''}

      <div class="warning">
        <p class="warning-text">
          ${urgencyLevel === 'critical'
            ? '<strong>FINAL NOTICE:</strong> Your access will be suspended if payment is not received within 24 hours.'
            : urgencyLevel === 'high'
            ? '<strong>Important:</strong> Please update your payment method immediately to avoid losing access.'
            : '<strong>Reminder:</strong> Please update your payment method to continue enjoying Vigil.'}
        </p>
      </div>

      <a href="${escapeHtml(update_payment_url || 'https://vigil.theintelligence.company/settings')}" class="cta">
        Update Payment Method Now
      </a>
    </div>
    <div class="footer">
      <p>Questions? Reply to this email or contact support.</p>
      <p><a href="https://vigil.theintelligence.company/settings">Manage subscription</a></p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
PAYMENT REMINDER - ${urgencyLevel === 'critical' ? 'FINAL NOTICE' : urgencyLevel === 'high' ? 'URGENT' : 'Action Required'}

Hi${user_name ? ` ${user_name}` : ''},

Your Vigil ${tier || 'Professional'} subscription payment is overdue.
${attempt_number ? `We've attempted to charge your card ${attempt_number} time${attempt_number > 1 ? 's' : ''} without success.` : ''}

${grace_period_end ? `Days until service suspension: ${Math.max(0, Math.ceil((new Date(grace_period_end) - new Date()) / (1000 * 60 * 60 * 24)))}` : ''}

${urgencyLevel === 'critical'
  ? 'FINAL NOTICE: Your access will be suspended if payment is not received within 24 hours.'
  : 'Please update your payment method to continue enjoying Vigil.'}

Update Payment Method: ${update_payment_url || 'https://vigil.theintelligence.company/settings'}

---
Vigil - Cyber Threat Intelligence
  `

  const subject = urgencyLevel === 'critical'
    ? `FINAL NOTICE: Your Vigil subscription will be suspended`
    : urgencyLevel === 'high'
    ? `Urgent: Your Vigil payment is overdue`
    : `Reminder: Update your Vigil payment method`

  return { html, text, subject }
}

/**
 * Generate HTML for subscription canceled email
 */
export function generateSubscriptionCanceledEmail(data) {
  const { user_name, tier, end_date, reactivate_url } = data

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Canceled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 20px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 20px; }
    .content { padding: 24px; }
    .message { font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
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
      <h1>Subscription Canceled</h1>
    </div>
    <div class="content">
      <p class="message">
        Hi${user_name ? ` ${escapeHtml(user_name)}` : ''},<br><br>
        Your Vigil ${escapeHtml(tier || 'Professional')} subscription has been canceled due to non-payment.
        You've been moved to the Free plan with limited features.
      </p>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Previous Plan</span>
          <span class="detail-value">${escapeHtml(tier || 'Professional')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Current Plan</span>
          <span class="detail-value">Free</span>
        </div>
        ${end_date ? `
        <div class="detail-row">
          <span class="detail-label">Canceled On</span>
          <span class="detail-value">${formatDate(end_date)}</span>
        </div>
        ` : ''}
      </div>

      <p class="message">
        We'd love to have you back! Reactivate your subscription anytime to regain access to all features.
      </p>

      <a href="${escapeHtml(reactivate_url || 'https://vigil.theintelligence.company/settings')}" class="cta">
        Reactivate Subscription
      </a>
    </div>
    <div class="footer">
      <p>Thank you for being a Vigil customer.</p>
      <p><a href="https://vigil.theintelligence.company">Visit Vigil</a></p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
SUBSCRIPTION CANCELED

Hi${user_name ? ` ${user_name}` : ''},

Your Vigil ${tier || 'Professional'} subscription has been canceled due to non-payment.
You've been moved to the Free plan with limited features.

Previous Plan: ${tier || 'Professional'}
Current Plan: Free
${end_date ? `Canceled On: ${formatDate(end_date)}` : ''}

We'd love to have you back! Reactivate your subscription anytime to regain access to all features.

Reactivate: ${reactivate_url || 'https://vigil.theintelligence.company/settings'}

---
Vigil - Cyber Threat Intelligence
  `

  return { html, text, subject: `Your Vigil subscription has been canceled` }
}

export default {
  sendEmail,
  generateRansomwareAlertEmail,
  generateKEVAlertEmail,
  generateCISAAlertEmail,
  generatePaymentFailureEmail,
  generateDunningEmail,
  generateSubscriptionCanceledEmail
}
