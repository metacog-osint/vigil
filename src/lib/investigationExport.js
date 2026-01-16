/**
 * Investigation Export Module
 *
 * Exports investigations to PDF format using browser print or
 * generates downloadable HTML reports.
 */

// ============================================
// CONSTANTS
// ============================================

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

// ============================================
// HTML TEMPLATE
// ============================================

function generateReportHTML(investigation, options = {}) {
  const {
    includeNotes = true,
    includeActivity = true,
    includeChecklist = true,
    includeComments = true,
    includeEntities = true,
    branding = {},
  } = options

  const {
    logo = '',
    companyName = 'Vigil Threat Intelligence',
    primaryColor = '#00ff88',
  } = branding

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  const escapeHtml = (text) => {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const markdownToHtml = (markdown) => {
    if (!markdown) return ''
    // Basic markdown conversion
    return escapeHtml(markdown)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n/g, '<br>')
  }

  // Build sections
  let notesSection = ''
  if (includeNotes && investigation.notes) {
    notesSection = `
      <section class="section">
        <h2>Investigation Notes</h2>
        <div class="content markdown">
          ${markdownToHtml(investigation.notes)}
        </div>
      </section>
    `
  }

  let activitySection = ''
  if (includeActivity && investigation.activities?.length > 0) {
    const activityItems = investigation.activities
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(
        (activity) => `
        <tr>
          <td>${formatDate(activity.created_at)}</td>
          <td>${escapeHtml(activity.action)}</td>
          <td>${escapeHtml(activity.description || '')}</td>
          <td>${escapeHtml(activity.user_email || 'System')}</td>
        </tr>
      `
      )
      .join('')

    activitySection = `
      <section class="section">
        <h2>Activity Timeline</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Details</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            ${activityItems}
          </tbody>
        </table>
      </section>
    `
  }

  let checklistSection = ''
  if (includeChecklist && investigation.checklist?.length > 0) {
    const checklistItems = investigation.checklist
      .map(
        (item) => `
        <li class="${item.completed ? 'completed' : ''}">
          <span class="checkbox">${item.completed ? '☑' : '☐'}</span>
          ${escapeHtml(item.text)}
          ${item.completed_at ? `<span class="completed-date">(Completed: ${formatDate(item.completed_at)})</span>` : ''}
        </li>
      `
      )
      .join('')

    checklistSection = `
      <section class="section">
        <h2>Checklist</h2>
        <ul class="checklist">
          ${checklistItems}
        </ul>
      </section>
    `
  }

  let commentsSection = ''
  if (includeComments && investigation.comments?.length > 0) {
    const commentItems = investigation.comments
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(
        (comment) => `
        <div class="comment">
          <div class="comment-header">
            <strong>${escapeHtml(comment.user_email || 'Unknown')}</strong>
            <span class="timestamp">${formatDate(comment.created_at)}</span>
          </div>
          <div class="comment-body">${markdownToHtml(comment.content)}</div>
        </div>
      `
      )
      .join('')

    commentsSection = `
      <section class="section">
        <h2>Comments</h2>
        ${commentItems}
      </section>
    `
  }

  let entitiesSection = ''
  if (includeEntities && investigation.entities?.length > 0) {
    const entityItems = investigation.entities
      .map(
        (entity) => `
        <tr>
          <td>${escapeHtml(entity.entity_type)}</td>
          <td>${escapeHtml(entity.entity_name || entity.entity_id)}</td>
          <td>${escapeHtml(entity.relationship || 'Related')}</td>
          <td>${formatDate(entity.added_at)}</td>
        </tr>
      `
      )
      .join('')

    entitiesSection = `
      <section class="section">
        <h2>Linked Entities</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Name/ID</th>
              <th>Relationship</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            ${entityItems}
          </tbody>
        </table>
      </section>
    `
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investigation Report: ${escapeHtml(investigation.title)}</title>
  <style>
    :root {
      --primary: ${primaryColor};
      --bg: #0a0a0f;
      --card: #1a1a2e;
      --border: #2a2a4a;
      --text: #e0e0e0;
      --text-muted: #888;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 40px;
    }

    @media print {
      body {
        background: white;
        color: black;
        padding: 20px;
      }
      .no-print { display: none; }
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid var(--primary);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header-left h1 {
      font-size: 24px;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .header-right {
      text-align: right;
      color: var(--text-muted);
    }

    .logo {
      max-height: 50px;
      margin-bottom: 10px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }

    .meta-item {
      background: var(--card);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    @media print {
      .meta-item {
        background: #f5f5f5;
        border: 1px solid #ddd;
      }
    }

    .meta-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .meta-value {
      font-size: 16px;
      font-weight: 600;
    }

    .priority-critical { color: #ef4444; }
    .priority-high { color: #f97316; }
    .priority-medium { color: #eab308; }
    .priority-low { color: #3b82f6; }

    .status-open { color: #ef4444; }
    .status-in_progress { color: #eab308; }
    .status-resolved { color: #22c55e; }
    .status-closed { color: #6b7280; }

    .section {
      margin-bottom: 30px;
    }

    .section h2 {
      font-size: 18px;
      color: var(--primary);
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 16px;
    }

    @media print {
      .section h2 {
        color: #333;
      }
    }

    .content {
      background: var(--card);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    @media print {
      .content {
        background: white;
        border: 1px solid #ddd;
      }
    }

    .markdown h1, .markdown h2, .markdown h3 {
      margin-top: 16px;
      margin-bottom: 8px;
    }

    .markdown code {
      background: rgba(0,0,0,0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }

    .markdown ul {
      margin-left: 20px;
      margin-bottom: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border-radius: 8px;
      overflow: hidden;
    }

    @media print {
      table {
        background: white;
      }
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: rgba(0,0,0,0.2);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    @media print {
      th {
        background: #f0f0f0;
        color: #333;
      }
    }

    .checklist {
      list-style: none;
    }

    .checklist li {
      padding: 12px 16px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .checklist li.completed {
      opacity: 0.7;
      text-decoration: line-through;
    }

    .checkbox {
      font-size: 18px;
    }

    .completed-date {
      font-size: 12px;
      color: var(--text-muted);
      margin-left: auto;
    }

    .comment {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .timestamp {
      color: var(--text-muted);
      font-size: 12px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
      text-align: center;
    }

    .print-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--primary);
      color: black;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }

    .print-button:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logo ? `<img src="${logo}" alt="Logo" class="logo">` : ''}
      <h1>${escapeHtml(investigation.title)}</h1>
      ${investigation.description ? `<p>${escapeHtml(investigation.description)}</p>` : ''}
    </div>
    <div class="header-right">
      <div>${companyName}</div>
      <div>Report Generated: ${formatDate(new Date().toISOString())}</div>
      <div>Investigation ID: ${investigation.id?.slice(0, 8) || 'N/A'}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Status</div>
      <div class="meta-value status-${investigation.status}">${STATUS_LABELS[investigation.status] || investigation.status}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Priority</div>
      <div class="meta-value priority-${investigation.priority}">${PRIORITY_LABELS[investigation.priority] || investigation.priority}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Created</div>
      <div class="meta-value">${formatDate(investigation.created_at)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Assigned To</div>
      <div class="meta-value">${escapeHtml(investigation.assigned_to_email || 'Unassigned')}</div>
    </div>
  </div>

  ${notesSection}
  ${checklistSection}
  ${activitySection}
  ${entitiesSection}
  ${commentsSection}

  <div class="footer">
    <p>This report was generated by ${companyName}</p>
    <p>Classification: ${investigation.classification || 'Internal'}</p>
  </div>

  <button class="print-button no-print" onclick="window.print()">
    Print / Save as PDF
  </button>
</body>
</html>`
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export investigation to HTML and open in new window for printing
 */
export function exportToPDF(investigation, options = {}) {
  const html = generateReportHTML(investigation, options)

  // Open in new window
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  } else {
    console.error('Could not open print window. Check popup blocker.')
  }
}

/**
 * Download investigation as HTML file
 */
export function downloadAsHTML(investigation, options = {}) {
  const html = generateReportHTML(investigation, options)

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `investigation-${investigation.id?.slice(0, 8) || 'report'}-${Date.now()}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Copy investigation summary to clipboard
 */
export async function copyToClipboard(investigation) {
  const summary = `
Investigation: ${investigation.title}
Status: ${STATUS_LABELS[investigation.status] || investigation.status}
Priority: ${PRIORITY_LABELS[investigation.priority] || investigation.priority}
Created: ${new Date(investigation.created_at).toLocaleString()}

${investigation.description || ''}

Notes:
${investigation.notes || 'No notes'}

Linked Entities: ${investigation.entities?.length || 0}
Checklist Items: ${investigation.checklist?.length || 0} (${investigation.checklist?.filter((c) => c.completed).length || 0} completed)
Comments: ${investigation.comments?.length || 0}
`.trim()

  try {
    await navigator.clipboard.writeText(summary)
    return { success: true }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return { success: false, error }
  }
}

/**
 * Export investigation to JSON
 */
export function exportToJSON(investigation) {
  const json = JSON.stringify(investigation, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `investigation-${investigation.id?.slice(0, 8) || 'export'}-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default {
  exportToPDF,
  downloadAsHTML,
  copyToClipboard,
  exportToJSON,
  generateReportHTML,
}
