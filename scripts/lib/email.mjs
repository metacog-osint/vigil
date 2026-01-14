// Email utility module using Resend
// Handles all transactional email sending for Vigil
import { Resend } from 'resend'

// Lazy-initialize Resend client (only when needed)
let resend = null
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const FROM_EMAIL = 'Vigil <alerts@vigil.theintelligence.company>'
const REPLY_TO = 'support@theintelligence.company'

/**
 * Send an email using Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (optional)
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - email not sent')
    return { success: false, error: 'API key not configured' }
  }

  try {
    const response = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text: text || stripHtml(html),
      reply_to: REPLY_TO,
    })

    console.log(`Email sent to ${to}: ${subject}`)
    return { success: true, data: response }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send a batch of emails
 * @param {Array<Object>} emails - Array of email objects
 * @returns {Promise<Array>} - Results for each email
 */
export async function sendBatchEmails(emails) {
  const results = []
  for (const email of emails) {
    const result = await sendEmail(email)
    results.push(result)
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return results
}

/**
 * Strip HTML tags for plain text fallback
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate daily digest email HTML
 */
export function generateDigestHtml({
  userName,
  date,
  criticalItems = [],
  highItems = [],
  watchlistUpdates = [],
  stats = {},
  profileSector = null,
}) {
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const criticalSection = criticalItems.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #ef4444; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">
        🚨 CRITICAL (${criticalItems.length} items${profileSector ? ` matching ${profileSector}` : ''})
      </h2>
      ${criticalItems.map(item => `
        <div style="background: #1f1f23; border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
          <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">${item.title}</div>
          <div style="color: #9ca3af; font-size: 13px;">${item.description}</div>
          ${item.actors ? `<div style="color: #f87171; font-size: 12px; margin-top: 4px;">Used by: ${item.actors.join(', ')}</div>` : ''}
        </div>
      `).join('')}
    </div>
  ` : ''

  const highSection = highItems.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #f97316; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">
        ⚠️ HIGH PRIORITY (${highItems.length} items)
      </h2>
      ${highItems.slice(0, 5).map(item => `
        <div style="background: #1f1f23; border-left: 3px solid #f97316; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
          <div style="font-weight: 600; color: #ffffff; margin-bottom: 4px;">${item.title}</div>
          <div style="color: #9ca3af; font-size: 13px;">${item.description}</div>
        </div>
      `).join('')}
      ${highItems.length > 5 ? `<div style="color: #6b7280; font-size: 12px;">+ ${highItems.length - 5} more items</div>` : ''}
    </div>
  ` : ''

  const watchlistSection = watchlistUpdates.length > 0 ? `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #06b6d4; font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">
        👁️ WATCHLIST UPDATES (${watchlistUpdates.length} items)
      </h2>
      ${watchlistUpdates.map(item => `
        <div style="background: #1f1f23; border-left: 3px solid #06b6d4; padding: 12px; margin-bottom: 8px; border-radius: 4px;">
          <div style="color: #ffffff;">${item.title}</div>
          <div style="color: #9ca3af; font-size: 13px;">${item.change}</div>
        </div>
      `).join('')}
    </div>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vigil Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f0f13 100%); border: 1px solid #374151; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <div style="background: #06b6d4; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
          <span style="color: #000; font-size: 20px; font-weight: bold;">V</span>
        </div>
        <div>
          <div style="color: #ffffff; font-size: 20px; font-weight: 700;">Vigil Daily Digest</div>
          <div style="color: #6b7280; font-size: 13px;">${formatDate(date)}</div>
        </div>
      </div>
      ${userName ? `<div style="color: #9ca3af; font-size: 14px;">Good morning, ${userName}</div>` : ''}
    </div>

    <!-- Stats Summary -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #1f1f23; border: 1px solid #374151; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="color: #ef4444; font-size: 24px; font-weight: 700;">${stats.incidents || 0}</div>
        <div style="color: #6b7280; font-size: 12px;">New Incidents</div>
      </div>
      <div style="flex: 1; background: #1f1f23; border: 1px solid #374151; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="color: #f97316; font-size: 24px; font-weight: 700;">${stats.kevs || 0}</div>
        <div style="color: #6b7280; font-size: 12px;">New KEVs</div>
      </div>
      <div style="flex: 1; background: #1f1f23; border: 1px solid #374151; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="color: #a855f7; font-size: 24px; font-weight: 700;">${stats.escalating || 0}</div>
        <div style="color: #6b7280; font-size: 12px;">Escalating</div>
      </div>
    </div>

    <!-- Content Sections -->
    ${criticalSection}
    ${highSection}
    ${watchlistSection}

    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://vigil.theintelligence.company" style="display: inline-block; background: #06b6d4; color: #000000; font-weight: 600; padding: 12px 32px; border-radius: 6px; text-decoration: none;">
        View Full Dashboard
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #374151; padding-top: 24px; text-align: center;">
      <div style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">
        You're receiving this because you subscribed to Vigil threat intelligence digests.
      </div>
      <div style="color: #6b7280; font-size: 12px;">
        <a href="https://vigil.theintelligence.company/settings" style="color: #06b6d4; text-decoration: none;">Manage preferences</a>
        &nbsp;•&nbsp;
        <a href="https://vigil.theintelligence.company/settings" style="color: #06b6d4; text-decoration: none;">Unsubscribe</a>
      </div>
      <div style="color: #4b5563; font-size: 11px; margin-top: 16px;">
        © ${new Date().getFullYear()} The Intelligence Company
      </div>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Generate vendor alert email HTML
 */
export function generateVendorAlertHtml({
  userName,
  vendor,
  cve,
  severity,
  description,
  actors = [],
}) {
  const severityColors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
  }
  const color = severityColors[severity] || severityColors.medium

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vigil Vendor Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Alert Header -->
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f0f13 100%); border: 1px solid ${color}; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <div style="background: ${color}; color: #000; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
          ${severity}
        </div>
        <div style="color: #ffffff; font-size: 14px; margin-left: 12px;">Vendor Alert: ${vendor}</div>
      </div>
      <div style="color: #ffffff; font-size: 20px; font-weight: 700; margin-bottom: 8px;">
        ${cve}
      </div>
      ${userName ? `<div style="color: #9ca3af; font-size: 14px;">Affects your environment, ${userName}</div>` : ''}
    </div>

    <!-- Details -->
    <div style="background: #1f1f23; border: 1px solid #374151; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 14px; margin: 0 0 12px 0;">Description</h3>
      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">
        ${description}
      </p>

      ${actors.length > 0 ? `
        <h3 style="color: #ffffff; font-size: 14px; margin: 16px 0 12px 0;">Known to be exploited by</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${actors.map(actor => `
            <span style="background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 12px;">
              ${actor}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Actions -->
    <div style="background: #1f1f23; border: 1px solid #374151; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 14px; margin: 0 0 12px 0;">Recommended Actions</h3>
      <ul style="color: #9ca3af; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>Check if your ${vendor} products are affected</li>
        <li>Review vendor advisory for patch availability</li>
        <li>Prioritize patching based on exposure</li>
        <li>Monitor for exploitation attempts</li>
      </ul>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://vigil.theintelligence.company/vulnerabilities?search=${cve}" style="display: inline-block; background: #06b6d4; color: #000000; font-weight: 600; padding: 12px 32px; border-radius: 6px; text-decoration: none;">
        View CVE Details
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #374151; padding-top: 24px; text-align: center;">
      <div style="color: #6b7280; font-size: 12px;">
        <a href="https://vigil.theintelligence.company/settings" style="color: #06b6d4; text-decoration: none;">Manage alert preferences</a>
      </div>
      <div style="color: #4b5563; font-size: 11px; margin-top: 16px;">
        © ${new Date().getFullYear()} The Intelligence Company
      </div>
    </div>
  </div>
</body>
</html>
  `
}

export default { sendEmail, sendBatchEmails, generateDigestHtml, generateVendorAlertHtml }
