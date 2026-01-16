#!/usr/bin/env node

/**
 * Scheduled Report Generator
 * Generates and sends intelligence reports on schedule
 *
 * Run with: node scripts/generate-scheduled-reports.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import 'dotenv/config'

// Initialize clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

// Report sections
const SECTIONS = {
  summary: { label: 'Executive Summary', order: 1 },
  incidents: { label: 'Ransomware Incidents', order: 2 },
  actors: { label: 'Threat Actors', order: 3 },
  vulnerabilities: { label: 'Vulnerabilities', order: 4 },
  iocs: { label: 'Indicators of Compromise', order: 5 },
  trends: { label: 'Trend Analysis', order: 6 },
  watchlist: { label: 'Watchlist Updates', order: 7 },
}

// Time range based on frequency
function getTimeRange(frequency) {
  const now = new Date()
  const ranges = {
    daily: { days: 1, label: 'Last 24 Hours' },
    weekly: { days: 7, label: 'Last 7 Days' },
    monthly: { days: 30, label: 'Last 30 Days' },
  }
  const range = ranges[frequency] || ranges.weekly
  return {
    start: startOfDay(subDays(now, range.days)),
    end: endOfDay(now),
    label: range.label,
  }
}

// Fetch report data
async function fetchReportData(sections, filters, timeRange) {
  const data = {}
  const stats = {}

  // Incidents
  if (sections.includes('incidents')) {
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select(`
        id, victim_name, victim_sector, discovered_date, country, status,
        threat_actor:threat_actors(id, name, trend_status)
      `)
      .gte('discovered_date', timeRange.start.toISOString())
      .lte('discovered_date', timeRange.end.toISOString())
      .order('discovered_date', { ascending: false })
      .limit(50)

    if (!error) {
      data.incidents = incidents || []
      stats.incidents = incidents?.length || 0
    }
  }

  // Threat Actors
  if (sections.includes('actors')) {
    const { data: actors, error } = await supabase
      .from('threat_actors')
      .select('id, name, trend_status, incidents_7d, incidents_prev_7d, target_sectors')
      .eq('trend_status', 'ESCALATING')
      .order('incidents_7d', { ascending: false })
      .limit(10)

    if (!error) {
      data.actors = actors || []
      stats.actors = actors?.length || 0
    }
  }

  // Vulnerabilities (KEVs)
  if (sections.includes('vulnerabilities')) {
    const { data: vulns, error } = await supabase
      .from('vulnerabilities')
      .select('id, cve_id, vendor_project, product, vulnerability_name, cvss_score, kev_date')
      .gte('kev_date', timeRange.start.toISOString())
      .order('kev_date', { ascending: false })
      .limit(20)

    if (!error) {
      data.vulnerabilities = vulns || []
      stats.vulnerabilities = vulns?.length || 0
    }
  }

  // IOCs
  if (sections.includes('iocs')) {
    const { data: iocs, error } = await supabase
      .from('iocs')
      .select('id, value, ioc_type, threat_type, confidence, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error) {
      data.iocs = iocs || []
      stats.iocs = iocs?.length || 0
    }
  }

  return { data, stats }
}

// Generate HTML report
function generateHtmlReport(reportConfig, reportData, timeRange) {
  const { name, sections, branding } = reportConfig
  const { data, stats } = reportData

  const primaryColor = branding?.primary_color || '#0ea5e9'
  const companyName = branding?.company_name || 'Vigil'
  const logoUrl = branding?.logo_url || ''

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f9fafb;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${primaryColor};
    }
    .header h1 {
      color: ${primaryColor};
      margin: 0;
      font-size: 28px;
    }
    .header .subtitle {
      color: #6b7280;
      margin-top: 8px;
    }
    .section {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: ${primaryColor};
      margin-top: 0;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: ${primaryColor};
    }
    .stat-card .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge-critical { background: #fef2f2; color: #dc2626; }
    .badge-high { background: #fff7ed; color: #ea580c; }
    .badge-medium { background: #fefce8; color: #ca8a04; }
    .badge-escalating { background: #fef2f2; color: #dc2626; }
    .badge-stable { background: #f0fdf4; color: #16a34a; }
    .footer {
      text-align: center;
      padding-top: 24px;
      color: #9ca3af;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="height: 40px; margin-bottom: 12px;">` : ''}
    <h1>${name}</h1>
    <div class="subtitle">${timeRange.label} | Generated ${format(new Date(), 'MMM d, yyyy h:mm a')}</div>
  </div>
`

  // Stats summary
  html += `
  <div class="stat-grid">
    <div class="stat-card">
      <div class="value">${stats.incidents || 0}</div>
      <div class="label">Incidents</div>
    </div>
    <div class="stat-card">
      <div class="value">${stats.actors || 0}</div>
      <div class="label">Escalating Actors</div>
    </div>
    <div class="stat-card">
      <div class="value">${stats.vulnerabilities || 0}</div>
      <div class="label">New KEVs</div>
    </div>
    <div class="stat-card">
      <div class="value">${stats.iocs || 0}</div>
      <div class="label">New IOCs</div>
    </div>
  </div>
`

  // Sections in order
  const orderedSections = sections
    .filter(s => SECTIONS[s])
    .sort((a, b) => SECTIONS[a].order - SECTIONS[b].order)

  for (const sectionId of orderedSections) {
    const sectionData = data[sectionId]
    if (!sectionData || sectionData.length === 0) continue

    html += `<div class="section"><h2>${SECTIONS[sectionId].label}</h2>`

    switch (sectionId) {
      case 'incidents':
        html += `
          <table>
            <thead>
              <tr>
                <th>Victim</th>
                <th>Sector</th>
                <th>Actor</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
        `
        for (const inc of sectionData.slice(0, 15)) {
          html += `
            <tr>
              <td>${inc.victim_name || 'Unknown'}</td>
              <td>${inc.victim_sector || '-'}</td>
              <td>${inc.threat_actor?.name || '-'}</td>
              <td>${inc.discovered_date ? format(new Date(inc.discovered_date), 'MMM d') : '-'}</td>
            </tr>
          `
        }
        html += '</tbody></table>'
        break

      case 'actors':
        html += `
          <table>
            <thead>
              <tr>
                <th>Actor</th>
                <th>Status</th>
                <th>7-Day Incidents</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
        `
        for (const actor of sectionData) {
          const change = actor.incidents_7d - (actor.incidents_prev_7d || 0)
          const changeStr = change > 0 ? `+${change}` : change.toString()
          html += `
            <tr>
              <td><strong>${actor.name}</strong></td>
              <td><span class="badge badge-${actor.trend_status?.toLowerCase()}">${actor.trend_status}</span></td>
              <td>${actor.incidents_7d || 0}</td>
              <td style="color: ${change > 0 ? '#dc2626' : '#16a34a'}">${changeStr}</td>
            </tr>
          `
        }
        html += '</tbody></table>'
        break

      case 'vulnerabilities':
        html += `
          <table>
            <thead>
              <tr>
                <th>CVE</th>
                <th>Product</th>
                <th>CVSS</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
        `
        for (const vuln of sectionData.slice(0, 10)) {
          const cvssClass = vuln.cvss_score >= 9 ? 'critical' : vuln.cvss_score >= 7 ? 'high' : 'medium'
          html += `
            <tr>
              <td><strong>${vuln.cve_id}</strong></td>
              <td>${vuln.vendor_project || ''} ${vuln.product || ''}</td>
              <td><span class="badge badge-${cvssClass}">${vuln.cvss_score || '-'}</span></td>
              <td>${vuln.kev_date ? format(new Date(vuln.kev_date), 'MMM d') : '-'}</td>
            </tr>
          `
        }
        html += '</tbody></table>'
        break

      case 'iocs':
        html += `
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>Threat</th>
              </tr>
            </thead>
            <tbody>
        `
        for (const ioc of sectionData.slice(0, 15)) {
          const displayValue = ioc.value?.length > 50 ? ioc.value.slice(0, 50) + '...' : ioc.value
          html += `
            <tr>
              <td>${ioc.ioc_type || '-'}</td>
              <td><code style="font-size: 12px; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${displayValue}</code></td>
              <td>${ioc.threat_type || '-'}</td>
            </tr>
          `
        }
        html += '</tbody></table>'
        break
    }

    html += '</div>'
  }

  html += `
  <div class="footer">
    <p>Generated by ${companyName} | <a href="https://vigil.theintelligence.company">vigil.theintelligence.company</a></p>
    <p>To manage your report settings, visit your <a href="https://vigil.theintelligence.company/reports">Reports Dashboard</a></p>
  </div>
</body>
</html>
`

  return html
}

// Send report via email
async function sendReport(recipients, subject, htmlContent) {
  if (!recipients || recipients.length === 0) {
    console.log('No recipients specified, skipping email')
    return { sent: [], failed: [] }
  }

  const sent = []
  const failed = []

  for (const recipient of recipients) {
    try {
      await resend.emails.send({
        from: 'Vigil Reports <reports@theintelligence.company>',
        to: recipient,
        subject: subject,
        html: htmlContent,
      })
      sent.push(recipient)
      console.log(`  Sent to ${recipient}`)
    } catch (error) {
      console.error(`  Failed to send to ${recipient}:`, error.message)
      failed.push(recipient)
    }
  }

  return { sent, failed }
}

// Update report after sending
async function updateReportStatus(reportId, historyRecord) {
  // Update scheduled_reports
  await supabase
    .from('scheduled_reports')
    .update({
      last_sent_at: new Date().toISOString(),
      send_count: supabase.sql`send_count + 1`,
    })
    .eq('id', reportId)

  // Insert history record
  await supabase
    .from('report_history')
    .insert(historyRecord)
}

// Main function
async function main() {
  console.log('=== Scheduled Report Generator ===')
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('')

  // Get reports due for delivery
  const { data: dueReports, error } = await supabase
    .from('scheduled_reports')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_scheduled_at', new Date().toISOString())
    .order('next_scheduled_at', { ascending: true })

  if (error) {
    console.error('Error fetching due reports:', error.message)
    process.exit(1)
  }

  if (!dueReports || dueReports.length === 0) {
    console.log('No reports due for delivery')
    return
  }

  console.log(`Found ${dueReports.length} report(s) due for delivery`)
  console.log('')

  for (const report of dueReports) {
    console.log(`Processing: ${report.name}`)
    console.log(`  Frequency: ${report.frequency}`)
    console.log(`  Recipients: ${report.recipients?.length || 0}`)

    try {
      // Get time range
      const timeRange = getTimeRange(report.frequency)

      // Fetch data
      const { data, stats } = await fetchReportData(
        report.sections || [],
        report.filters || {},
        timeRange
      )

      console.log(`  Data fetched: ${JSON.stringify(stats)}`)

      // Generate HTML
      const html = generateHtmlReport(report, { data, stats }, timeRange)

      // Send emails
      const subject = `${report.name} - ${format(new Date(), 'MMM d, yyyy')}`
      const { sent, failed } = await sendReport(report.recipients, subject, html)

      // Record history
      const status = failed.length === 0 ? 'sent' :
                     sent.length === 0 ? 'failed' : 'partial'

      await updateReportStatus(report.id, {
        report_id: report.id,
        user_id: report.user_id,
        time_range_start: timeRange.start.toISOString(),
        time_range_end: timeRange.end.toISOString(),
        stats,
        delivery_status: status,
        recipients_sent: sent,
        recipients_failed: failed,
      })

      console.log(`  Status: ${status}`)
      console.log('')
    } catch (err) {
      console.error(`  Error processing report: ${err.message}`)

      // Record failure
      await supabase
        .from('report_history')
        .insert({
          report_id: report.id,
          user_id: report.user_id,
          delivery_status: 'failed',
          error_message: err.message,
        })
    }
  }

  console.log('=== Complete ===')
}

main().catch(console.error)
