/**
 * ReportBuilder Component
 * Custom report builder with drag-and-drop sections
 */

import { useState, useCallback } from 'react'
import {
  DocumentTextIcon,
  ChartBarIcon,
  TableCellsIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  ArrowsUpDownIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'

// Available report sections
const SECTION_TYPES = {
  title: {
    name: 'Title',
    icon: DocumentTextIcon,
    defaultContent: { text: 'Threat Intelligence Report', subtitle: '' },
  },
  summary: {
    name: 'Executive Summary',
    icon: DocumentTextIcon,
    defaultContent: { text: '' },
  },
  metric_cards: {
    name: 'Metric Cards',
    icon: ChartBarIcon,
    defaultContent: {
      metrics: [
        { label: 'Total Incidents', query: 'incidents_count', format: 'number' },
        { label: 'Active Actors', query: 'actors_count', format: 'number' },
        { label: 'Critical CVEs', query: 'critical_cves', format: 'number' },
      ],
    },
  },
  chart: {
    name: 'Chart',
    icon: ChartBarIcon,
    defaultContent: {
      chartType: 'bar',
      dataSource: 'incidents_by_sector',
      title: 'Incidents by Sector',
    },
  },
  table: {
    name: 'Data Table',
    icon: TableCellsIcon,
    defaultContent: {
      dataSource: 'top_actors',
      columns: ['name', 'incidents_7d', 'trend_status'],
      limit: 10,
    },
  },
  text: {
    name: 'Text Block',
    icon: DocumentTextIcon,
    defaultContent: { markdown: '' },
  },
  image: {
    name: 'Image',
    icon: PhotoIcon,
    defaultContent: { url: '', caption: '' },
  },
  divider: {
    name: 'Divider',
    icon: ArrowsUpDownIcon,
    defaultContent: {},
  },
}

// Data source options
const DATA_SOURCES = {
  incidents_by_sector: 'Incidents by Sector (30d)',
  incidents_by_actor: 'Incidents by Actor (30d)',
  incidents_timeline: 'Incidents Timeline',
  top_actors: 'Top Threat Actors',
  escalating_actors: 'Escalating Actors',
  recent_incidents: 'Recent Incidents',
  critical_vulns: 'Critical Vulnerabilities',
  kev_vulns: 'KEV Vulnerabilities',
  ioc_distribution: 'IOC Type Distribution',
  sector_trends: 'Sector Trends',
}

// Chart type options
const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'donut', label: 'Donut Chart' },
]

// Column options per data source
const TABLE_COLUMNS = {
  top_actors: [
    { value: 'name', label: 'Name' },
    { value: 'incidents_7d', label: 'Incidents (7d)' },
    { value: 'incidents_30d', label: 'Incidents (30d)' },
    { value: 'trend_status', label: 'Trend' },
    { value: 'target_sectors', label: 'Target Sectors' },
  ],
  recent_incidents: [
    { value: 'victim_name', label: 'Victim' },
    { value: 'threat_actor.name', label: 'Actor' },
    { value: 'victim_sector', label: 'Sector' },
    { value: 'discovered_date', label: 'Date' },
  ],
  critical_vulns: [
    { value: 'cve_id', label: 'CVE ID' },
    { value: 'cvss_score', label: 'CVSS' },
    { value: 'epss_score', label: 'EPSS' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'description', label: 'Description' },
  ],
  kev_vulns: [
    { value: 'cve_id', label: 'CVE ID' },
    { value: 'cvss_score', label: 'CVSS' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'kev_date', label: 'Added to KEV' },
  ],
}

// Section Editor Components
function TitleEditor({ content, onChange }) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={content.text || ''}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        placeholder="Report Title"
        className="cyber-input w-full text-lg font-bold"
      />
      <input
        type="text"
        value={content.subtitle || ''}
        onChange={(e) => onChange({ ...content, subtitle: e.target.value })}
        placeholder="Subtitle (optional)"
        className="cyber-input w-full text-sm"
      />
    </div>
  )
}

function SummaryEditor({ content, onChange }) {
  return (
    <textarea
      value={content.text || ''}
      onChange={(e) => onChange({ ...content, text: e.target.value })}
      placeholder="Enter executive summary..."
      className="cyber-input w-full h-32"
    />
  )
}

