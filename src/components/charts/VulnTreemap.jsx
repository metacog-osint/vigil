// Vulnerability Treemap - hierarchical view of vulnerabilities by category
import { useMemo } from 'react'
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { clsx } from 'clsx'

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d',
  none: '#6b7280',
}

// Custom treemap cell content
function CustomContent({ root, depth, x, y, width, height, name, value, severity }) {
  if (width < 30 || height < 20) return null

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={SEVERITY_COLORS[severity?.toLowerCase()] || SEVERITY_COLORS.medium}
        stroke="#1f2937"
        strokeWidth={2}
        className="transition-opacity hover:opacity-80"
      />
      {width > 50 && height > 30 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="white"
            fontSize={12}
            fontWeight="500"
          >
            {name?.length > width / 8 ? name.slice(0, Math.floor(width / 8)) + '...' : name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="rgba(255,255,255,0.7)"
            fontSize={10}
          >
            {value}
          </text>
        </>
      )}
    </g>
  )
}

export function VulnTreemap({
  data = [], // Array of { cve_id, severity, vendor?, product?, cvss_score }
  groupBy = 'severity', // 'severity', 'vendor', 'product'
  onCellClick,
  className = '',
}) {
  const treeData = useMemo(() => {
    if (!data || data.length === 0) return []

    if (groupBy === 'severity') {
      // Group by severity
      const groups = {}
      for (const vuln of data) {
        const sev = vuln.severity?.toLowerCase() || 'medium'
        if (!groups[sev]) {
          groups[sev] = { name: sev, severity: sev, children: [] }
        }
        groups[sev].children.push({
          name: vuln.cve_id,
          value: vuln.cvss_score || 5,
          severity: sev,
          data: vuln,
        })
      }

      // Order by severity
      const order = ['critical', 'high', 'medium', 'low', 'none']
      return order
        .filter((s) => groups[s])
        .map((s) => ({
          ...groups[s],
          value: groups[s].children.reduce((sum, c) => sum + c.value, 0),
        }))
    }

    if (groupBy === 'vendor') {
      const groups = {}
      for (const vuln of data) {
        const vendor = vuln.vendor || 'Unknown'
        if (!groups[vendor]) {
          groups[vendor] = { name: vendor, children: [] }
        }
        groups[vendor].children.push({
          name: vuln.cve_id,
          value: vuln.cvss_score || 5,
          severity: vuln.severity?.toLowerCase() || 'medium',
          data: vuln,
        })
      }

      return Object.values(groups)
        .map((g) => ({
          ...g,
          value: g.children.reduce((sum, c) => sum + c.value, 0),
          severity: getMostCommonSeverity(g.children),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 20)
    }

    // Default: flat list by CVSS score
    return data.slice(0, 50).map((vuln) => ({
      name: vuln.cve_id,
      value: vuln.cvss_score || 5,
      severity: vuln.severity?.toLowerCase() || 'medium',
      data: vuln,
    }))
  }, [data, groupBy])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-cyber-dark border border-gray-700 rounded px-3 py-2 text-sm shadow-lg">
          <div className="font-medium text-white">{item.name}</div>
          {item.data?.description && (
            <div className="text-gray-400 text-xs mt-1 max-w-xs truncate">
              {item.data.description}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-400">
              CVSS: <span className="text-white">{item.value?.toFixed(1)}</span>
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded capitalize"
              style={{
                backgroundColor: SEVERITY_COLORS[item.severity] + '40',
                color: SEVERITY_COLORS[item.severity],
              }}
            >
              {item.severity}
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  if (!data || data.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-64 text-gray-500', className)}>
        No vulnerability data
      </div>
    )
  }

  return (
    <div className={clsx('', className)}>
      <ResponsiveContainer width="100%" height={300}>
        <Treemap
          data={treeData}
          dataKey="value"
          aspectRatio={4 / 3}
          stroke="#1f2937"
          content={<CustomContent />}
          onClick={(node) => onCellClick?.(node.data || node)}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs">
        {Object.entries(SEVERITY_COLORS)
          .slice(0, 4)
          .map(([sev, color]) => (
            <div key={sev} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-gray-400 capitalize">{sev}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

// Helper to get most common severity in a group
function getMostCommonSeverity(items) {
  const counts = {}
  for (const item of items) {
    counts[item.severity] = (counts[item.severity] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium'
}

// Mini version for cards
export function VulnTreemapMini({ data = [], className = '' }) {
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }

    // Handle pre-aggregated format: [{ name: 'Critical', value: 100, severity: 'critical' }]
    if (data.length > 0 && data[0].value !== undefined) {
      for (const item of data) {
        const sev = item.severity?.toLowerCase() || item.name?.toLowerCase() || 'medium'
        if (counts[sev] !== undefined) counts[sev] = item.value
      }
    } else {
      // Handle raw vulnerability array format
      for (const vuln of data) {
        const sev = vuln.severity?.toLowerCase() || 'medium'
        if (counts[sev] !== undefined) counts[sev]++
      }
    }
    return counts
  }, [data])

  const total = Object.values(severityCounts).reduce((a, b) => a + b, 0) || 1

  if (total === 0) {
    return <div className={clsx('text-center text-gray-500 text-sm py-4', className)}>No data</div>
  }

  return (
    <div className={className}>
      <div className="flex h-8 rounded overflow-hidden mb-3">
        {Object.entries(severityCounts).map(([sev, count]) => {
          const width = (count / total) * 100
          if (width === 0) return null
          return (
            <div
              key={sev}
              className="h-full transition-all flex items-center justify-center"
              style={{
                width: `${width}%`,
                backgroundColor: SEVERITY_COLORS[sev],
                minWidth: count > 0 ? '20px' : '0',
              }}
              title={`${sev}: ${count}`}
            >
              {width > 15 && <span className="text-white text-xs font-medium">{count}</span>}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        {Object.entries(severityCounts).map(([sev, count]) => (
          <div key={sev} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
            <span className="text-gray-400 capitalize">{sev}</span>
            <span className="text-gray-500">({count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VulnTreemap
