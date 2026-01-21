/**
 * Reports Page
 * Configure and manage scheduled intelligence reports
 */

import { useState, useEffect } from 'react'
import {
  scheduledReports,
  REPORT_SECTIONS,
  REPORT_TEMPLATES,
  FREQUENCY_OPTIONS,
  DAY_OPTIONS,
} from '../lib/scheduledReports'
import { useAuth } from '../hooks/useAuth'
import { useSubscription } from '../contexts/SubscriptionContext'
import { UpgradePrompt } from '../components/UpgradePrompt'
import { format, formatDistanceToNow } from 'date-fns'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

export default function Reports() {
  const { user } = useAuth()
  const { canAccess, tier } = useSubscription()
  const userId = user?.id || 'anonymous'

  const [reports, setReports] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingReport, setEditingReport] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)
  const [error, setError] = useState(null)

  const hasReportAccess = canAccess('scheduled_reports')

  useEffect(() => {
    if (hasReportAccess) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [userId, hasReportAccess])

  async function loadData() {
    setLoading(true)
    try {
      const [reportsData, historyData] = await Promise.all([
        scheduledReports.getAll(userId),
        scheduledReports.getAllHistory(userId),
      ])
      setReports(reportsData)
      setHistory(historyData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(config) {
    try {
      const newReport = await scheduledReports.create(userId, config)
      setReports([newReport, ...reports])
      setShowCreateModal(false)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdate(reportId, updates) {
    try {
      const updated = await scheduledReports.update(reportId, userId, updates)
      setReports(reports.map((r) => (r.id === reportId ? updated : r)))
      setEditingReport(null)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(reportId) {
    if (!confirm('Delete this scheduled report?')) return
    try {
      await scheduledReports.delete(reportId, userId)
      setReports(reports.filter((r) => r.id !== reportId))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggle(report) {
    try {
      const updated = await scheduledReports.toggle(report.id, userId, !report.is_enabled)
      setReports(reports.map((r) => (r.id === report.id ? updated : r)))
    } catch (err) {
      setError(err.message)
    }
  }

  // Check access
  if (!hasReportAccess) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Scheduled Reports</h1>
          <p className="text-gray-400 text-sm mt-1">
            Automated threat intelligence digests delivered to your inbox
          </p>
        </div>
        <UpgradePrompt feature="scheduled_reports" currentTier={tier} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scheduled Reports</h1>
          <p className="text-gray-400 text-sm mt-1">
            Automated threat intelligence digests delivered to your inbox
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Report
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Reports Grid */}
      {reports.length === 0 ? (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No scheduled reports yet</h3>
          <p className="text-gray-400 text-sm mb-4">
            Create your first report to receive automated threat intelligence digests.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Create your first report
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onToggle={() => handleToggle(report)}
              onEdit={() => setEditingReport(report)}
              onDelete={() => handleDelete(report.id)}
              onViewHistory={() => setSelectedReport(report)}
            />
          ))}
        </div>
      )}

      {/* Recent Report History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-white mb-4">Recent Reports</h2>
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {history.slice(0, 5).map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">
                    {item.scheduled_reports?.name || 'Report'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {format(new Date(item.generated_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.delivery_status} />
                  {item.pdf_url && (
                    <a
                      href={item.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingReport) && (
        <ReportModal
          report={editingReport}
          onClose={() => {
            setShowCreateModal(false)
            setEditingReport(null)
          }}
          onSave={
            editingReport ? (updates) => handleUpdate(editingReport.id, updates) : handleCreate
          }
          tier={tier}
        />
      )}

      {/* History Modal */}
      {selectedReport && (
        <HistoryModal
          report={selectedReport}
          userId={userId}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  )
}

function ReportCard({ report, onToggle, onEdit, onDelete, onViewHistory }) {
  const frequencyLabel =
    FREQUENCY_OPTIONS.find((f) => f.value === report.frequency)?.label || report.frequency

  return (
    <div
      className={`bg-gray-800/30 border rounded-lg p-5 transition-colors ${
        report.is_enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{report.name}</h3>
          <p className="text-sm text-gray-400">
            {frequencyLabel} at {report.delivery_time?.slice(0, 5)} {report.timezone}
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            report.is_enabled ? 'bg-cyan-500' : 'bg-gray-700'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              report.is_enabled ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* Sections */}
      <div className="flex flex-wrap gap-1 mb-3">
        {(report.sections || []).map((sectionId) => (
          <span key={sectionId} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
            {REPORT_SECTIONS[sectionId]?.label || sectionId}
          </span>
        ))}
      </div>

      {/* Recipients */}
      <div className="text-sm text-gray-500 mb-3">
        {(report.recipients || []).length} recipient{report.recipients?.length !== 1 ? 's' : ''}
      </div>

      {/* Next scheduled */}
      {report.is_enabled && report.next_scheduled_at && (
        <div className="text-sm text-gray-400 mb-3">
          Next: {formatDistanceToNow(new Date(report.next_scheduled_at), { addSuffix: true })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-700">
        <button
          onClick={onEdit}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onViewHistory}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          History
        </button>
        <button
          onClick={onDelete}
          className="text-sm text-gray-400 hover:text-red-400 transition-colors ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    sent: 'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    failed: 'bg-red-500/20 text-red-400',
    partial: 'bg-orange-500/20 text-orange-400',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[status] || styles.pending}`}>
      {status}
    </span>
  )
}

function ReportModal({ report, onClose, onSave, tier }) {
  const [step, setStep] = useState(report ? 'configure' : 'template') // template or configure
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [name, setName] = useState(report?.name || '')
  const [frequency, setFrequency] = useState(report?.frequency || 'weekly')
  const [deliveryDay, setDeliveryDay] = useState(report?.delivery_day || 1)
  const [deliveryTime, setDeliveryTime] = useState(report?.delivery_time?.slice(0, 5) || '08:00')
  const [timezone, setTimezone] = useState(report?.timezone || 'UTC')
  const [sections, setSections] = useState(
    report?.sections || ['summary', 'incidents', 'actors', 'vulnerabilities']
  )
  const [recipients, setRecipients] = useState((report?.recipients || []).join(', '))
  const [branding, setBranding] = useState(
    report?.branding || { logoUrl: '', primaryColor: '#06b6d4' }
  )
  const [saving, setSaving] = useState(false)

  // Frequency limits by tier
  const allowedFrequencies =
    tier === 'enterprise'
      ? ['daily', 'weekly', 'monthly']
      : tier === 'team'
        ? ['daily', 'weekly', 'monthly']
        : ['weekly', 'monthly'] // Professional

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template)
    setName(template.name)
    setFrequency(template.frequency)
    setSections(template.sections)
    setStep('configure')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || sections.length === 0) return

    setSaving(true)
    await onSave({
      name: name.trim(),
      frequency,
      deliveryDay,
      deliveryTime: deliveryTime + ':00',
      timezone,
      sections,
      recipients: recipients
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      filters: {},
      format: 'pdf',
      branding,
      isEnabled: report?.is_enabled ?? true,
    })
    setSaving(false)
  }

  const toggleSection = (sectionId) => {
    setSections((prev) =>
      prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Template Selection Step */}
        {step === 'template' && (
          <>
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Choose a Report Template</h2>
              <p className="text-sm text-gray-400 mt-1">
                Start with a template or build a custom report
              </p>
            </div>

            <div className="p-6 space-y-3">
              {Object.values(REPORT_TEMPLATES).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    template.recommended
                      ? 'bg-cyan-500/10 border-cyan-500/50 hover:border-cyan-500'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{template.name}</div>
                    {template.recommended && (
                      <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.sections.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded"
                      >
                        {REPORT_SECTIONS[s]?.label || s}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Configure Step */}
        {step === 'configure' && (
          <>
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center gap-2">
                {!report && (
                  <button
                    onClick={() => setStep('template')}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {report ? 'Edit Report' : 'Configure Report'}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedTemplate?.name
                      ? `Based on: ${selectedTemplate.name}`
                      : 'Configure your automated threat intelligence digest'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Report Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Report Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g., Weekly Threat Digest"
                  required
                />
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={!allowedFrequencies.includes(opt.value)}
                      >
                        {opt.label}{' '}
                        {!allowedFrequencies.includes(opt.value) && '(Upgrade required)'}
                      </option>
                    ))}
                  </select>
                </div>

                {frequency !== 'daily' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {frequency === 'weekly' ? 'Day of Week' : 'Day of Month'}
                    </label>
                    <select
                      value={deliveryDay}
                      onChange={(e) => setDeliveryDay(parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                      {DAY_OPTIONS[frequency]?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Delivery Time
                  </label>
                  <input
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sections */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Report Sections
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(REPORT_SECTIONS).map((section) => (
                    <label
                      key={section.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sections.includes(section.id)
                          ? 'bg-cyan-500/10 border-cyan-500/50'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={sections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                        className="mt-1 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div>
                        <div className="text-white font-medium text-sm">{section.label}</div>
                        <div className="text-gray-400 text-xs">{section.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Branding (Enterprise only) */}
              {tier === 'enterprise' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Report Branding
                    <span className="ml-2 text-xs text-cyan-400">Enterprise</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Logo URL</label>
                      <input
                        type="url"
                        value={branding.logoUrl || ''}
                        onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                        placeholder="https://company.com/logo.png"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Primary Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={branding.primaryColor || '#06b6d4'}
                          onChange={(e) =>
                            setBranding({ ...branding, primaryColor: e.target.value })
                          }
                          className="h-10 w-14 rounded cursor-pointer border border-gray-700"
                        />
                        <input
                          type="text"
                          value={branding.primaryColor || '#06b6d4'}
                          onChange={(e) =>
                            setBranding({ ...branding, primaryColor: e.target.value })
                          }
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                          placeholder="#06b6d4"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recipients (comma-separated emails)
                </label>
                <textarea
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  rows={2}
                  placeholder="analyst@company.com, team@company.com"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim() || sections.length === 0}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : report ? 'Save Changes' : 'Create Report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function HistoryModal({ report, userId, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [report.id])

  async function loadHistory() {
    setLoading(true)
    try {
      const data = await scheduledReports.getHistory(report.id, userId, 20)
      setHistory(data)
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{report.name}</h2>
            <p className="text-sm text-gray-400">Report History</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No reports generated yet</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {history.map((item) => (
                <div key={item.id} className="p-4 hover:bg-gray-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-white">
                      {format(new Date(item.generated_at), 'MMM d, yyyy h:mm a')}
                    </div>
                    <StatusBadge status={item.delivery_status} />
                  </div>
                  {item.stats && (
                    <div className="flex gap-4 text-sm text-gray-400">
                      {item.stats.incidents && <span>{item.stats.incidents} incidents</span>}
                      {item.stats.actors && <span>{item.stats.actors} actors</span>}
                      {item.stats.vulnerabilities && (
                        <span>{item.stats.vulnerabilities} vulns</span>
                      )}
                    </div>
                  )}
                  {item.error_message && (
                    <div className="mt-2 text-sm text-red-400">{item.error_message}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