function MetricCardsEditor({ content, onChange }) {
  const addMetric = () => {
    onChange({
      ...content,
      metrics: [...(content.metrics || []), { label: '', query: '', format: 'number' }],
    })
  }

  const updateMetric = (index, field, value) => {
    const newMetrics = [...content.metrics]
    newMetrics[index] = { ...newMetrics[index], [field]: value }
    onChange({ ...content, metrics: newMetrics })
  }

  const removeMetric = (index) => {
    onChange({
      ...content,
      metrics: content.metrics.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-2">
      {content.metrics?.map((metric, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={metric.label}
            onChange={(e) => updateMetric(index, 'label', e.target.value)}
            placeholder="Label"
            className="cyber-input flex-1"
          />
          <select
            value={metric.query}
            onChange={(e) => updateMetric(index, 'query', e.target.value)}
            className="cyber-input w-40"
          >
            <option value="">Select metric...</option>
            <option value="incidents_count">Total Incidents</option>
            <option value="actors_count">Active Actors</option>
            <option value="critical_cves">Critical CVEs</option>
            <option value="kev_count">KEV Count</option>
            <option value="iocs_count">IOC Count</option>
          </select>
          <button
            onClick={() => removeMetric(index)}
            className="p-2 text-gray-400 hover:text-red-400"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={addMetric}
        className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
      >
        <PlusIcon className="w-4 h-4" />
        Add Metric
      </button>
    </div>
  )
}

function ChartEditor({ content, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={content.chartType || 'bar'}
          onChange={(e) => onChange({ ...content, chartType: e.target.value })}
          className="cyber-input w-32"
        >
          {CHART_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={content.dataSource || ''}
          onChange={(e) => onChange({ ...content, dataSource: e.target.value })}
          className="cyber-input flex-1"
        >
          <option value="">Select data source...</option>
          {Object.entries(DATA_SOURCES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={content.title || ''}
        onChange={(e) => onChange({ ...content, title: e.target.value })}
        placeholder="Chart title"
        className="cyber-input w-full"
      />
    </div>
  )
}

function TableEditor({ content, onChange }) {
  const columns = TABLE_COLUMNS[content.dataSource] || []

  return (
    <div className="space-y-3">
      <select
        value={content.dataSource || ''}
        onChange={(e) =>
          onChange({
            ...content,
            dataSource: e.target.value,
            columns: [],
          })
        }
        className="cyber-input w-full"
      >
        <option value="">Select data source...</option>
        {Object.entries(DATA_SOURCES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {content.dataSource && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Columns:</label>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <label key={col.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={content.columns?.includes(col.value)}
                    onChange={(e) => {
                      const newCols = e.target.checked
                        ? [...(content.columns || []), col.value]
                        : content.columns?.filter((c) => c !== col.value)
                      onChange({ ...content, columns: newCols })
                    }}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span className="text-gray-300">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-400">Limit:</label>
            <input
              type="number"
              value={content.limit || 10}
              onChange={(e) => onChange({ ...content, limit: parseInt(e.target.value) || 10 })}
              className="cyber-input w-20"
              min="1"
              max="100"
            />
          </div>
        </>
      )}
    </div>
  )
}

function TextEditor({ content, onChange }) {
  return (
    <textarea
      value={content.markdown || ''}
      onChange={(e) => onChange({ ...content, markdown: e.target.value })}
      placeholder="Enter markdown content..."
      className="cyber-input w-full h-24 font-mono text-sm"
    />
  )
}

function ImageEditor({ content, onChange }) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={content.url || ''}
        onChange={(e) => onChange({ ...content, url: e.target.value })}
        placeholder="Image URL"
        className="cyber-input w-full"
      />
      <input
        type="text"
        value={content.caption || ''}
        onChange={(e) => onChange({ ...content, caption: e.target.value })}
        placeholder="Caption (optional)"
        className="cyber-input w-full text-sm"
      />
    </div>
  )
}

// Section Component
function ReportSection({ section, index, onUpdate, onRemove, onMove, totalSections }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const sectionType = SECTION_TYPES[section.type]
  const Icon = sectionType?.icon || DocumentTextIcon

  const renderEditor = () => {
    switch (section.type) {
      case 'title':
        return (
          <TitleEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'summary':
        return (
          <SummaryEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'metric_cards':
        return (
          <MetricCardsEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'chart':
        return (
          <ChartEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'table':
        return (
          <TableEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'text':
        return (
          <TextEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'image':
        return (
          <ImageEditor
            content={section.content}
            onChange={(c) => onUpdate({ ...section, content: c })}
          />
        )
      case 'divider':
        return <div className="border-t border-gray-600 my-2" />
      default:
        return null
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 p-2 bg-gray-800/50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Icon className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-white flex-1">{sectionType?.name}</span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={index === totalSections - 1}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
            title="Move down"
          >
            ▼
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-400"
            title="Remove"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && <div className="p-3 bg-gray-900/50">{renderEditor()}</div>}
    </div>
  )
}

// Main ReportBuilder Component
export default function ReportBuilder({
  initialSections = null,
  onChange,
  onSave,
  onPreview,
  onExport,
}) {
  const [sections, setSections] = useState(
    initialSections || [
      {
        id: crypto.randomUUID(),
        type: 'title',
        content: SECTION_TYPES.title.defaultContent,
      },
    ]
  )
  const [reportName, setReportName] = useState('Untitled Report')
  const [schedule, setSchedule] = useState({ enabled: false, frequency: 'weekly', day: 1, hour: 9 })

  const handleSectionsChange = useCallback(
    (newSections) => {
      setSections(newSections)
      onChange?.(newSections)
    },
    [onChange]
  )

  const addSection = (type) => {
    const newSection = {
      id: crypto.randomUUID(),
      type,
      content: { ...SECTION_TYPES[type].defaultContent },
    }
    handleSectionsChange([...sections, newSection])
  }

  const updateSection = (index, updated) => {
    const newSections = [...sections]
    newSections[index] = updated
    handleSectionsChange(newSections)
  }

  const removeSection = (index) => {
    handleSectionsChange(sections.filter((_, i) => i !== index))
  }

  const moveSection = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= sections.length) return

    const newSections = [...sections]
    const [removed] = newSections.splice(index, 1)
    newSections.splice(newIndex, 0, removed)
    handleSectionsChange(newSections)
  }

  const handleSave = () => {
    onSave?.({
      name: reportName,
      sections,
      schedule,
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Sidebar - Section palette */}
      <div className="w-48 space-y-2 flex-shrink-0">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Add Section
        </div>
        {Object.entries(SECTION_TYPES).map(([type, config]) => {
          const Icon = config.icon
          return (
            <button
              key={type}
              onClick={() => addSection(type)}
              className="flex items-center gap-2 w-full p-2 text-left text-sm text-gray-300 hover:bg-gray-800 rounded transition-colors"
            >
              <Icon className="w-4 h-4 text-gray-500" />
              {config.name}
            </button>
          )
        })}
      </div>

      {/* Main content - Section list */}
      <div className="flex-1 space-y-4 overflow-auto">
        {/* Report name */}
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            className="cyber-input flex-1 text-lg font-bold"
            placeholder="Report Name"
          />
          <div className="flex gap-2">
            {onPreview && (
              <button
                onClick={() => onPreview(sections)}
                className="cyber-button flex items-center gap-1"
              >
                <EyeIcon className="w-4 h-4" />
                Preview
              </button>
            )}
            {onExport && (
              <button
                onClick={() => onExport(sections)}
                className="cyber-button flex items-center gap-1"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Export
              </button>
            )}
            {onSave && (
              <button onClick={handleSave} className="cyber-button-primary">
                Save Report
              </button>
            )}
          </div>
        </div>

        {/* Sections */}
        {sections.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No sections yet. Add sections from the sidebar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <ReportSection
                key={section.id}
                section={section}
                index={index}
                onUpdate={(updated) => updateSection(index, updated)}
                onRemove={() => removeSection(index)}
                onMove={moveSection}
                totalSections={sections.length}
              />
            ))}
          </div>
        )}

        {/* Schedule settings */}
        <div className="border-t border-gray-700 pt-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <ClockIcon className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-white">Schedule Report</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                className="rounded bg-gray-700 border-gray-600 text-cyan-500"
              />
              <span className="text-gray-300">Enable scheduled generation</span>
            </label>

            {schedule.enabled && (
              <>
                <select
                  value={schedule.frequency}
                  onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
                  className="cyber-input text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                {schedule.frequency === 'weekly' && (
                  <select
                    value={schedule.day}
                    onChange={(e) => setSchedule({ ...schedule, day: parseInt(e.target.value) })}
                    className="cyber-input text-sm"
                  >
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                  </select>
                )}

                <div className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                  <select
                    value={schedule.hour}
                    onChange={(e) => setSchedule({ ...schedule, hour: parseInt(e.target.value) })}
                    className="cyber-input text-sm w-20"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export { SECTION_TYPES, DATA_SOURCES, CHART_TYPES }
