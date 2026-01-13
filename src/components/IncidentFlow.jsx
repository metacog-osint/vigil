// Incident Flow - Sankey-style visualization of attack chains
import { useMemo } from 'react'
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts'
import { clsx } from 'clsx'

const NODE_COLORS = {
  actor: '#ef4444',
  tactic: '#8b5cf6',
  sector: '#3b82f6',
  technique: '#f59e0b',
}

// Custom node for Sankey diagram
function CustomNode({ x, y, width, height, index, payload }) {
  const color = NODE_COLORS[payload.category] || '#6b7280'

  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.9}
        rx={4}
      />
      {height > 20 && (
        <text
          x={x + width + 6}
          y={y + height / 2}
          textAnchor="start"
          dominantBaseline="middle"
          fill="#d1d5db"
          fontSize={11}
        >
          {payload.name?.length > 15 ? payload.name.slice(0, 15) + '...' : payload.name}
        </text>
      )}
    </g>
  )
}

// Custom link for Sankey
function CustomLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }) {
  const gradientId = `linkGradient${index}`
  const sourceColor = NODE_COLORS[payload.source?.category] || '#6b7280'
  const targetColor = NODE_COLORS[payload.target?.category] || '#6b7280'

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.4} />
        </linearGradient>
      </defs>
      <path
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={linkWidth}
        strokeOpacity={0.5}
        className="transition-opacity hover:stroke-opacity-80"
      />
    </g>
  )
}

export function IncidentFlow({
  actors = [],      // { name, incidents: number }
  tactics = [],     // { name, count: number }
  sectors = [],     // { name, count: number }
  flows = [],       // { source, target, value } - connections
  className = '',
}) {
  const { nodes, links } = useMemo(() => {
    // If pre-computed flows provided, use them
    if (flows.length > 0) {
      const nodeMap = new Map()

      for (const flow of flows) {
        if (!nodeMap.has(flow.source)) {
          nodeMap.set(flow.source, { name: flow.source, category: flow.sourceCategory || 'actor' })
        }
        if (!nodeMap.has(flow.target)) {
          nodeMap.set(flow.target, { name: flow.target, category: flow.targetCategory || 'sector' })
        }
      }

      const nodes = Array.from(nodeMap.values())
      const nodeIndex = new Map(nodes.map((n, i) => [n.name, i]))

      const links = flows.map(f => ({
        source: nodeIndex.get(f.source),
        target: nodeIndex.get(f.target),
        value: f.value || 1,
      }))

      return { nodes, links }
    }

    // Build from actors, tactics, sectors
    const nodes = []
    const links = []

    // Add actor nodes
    const topActors = actors.slice(0, 5)
    for (const actor of topActors) {
      nodes.push({ name: actor.name, category: 'actor' })
    }

    // Add tactic nodes
    const topTactics = tactics.slice(0, 5)
    for (const tactic of topTactics) {
      nodes.push({ name: tactic.name, category: 'tactic' })
    }

    // Add sector nodes
    const topSectors = sectors.slice(0, 5)
    for (const sector of topSectors) {
      nodes.push({ name: sector.name || sector.sector, category: 'sector' })
    }

    // Create links (actor -> tactic -> sector)
    const actorCount = topActors.length
    const tacticCount = topTactics.length

    // Actor to tactic links
    for (let a = 0; a < actorCount; a++) {
      for (let t = 0; t < tacticCount; t++) {
        // Distribute actors across tactics
        if ((a + t) % 2 === 0) {
          links.push({
            source: a,
            target: actorCount + t,
            value: topActors[a].incidents || 1,
          })
        }
      }
    }

    // Tactic to sector links
    for (let t = 0; t < tacticCount; t++) {
      for (let s = 0; s < topSectors.length; s++) {
        if ((t + s) % 2 === 0) {
          links.push({
            source: actorCount + t,
            target: actorCount + tacticCount + s,
            value: topTactics[t].count || 1,
          })
        }
      }
    }

    return { nodes, links }
  }, [actors, tactics, sectors, flows])

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-cyber-dark border border-gray-700 rounded px-3 py-2 text-sm shadow-lg">
          {data.source && data.target ? (
            <>
              <div className="text-gray-400">
                <span className="text-white">{data.source.name}</span>
                {' → '}
                <span className="text-white">{data.target.name}</span>
              </div>
              <div className="text-gray-500 mt-1">
                {data.value} connection{data.value !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <div className="text-white">{data.name}</div>
          )}
        </div>
      )
    }
    return null
  }

  if (nodes.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-64 text-gray-500', className)}>
        No flow data available
      </div>
    )
  }

  return (
    <div className={clsx('', className)}>
      <ResponsiveContainer width="100%" height={300}>
        <Sankey
          data={{ nodes, links }}
          node={<CustomNode />}
          link={<CustomLink />}
          nodePadding={30}
          nodeWidth={10}
          margin={{ top: 20, right: 100, bottom: 20, left: 20 }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        {Object.entries(NODE_COLORS).map(([category, color]) => (
          <div key={category} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-400 capitalize">{category}s</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Simplified flow chart without Sankey (fallback)
export function IncidentFlowSimple({
  stages = [], // Array of { name, count, items: [] }
  className = '',
}) {
  if (!stages || stages.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-32 text-gray-500', className)}>
        No flow data
      </div>
    )
  }

  const maxCount = Math.max(...stages.map(s => s.count || s.items?.length || 0), 1)

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {stages.map((stage, i) => {
        const count = stage.count || stage.items?.length || 0
        const height = Math.max((count / maxCount) * 100, 20)

        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            {/* Stage box */}
            <div
              className="w-full rounded-lg flex items-center justify-center text-white font-medium text-sm transition-all"
              style={{
                height: `${height}px`,
                minHeight: '40px',
                backgroundColor: NODE_COLORS[stage.category] || '#6b7280',
              }}
            >
              {count}
            </div>
            {/* Label */}
            <div className="text-xs text-gray-400 mt-2 text-center truncate w-full">
              {stage.name}
            </div>
            {/* Arrow */}
            {i < stages.length - 1 && (
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 text-gray-600">
                →
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Attack chain visualization
export function AttackChain({
  chain = [], // Array of { phase, technique, actor?, timestamp? }
  className = '',
}) {
  if (!chain || chain.length === 0) {
    return null
  }

  return (
    <div className={clsx('space-y-2', className)}>
      {chain.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          {/* Timeline dot and line */}
          <div className="flex flex-col items-center">
            <div className={clsx(
              'w-3 h-3 rounded-full',
              i === 0 ? 'bg-green-500' : i === chain.length - 1 ? 'bg-red-500' : 'bg-gray-500'
            )} />
            {i < chain.length - 1 && (
              <div className="w-0.5 h-8 bg-gray-700" />
            )}
          </div>

          {/* Step content */}
          <div className="flex-1 pb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {step.phase}
            </div>
            <div className="text-sm text-white font-medium">
              {step.technique}
            </div>
            {step.actor && (
              <div className="text-xs text-gray-400 mt-0.5">
                by {step.actor}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default IncidentFlow
